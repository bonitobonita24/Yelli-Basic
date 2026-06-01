#!/usr/bin/env node
/**
 * tools/check-product-sync.mjs
 * Rule 9 + Rule 20 compliance checks:
 *   1. PRIVATE TAG LEAK: content inside <private>...</private> in PRODUCT.md
 *      must not appear in any governance doc.
 *   2. TECH STACK ALIGNMENT: tech_stack.* in inputs.yml matches declared
 *      technologies mentioned in PRODUCT.md (soft warning, not a failure).
 * Usage: node tools/check-product-sync.mjs
 * Exit 0 = pass, 1 = private tag leak detected.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// ── File paths ──
const PRODUCT_MD = resolve(ROOT, "docs/PRODUCT.md");
const INPUTS_YML = resolve(ROOT, "inputs.yml");
const GOVERNANCE_DOCS = [
  resolve(ROOT, "docs/CHANGELOG_AI.md"),
  resolve(ROOT, "docs/DECISIONS_LOG.md"),
  resolve(ROOT, "docs/IMPLEMENTATION_MAP.md"),
  resolve(ROOT, ".cline/memory/lessons.md"),
  resolve(ROOT, ".cline/memory/agent-log.md"),
];

// ── Extract <private>...</private> block contents ──
function extractPrivateBlocks(text) {
  const blocks = [];
  const re = /<private>([\s\S]*?)<\/private>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const content = m[1].trim();
    if (content.length > 0) blocks.push(content);
  }
  return blocks;
}

// ── Extract significant phrases from private block (5+ char non-trivial tokens) ──
function extractPhrases(block) {
  // Split on whitespace and punctuation; keep tokens >= 6 chars
  return block
    .split(/[\s,.:;!?()\[\]{}"'|\\\/\-]+/)
    .filter((t) => t.length >= 6)
    .map((t) => t.toLowerCase());
}

// ── Simple YAML line scanner for tech_stack values ──
function extractTechStackFromYml(text) {
  const values = {};
  let inTechStack = false;
  for (const line of text.split("\n")) {
    if (line.match(/^tech_stack:/)) { inTechStack = true; continue; }
    if (inTechStack && line.match(/^\S/) && !line.match(/^  /)) { inTechStack = false; }
    if (!inTechStack) continue;
    const m = line.match(/^\s+(\w+):\s+(.+)/);
    if (m) values[m[1]] = m[2].trim().replace(/#.*$/, "").trim();
  }
  return values;
}

// ── Main ──
if (!existsSync(PRODUCT_MD)) {
  console.warn("⚠️  docs/PRODUCT.md not found — skipping sync check");
  process.exit(0);
}

const productText = readFileSync(PRODUCT_MD, "utf8");
const privateBlocks = extractPrivateBlocks(productText);
let leakFound = false;

// Check 1 — Private tag leak
if (privateBlocks.length === 0) {
  console.log("✅ No <private> blocks in PRODUCT.md — leak check skipped");
} else {
  console.log(`🔍 Found ${privateBlocks.length} <private> block(s). Checking governance docs...`);
  for (const docPath of GOVERNANCE_DOCS) {
    if (!existsSync(docPath)) continue;
    const docText = readFileSync(docPath, "utf8").toLowerCase();
    for (const block of privateBlocks) {
      const phrases = extractPhrases(block);
      for (const phrase of phrases) {
        if (docText.includes(phrase)) {
          const shortPath = docPath.replace(ROOT, "");
          console.error(`❌ PRIVATE TAG LEAK: phrase "${phrase}" from <private> block found in ${shortPath}`);
          leakFound = true;
          break; // one match per block per doc is enough
        }
      }
    }
  }
  if (!leakFound) {
    console.log("✅ No private tag content leaked into governance docs");
  }
}

// Check 2 — Tech stack soft alignment (warnings only)
if (existsSync(INPUTS_YML)) {
  const ymlText = readFileSync(INPUTS_YML, "utf8");
  const techStack = extractTechStackFromYml(ymlText);

  // Map of inputs.yml key → expected PRODUCT.md mention
  const checks = [
    { key: "frontend",   expect: ["nextjs", "next.js"] },
    { key: "api",        expect: ["trpc"] },
    { key: "orm",        expect: ["prisma"] },
    { key: "auth",       expect: ["auth.js", "authjs", "auth.js v5"] },
    { key: "database",   expect: ["postgresql", "postgres"] },
    { key: "cache",      expect: ["valkey", "redis"] },
    { key: "queue",      expect: ["bullmq"] },
    { key: "ui_library", expect: ["shadcn"] },
  ];

  const productLower = productText.toLowerCase();
  let warnings = 0;
  for (const { key, expect } of checks) {
    const ymlVal = (techStack[key] ?? "").toLowerCase();
    if (!ymlVal) continue;
    const foundInProduct = expect.some((e) => productLower.includes(e));
    if (!foundInProduct) {
      console.warn(`⚠️  SOFT MISMATCH: inputs.yml tech_stack.${key}="${ymlVal}" but none of [${expect.join(", ")}] found in PRODUCT.md`);
      warnings++;
    }
  }
  if (warnings === 0) {
    console.log("✅ inputs.yml tech_stack aligns with PRODUCT.md mentions");
  }
} else {
  console.warn("⚠️  inputs.yml not found — skipping tech stack alignment check");
}

if (leakFound) {
  console.error("\n❌ check-product-sync FAILED — private tag content leaked. Fix before committing.");
  process.exit(1);
} else {
  console.log("\n✅ PRODUCT.md ↔ inputs.yml in sync (no private tag leaks)");
  process.exit(0);
}
