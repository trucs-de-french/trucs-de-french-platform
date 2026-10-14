// ============================================================================
// r2-lib.mjs — shared, READ-ONLY helpers for the R2 maintenance scripts
// (r2-audit.mjs, r2-cleanup.mjs). No Delete/Put object calls live here on
// purpose, so importing this module can never give a script write access to
// R2 by accident — write operations (PUT/DELETE) are implemented directly in
// r2-cleanup.mjs, where they are easy to audit in one place.
// ============================================================================

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { AwsClient } from "aws4fetch";

export function loadEnvLocal(repoRoot) {
  const envPath = path.join(repoRoot, ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local не знайдено в корені репозиторію");
  }
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} не задано в .env.local`);
  return v;
}

export function buildBuckets() {
  return [
    {
      label: "task-audio",
      bucket: requireEnv("R2_BUCKET_NAME"),
      publicUrl: requireEnv("R2_PUBLIC_URL").replace(/\/$/, ""),
    },
    {
      label: "task-images",
      bucket: requireEnv("R2_IMAGES_BUCKET_NAME"),
      publicUrl: requireEnv("R2_IMAGES_PUBLIC_URL").replace(/\/$/, ""),
    },
    {
      label: "task-html-games",
      bucket: requireEnv("R2_HTML_GAMES_BUCKET_NAME"),
      publicUrl: requireEnv("R2_HTML_GAMES_PUBLIC_URL").replace(/\/$/, ""),
    },
  ];
}

// ----------------------------------------------------------------------------
// R2 (S3-compatible) client + read-only operations via aws4fetch — same
// library/shape as src/lib/r2-client.ts.
// ----------------------------------------------------------------------------
export function getR2Client() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" }),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export function objectUrl(endpoint, bucket, key) {
  return `${endpoint}/${bucket}/${encodeURIComponent(key)}`;
}

function xmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1] : null;
}

// Minimal purpose-built XML scraping for ListObjectsV2 responses — not a
// general XML parser, just enough for the fixed <Contents>/<ListBucketResult>
// shape S3-compatible APIs return, to avoid a new dependency for one shape.
function parseListObjectsV2(xml) {
  const contents = [];
  const contentsBlocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) || [];
  for (const block of contentsBlocks) {
    contents.push({
      key: xmlTag(block, "Key"),
      size: Number(xmlTag(block, "Size") || "0"),
      etag: (xmlTag(block, "ETag") || "").replace(/^"|"$/g, ""),
      lastModified: xmlTag(block, "LastModified"),
    });
  }
  const isTruncated = xmlTag(xml, "IsTruncated") === "true";
  const nextToken = xmlTag(xml, "NextContinuationToken");
  return { contents, isTruncated, nextToken };
}

export async function listAllObjects(bucket) {
  const { client, endpoint } = getR2Client();
  const objects = [];
  let continuationToken = null;
  for (;;) {
    const params = new URLSearchParams({ "list-type": "2", "max-keys": "1000" });
    if (continuationToken) params.set("continuation-token", continuationToken);
    const url = `${endpoint}/${bucket}?${params.toString()}`;
    const res = await client.fetch(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`R2 ListObjectsV2 для "${bucket}" впав: HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    const xml = await res.text();
    const { contents, isTruncated, nextToken } = parseListObjectsV2(xml);
    objects.push(...contents);
    if (!isTruncated || !nextToken) break;
    continuationToken = nextToken;
  }
  return objects;
}

// HEAD — existence + metadata only, no body transfer. Returns null on 404.
export async function headObject(bucket, key) {
  const { client, endpoint } = getR2Client();
  const res = await client.fetch(objectUrl(endpoint, bucket, key), { method: "HEAD" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`R2 HEAD ${bucket}/${key} впав: HTTP ${res.status}`);
  }
  return {
    size: Number(res.headers.get("content-length") || "0"),
    contentType: res.headers.get("content-type") || "application/octet-stream",
    etag: (res.headers.get("etag") || "").replace(/^"|"$/g, ""),
    lastModified: res.headers.get("last-modified"),
  };
}

// GET — full object body, for backup. Returns null on 404.
export async function getObject(bucket, key) {
  const { client, endpoint } = getR2Client();
  const res = await client.fetch(objectUrl(endpoint, bucket, key), { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`R2 GET ${bucket}/${key} впав: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    buffer,
    size: Number(res.headers.get("content-length") || String(buffer.length)),
    contentType: res.headers.get("content-type") || "application/octet-stream",
    etag: (res.headers.get("etag") || "").replace(/^"|"$/g, ""),
    lastModified: res.headers.get("last-modified"),
  };
}

// ----------------------------------------------------------------------------
// Schema discovery: parse supabase/migrations/*.sql for create/alter/drop
// table statements, keep only text/varchar/jsonb columns (candidates for
// holding an R2 key or URL).
//
// Why not a live information_schema query: Supabase's PostgREST API only
// exposes the "public" (and graphql_public) schema — information_schema is
// not reachable through it, and this project has no generic SQL-exec RPC
// (only narrow, purpose-built ones like copy_task/duplicate_scene). Adding
// one would itself be a migration, which is out of scope for a read-only
// audit/cleanup tool. supabase/migrations/*.sql is the single source of
// truth for schema in this repo, so it is parsed statically instead.
// ----------------------------------------------------------------------------
const TEXTY_TYPE = /\b(text|varchar|character varying|jsonb|json|citext)\b/i;

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitTopLevelCommas(body) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function listSqlFiles(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".sql"));
}

export function parseSchemaFromMigrations(repoRoot) {
  const migrationsDir = path.join(repoRoot, "supabase", "migrations");
  const files = listSqlFiles(migrationsDir).sort();
  // table -> { columns: Set<column>, pk: string }
  const schema = new Map();

  for (const file of files) {
    const sql = stripSqlComments(readFileSync(path.join(migrationsDir, file), "utf8"));

    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\s*\(([\s\S]*?)\)\s*;/gi;
    let m;
    while ((m = createRe.exec(sql))) {
      const table = m[1];
      const body = m[2];
      const entry = schema.get(table) || { columns: new Set(), pk: "id" };
      for (const colLine of splitTopLevelCommas(body)) {
        const trimmed = colLine.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (lower.startsWith("primary key")) {
          const pkMatch = trimmed.match(/primary\s+key\s*\(([^)]+)\)/i);
          if (pkMatch) entry.pk = pkMatch[1].split(",")[0].trim();
          continue;
        }
        if (
          lower.startsWith("unique") ||
          lower.startsWith("check") ||
          lower.startsWith("foreign key") ||
          lower.startsWith("constraint")
        ) {
          continue;
        }
        const colMatch = trimmed.match(/^(\w+)\s+(.+)$/s);
        if (!colMatch) continue;
        const [, colName, rest] = colMatch;
        if (/primary\s+key/i.test(rest)) entry.pk = colName;
        if (TEXTY_TYPE.test(rest)) entry.columns.add(colName);
      }
      schema.set(table, entry);
    }

    const dropTableRe = /drop\s+table\s+(?:if\s+exists\s+)?public\.(\w+)\s*(?:cascade)?\s*;/gi;
    while ((m = dropTableRe.exec(sql))) {
      schema.delete(m[1]);
    }

    const addColRe =
      /alter\s+table\s+public\.(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+([^,;]+)[,;]/gi;
    while ((m = addColRe.exec(sql))) {
      const [, table, col, type] = m;
      if (TEXTY_TYPE.test(type)) {
        const entry = schema.get(table) || { columns: new Set(), pk: "id" };
        entry.columns.add(col);
        schema.set(table, entry);
      }
    }

    const dropColRe = /alter\s+table\s+public\.(\w+)\s+drop\s+column\s+(?:if\s+exists\s+)?(\w+)\s*;/gi;
    while ((m = dropColRe.exec(sql))) {
      const [, table, col] = m;
      schema.get(table)?.columns.delete(col);
    }
  }

  return schema;
}

// ----------------------------------------------------------------------------
// DB reference scan: for every (table, text/jsonb column), page through rows
// (SELECT pk, <column> only) and check whether any known R2 key or its
// public URL appears in the stringified value. keyToInfo: Map<key, {publicUrl}>
// ----------------------------------------------------------------------------
function findKeyMentions(text, keyToInfo, onHit) {
  if (!text) return;
  const seen = new Set();
  for (const [key, info] of keyToInfo) {
    if (seen.has(key)) continue;
    if (text.includes(key) || (info.publicUrl && text.includes(`${info.publicUrl}/${key}`))) {
      onHit(key);
      seen.add(key);
    }
  }
}

export async function scanDbReferences(supabase, schema, keyToInfo) {
  // key -> [{table, column, id}]
  const refs = new Map();
  const tables = [...schema.keys()].sort();
  const pageSize = 500;

  for (const table of tables) {
    const entry = schema.get(table);
    const columns = [...(entry?.columns || [])];
    if (columns.length === 0) continue;
    const pk = entry.pk;
    const selectCols = [pk, ...columns.filter((c) => c !== pk)].join(",");

    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select(selectCols)
        .range(from, from + pageSize - 1);
      if (error) {
        console.warn(`[WARN] SELECT ${table}(${selectCols}) помилка: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        for (const col of columns) {
          if (col === pk) continue;
          const raw = row[col];
          if (raw === null || raw === undefined) continue;
          const text = typeof raw === "string" ? raw : JSON.stringify(raw);
          findKeyMentions(text, keyToInfo, (key) => {
            const list = refs.get(key) || [];
            list.push({ table, column: col, id: row[pk] });
            refs.set(key, list);
          });
        }
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  return refs;
}

// ----------------------------------------------------------------------------
// CSV helpers
// ----------------------------------------------------------------------------
export function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

export function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCsv(text) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
