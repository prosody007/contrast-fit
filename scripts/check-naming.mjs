import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

// Build the forbidden spelling in pieces so this gate can scan its own source.
const retiredBrand = new RegExp(["adap", "tive"].join(""), "i");
// MIT requires preserving the original attribution. Exempt this exact notice,
// not the rest of the license or other files bearing a license-like name.
const originalCopyright = ["Copyright (c) 2026 Adap", "tive Palette contributors"].join("");
const attributionFiles = new Set(["LICENSE", "public/LICENSE"]);
const historicalDocuments = new Set([
  "MIGRATING.md", "CHANGELOG.md",
  // Exact generated mirrors of the two allowed history documents, not arbitrary
  // nested files with a migration-looking name.
  "public/MIGRATING.md", "public/CHANGELOG.md",
]);
const ignoredDirectories = new Set([
  ".git", "node_modules", ".cache", ".vercel", ".playwright", "coverage",
  "playwright-report", "test-results",
]);

/** Scan names and UTF-8 content, including generated dist/ and public/ assets. */
export async function findNamingViolations(root) {
  const violations = [];
  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const path = join(directory, entry.name);
      const name = relative(root, path).split("\\").join("/");
      if (retiredBrand.test(entry.name)) violations.push(`${name}: retired brand in file/directory name`);
      if (entry.isDirectory()) await scan(path);
      // Never follow symlinks out of the repository, or decode binary artifacts.
      else if (entry.isFile() && !historicalDocuments.has(name)) {
        const bytes = await readFile(path);
        if (bytes.includes(0)) continue;
        let text;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
        catch { continue; }
        for (const [index, line] of text.split(/\r?\n/).entries()) {
          if (attributionFiles.has(name) && line === originalCopyright) continue;
          if (retiredBrand.test(line)) violations.push(`${name}:${index + 1}: ${line.trim()}`);
        }
      }
    }
  }
  await scan(root);
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = await findNamingViolations(fileURLToPath(new URL("../", import.meta.url)));
  if (violations.length) {
    console.error(`Naming regression gate failed (${violations.length}):\n${violations.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("Naming regression: source, configuration and built assets passed (migration/changelog history and exact original MIT attribution only)");
  }
}
