import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findNamingViolations } from "../scripts/check-naming.mjs";

const cache = fileURLToPath(new URL("../.cache/", import.meta.url));
const retiredName = ["adap", "tive-palette"].join("");

test("naming gate scans active names/content and builds, exempting history and exact original attribution only", async () => {
  await mkdir(cache, { recursive: true });
  const fixture = await mkdtemp(join(cache, "naming-gate-"));
  const put = async (name, content) => {
    const file = join(fixture, name);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, content);
  };
  try {
    await put("MIGRATING.md", `Migrate from ${retiredName}.`);
    await put("CHANGELOG.md", `Previously ${retiredName}.`);
    await put("public/MIGRATING.md", `Migrate from ${retiredName}.`);
    await put("public/CHANGELOG.md", `Previously ${retiredName}.`);
    for (const directory of [".git", "node_modules", ".cache", "coverage", "playwright-report", "test-results"]) {
      await put(`${directory}/metadata`, retiredName);
    }
    const attribution = ["Copyright (c) 2026 Adap", "tive Palette contributors"].join("");
    await put("LICENSE", `MIT License\n\n${attribution}\nCopyright (c) 2026 ContrastFit contributors`);
    await put("public/LICENSE", `${attribution}\n`);
    await put("README.md", "ContrastFit");
    assert.deepEqual(await findNamingViolations(fixture), []);
    // The exception must not conceal stale branding, altered notices, or copies
    // in arbitrary paths (including nested directories named like licenses).
    await put("LICENSE", `${attribution}\n${retiredName}`);
    await put("public/LICENSE", `${attribution} extra`);
    await put("docs/LICENSE", attribution);
    const licenseFailures = await findNamingViolations(fixture);
    assert.equal(licenseFailures.length, 3, licenseFailures.join("\n"));
    for (const name of ["LICENSE:2:", "public/LICENSE:1:", "docs/LICENSE:1:"]) {
      assert.ok(licenseFailures.some((failure) => failure.startsWith(name)), name);
    }
    await put("LICENSE", attribution);
    await put("public/LICENSE", attribution);
    await put("docs/LICENSE", "ContrastFit");
    await put("src/core.js", `export const name = '${retiredName}';`);
    await put("docs/MIGRATING.md", retiredName);
    await put("dist/contrast-fit.js", retiredName);
    await put("public/index.html", retiredName);
    await put(`${retiredName}.txt`, "old filename");
    const failures = await findNamingViolations(fixture);
    assert.equal(failures.length, 5, failures.join("\n"));
    for (const name of ["src/core.js:1:", "docs/MIGRATING.md:1:", "dist/contrast-fit.js:1:", "public/index.html:1:", `${retiredName}.txt:`]) {
      assert.ok(failures.some((failure) => failure.startsWith(name)), name);
    }
    // Binary release archives aren't text, even if a byte sequence spells a name.
    await put("archive.tgz", Buffer.concat([Buffer.from([0]), Buffer.from(retiredName)]));
    assert.equal((await findNamingViolations(fixture)).length, 5);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
