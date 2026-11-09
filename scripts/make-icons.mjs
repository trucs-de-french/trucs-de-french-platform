// One-off script: builds static favicon/app-icon files for the TDF badge.
//
// Static <img>/.ico/.png files can't load web fonts, so the "TDF" letters
// are baked as outline paths instead of live <text> (unlike platform-badge.tsx,
// which renders live text for in-app use). Lora has no standalone static Bold
// file in Google Fonts; this script fetches the variable font and instances it
// at wght=700 via @pdf-lib/fontkit (already a project dependency) to get the
// Bold outlines. Rasterisation uses `sharp`, which is already resolvable in
// node_modules (brought in transitively) with librsvg built in — no new
// dependency was added for this script.
//
// Run from the repo root: node scripts/make-icons.mjs
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const LORA_VARIABLE_TTF_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/lora/Lora%5Bwght%5D.ttf";

const GOLD = "#d9b765";
const GOLD_SHADE = "#c49b3f";
const INDIGO = "#2f2c6b";
const INK = "#1a1640";

const CROISSANT_ELLIPSES = [
  [6, 26, 6, 5.6, -50],
  [54, 26, 6, 5.6, 50],
  [16, 18, 8.6, 10.4, -26],
  [44, 18, 8.6, 10.4, 26],
  [30, 15, 10.6, 13, 0],
];

function croissantSvg(scale) {
  const ellipses = CROISSANT_ELLIPSES.map(
    ([cx, cy, rx, ry, rotate]) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${GOLD_SHADE}" stroke="${GOLD}" stroke-width="1.8" transform="rotate(${rotate} ${cx} ${cy})"/>`,
  ).join("");
  return `<g transform="translate(100 102) scale(${scale}) translate(-30 -17)">${ellipses}</g>`;
}

// Lays out "TDF" in the given Bold font instance, returns the <path>
// elements plus the letters' bounding box (in the same SVG coordinate
// space), matching the visual position of the live
// <text x={cx} y={baselineY} font-size={fontSize} text-anchor="middle">
// in platform-badge.tsx.
function tdfLayout(boldFont, { cx, baselineY, fontSize, letterSpacing = -1 }) {
  const scale = fontSize / boldFont.unitsPerEm;
  const run = boldFont.layout("TDF");
  const glyphs = run.glyphs;
  const advances = run.positions.map((p) => p.xAdvance * scale);
  const totalWidth = advances.reduce((a, b) => a + b, 0) + letterSpacing * (glyphs.length - 1);
  const startX = cx - totalWidth / 2;

  let cursor = startX;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const parts = [];
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const d = glyph.path.toSVG();
    // font units are y-up with origin on the baseline; flip y and place.
    parts.push(
      `<path d="${d}" transform="translate(${cursor} ${baselineY}) scale(${scale} ${-scale})"/>`,
    );
    const bbox = glyph.bbox;
    minX = Math.min(minX, cursor + bbox.minX * scale);
    maxX = Math.max(maxX, cursor + bbox.maxX * scale);
    minY = Math.min(minY, baselineY - bbox.maxY * scale);
    maxY = Math.max(maxY, baselineY - bbox.minY * scale);
    cursor += advances[i] + letterSpacing;
  }
  return { pathElements: parts, bbox: { minX, maxX, minY, maxY } };
}

// Renders the laid-out paths filled with a userSpace linear gradient
// (top-left to bottom-right of the letters' own bounding box, same stops
// as platform-badge.tsx) or a flat fallback colour for small sizes where
// the gradient would hurt legibility/contrast.
function tdfPathSvg(boldFont, opts, { gradientId, flatFill } = {}) {
  const { pathElements, bbox } = tdfLayout(boldFont, opts);
  if (flatFill) {
    return `<g fill="${flatFill}">${pathElements.join("")}</g>`;
  }
  const defs = `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${bbox.minX}" y1="${bbox.minY}" x2="${bbox.maxX}" y2="${bbox.maxY}">
<stop offset="0%" stop-color="#4b46da"/>
<stop offset="55%" stop-color="#2f2c6b"/>
<stop offset="100%" stop-color="${INK}"/>
</linearGradient>`;
  return `<defs>${defs}</defs><g fill="url(#${gradientId})">${pathElements.join("")}</g>`;
}

function roundBadgeSvg(tdfPath) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<circle cx="100" cy="100" r="90" fill="${GOLD}"/>
${croissantSvg(2.7)}
${tdfPath}
</svg>`;
}

function appIconBadgeSvg(tdfPath) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="44" fill="${INDIGO}"/>
<circle cx="100" cy="100" r="74" fill="${GOLD}"/>
${croissantSvg(2.2)}
${tdfPath}
</svg>`;
}

// ICO container: a minimal hand-rolled encoder (PNG-compressed entries,
// supported since Windows Vista) — avoids adding an image-to-ico dependency.
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  pngBuffers.forEach(({ size, buffer }, i) => {
    const entryOffset = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 0);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2); // color palette
    header.writeUInt8(0, entryOffset + 3); // reserved
    header.writeUInt16LE(1, entryOffset + 4); // color planes
    header.writeUInt16LE(32, entryOffset + 6); // bits per pixel
    header.writeUInt32LE(buffer.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += buffer.length;
    entries.push(buffer);
  });

  return Buffer.concat([header, ...entries]);
}

async function main() {
  console.log("Fetching Lora variable font…");
  const res = await fetch(LORA_VARIABLE_TTF_URL);
  if (!res.ok) {
    throw new Error(`Could not fetch Lora font (${res.status}) — aborting, no icons generated.`);
  }
  const fontBuffer = Buffer.from(await res.arrayBuffer());
  const variableFont = fontkit.create(fontBuffer);
  const boldFont = variableFont.getVariation({ wght: 700 });

  const roundPath78 = tdfPathSvg(
    boldFont,
    { cx: 100, baselineY: 128, fontSize: 78 },
    { gradientId: "tdf-letters-round" },
  );
  // Flat fallback: at 16/32px the gradient loses contrast against the gold
  // circle, so the favicon's small frames use a flat indigo fill instead.
  const roundPath78Flat = tdfPathSvg(
    boldFont,
    { cx: 100, baselineY: 128, fontSize: 78 },
    { flatFill: INDIGO },
  );
  const appIconPath = tdfPathSvg(
    boldFont,
    { cx: 100, baselineY: 124, fontSize: 64 },
    { gradientId: "tdf-letters-app-icon" },
  );

  const roundSvgFull = roundBadgeSvg(roundPath78);
  const roundSvgFlat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<circle cx="100" cy="100" r="90" fill="${GOLD}"/>
${croissantSvg(2.7)}
${roundPath78Flat}
</svg>`;
  const roundSvgNoCroissant = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<circle cx="100" cy="100" r="90" fill="${GOLD}"/>
${roundPath78Flat}
</svg>`;
  const appIconSvg = appIconBadgeSvg(appIconPath);

  // 1. src/app/icon.svg — round badge, paths only.
  await writeFile(path.join(ROOT, "src/app/icon.svg"), roundSvgFull, "utf8");

  // 2. src/app/apple-icon.png — 180x180, rounded-square (app-icon) variant.
  await sharp(Buffer.from(appIconSvg)).resize(180, 180).png().toFile(path.join(ROOT, "src/app/apple-icon.png"));

  // 3. public/icon-192.png, public/icon-512.png — rounded-square variant.
  await mkdir(path.join(ROOT, "public"), { recursive: true });
  await sharp(Buffer.from(appIconSvg)).resize(192, 192).png().toFile(path.join(ROOT, "public/icon-192.png"));
  await sharp(Buffer.from(appIconSvg)).resize(512, 512).png().toFile(path.join(ROOT, "public/icon-512.png"));

  // 4. src/app/favicon.ico — 16/32/48 from the round badge; croissant omitted
  //    at 16px so the letters stay legible. 16/32px use a flat indigo fill
  //    instead of the gradient — at that size the gradient reads as a muddy
  //    smear and loses contrast against the gold circle.
  const png48 = await sharp(Buffer.from(roundSvgFull)).resize(48, 48).png().toBuffer();
  const png32 = await sharp(Buffer.from(roundSvgFlat)).resize(32, 32).png().toBuffer();
  const png16 = await sharp(Buffer.from(roundSvgNoCroissant)).resize(16, 16).png().toBuffer();
  const ico = buildIco([
    { size: 16, buffer: png16 },
    { size: 32, buffer: png32 },
    { size: 48, buffer: png48 },
  ]);
  await writeFile(path.join(ROOT, "src/app/favicon.ico"), ico);

  console.log("Icons written: src/app/icon.svg, src/app/apple-icon.png, public/icon-192.png, public/icon-512.png, src/app/favicon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
