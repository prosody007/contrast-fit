import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = new URL("../public/", import.meta.url);
let checked = 0;
async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) await verify(file);
    else if (/\.(?:html|js|css|md)$/.test(entry.name)) {
      const text = await readFile(file, "utf8");
      assert.ok(text.length > 0, `empty build output: ${file}`);
      const references = [
        ...text.matchAll(/(?:href|src)=["']([^"']+)["']/g),
        ...(entry.name.endsWith(".js") ? text.matchAll(/(?:from|import)\s*["']([^"']+)["']/g) : []),
        ...(entry.name.endsWith(".md") ? text.matchAll(/\]\(([^)]+)\)/g) : []),
      ];
      for (const [, reference] of references) {
        if (!reference.startsWith(".") && !reference.startsWith("/")) continue;
        const target = reference.startsWith("/")
          ? new URL(`.${reference}`, output)
          : new URL(reference, file);
        assert.ok(fileURLToPath(target).startsWith(fileURLToPath(output)), "reference escaped build output");
        if (target.pathname.endsWith("/")) target.pathname += "index.html";
        await access(target);
      }
      checked += 1;
    }
  }
}
for (const path of ["index.html", "examples/studio/index.html", "examples/studio/studio.js", "examples/studio/studio.css", "examples/dashboard/index.html", "docs/index.html", "src/contrast-fit.js", "dist/contrast-fit.js", "dist/contrast-fit.cjs", "dist/contrast-fit.global.js"]) {
  await access(new URL(path, output));
}
await verify(output);
console.log(`Static build: ${checked} text assets and their local references passed`);
