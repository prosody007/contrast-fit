import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

test("loopback development server serves assets but never private paths", { timeout: 15_000 }, async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("../scripts/dev-server.mjs", import.meta.url))], {
    env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = once(child, "exit");
  try {
    let output = "";
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("development server startup timed out")), 5000);
      child.on("error", reject);
      child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`server exited: ${code}`)); });
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = /http:\/\/127\.0\.0\.1:\d+\//.exec(output);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
    });
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /ContrastFit/);
    const source = await fetch(new URL("src/contrast-fit.js", base));
    assert.equal(source.status, 200);
    assert.match(source.headers.get("content-type"), /javascript/);
    for (const path of [".git/config", ".env", "node_modules/typescript/package.json", "package-lock.json", "src/%2E%2E/%2Egit/config", "src/%5c.env"]) {
      const response = await fetch(new URL(path, base));
      assert.equal(response.status, 404, path);
    }
    assert.equal((await fetch(base, { method: "POST" })).status, 405);
    assert.equal((await fetch(new URL("src/%ZZ", base))).status, 400);
    const head = await fetch(base, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  } finally {
    child.kill("SIGTERM");
    await exited;
  }
});
