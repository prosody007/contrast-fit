import { readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

let checked = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) await check(url);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) {
      execFileSync(process.execPath, ["--check", fileURLToPath(url)], { stdio: "inherit" });
      checked += 1;
    }
  }
}
for (const path of ["src/", "examples/", "scripts/", "test/"]) await check(new URL(`../${path}`, import.meta.url));
console.log(`JavaScript syntax: ${checked} files passed`);
