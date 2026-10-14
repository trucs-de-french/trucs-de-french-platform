#!/usr/bin/env node
// ============================================================================
// r2-cleanup.mjs — safe, teacher-approved deletion of ORPHAN files found by
// scripts/maintenance/r2-audit.mjs. Reuses r2-lib.mjs for credentials, R2
// listing/HEAD/GET and the DB-reference scan; the only Put/Delete R2 calls in
// either script live here, so write access is easy to audit in one place.
//
// RUN IN THIS ORDER (one command per step, review the output each time):
//
//   1. node scripts/maintenance/r2-cleanup.mjs
//      First run with no approved-delete.csv yet: creates
//      ~/Desktop/r2-audit/approved-delete.csv from orphans.csv and stops.
//      Open it and delete any row you do NOT want removed, then re-run.
//
//   2. node scripts/maintenance/r2-cleanup.mjs --backup
//      Downloads every approved key to ~/Desktop/r2-backup/<bucket>/<key>
//      and records size/etag/contentType in ~/Desktop/r2-backup/manifest.json.
//
//   3. node scripts/maintenance/r2-cleanup.mjs
//      Dry run again (default mode) — prints/writes the delete plan (counts
//      and bytes per bucket). Deletes and backs up nothing. Re-check the plan.
//
//   4. node scripts/maintenance/r2-cleanup.mjs --execute [--min-age-days=14]
//      Requires a verified backup of every approved key. Re-checks DB
//      references once at the start, then per key: re-checks existence +
//      age, deletes with a single DeleteObject, and logs the action to
//      ~/Desktop/r2-audit/cleanup-log.csv.
//
//   Undo: node scripts/maintenance/r2-cleanup.mjs --restore
//      Re-uploads every backed-up file from ~/Desktop/r2-backup back to its
//      original bucket/key with its original content type. Does not touch
//      the database.
//
// More than 300 rows in approved-delete.csv requires an extra --i-know flag
// (hard-coded refusal otherwise, to force a human to notice a huge batch).
//
// Never deletes anything outside approved-delete.csv, never deletes when the
// DB reference scan fails or returns zero tables, and never prints secrets.
// Backups, logs, manifests and reports are written OUTSIDE the repo (under
// ~/Desktop) and are never added to git.
// ============================================================================

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  loadEnvLocal,
  buildBuckets,
  getR2Client,
  objectUrl,
  listAllObjects,
  headObject,
  getObject,
  parseSchemaFromMigrations,
  scanDbReferences,
  toCsv,
  parseCsv,
  fmtBytes,
} from "./r2-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const AUDIT_DIR = path.join(homedir(), "Desktop", "r2-audit");
const APPROVED_PATH = path.join(AUDIT_DIR, "approved-delete.csv");
const ORPHANS_PATH = path.join(AUDIT_DIR, "orphans.csv");
const PLAN_PATH = path.join(AUDIT_DIR, "cleanup-plan.md");
const LOG_PATH = path.join(AUDIT_DIR, "cleanup-log.csv");

const BACKUP_DIR = path.join(homedir(), "Desktop", "r2-backup");
const MANIFEST_PATH = path.join(BACKUP_DIR, "manifest.json");

const MAX_APPROVED_WITHOUT_FLAG = 300;
const DEFAULT_MIN_AGE_DAYS = 14;

// ----------------------------------------------------------------------------
// R2 write operations (the ONLY place in these two scripts that can mutate
// R2) — PUT (restore) and a single-object DELETE (execute). Both signed the
// same way as the read helpers in r2-lib.mjs, via aws4fetch.
// ----------------------------------------------------------------------------
async function putObject(bucket, key, buffer, contentType) {
  const { client, endpoint } = getR2Client();
  return client.fetch(objectUrl(endpoint, bucket, key), {
    method: "PUT",
    headers: { "Content-Type": contentType || "application/octet-stream" },
    body: buffer,
  });
}

async function deleteObject(bucket, key) {
  const { client, endpoint } = getR2Client();
  return client.fetch(objectUrl(endpoint, bucket, key), { method: "DELETE" });
}

// ----------------------------------------------------------------------------
// Approved list
// ----------------------------------------------------------------------------
function ensureApprovedList() {
  if (existsSync(APPROVED_PATH)) return;
  if (!existsSync(ORPHANS_PATH)) {
    throw new Error(
      `Не знайдено ні ${APPROVED_PATH}, ні ${ORPHANS_PATH}. Спершу запустіть node scripts/maintenance/r2-audit.mjs.`
    );
  }
  const { header, rows } = parseCsv(readFileSync(ORPHANS_PATH, "utf8"));
  const bucketIdx = header.indexOf("bucket");
  const keyIdx = header.indexOf("key");
  if (bucketIdx === -1 || keyIdx === -1) {
    throw new Error(`${ORPHANS_PATH} не має колонок bucket,key — неочікуваний формат.`);
  }
  const outRows = [["bucket", "key"], ...rows.map((r) => [r[bucketIdx], r[keyIdx]])];
  writeFileSync(APPROVED_PATH, toCsv(outRows));
  console.log(`Створено ${APPROVED_PATH} (${rows.length} рядків) — копія orphans.csv (лише bucket,key).`);
  console.log("Перегляньте файл, видаліть рядки, які НЕ потрібно видаляти з R2, і запустіть скрипт знову.");
  process.exit(0);
}

function readApprovedList() {
  const { header, rows } = parseCsv(readFileSync(APPROVED_PATH, "utf8"));
  const bucketIdx = header.indexOf("bucket");
  const keyIdx = header.indexOf("key");
  if (bucketIdx === -1 || keyIdx === -1) {
    throw new Error(`${APPROVED_PATH} має мати колонки bucket,key.`);
  }
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const bucket = r[bucketIdx]?.trim();
    const key = r[keyIdx]?.trim();
    if (!bucket || !key) continue;
    const dedupeKey = `${bucket}/${key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ bucket, key });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Dry run (default mode) — no backup, no delete.
// ----------------------------------------------------------------------------
async function runDryRun(rows, buckets) {
  console.log(`Dry run: ${rows.length} схвалених рядків у ${APPROVED_PATH}.`);

  const listByBucket = new Map();
  for (const b of new Set(rows.map((r) => r.bucket))) {
    listByBucket.set(b, await listAllObjectsMap(b));
  }

  const perBucket = new Map();
  const notFound = [];
  for (const row of rows) {
    const obj = listByBucket.get(row.bucket)?.get(row.key);
    if (!obj) {
      notFound.push(row);
      continue;
    }
    const agg = perBucket.get(row.bucket) || { count: 0, bytes: 0 };
    agg.count += 1;
    agg.bytes += obj.size;
    perBucket.set(row.bucket, agg);
  }

  const lines = [];
  lines.push("# R2 cleanup plan (dry run)");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Approved rows: ${rows.length}`);
  lines.push("");
  lines.push("## Per bucket (if approved list is executed as-is)");
  lines.push("");
  for (const b of buckets) {
    const agg = perBucket.get(b.bucket) || { count: 0, bytes: 0 };
    lines.push(`- ${b.label} (${b.bucket}): ${agg.count} objects, ${fmtBytes(agg.bytes)}`);
  }
  lines.push("");
  lines.push(`## Approved keys not found in R2 (already gone?): ${notFound.length}`);
  lines.push("");
  for (const row of notFound.slice(0, 50)) {
    lines.push(`- [${row.bucket}] ${row.key}`);
  }
  lines.push("");

  writeFileSync(PLAN_PATH, lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  console.log(`Plan written to ${PLAN_PATH}. Nothing was deleted or backed up.`);
}

async function listAllObjectsMap(bucket) {
  const objs = await listAllObjects(bucket);
  return new Map(objs.map((o) => [o.key, o]));
}

// ----------------------------------------------------------------------------
// Backup
// ----------------------------------------------------------------------------
function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return {};
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function runBackup(rows) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const manifest = loadManifest();

  let backedUp = 0;
  let skippedAlready = 0;
  let missing = 0;

  for (const { bucket, key } of rows) {
    const manifestKey = `${bucket}/${key}`;
    const head = await headObject(bucket, key);
    if (!head) {
      console.warn(`[WARN] ${manifestKey}: не знайдено в R2, пропуск backup.`);
      missing++;
      continue;
    }

    const localDir = path.join(BACKUP_DIR, bucket);
    const localPath = path.join(localDir, key);

    if (existsSync(localPath) && statSync(localPath).size === head.size) {
      skippedAlready++;
      manifest[manifestKey] = {
        bucket,
        key,
        size: head.size,
        etag: head.etag,
        contentType: head.contentType,
        backedUpAt: manifest[manifestKey]?.backedUpAt || new Date().toISOString(),
      };
      continue;
    }

    const obj = await getObject(bucket, key);
    if (!obj) {
      console.warn(`[WARN] ${manifestKey}: зник між HEAD і GET, пропуск.`);
      missing++;
      continue;
    }

    mkdirSync(localDir, { recursive: true });
    writeFileSync(localPath, obj.buffer);
    const writtenSize = statSync(localPath).size;
    if (writtenSize !== head.size) {
      throw new Error(
        `Backup mismatch для ${manifestKey}: R2 size=${head.size}, завантажено=${writtenSize}. Зупинено — перевірте мережу/диск і запустіть --backup знову.`
      );
    }

    manifest[manifestKey] = {
      bucket,
      key,
      size: head.size,
      etag: head.etag,
      contentType: head.contentType,
      backedUpAt: new Date().toISOString(),
    };
    saveManifest(manifest);
    backedUp++;
  }

  saveManifest(manifest);
  console.log(
    `Backup завершено: нові копії ${backedUp}, вже були з тим самим розміром ${skippedAlready}, відсутні в R2 ${missing}.`
  );
  console.log(`Backup lives at ${BACKUP_DIR}, manifest at ${MANIFEST_PATH}.`);
}

// ----------------------------------------------------------------------------
// Execute
// ----------------------------------------------------------------------------
function appendLog(row) {
  if (!existsSync(LOG_PATH)) {
    writeFileSync(LOG_PATH, toCsv([["timestamp", "bucket", "key", "size", "action", "result"]]));
  }
  appendFileSync(LOG_PATH, toCsv([[row.timestamp, row.bucket, row.key, row.size ?? "", row.action, row.result]]));
}

async function runExecute(rows, minAgeDays) {
  // 1) Every approved key must have a verified backup (size match on disk).
  const manifest = loadManifest();
  const missingBackup = [];
  for (const { bucket, key } of rows) {
    const manifestKey = `${bucket}/${key}`;
    const entry = manifest[manifestKey];
    const localPath = path.join(BACKUP_DIR, bucket, key);
    if (!entry || !existsSync(localPath) || statSync(localPath).size !== entry.size) {
      missingBackup.push(manifestKey);
    }
  }
  if (missingBackup.length > 0) {
    console.error(
      `Відмова: у ${missingBackup.length} з ${rows.length} схвалених ключів немає підтвердженого backup. Запустіть --backup спершу. Приклади:`
    );
    for (const k of missingBackup.slice(0, 20)) console.error(`  - ${k}`);
    process.exit(1);
  }

  // 2) Re-check DB references ONCE for the whole approved list.
  const schema = parseSchemaFromMigrations(REPO_ROOT);
  if (schema.size === 0) {
    console.error("Відмова: парсер схеми повернув 0 таблиць — DB-скан не довірений, видалення скасовано.");
    process.exit(1);
  }

  const buckets = buildBuckets();
  const publicUrlByBucket = Object.fromEntries(buckets.map((b) => [b.bucket, b.publicUrl]));
  const keyToInfo = new Map(
    rows.map(({ bucket, key }) => [key, { publicUrl: publicUrlByBucket[bucket] }])
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let referencedNow;
  try {
    referencedNow = await scanDbReferences(supabase, schema, keyToInfo);
  } catch (err) {
    console.error(`Відмова: DB-скан посилань не вдався (${err.message}) — видалення скасовано.`);
    process.exit(1);
  }

  // 3) Per key: skip if referenced now, skip if missing/too recent, else delete.
  let deleted = 0;
  let skippedReferenced = 0;
  let skippedMissing = 0;
  let skippedTooRecent = 0;
  let failed = 0;
  const minAgeMs = minAgeDays * 24 * 60 * 60 * 1000;

  for (const { bucket, key } of rows) {
    const timestamp = new Date().toISOString();

    if (referencedNow.has(key)) {
      appendLog({ timestamp, bucket, key, action: "skip-referenced", result: "now referenced in DB" });
      console.warn(`[SKIP] ${bucket}/${key}: тепер є посилання в БД — пропуск.`);
      skippedReferenced++;
      continue;
    }

    const head = await headObject(bucket, key);
    if (!head) {
      appendLog({ timestamp, bucket, key, action: "skip-missing", result: "not found in R2" });
      skippedMissing++;
      continue;
    }

    const ageMs = Date.now() - new Date(head.lastModified).getTime();
    if (ageMs < minAgeMs) {
      appendLog({
        timestamp,
        bucket,
        key,
        size: head.size,
        action: "skip-too-recent",
        result: `age ${(ageMs / 86400000).toFixed(1)}d < ${minAgeDays}d`,
      });
      skippedTooRecent++;
      continue;
    }

    const res = await deleteObject(bucket, key);
    if (res.ok) {
      appendLog({ timestamp, bucket, key, size: head.size, action: "deleted", result: `HTTP ${res.status}` });
      deleted++;
    } else {
      const body = await res.text().catch(() => "");
      appendLog({
        timestamp,
        bucket,
        key,
        size: head.size,
        action: "delete-failed",
        result: `HTTP ${res.status} ${body.slice(0, 200)}`,
      });
      failed++;
    }
  }

  console.log(
    `Execute завершено: видалено ${deleted}, пропущено (тепер referenced) ${skippedReferenced}, пропущено (відсутні) ${skippedMissing}, пропущено (надто нові, < ${minAgeDays}d) ${skippedTooRecent}, помилок ${failed}.`
  );
  console.log(`Лог: ${LOG_PATH}`);
}

// ----------------------------------------------------------------------------
// Restore (undo) — independent of approved-delete.csv, driven by the backup
// manifest only. Does not touch the database.
// ----------------------------------------------------------------------------
async function runRestore() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Не знайдено ${MANIFEST_PATH} — нема що відновлювати.`);
  }
  const manifest = loadManifest();
  const entries = Object.values(manifest);
  console.log(`Відновлення ${entries.length} файлів з ${BACKUP_DIR} назад у R2...`);

  let restored = 0;
  let failed = 0;
  for (const entry of entries) {
    const localPath = path.join(BACKUP_DIR, entry.bucket, entry.key);
    if (!existsSync(localPath)) {
      console.warn(`[WARN] ${entry.bucket}/${entry.key}: локального backup-файлу немає, пропуск.`);
      failed++;
      continue;
    }
    const buffer = readFileSync(localPath);
    const res = await putObject(entry.bucket, entry.key, buffer, entry.contentType);
    if (res.ok) {
      restored++;
    } else {
      console.warn(`[WARN] ${entry.bucket}/${entry.key}: PUT HTTP ${res.status}`);
      failed++;
    }
  }

  console.log(`Відновлено: ${restored}, помилок: ${failed}.`);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  loadEnvLocal(REPO_ROOT);

  const args = process.argv.slice(2);
  const hasFlag = (f) => args.includes(f);
  const minAgeDaysArg = args.find((a) => a.startsWith("--min-age-days="));
  const minAgeDays = minAgeDaysArg ? Number(minAgeDaysArg.split("=")[1]) : DEFAULT_MIN_AGE_DAYS;
  const iKnow = hasFlag("--i-know");
  const doBackup = hasFlag("--backup");
  const doExecute = hasFlag("--execute");
  const doRestore = hasFlag("--restore");

  const modeCount = [doBackup, doExecute, doRestore].filter(Boolean).length;
  if (modeCount > 1) {
    throw new Error("Вкажіть лише один з --backup / --execute / --restore за раз.");
  }

  if (doRestore) {
    await runRestore();
    return;
  }

  ensureApprovedList(); // exits the process if it just created the file

  const rows = readApprovedList();

  if (rows.length > MAX_APPROVED_WITHOUT_FLAG && !iKnow) {
    throw new Error(
      `Відмова: у ${APPROVED_PATH} ${rows.length} рядків (> ${MAX_APPROVED_WITHOUT_FLAG}). Додайте --i-know, якщо це дійсно навмисно.`
    );
  }

  const buckets = buildBuckets();

  if (doBackup) {
    await runBackup(rows);
    return;
  }

  if (doExecute) {
    await runExecute(rows, minAgeDays);
    return;
  }

  await runDryRun(rows, buckets);
}

main().catch((err) => {
  console.error("r2-cleanup failed:", err.message);
  process.exit(1);
});
