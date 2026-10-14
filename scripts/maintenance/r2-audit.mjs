#!/usr/bin/env node
// ============================================================================
// r2-audit.mjs — read-only audit of Cloudflare R2 storage (3 buckets) vs.
// references found in the Supabase database.
//
// STRICTLY READ-ONLY: this file contains no Delete/Put/Copy R2 calls and no
// INSERT/UPDATE/DELETE SQL (same for the shared r2-lib.mjs it imports).
// Deletion of orphans/duplicates is intentionally NOT implemented here —
// this script only reports candidates for a human to review. For an actual
// (also-careful) delete flow see scripts/maintenance/r2-cleanup.mjs.
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
// See r2-lib.mjs for why the DB column list is parsed from
// supabase/migrations/*.sql instead of a live information_schema query.
// ============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  loadEnvLocal,
  requireEnv,
  buildBuckets,
  listAllObjects,
  parseSchemaFromMigrations,
  scanDbReferences,
  toCsv,
  fmtBytes,
} from "./r2-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(homedir(), "Desktop", "r2-audit");
const RECENT_DAYS = 14;

// ----------------------------------------------------------------------------
// Also collect every R2-looking URL/key mentioned in the DB, to detect
// references pointing at objects that do NOT exist in R2 (broken links) —
// a separate pass with a broader URL regex (not limited to keys we already
// found in R2).
// ----------------------------------------------------------------------------
function buildUrlRegex(buckets) {
  const bases = buckets.map((b) => b.publicUrl.replace(/\/$/, "")).filter(Boolean);
  const escaped = bases.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?:${escaped.join("|")})/([A-Za-z0-9._\\-]+)`, "g");
}

async function scanDbForAllR2Urls(supabase, schema, bucketsByPublicUrl, urlRegex) {
  // key -> [{table, column, id, key, publicUrl}]
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

async function main() {
  loadEnvLocal(REPO_ROOT);
  mkdirSync(OUT_DIR, { recursive: true });

  const buckets = buildBuckets();

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
  const schema = parseSchemaFromMigrations(REPO_ROOT);
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
  const urlRegex = buildUrlRegex(buckets);
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
