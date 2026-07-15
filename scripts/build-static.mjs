import { cp, mkdir, rm } from "node:fs/promises";

const outputDir = new URL("../public/", import.meta.url);
const rootFiles = ["index.html", "README.md", "LICENSE"];
const rootDirs = ["examples", "src", "docs"];

await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDir, { recursive: true });

for (const file of rootFiles) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(file, outputDir));
}

for (const dir of rootDirs) {
  await cp(new URL(`../${dir}`, import.meta.url), new URL(`${dir}/`, outputDir), {
    recursive: true,
  });
}
