#!/usr/bin/env node
// ============================================================================
// r2-audit.mjs — read-only audit of Cloudflare R2 storage (3 buckets) vs.
// references found in the Supabase database.
//
// STRICTLY READ-ONLY: this file contains no Delete/Put/Copy R2 calls and no
// INSERT/UPDATE/DELETE SQL. Deletion of orphans/duplicates is intentionally
// NOT implemented here — this script only reports candidates for a human to
// review and remove manually.
//
// Run:
//   node scripts/maintenance/r2-audit.mjs
//
// Reads credentials from .env.local (same vars the app's own upload route /
// r2-client use: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET_NAME/R2_PUBLIC_URL, R2_IMAGES_BUCKET_NAME/R2_IMAGES_PUBLIC_URL,
// R2_HTML_GAMES_BUCKET_NAME/R2_HTML_GAMES_PUBLIC_URL, and for DB access
// NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, same pair as
// scripts/seed.mjs). No secret value is ever printed or written to a report.
//
// Reports are written OUTSIDE the repo, to ~/Desktop/r2-audit/:
//   summary.md, orphans.csv, duplicates.csv, references-missing.csv
//
// Schema source for the DB scan: the Supabase REST API (PostgREST) only
// exposes the "public" schema's own tables — information_schema is not in
// the exposed-schemas list and there is no generic SQL-exec RPC function in
// this project (only narrow, purpose-built RPCs). Querying information_schema
// live is therefore not possible without adding a DB function, which would be
// a migration — out of scope ("no database migration"). Instead this script
// derives the authoritative table/column list by statically parsing
// supabase/migrations/*.sql (the single source of truth for schema in this
// repo), picking out "create table" and "alter table ... add/drop column"
// statements, and keeping only text/varchar/jsonb columns. It then performs
// plain SELECT (read-only) calls against those tables/columns via the
// service-role Supabase client.
// ============================================================================

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(homedir(), "Desktop", "r2-audit");
const RECENT_DAYS = 14;

// ----------------------------------------------------------------------------
// .env.local loading (no new dependency — same files the app already reads,
// just parsed by hand here since this is a standalone node script, not Next.js)
// ----------------------------------------------------------------------------
function loadEnvLocal() {
  const envPath = path.join(REPO_ROOT, ".env.local");
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

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} не задано в .env.local`);
  return v;
}

// ----------------------------------------------------------------------------
// R2 (S3-compatible) listing via aws4fetch — same library/client shape as
// src/lib/r2-client.ts, but used for signed GET (ListObjectsV2) instead of a
// signed PUT URL. No @aws-sdk/client-s3 needed for a single read operation.
// ----------------------------------------------------------------------------
function getR2Client() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" }),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
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

async function listAllObjects(bucket) {
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

// ----------------------------------------------------------------------------
// Schema discovery: parse supabase/migrations/*.sql for create/alter table
// statements, keep only text/varchar/jsonb columns (candidates for holding an
// R2 key or URL). See file header for why this replaces a live
// information_schema query.
// ----------------------------------------------------------------------------
const TEXTY_TYPE = /\b(text|varchar|character varying|jsonb|json|citext)\b/i;

function stripSqlComments(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseSchemaFromMigrations() {
  const migrationsDir = path.join(REPO_ROOT, "supabase", "migrations");
  const files = listSqlFiles(migrationsDir).sort();
  // table -> { columns: Set<column>, pk: string }
  const schema = new Map();

  for (const file of files) {
    const sql = stripSqlComments(readFileSync(path.join(migrationsDir, file), "utf8"));

    // CREATE TABLE public.<name> ( ...columns... );
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
          // table-level: primary key (col[, col2])
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

    // DROP TABLE public.<name>;
    const dropTableRe = /drop\s+table\s+(?:if\s+exists\s+)?public\.(\w+)\s*(?:cascade)?\s*;/gi;
    while ((m = dropTableRe.exec(sql))) {
      schema.delete(m[1]);
    }

    // ALTER TABLE public.<name> ADD COLUMN [IF NOT EXISTS] <col> <type> ...;
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

    // ALTER TABLE public.<name> DROP COLUMN [IF EXISTS] <col>;
    const dropColRe = /alter\s+table\s+public\.(\w+)\s+drop\s+column\s+(?:if\s+exists\s+)?(\w+)\s*;/gi;
    while ((m = dropColRe.exec(sql))) {
      const [, table, col] = m;
      schema.get(table)?.columns.delete(col);
    }
  }

  return schema;
}

function listSqlFiles(dir) {
  return readdirSync(dir).filter((f) => f.endsWith(".sql"));
}

// Splits a CREATE TABLE body on top-level commas (ignoring commas nested
// inside parens, e.g. numeric(10, 2) or check (... in (...))).
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

// ----------------------------------------------------------------------------
// DB reference scan: for every (table, text/jsonb column), page through rows
// (SELECT id, <column> only) and check whether any R2 key or public URL
// appears in the stringified value.
// ----------------------------------------------------------------------------
async function scanDbReferences(supabase, schema, keyToInfo) {
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
        // Table might not actually exist under this name, or RLS restricts the
        // service role in some unusual way — report and skip, don't crash the
        // whole audit over one table.
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

// For a given text blob, find mentions of any known R2 key (as a bare key or
// inside a public URL) and invoke onHit(key) for each match (deduped per call).
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

// ----------------------------------------------------------------------------
// Also collect every R2-looking URL/key mentioned in the DB, to detect
// references pointing at objects that do NOT exist in R2 (broken links) —
// requires a separate pass with a broader URL regex (not limited to keys we
// already found in R2).
// ----------------------------------------------------------------------------
function buildUrlRegexes(buckets) {
  const bases = buckets.map((b) => b.publicUrl.replace(/\/$/, "")).filter(Boolean);
  const escaped = bases.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?:${escaped.join("|")})/([A-Za-z0-9._\\-]+)`, "g");
}

async function scanDbForAllR2Urls(supabase, schema, bucketsByPublicUrl, urlRegex) {
  // key -> [{table, column, id, publicUrl}]
  const mentions = new Map();
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
      if (error) break;
      if (!data || data.length === 0) break;

      for (const row of data) {
        for (const col of columns) {
          if (col === pk) continue;
          const raw = row[col];
          if (raw === null || raw === undefined) continue;
          const text = typeof raw === "string" ? raw : JSON.stringify(raw);
          let match;
          const re = new RegExp(urlRegex.source, "g");
          while ((match = re.exec(text))) {
            const fullUrl = match[0];
            const key = match[1];
            const publicUrl = Object.keys(bucketsByPublicUrl).find((base) => fullUrl.startsWith(base));
            const mapKey = `${publicUrl}/${key}`;
            const list = mentions.get(mapKey) || [];
            list.push({ table, column: col, id: row[pk], key, publicUrl });
            mentions.set(mapKey, list);
          }
        }
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  return mentions;
}

// ----------------------------------------------------------------------------
// CSV helpers
// ----------------------------------------------------------------------------
function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  loadEnvLocal();
  mkdirSync(OUT_DIR, { recursive: true });

  const buckets = [
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

  console.log("1/4 Listing R2 buckets...");
  const allObjects = []; // {label, bucket, key, size, etag, lastModified, publicUrl}
  for (const b of buckets) {
    const objs = await listAllObjects(b.bucket);
    console.log(`  ${b.label} (${b.bucket}): ${objs.length} objects`);
    for (const o of objs) {
      allObjects.push({ ...o, label: b.label, bucket: b.bucket, publicUrl: b.publicUrl });
    }
  }

  // key -> {publicUrl} map for the "does this text mention a known object" scan
  const keyToInfo = new Map();
  for (const o of allObjects) keyToInfo.set(o.key, { publicUrl: o.publicUrl });

  console.log("2/4 Parsing DB schema from supabase/migrations/*.sql...");
  const schema = parseSchemaFromMigrations();
  const totalCols = [...schema.values()].reduce((sum, s) => sum + s.columns.size, 0);
  console.log(`  tables: ${schema.size}, text/varchar/jsonb columns: ${totalCols}`);

  console.log("3/4 Scanning DB for references to known R2 keys (service-role Supabase client)...");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const refs = await scanDbReferences(supabase, schema, keyToInfo);

  console.log("4/4 Scanning DB for ALL R2-looking URLs (to find broken references)...");
  const urlRegex = buildUrlRegexes(buckets);
  const bucketsByPublicUrl = Object.fromEntries(buckets.map((b) => [b.publicUrl, b]));
  const allMentions = await scanDbForAllR2Urls(supabase, schema, bucketsByPublicUrl, urlRegex);

  // ---- classify ----
  const now = Date.now();
  const recentCutoffMs = RECENT_DAYS * 24 * 60 * 60 * 1000;

  const referenced = [];
  const orphanCandidates = [];
  const recentSkipped = [];

  for (const o of allObjects) {
    const isReferenced = refs.has(o.key);
    if (isReferenced) {
      referenced.push(o);
      continue;
    }
    const ageMs = now - new Date(o.lastModified).getTime();
    if (ageMs < recentCutoffMs) {
      recentSkipped.push(o);
    } else {
      orphanCandidates.push(o);
    }
  }

  // leftover-looking: large video files in task-audio bucket that are unreferenced
  const leftoverVideoCandidates = orphanCandidates.filter(
    (o) => o.label === "task-audio" && /\.(mp4|mov|webm|mkv)$/i.test(o.key) && o.size > 5 * 1024 * 1024
  );

  // duplicate groups: same bucket + size + etag
  const groups = new Map(); // groupKey -> objects[]
  for (const o of allObjects) {
    const groupKey = `${o.bucket}::${o.size}::${o.etag}`;
    const list = groups.get(groupKey) || [];
    list.push(o);
    groups.set(groupKey, list);
  }
  const duplicateGroups = [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([groupKey, list], idx) => {
      const unverified = list.some((o) => o.etag.includes("-"));
      const sortedByDate = [...list].sort(
        (a, b) => new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
      );
      const referencedOnes = list.filter((o) => refs.has(o.key));
      const keeper = referencedOnes[0] || sortedByDate[0];
      const wastedBytes = list.reduce((sum, o) => sum + o.size, 0) - keeper.size;
      return {
        groupId: idx + 1,
        groupKey,
        items: list,
        unverified,
        keeper,
        wastedBytes,
      };
    })
    .sort((a, b) => b.wastedBytes - a.wastedBytes);

  // references pointing to missing objects
  const existingKeysByBucketPublicUrl = new Set(allObjects.map((o) => `${o.publicUrl}/${o.key}`));
  const missingRefs = [];
  for (const [mapKey, mentionList] of allMentions) {
    if (existingKeysByBucketPublicUrl.has(mapKey)) continue;
    for (const m of mentionList) {
      missingRefs.push({ ...m, mapKey });
    }
  }

  // ---- write reports ----
  console.log("Writing reports to", OUT_DIR);

  const orphansCsvRows = [["bucket", "key", "size", "lastModified", "publicUrl"]];
  for (const o of orphanCandidates) {
    orphansCsvRows.push([o.label, o.key, o.size, o.lastModified, `${o.publicUrl}/${o.key}`]);
  }
  writeFileSync(path.join(OUT_DIR, "orphans.csv"), toCsv(orphansCsvRows));

  const duplicatesCsvRows = [
    ["groupId", "bucket", "key", "size", "etag", "referenced", "referencedBy", "proposedKeeper"],
  ];
  for (const g of duplicateGroups) {
    for (const o of g.items) {
      const refList = refs.get(o.key) || [];
      duplicatesCsvRows.push([
        g.groupId,
        o.label,
        o.key,
        o.size,
        g.unverified ? `${o.etag} (unverified: multipart)` : o.etag,
        refList.length > 0 ? "yes" : "no",
        refList.map((r) => `${r.table}.${r.column}#${r.id}`).join(" | "),
        o.key === g.keeper.key ? "yes" : "no",
      ]);
    }
  }
  writeFileSync(path.join(OUT_DIR, "duplicates.csv"), toCsv(duplicatesCsvRows));

  const missingCsvRows = [["table", "column", "rowId", "missingUrl"]];
  for (const m of missingRefs) {
    missingCsvRows.push([m.table, m.column, m.id, `${m.publicUrl}/${m.key}`]);
  }
  writeFileSync(path.join(OUT_DIR, "references-missing.csv"), toCsv(missingCsvRows));

  const byBucket = buckets.map((b) => {
    const objs = allObjects.filter((o) => o.label === b.label);
    const ref = objs.filter((o) => refs.has(o.key));
    const orphan = orphanCandidates.filter((o) => o.label === b.label);
    const recent = recentSkipped.filter((o) => o.label === b.label);
    return {
      label: b.label,
      count: objs.length,
      bytes: objs.reduce((s, o) => s + o.size, 0),
      refCount: ref.length,
      refBytes: ref.reduce((s, o) => s + o.size, 0),
      orphanCount: orphan.length,
      orphanBytes: orphan.reduce((s, o) => s + o.size, 0),
      recentCount: recent.length,
      recentBytes: recent.reduce((s, o) => s + o.size, 0),
    };
  });

  const totalWasted = duplicateGroups.reduce((s, g) => s + g.wastedBytes, 0);

  const biggestOrphans = [...orphanCandidates].sort((a, b) => b.size - a.size).slice(0, 20);
  const biggestDupGroups = [...duplicateGroups].slice(0, 20);

  const lines = [];
  lines.push("# R2 audit summary");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Recent-skip threshold: objects newer than ${RECENT_DAYS} days are excluded from orphan candidates.`);
  lines.push("");
  lines.push("## Per bucket");
  lines.push("");
  for (const b of byBucket) {
    lines.push(`### ${b.label}`);
    lines.push(`- Total: ${b.count} objects, ${fmtBytes(b.bytes)}`);
    lines.push(`- Referenced: ${b.refCount} objects, ${fmtBytes(b.refBytes)}`);
    lines.push(`- Orphan candidates (>${RECENT_DAYS}d, unreferenced): ${b.orphanCount} objects, ${fmtBytes(b.orphanBytes)}`);
    lines.push(`- Recent, skipped (<${RECENT_DAYS}d, unreferenced): ${b.recentCount} objects, ${fmtBytes(b.recentBytes)}`);
    lines.push("");
  }

  lines.push("## Duplicate groups");
  lines.push("");
  lines.push(`- Groups found: ${duplicateGroups.length}`);
  lines.push(`- Total wasted bytes (sum of group size minus one keeper per group): ${fmtBytes(totalWasted)}`);
  lines.push("");

  lines.push("## Leftover-looking files");
  lines.push("");
  lines.push(
    `- Large (>5MB) unreferenced video files in task-audio (likely pre-re-encode leftovers): ${leftoverVideoCandidates.length}`
  );
  for (const o of leftoverVideoCandidates.slice(0, 20)) {
    lines.push(`  - ${o.key} — ${fmtBytes(o.size)} — last modified ${o.lastModified}`);
  }
  lines.push("");

  lines.push("## Broken references");
  lines.push("");
  lines.push(`- DB references pointing to keys that do NOT exist in R2: ${missingRefs.length}`);
  lines.push("");

  lines.push("## Biggest 20 orphans");
  lines.push("");
  for (const o of biggestOrphans) {
    lines.push(`- [${o.label}] ${o.key} — ${fmtBytes(o.size)} — last modified ${o.lastModified}`);
  }
  lines.push("");

  lines.push("## Biggest 20 duplicate groups");
  lines.push("");
  for (const g of biggestDupGroups) {
    const refdCount = g.items.filter((o) => refs.has(o.key)).length;
    lines.push(
      `- Group #${g.groupId}: ${g.items.length} copies, wasted ${fmtBytes(g.wastedBytes)}${
        g.unverified ? " (unverified: multipart ETag)" : ""
      }, referenced copies: ${refdCount}/${g.items.length}, proposed keeper: ${g.keeper.key}`
    );
  }
  lines.push("");

  writeFileSync(path.join(OUT_DIR, "summary.md"), lines.join("\n") + "\n");

  console.log("Done. Reports written to:", OUT_DIR);
  console.log(`  objects: ${allObjects.length}, orphan candidates: ${orphanCandidates.length}, duplicate groups: ${duplicateGroups.length}, broken refs: ${missingRefs.length}`);
}

main().catch((err) => {
  console.error("r2-audit failed:", err.message);
  process.exit(1);
});
