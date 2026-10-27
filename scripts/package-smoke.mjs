import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import * as source from "../src/contrast-fit.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const cache = join(root, ".cache");
await mkdir(cache, { recursive: true });
const temp = await mkdtemp(join(cache, "contrast-fit-consumer-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (command, args, cwd = root) => execFileSync(command, args, {
  cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
});
assert.ok(process.argv.slice(2).every((arg) => arg === "--browser"), "Usage: node scripts/package-smoke.mjs [--browser]");

// This function is also serialized into fresh ESM, CommonJS and browser realms.
// It does not depend on a DOM, external packages, or module-scope bindings.
function exercise(api) {
  const palettes = [];
  const colors = ["#000", "#fff", "#123456", "#777", "#808080", "#8855EE", "#FF00FF", "#000044"];
  for (const color of colors) {
    for (const options of [undefined, { backgroundStrategy: "preserve" }, {
      textContrast: 21, mutedContrast: 21, accentContrast: 21, surfaceTextContrast: 21,
    }]) {
      const palette = api.createContrastFit(color, options);
      const variables = api.paletteToCssVariables(palette);
      const applied = {};
      api.applyPaletteToElement({ style: { setProperty(name, value) { applied[name] = value; } } }, palette);
      if (JSON.stringify(applied) !== JSON.stringify(variables)) throw new Error("DOM adapter/SSR serializer mismatch");
      if (Object.keys(variables).length !== 17 || variables["--contrast-fit-bg"] !== palette.background) {
        throw new Error("default CSS variable contract changed");
      }
      if (palette.tokens.length !== 17 || (!options?.backgroundStrategy && !palette.usable)) {
        throw new Error("default automatic repair regressed");
      }
      palettes.push({ palette, variables });
    }
  }
  return { exports: Object.keys(api).sort(), palettes };
}
const expected = exercise(source);
// Different V8 builds can disagree in the last few floating-point bits of
// perceptual metrics; do not relax any actual color, boolean or contrast gate.
function stableNumbers(value) {
  if (typeof value === "number") return Number(value.toFixed(12));
  if (Array.isArray(value)) return value.map(stableNumbers);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, stableNumbers(child)]),
  );
  return value;
}

try {
  // Exercise the real prepack lifecycle: a clean checkout must not need dist/.
  // prepack builds the library, and must never invoke package:smoke recursively.
  run(npm, ["pack", "--pack-destination", temp]);
  // Lifecycle scripts may legitimately write to stdout, even with --json.
  // Inspect the actual archive instead of parsing npm's mixed lifecycle output.
  const archives = (await readdir(temp)).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1, "npm pack must create exactly one archive");
  const archive = { filename: archives[0], size: (await stat(join(temp, archives[0]))).size };
  const expectedFiles = [
    "package.json", "src/contrast-fit.js", "src/contrast-fit.d.ts",
    "dist/contrast-fit.js", "dist/contrast-fit.cjs", "dist/contrast-fit.global.js",
    "dist/contrast-fit.d.ts", "dist/contrast-fit.d.cts",
    "README.md", "LICENSE", "MIGRATING.md", "CHANGELOG.md", "SECURITY.md",
    "CONTRIBUTING.md", "RELEASING.md", "docs/api.md", "docs/architecture.md",
  ];
  const files = run("tar", ["-tzf", join(temp, archive.filename)], temp).trim().split(/\r?\n/)
    .filter((path) => !path.endsWith("/"))
    .map((path) => {
      assert.ok(path.startsWith("package/"), "archive entry must stay in package/");
      assert.ok(!path.split("/").includes(".."), "archive entry must not traverse directories");
      return path.slice("package/".length);
    }).sort();
  assert.deepEqual(files, expectedFiles.sort(), "unexpected package contents");
  await writeFile(join(temp, "package.json"), JSON.stringify({ name: "contrast-fit-consumer", private: true, type: "module" }));
  const installed = join(temp, "node_modules", "contrast-fit");
  await mkdir(installed, { recursive: true });
  // Extract exactly the locally produced tarball. No registry or npm install is
  // needed: the distributed library has no runtime dependencies or install hooks.
  run("tar", ["-xzf", join(temp, archive.filename), "--strip-components=1", "-C", installed], temp);
  const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
  assert.equal(manifest.name, "contrast-fit");
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0, "runtime dependencies must remain empty");
  assert.equal(Object.keys(manifest.optionalDependencies ?? {}).length, 0);
  assert.equal(Object.keys(manifest.peerDependencies ?? {}).length, 0);
  assert.equal(manifest.main, "./dist/contrast-fit.cjs");
  assert.equal(manifest.types, manifest.exports["."].import.types);
  assert.equal(manifest.module, manifest.exports["."].import.default);
  assert.equal(manifest.browser, manifest.module, "browser bundlers must receive the ESM module, not a global-only script");
  assert.equal(manifest.unpkg, manifest.jsdelivr);
  for (const path of [manifest.main, manifest.module, manifest.types, manifest.browser,
    manifest.unpkg, manifest.exports["."].require.types, manifest.exports["./browser"]]) {
    await readFile(join(installed, path));
  }

  await writeFile(join(temp, "consumer.mjs"), `
import * as api from 'contrast-fit';
if (typeof document !== 'undefined') throw new Error('SSR fixture unexpectedly has a DOM');
console.log(JSON.stringify((${exercise.toString()})(api)));
`);
  await writeFile(join(temp, "consumer.cjs"), `
const api = require('contrast-fit');
if (typeof document !== 'undefined') throw new Error('SSR fixture unexpectedly has a DOM');
console.log(JSON.stringify((${exercise.toString()})(api)));
`);
  for (const name of ["consumer.mjs", "consumer.cjs"]) {
    assert.deepEqual(JSON.parse(run(process.execPath, [join(temp, name)], temp)), expected, `${name}: packed runtime differs from source`);
  }
  console.log("Packed ESM + CommonJS: 24 automatic/preserve/extreme-target palettes match source, SSR serialization passed");

  const browserFile = join(installed, manifest.unpkg);
  const browserCode = await readFile(browserFile, "utf8");
  const sandbox = {};
  const browserResult = runInNewContext(browserCode + `\nJSON.stringify((${exercise.toString()})(globalThis.ContrastFit));`, sandbox, {
    filename: browserFile, timeout: 10_000,
  });
  assert.equal(typeof sandbox.require, "undefined");
  assert.equal(typeof sandbox.module, "undefined");
  assert.equal(Object.isFrozen(sandbox.ContrastFit), true);
  assert.deepEqual(JSON.parse(browserResult), expected);
  console.log("Packed browser global: globalThis.ContrastFit runs without a module loader or DOM");

  const fixture = await readFile(new URL("../test/types/consumer.ts", import.meta.url), "utf8");
  await writeFile(join(temp, "consumer.mts"), fixture);
  await writeFile(join(temp, "consumer.ts"), fixture);
  await writeFile(join(temp, "consumer.cts"), await readFile(new URL("../test/types/consumer.cts", import.meta.url), "utf8"));
  const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
  const flags = [tsc, "--ignoreConfig", "--noEmit", "--strict", "--skipLibCheck", "false", "--exactOptionalPropertyTypes", "--target", "ES2022", "--lib", "ES2022,DOM"];
  run(process.execPath, [...flags, "--module", "NodeNext", "--moduleResolution", "NodeNext", "consumer.mts", "consumer.cts"], temp);
  run(process.execPath, [...flags, "--module", "ESNext", "--moduleResolution", "Bundler", "consumer.ts"], temp);
  console.log("Packed TypeScript consumers: NodeNext ESM + typed require (.d.cts), and Bundler passed");

  if (process.argv.includes("--browser")) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addScriptTag({ path: browserFile });
      const actual = await page.evaluate(`(${exercise.toString()})(globalThis.ContrastFit)`);
      assert.deepEqual(stableNumbers(actual), stableNumbers(expected));
      const applied = await page.evaluate(() => {
        const element = document.createElement("article");
        document.body.append(element);
        const palette = globalThis.ContrastFit.createContrastFit("#777");
        globalThis.ContrastFit.applyPaletteToElement(element, palette);
        return { actual: getComputedStyle(element).getPropertyValue("--contrast-fit-bg").trim(), expected: palette.background };
      });
      assert.equal(applied.actual, applied.expected);
      assert.deepEqual(errors, []);
      console.log(`Packed classic script + DOM application: Chromium ${browser.version()} passed`);
    } finally {
      await browser.close();
    }
  }
  console.log(`Package contract passed: ${files.length} files, ${archive.size} bytes packed locally`);
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  // temp is created by mkdtemp under this repository's ignored .cache/ only.
  await rm(temp, { recursive: true, force: true });
}
