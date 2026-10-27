import { cp, mkdir, rm } from "node:fs/promises";

const outputDir = new URL("../public/", import.meta.url);
const rootFiles = ["index.html", "README.md", "LICENSE", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "RELEASING.md", "MIGRATING.md"];
const rootDirs = ["examples", "src", "dist", "docs"];

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
