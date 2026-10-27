// Built-site regression gate: npm run build && node test/browser/dashboard-smoke.mjs
// For demo-only development without rebuilding: node test/browser/dashboard-smoke.mjs --source
// Prerequisites: playwright + axe-core devDependencies; npx playwright install chromium.
// Uses an ephemeral loopback server and always closes the browser/server on failure.
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import axe from "axe-core";
import { createContrastFit, paletteToCssVariables } from "../../src/contrast-fit.js";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

async function startStaticServer(siteDir) {
  const root = await realpath(siteDir);
  const server = createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (pathname === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      let path = resolve(root, `.${pathname}`);
      if (path !== root && !path.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      path = await realpath(path);
      if (!path.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(path);
      response.writeHead(200, {
        "Content-Type": mimeTypes[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done, reject) => {
      server.close((error) => error ? reject(error) : done());
      server.closeAllConnections();
    }),
  };
}

function near(actual, expected, message, tolerance = 0.11) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`);
}

async function verifyChart(card, index) {
  const chart = await card.evaluate((element) => {
    const plot = element.querySelector(".js-plot");
    const ticks = (selector) => [...plot.querySelectorAll(selector)].map((tick) => ({
      value: Number(tick.querySelector("text").textContent),
      y: Number(tick.querySelector("line").getAttribute("y1")),
    }));
    return {
      headers: [...element.querySelectorAll("thead th")].map((cell) => cell.textContent),
      rows: [...element.querySelectorAll("tbody tr")].map((row) => ({
        period: row.querySelector("th").textContent,
        values: [...row.querySelectorAll("td")].map((cell) => Number(cell.textContent)),
      })),
      scoreTicks: ticks(".score-tick"),
      volumeTicks: ticks(".volume-tick"),
      periodTicks: [...plot.querySelectorAll(".period-tick")].map((tick) => ({
        period: Number(tick.querySelector("text").textContent.slice(1)),
        x: Number(tick.querySelector("line").getAttribute("x1")),
      })),
      series: ["a", "b", "c"].map((name) => ({
        points: [...plot.querySelector(`.series-line.line-${name}`).getAttribute("d")
          .matchAll(/[ML]\s+(-?[\d.]+)\s+(-?[\d.]+)/g)]
          .map((match) => [Number(match[1]), Number(match[2])]),
        dash: getComputedStyle(plot.querySelector(`.series-line.line-${name}`)).strokeDasharray,
        stroke: getComputedStyle(plot.querySelector(`.series-line.line-${name}`)).stroke,
      })),
      bars: [...plot.querySelectorAll(".bar")].map((bar) => Object.fromEntries(
        ["x", "y", "width", "height"].map((name) => [name, Number(bar.getAttribute(name))]),
      )),
      latest: Number(plot.querySelector(".value-label").textContent),
      markerShapes: ["a", "b", "c"].map((name) => [...new Set(
        [...plot.querySelectorAll(`.point.line-${name}`)].map((marker) => marker.tagName),
      )]),
      legend: [...element.querySelectorAll(".legend span")].map((item) => {
        const key = item.querySelector(".series-line");
        return {
          label: item.textContent.trim(),
          dash: key && getComputedStyle(key).strokeDasharray,
          stroke: key && getComputedStyle(key).stroke,
        };
      }),
    };
  });

  const labels = index === 0 ? ["Revenue", "Activation", "Expansion"] : ["Usage", "Solver", "Quality"];
  assert.deepEqual(chart.headers, ["Period", ...labels, "Volume"]);
  assert.equal(chart.rows.length, 24, `card ${index}: 24 table rows`);
  assert.deepEqual(chart.markerShapes, [["circle"], ["rect"], ["path"]], "series use distinct marker shapes");
  assert.deepEqual(chart.rows[0].values, index === 0 ? [42, 31, 18, 34] : [49, 39.75, 28.5, 41]);
  assert.deepEqual(chart.rows.at(-1).values, index === 0 ? [118, 96, 77, 130] : [125, 104.75, 87.5, 137]);
  assert.deepEqual(chart.legend.map((item) => item.label), labels);
  assert.equal(new Set(chart.series.map((series) => series.dash)).size, 3,
    `card ${index}: series have three distinguishable line styles`);

  assert.deepEqual(chart.scoreTicks.map((tick) => tick.value), [20, 40, 60, 80, 100, 120]);
  const [scoreFirst, scoreLast] = [chart.scoreTicks[0], chart.scoreTicks.at(-1)];
  const scoreY = (value) => scoreFirst.y + (value - scoreFirst.value)
    * (scoreLast.y - scoreFirst.y) / (scoreLast.value - scoreFirst.value);
  chart.scoreTicks.forEach((tick) => near(tick.y, scoreY(tick.value), "score grid and labels agree"));
  assert.equal(chart.volumeTicks.length, 2, "volume has an explicit independent scale");
  const [volumeTop, volumeBottom] = chart.volumeTicks;
  assert.equal(volumeTop.value, chart.rows.at(-1).values[3]);
  assert.equal(volumeBottom.value, 0);
  const volumeY = (value) => volumeBottom.y
    - (value / volumeTop.value) * (volumeBottom.y - volumeTop.y);

  assert.equal(chart.periodTicks[0].period, 1);
  assert.equal(chart.periodTicks.at(-1).period, 24);
  const firstX = chart.periodTicks[0].x;
  const lastX = chart.periodTicks.at(-1).x;
  const periodX = (period) => firstX + (period - 1) * (lastX - firstX) / 23;
  chart.periodTicks.forEach((tick) => near(tick.x, periodX(tick.period), "period label matches plotted x"));

  chart.series.forEach((series, seriesIndex) => {
    assert.equal(series.points.length, 24, "each path has 24 points");
    assert.equal(chart.legend[seriesIndex].dash, series.dash, "legend reproduces path dash pattern");
    assert.equal(chart.legend[seriesIndex].stroke, series.stroke, "legend reproduces path color");
    series.points.forEach(([x, y], periodIndex) => {
      near(x, periodX(periodIndex + 1), `card ${index}, series ${seriesIndex}, period ${periodIndex + 1}: x`);
      near(y, scoreY(chart.rows[periodIndex].values[seriesIndex]),
        `card ${index}, series ${seriesIndex}, period ${periodIndex + 1}: SVG and table value agree`);
    });
  });
  assert.equal(chart.bars.length, 24);
  chart.bars.forEach((bar, periodIndex) => {
    assert.equal(chart.rows[periodIndex].period, `Period ${periodIndex + 1}`);
    near(bar.x + bar.width / 2, periodX(periodIndex + 1), "volume bar and trend point share a period");
    near(bar.y, volumeY(chart.rows[periodIndex].values[3]), "volume table value and bar y agree");
    near(bar.y + bar.height, volumeBottom.y, "volume bars share the zero baseline");
  });
  assert.equal(chart.latest, chart.rows.at(-1).values[0], "callout shows the actual latest value");
}

async function verifyAxe(page, label) {
  const result = await page.evaluate(async () => {
    const results = await window.axe.run(document, { resultTypes: ["violations"] });
    return results.violations.map(({ id, impact, help, nodes }) => ({
      id, impact, help, targets: nodes.map((node) => node.target),
    }));
  });
  const blocking = result.filter(({ impact }) => ["serious", "critical"].includes(impact));
  assert.deepEqual(blocking, [], `${label}: serious/critical axe violations\n${JSON.stringify(blocking, null, 2)}`);
  console.log(`PASS ${label}: no serious/critical axe violations (${result.length} lower-impact advisories)`);
}

async function verifyReadableChart(page, card, index, width) {
  const viewport = card.locator(".chart-viewport");
  assert.equal(await viewport.getAttribute("tabindex"), "0", "chart viewport is in the natural tab order");
  assert.equal(await viewport.getAttribute("role"), "region", "chart viewport has a region role");
  assert.match(await viewport.getAttribute("aria-label"), /chart, horizontally scrollable$/,
    "chart region has an explicit accessible name and scroll affordance");
  const descriptionId = await viewport.getAttribute("aria-describedby");
  assert.match(await page.locator(`#${descriptionId}`).textContent(), /left and right arrow keys/,
    "chart region describes its keyboard scrolling affordance");

  const chart = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    labels: [...element.querySelectorAll(".axis-label, .value-label")].map((label) => {
      const matrix = label.getScreenCTM();
      const fontSize = parseFloat(getComputedStyle(label).fontSize);
      // CSS font size alone misses viewBox scaling: measure actual on-screen SVG units.
      const scale = matrix && Math.min(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
      return { text: label.textContent, pixels: fontSize * (scale ?? 0) };
    }),
  }));
  assert.ok(chart.labels.length > 0, `card ${index}: actual SVG labels are present`);
  chart.labels.forEach(({ text, pixels }) => {
    assert.ok(Number.isFinite(pixels) && pixels >= 10,
      `${width}px, card ${index}, SVG label "${text}": transformed font ${pixels}px must be >= 10px`);
  });
  assert.ok(chart.scrollWidth > chart.clientWidth,
    `${width}px, card ${index}: readable chart scrolls inside its own viewport`);
  await viewport.evaluate((element) => { element.scrollLeft = 0; });
  // Enter through Tab so :focus-visible is tested in keyboard, not prior mouse, modality.
  await card.locator(".js-bg-hex").focus();
  await page.keyboard.press("Tab");
  assert.equal(await viewport.evaluate((element) => {
    const style = getComputedStyle(element);
    return element === document.activeElement && element.matches(":focus-visible")
      && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
  }), true, `${width}px, card ${index}: chart has visible keyboard focus`);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction((index) => document.querySelectorAll(".chart-viewport")[index].scrollLeft > 0, index);
  assert.equal(await page.evaluate(() => window.scrollX), 0, "chart arrow scrolling does not move the whole page horizontally");
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction((index) => document.querySelectorAll(".chart-viewport")[index].scrollLeft === 0, index);
}

async function verifyRenderedContrast(card) {
  const result = await card.evaluate((element) => {
    const rgb = (value) => {
      const channels = value.match(/[\d.]+/g).map(Number);
      return [...channels.slice(0, 3), channels[3] ?? 1];
    };
    const composite = (top, bottom) => top.slice(0, 3).map((channel, index) =>
      bottom[index] + (channel - bottom[index]) * top[3]);
    const background = (node) => {
      const layers = [];
      for (let parent = node; parent; parent = parent.parentElement) layers.unshift(parent);
      return layers.reduce((base, layer) => composite(rgb(getComputedStyle(layer).backgroundColor), base), [255, 255, 255]);
    };
    const luminance = (color) => color.slice(0, 3).reduce((total, channel, index) => {
      const value = channel / 255;
      return total + [0.2126, 0.7152, 0.0722][index] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    }, 0);
    const ratio = (first, second) => {
      const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const samples = [
      [".js-resolved-color", 8], [".palette-result", 4.7], [".chart-summary", 4.7], [".chart-scroll-hint", 4.7],
      ["h2", 4.5], [".chart-card__eyebrow", 4.5], [".hex-input", 4.5],
      [".metric strong", 4.5], [".metric span", 4.5], [".tag--good", 4.5], [".tag--warn", 4.5],
    ].map(([selector, target]) => {
      const node = element.querySelector(selector);
      return { selector, target, actual: ratio(rgb(getComputedStyle(node).color), background(node)) };
    });
    const bar = element.querySelector(".plot .bar");
    samples.push({ selector: "volume bars", target: 3.3, actual: ratio(rgb(getComputedStyle(bar).fill), background(bar)) });
    for (const name of ["a", "b", "c"]) {
      const line = element.querySelector(`.plot .series-line.line-${name}`);
      samples.push({ selector: `series-${name}`, target: 3.3, actual: ratio(rgb(getComputedStyle(line).stroke), background(line)) });
    }
    return {
      requested: element.dataset.bg,
      resolved: element.dataset.resolvedBg,
      applied: "#" + rgb(getComputedStyle(element).backgroundColor).slice(0, 3)
        .map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("").toUpperCase(),
      frame: "#" + rgb(getComputedStyle(element).borderTopColor).slice(0, 3)
        .map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("").toUpperCase(),
      input: getComputedStyle(element).getPropertyValue("--demo-input-bg").trim(),
      overlays: element.querySelectorAll('.plot linearGradient, .plot .target-band').length,
      samples,
    };
  });
  assert.equal(result.input, result.requested, "input CSS token retains the requested color");
  assert.equal(result.frame, result.requested, "actual frame renders the requested color");
  assert.equal(result.applied, result.resolved, "actual content background renders the resolved color");
  assert.equal(result.overlays, 0, "plot does not layer translucent bands over the measured base");
  result.samples.forEach(({ selector, target, actual }) => {
    assert.ok(actual + 1e-9 >= target, `${result.requested} -> ${result.resolved}, ${selector}: actual rendered ratio ${actual} < ${target}`);
  });
}

async function verifyInspector(page, cards) {
  const input = await cards.nth(0).getAttribute("data-bg");
  const expected = createContrastFit(input);
  const actual = JSON.parse(await page.locator(".js-json-output").textContent());
  const stableNumbers = (value) => {
    if (typeof value === "number") return Number(value.toFixed(12));
    if (Array.isArray(value)) return value.map(stableNumbers);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, stableNumbers(child)]),
    );
    return value;
  };
  assert.deepEqual(stableNumbers(actual), stableNumbers(expected), "live inspector JSON follows the first card, not the second");
  const rows = await page.locator(".js-token-output > li").evaluateAll((elements) => elements.map((element) => ({
    name: element.querySelector("strong").textContent,
    css: element.querySelector("code").textContent,
    detail: element.querySelector("small").textContent,
  })));
  assert.equal(rows.length, 17, "inspector displays all semantic tokens");
  rows.forEach((row, index) => {
    assert.equal(row.name, expected.tokens[index].name);
    assert.equal(row.css, expected.tokens[index].css);
    assert.ok(row.detail.includes(expected.tokens[index].effectiveColor));
  });
  const css = await page.locator(".js-css-output").textContent();
  const lines = Object.entries(paletteToCssVariables(expected)).map(([name, value]) => `  ${name}: ${value};`).join("\n");
  assert.equal(css, `.contrast-fit-surface {\n${lines}\n}`, "inspector CSS contains the actual 17 default-prefix custom properties");
  const repair = await page.locator(".js-repair-output").textContent();
  assert.ok(repair.includes(`${expected.inputBackground} → ${expected.background}`));
  for (const { message } of expected.adjustments) assert.ok(repair.includes(message));
}

async function verifyInputs(page, cards, index) {
  const card = cards.nth(index);
  const other = cards.nth(1 - index);
  const input = card.locator(".js-bg-hex");
  const picker = card.locator(".js-bg-picker");
  const status = card.locator(".js-palette-status");
  const original = await card.getAttribute("data-bg");
  const otherBackground = await other.getAttribute("data-bg");

  await input.fill("#12XZ");
  assert.equal(await input.getAttribute("aria-invalid"), "true");
  assert.equal(await status.getAttribute("data-state"), "error");
  assert.match(await status.textContent(), /3- or 6-digit hex/);
  assert.equal(await status.isVisible(), true);
  assert.equal(await card.getAttribute("data-bg"), original, "invalid drafts retain the palette");
  assert.equal((await picker.inputValue()).toUpperCase(), original);
  await page.keyboard.press("Tab");
  assert.equal(await input.inputValue(), "#12XZ", "invalid draft remains available for correction on blur");
  await input.focus();
  await page.keyboard.press("Escape");
  assert.equal(await input.inputValue(), original, "Escape restores the last committed color");
  assert.equal(await input.getAttribute("aria-invalid"), "false");

  await input.fill("");
  await input.pressSequentially("#abcdef");
  assert.equal(await input.inputValue(), "#abcdef", "live shorthand preview does not rewrite an unfinished six-digit draft");
  assert.equal(await card.getAttribute("data-bg"), "#ABCDEF");
  assert.equal(await input.getAttribute("aria-invalid"), "false");
  assert.equal((await picker.inputValue()).toUpperCase(), "#ABCDEF");
  await page.keyboard.press("Enter");
  assert.equal(await input.inputValue(), "#ABCDEF", "Enter canonicalizes a valid draft");

  await input.fill(" #f0a ");
  await page.keyboard.press("Tab");
  assert.equal(await input.inputValue(), "#FF00AA", "blur canonicalizes trimmed shorthand");
  assert.equal(await card.getAttribute("data-bg"), "#FF00AA");

  await input.fill("#123456");
  await page.keyboard.press("Escape");
  assert.equal(await card.getAttribute("data-bg"), "#FF00AA", "Escape also undoes a valid live preview");

  // Headless Chromium has no portable native color-popup UI; exercise its standard DOM events.
  await picker.evaluate((element) => {
    element.value = "#204060";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(await input.inputValue(), "#204060", "color picker synchronizes the hex field");
  assert.equal(await card.getAttribute("data-bg"), "#204060");

  await input.fill("#777777");
  await page.keyboard.press("Enter");
  assert.equal(await card.getAttribute("data-bg"), "#777777");
  assert.equal(await input.getAttribute("aria-invalid"), "false", "automatic fitting is not a parse error");
  assert.equal(await status.isVisible(), true);
  assert.equal(await status.getAttribute("data-state"), "adapted", "mid-gray is automatically repaired, not rejected");
  assert.match(await status.textContent(), /^Auto-fitted content/);
  assert.notEqual(await card.getAttribute("data-resolved-bg"), "#777777");
  assert.equal(await card.getAttribute("data-usable"), "true");
  assert.equal(await input.inputValue(), "#777777", "original choice stays editable, not silently overwritten");
  await verifyRenderedContrast(card);
  await verifyInspector(page, cards);
  assert.equal(await other.getAttribute("data-bg"), otherBackground, "cards update independently");

  await input.fill(original);
  await page.keyboard.press("Enter");
  assert.equal(await card.getAttribute("data-bg"), original);
  assert.equal(await status.isVisible(), false, "returning to an already-suitable baseline clears the adaptation note");
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.every((arg) => arg === "--source"), "Usage: node test/browser/dashboard-smoke.mjs [--source]");
  const sourceMode = args.includes("--source");
  const siteDir = resolve(projectDir, sourceMode ? "." : "public");
  await stat(resolve(siteDir, "examples/dashboard/index.html")).catch(() => {
    throw new Error("Built dashboard missing. Run npm run build before the browser smoke test.");
  });
  const server = await startStaticServer(siteDir);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    context.setDefaultTimeout(10_000);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(`${server.origin}/examples/dashboard/`, { waitUntil: "networkidle" });
    const cards = page.locator(".js-contrast-card");
    await cards.nth(1).locator(".js-plot .series-line.line-a").waitFor();
    assert.equal(await cards.count(), 2);
    assert.equal(await cards.nth(0).getAttribute("data-bg"), "#2B3548");
    assert.equal(await cards.nth(1).getAttribute("data-bg"), "#F5F7F9");
    assert.equal(await cards.nth(0).locator("h2").textContent(), "North America expansion");
    assert.equal(await cards.nth(1).locator("h2").textContent(), "iOS feature velocity");
    await verifyInspector(page, cards);
    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    assert.deepEqual(duplicateIds, [], "SVG gradients and accessible descriptions have unique IDs");
    await page.addScriptTag({ content: axe.source });
    await verifyAxe(page, "desktop baseline, collapsed tables");

    // Natural order: GitHub -> quick examples -> picker -> hex -> chart viewport -> data summary.
    // The chart is intentionally focusable for native arrow-key scrolling; details still need no custom handler.
    await page.locator(".github-link").focus();
    for (const color of ["#777777", "#2B3548"]) {
      await page.keyboard.press("Tab");
      assert.equal(await page.locator(`[data-background="${color}"]`).evaluate((element) =>
        element === document.activeElement && element.matches(":focus-visible") &&
        getComputedStyle(element).outlineStyle !== "none"), true,
      "quick-example buttons are keyboard reachable with visible focus");
    }
    for (const selector of [".js-bg-picker", ".js-bg-hex", ".chart-viewport", ".data-table summary"]) {
      await page.keyboard.press("Tab");
      assert.equal(await cards.nth(0).locator(selector).evaluate((element) => element === document.activeElement), true,
        `Tab reaches ${selector}`);
      if (selector === ".chart-viewport") {
        assert.equal(await cards.nth(0).locator(selector).evaluate((element) => {
          const style = getComputedStyle(element);
          return element.matches(":focus-visible") && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
        }), true, "chart's new tab stop has a visible focus outline");
      }
    }
    for (let index = 0; index < 2; index += 1) {
      const card = cards.nth(index);
      const summary = card.locator("summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.equal(await card.locator("details").getAttribute("open"), "", "Enter opens the data table");
      assert.equal(await summary.evaluate((element) => {
        const style = getComputedStyle(element);
        return element.matches(":focus-visible") && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
      }), true, "keyboard focus has a visible outline");
      await page.keyboard.press("Space");
      assert.equal(await card.locator("details").getAttribute("open"), null, "Space closes the data table");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      assert.equal(await card.locator(".js-data-table").evaluate((element) => element === document.activeElement), true,
        "expanded scroll region is keyboard reachable");
      await verifyChart(card, index);
      await verifyInputs(page, cards, index);
    }
    console.log("PASS both cards: all 144 trend points + 48 volume bars match tables/axes; fractional values, callouts and legend styles agree");
    console.log("PASS both cards: invalid input, six-digit typing, shorthand, Enter/blur/Escape, picker synchronization, #777777 auto-repair and isolation");
    console.log("PASS keyboard: tab order, visible focus and Enter/Space details toggles");
    await verifyAxe(page, "desktop baseline, expanded tables");

    const repairedCard = cards.nth(0);
    await page.locator('[data-background="#777777"]').click();
    assert.equal(await repairedCard.getAttribute("data-bg"), "#777777", "quick example changes the requested background");
    assert.equal(await repairedCard.getAttribute("data-usable"), "true");
    await verifyRenderedContrast(repairedCard);
    await verifyInspector(page, cards);
    await verifyAxe(page, "auto-repaired mid-gray with expanded table");
    for (const inputColor of ["#000000", "#FFFFFF", "#8855EE", "#FF00FF", "#000044", "#808080"]) {
      const field = repairedCard.locator(".js-bg-hex");
      await field.fill(inputColor);
      await field.press("Enter");
      assert.equal(await repairedCard.getAttribute("data-bg"), inputColor);
      assert.equal(await repairedCard.getAttribute("data-usable"), "true");
      await verifyRenderedContrast(repairedCard);
      await verifyInspector(page, cards);
    }
    await page.locator('[data-background="#2B3548"]').click();
    console.log("PASS automatic repair: original frame retained, resolved content applied, actual computed text/surface/series contrast verified for 7 difficult colors");

    for (const width of [320, 375, 680, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => ({
        viewport: window.innerWidth,
        page: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        controls: [...document.querySelectorAll(".card-controls input, .chart-viewport, .data-table summary")].map((element) => {
          const { left, right } = element.getBoundingClientRect();
          return { left, right };
        }),
      }));
      assert.ok(overflow.page <= overflow.viewport + 1, `${width}px: no horizontal page overflow (${JSON.stringify(overflow)})`);
      overflow.controls.forEach(({ left, right }) => {
        assert.ok(left >= 0 && right <= width + 1, `${width}px: controls and summaries remain on screen`);
      });
      for (let index = 0; index < 2; index += 1) {
        await verifyReadableChart(page, cards.nth(index), index, width);
      }
      if (width === 320) {
        for (let index = 0; index < 2; index += 1) {
          const table = cards.nth(index).locator(".js-data-table");
          assert.equal(await table.evaluate((element) => element.scrollWidth > element.clientWidth), true,
            "narrow tables scroll locally, not the page");
          await table.focus();
          await page.keyboard.press("ArrowRight");
          await page.waitForFunction((index) => document.querySelectorAll(".js-data-table")[index].scrollLeft > 0, index);
        }
        await verifyAxe(page, "320px mobile baseline, expanded tables");
        await page.locator('[data-background="#777777"]').click();
        await verifyRenderedContrast(repairedCard);
        await verifyAxe(page, "320px mobile auto-repaired mid-gray, expanded table");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
          "mobile adaptation note does not cause page overflow");
        await page.locator('[data-background="#2B3548"]').click();
      }
    }
    console.log("PASS live inspector: 17 tokens, effective colors, CSS, JSON and repair messages follow only the first card");
    console.log("PASS responsive: 320/375/680/768px SVG labels render >=10px; labeled chart regions have visible focus and arrow-key scrolling; no horizontal page overflow; narrow tables scroll by keyboard");
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${server.origin}/docs/`, { waitUntil: "networkidle" });
      assert.match(await page.locator("#usage").textContent(), /Install the first public release/);
      assert.match(await page.locator("body").textContent(), /npm install contrast-fit@0\.1\.0/);
      assert.equal(await page.locator('a[href="https://www.npmjs.com/package/contrast-fit/v/0.1.0"]').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
        `${width}px: product documentation does not overflow the page`);
      if (width === 320) {
        const codeExamples = page.locator("pre");
        assert.equal(await codeExamples.count(), 3);
        for (let index = 0; index < 3; index += 1) {
          const example = codeExamples.nth(index);
          assert.equal(await example.getAttribute("tabindex"), "0");
          assert.equal(await example.getAttribute("role"), "region");
          assert.ok(await example.getAttribute("aria-label"));
          await page.locator("#usage").click();
          await page.keyboard.press("Tab");
          await example.focus();
          assert.equal(await example.evaluate((element) => element.matches(":focus-visible")
            && getComputedStyle(element).outlineStyle !== "none"), true,
          "scrollable documentation code has visible keyboard focus");
          await page.keyboard.press("ArrowRight");
          await page.waitForFunction((index) => document.querySelectorAll("pre")[index].scrollLeft > 0, index);
        }
      }
      await page.addScriptTag({ content: axe.source });
      await verifyAxe(page, `${width}px product documentation with confirmed installation instructions`);
    }
    console.log("PASS product documentation: registry installation instructions, desktop/mobile layout and accessibility gate");
    assert.deepEqual(errors, [], `no page errors or failed requests: ${JSON.stringify(errors)}`);
    console.log(`PASS dashboard browser smoke (${sourceMode ? "source preview" : "built public/"}; Chromium ${browser.version()})`);
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
}

// Keep `node --test` focused on unit tests; this gate deliberately needs a prior build.
if (process.env.NODE_TEST_CONTEXT) {
  const { test } = await import("node:test");
  test("dashboard browser smoke", { skip: "Run node test/browser/dashboard-smoke.mjs after npm run build" }, () => {});
} else {
  await main();
}
