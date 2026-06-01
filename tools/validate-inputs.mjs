#!/usr/bin/env node
/**
 * tools/validate-inputs.mjs
 * Validate inputs.yml against inputs.schema.json using only Node.js built-ins.
 * Usage: node tools/validate-inputs.mjs
 * Exit 0 = pass, 1 = fail.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// ── Minimal YAML → JS parser (handles scalars, block sequences, block mappings) ──
// Approach: single-pass with an indent stack.
// Each frame = { obj: currentContainer, indent: indentLevel }
// We track the "owner" of any upcoming sequence items by finding the frame
// at the correct indentation level (the mapping key's parent frame).
function parseYaml(text) {
  const lines = text.split("\n");
  const result = {};
  // Each frame: { obj, indent }
  // obj: the container this frame represents (plain object or array)
  // indent: the indentation of the KEY that introduced this frame
  const stack = [{ obj: result, indent: -1 }];

  // lastSeqOwner: when we see "key:" with no value, record {frame, key}
  // so the next "- item" at deeper indent knows where to push
  let lastMappingKey = null; // { frame, key, keyIndent }

  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const indent = line.match(/^(\s*)/)[1].length;
    const stripped = line.trim();

    // ── Sequence item ──
    if (stripped.startsWith("- ") || stripped === "-") {
      const itemContent = (stripped === "-") ? "" : stripped.slice(2).trim();

      // Find the frame that owns this sequence.
      // The owning frame is the one whose key was declared at indentation < indent.
      // Pop frames whose indent >= current indent (they are deeper scopes, closed now).
      // But we need to be careful: we pop back to the frame that CONTAINS the key
      // whose value is this sequence. That frame's indent < indent.
      // However "lastMappingKey" recorded the exact frame+key that had an empty value.
      if (lastMappingKey && lastMappingKey.keyIndent < indent) {
        const { frame, key } = lastMappingKey;
        if (!Array.isArray(frame.obj[key])) {
          frame.obj[key] = [];
          // Remove any stale frames pushed for this key
          while (stack.length > 1 && stack[stack.length - 1].indent >= lastMappingKey.keyIndent) {
            stack.pop();
          }
        }
        const arr = frame.obj[key];
        if (itemContent === "" || (itemContent.endsWith(":") && !itemContent.includes(": "))) {
          const newObj = {};
          arr.push(newObj);
          stack.push({ obj: newObj, indent });
          lastMappingKey = null;
        } else if (itemContent.includes(": ")) {
          const ci = itemContent.indexOf(": ");
          const newObj = { [itemContent.slice(0, ci)]: parseScalar(itemContent.slice(ci + 2)) };
          arr.push(newObj);
          stack.push({ obj: newObj, indent });
          lastMappingKey = null;
        } else {
          arr.push(parseScalar(itemContent));
          // don't clear lastMappingKey — more seq items coming
        }
      } else {
        // Fallback: find container by indent
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        const top = stack[stack.length - 1].obj;
        if (Array.isArray(top)) {
          if (itemContent.includes(": ")) {
            const ci = itemContent.indexOf(": ");
            const newObj = { [itemContent.slice(0, ci)]: parseScalar(itemContent.slice(ci + 2)) };
            top.push(newObj);
            stack.push({ obj: newObj, indent });
          } else if (itemContent === "") {
            const newObj = {};
            top.push(newObj);
            stack.push({ obj: newObj, indent });
          } else {
            top.push(parseScalar(itemContent));
          }
        }
      }
      continue;
    }

    // ── Mapping key ──
    const colonIdx = stripped.indexOf(": ");
    const trailingColon = (stripped.endsWith(":") && !stripped.endsWith("::")) ? stripped.length - 1 : -1;
    if (colonIdx === -1 && trailingColon === -1) continue;

    const key = colonIdx !== -1 ? stripped.slice(0, colonIdx) : stripped.slice(0, trailingColon);
    const val = colonIdx !== -1 ? stripped.slice(colonIdx + 2).trim() : "";

    // Pop stack back to a frame whose indent < current indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const frame = stack[stack.length - 1];
    const parent = frame.obj;

    if (val === "") {
      // Will be filled by child mappings or sequence items
      parent[key] = {};
      lastMappingKey = { frame, key, keyIndent: indent };
      stack.push({ obj: parent[key], indent });
    } else {
      parent[key] = parseScalar(val);
      lastMappingKey = null;
    }
  }
  return result;
}

function parseScalar(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  // Strip quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

// ── Simple JSON Schema validator (subset: required, type, enum, const, pattern) ──
function validate(data, schema, path = "#") {
  const errors = [];

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    let actual = Array.isArray(data) ? "array" : data === null ? "null" : typeof data;

    const matches = types.some((t) => {
      if (t === "integer") return typeof data === "number" && Number.isFinite(data);
      if (t === "null") return data === null;
      return actual === t;
    });

    if (!matches) {
      errors.push(`${path}: expected type "${types.join(",")}", got "${actual}"`);
      // Only abort for non-null type mismatches (null is a valid union member, don't cascade)
      if (!types.includes("null")) return errors;
    }
  }

  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`);
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(data)}`);
  }

  if (schema.pattern && typeof data === "string" && !new RegExp(schema.pattern).test(data)) {
    errors.push(`${path}: "${data}" does not match pattern ${schema.pattern}`);
  }

  if (schema.minLength && typeof data === "string" && data.length < schema.minLength) {
    errors.push(`${path}: string too short (min ${schema.minLength})`);
  }

  if (schema.required && typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const req of schema.required) {
      if (!(req in data)) {
        errors.push(`${path}: missing required field "${req}"`);
      }
    }
  }

  if (schema.properties && typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const [k, subSchema] of Object.entries(schema.properties)) {
      if (k in data) {
        errors.push(...validate(data[k], subSchema, `${path}.${k}`));
      }
    }
  }

  if (schema.items && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      errors.push(...validate(data[i], schema.items, `${path}[${i}]`));
    }
  }

  return errors;
}

// ── Main ──
const inputsPath = resolve(ROOT, "inputs.yml");
const schemaPath = resolve(ROOT, "inputs.schema.json");

if (!existsSync(inputsPath)) {
  console.error("❌ inputs.yml not found at project root");
  process.exit(1);
}

if (!existsSync(schemaPath)) {
  console.warn("⚠️  inputs.schema.json not found — skipping schema validation (non-blocking)");
  console.log("✅ inputs.yml exists (schema validation skipped)");
  process.exit(0);
}

let data, schema;
try {
  data = parseYaml(readFileSync(inputsPath, "utf8"));
} catch (e) {
  console.error("❌ Failed to parse inputs.yml:", e.message);
  process.exit(1);
}

try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch (e) {
  console.error("❌ Failed to parse inputs.schema.json:", e.message);
  process.exit(1);
}

const errors = validate(data, schema);
if (errors.length === 0) {
  console.log("✅ inputs.yml validates against inputs.schema.json");
  process.exit(0);
} else {
  console.error(`❌ inputs.yml has ${errors.length} validation error(s):`);
  for (const err of errors) console.error("  •", err);
  process.exit(1);
}
