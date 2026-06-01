#!/usr/bin/env node
/**
 * tools/hydration-lint.mjs
 * Scan apps/yelli/src/app/ for common SSR hydration mismatch patterns.
 * Warnings only — always exits 0.
 * Usage: node tools/hydration-lint.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIR = resolve(ROOT, "apps/yelli/src/app");

// ── Patterns that cause hydration mismatches ──
const PATTERNS = [
  {
    re: /\bDate\.now\(\)/g,
    msg: "Date.now() in component body → wrap in useEffect() or useMemo()",
  },
  {
    re: /new\s+Date\(\)/g,
    msg: "new Date() in component body → wrap in useEffect() or useMemo()",
  },
  {
    re: /\bMath\.random\(\)/g,
    msg: "Math.random() in component body → generates different values per render",
  },
  {
    re: /typeof\s+window/g,
    msg: "typeof window outside useEffect → use dynamic import or client boundary",
  },
  {
    re: /\blocalStorage\b/g,
    msg: "localStorage at module/component scope → wrap in useEffect()",
  },
  {
    re: /\bsessionStorage\b/g,
    msg: "sessionStorage at module/component scope → wrap in useEffect()",
  },
];

// ── Recursively collect .tsx files ──
function collectFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, files);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

// ── Strip "use client" guard blocks (patterns inside useEffect are safe) ──
// Simple heuristic: skip lines inside useEffect(() => { ... })
// We do this by removing useEffect callback bodies before scanning
function stripUseEffectBodies(text) {
  // Replace content between useEffect(( => { and its matching }) with blank lines
  // Simple approach: remove single-line and detect depth
  return text.replace(/useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?\}\s*(?:,\s*\[[\s\S]*?\])?\s*\)/g, "/* useEffect removed */");
}

// ── Skip files that are entirely 'use client' (no SSR concern) ──
function isClientOnly(text) {
  return /^\s*['"]use client['"]/m.test(text);
}

// ── Main ──
if (!existsSync(SCAN_DIR)) {
  console.log(`⚠️  ${SCAN_DIR} does not exist yet — hydration lint skipped (non-blocking)`);
  process.exit(0);
}

const files = collectFiles(SCAN_DIR);
if (files.length === 0) {
  console.log("✅ No .tsx/.ts files found to scan");
  process.exit(0);
}

let totalWarnings = 0;

for (const filePath of files) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  // Client-only files are fine — they run in browser only
  if (isClientOnly(text)) continue;

  // Remove useEffect bodies before scanning (patterns inside are safe)
  const scanText = stripUseEffectBodies(text);

  const rel = relative(ROOT, filePath);
  const lines = scanText.split("\n");

  for (const { re, msg } of PATTERNS) {
    // Reset lastIndex for global regexes
    re.lastIndex = 0;
    let lineNo = 0;
    for (const line of lines) {
      lineNo++;
      re.lastIndex = 0;
      if (re.test(line)) {
        console.warn(`⚠️  ${rel}:${lineNo} — ${msg}`);
        console.warn(`     ${line.trim()}`);
        totalWarnings++;
      }
    }
  }
}

if (totalWarnings === 0) {
  console.log(`✅ hydration-lint clean — scanned ${files.length} file(s), no issues found`);
} else {
  console.log(`\n⚠️  hydration-lint found ${totalWarnings} potential issue(s) — fix recommended but not blocking`);
}

// Always exit 0 — warnings only
process.exit(0);
