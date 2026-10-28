// Real-engine regression for the built Studio, including a GitHub Pages project mount.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, realpath, stat, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import axe from "axe-core";
import { createContrastFit } from "../../src/contrast-fit.js";
import { verifyScenarios } from "./studio-scenarios.mjs";

const args = process.argv.slice(2);
assert.ok(args.every((arg) => arg === "--source" || arg.startsWith("--screenshots=")), "Usage: studio-smoke.mjs [--source] [--screenshots=/absolute/path]");
const project = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const root = await realpath(resolve(project, args.includes("--source") ? "." : "public"));
const screenshotDir = args.find((arg) => arg.startsWith("--screenshots="))?.slice("--screenshots=".length);
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const mount = "/contrast-fit/";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/favicon.ico") return response.writeHead(204).end();
    if (!pathname.startsWith(mount)) return response.writeHead(404).end();
    let file = resolve(root, pathname.slice(mount.length));
    if (file !== root && !file.startsWith(root + sep)) return response.writeHead(403).end();
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
    file = await realpath(file);
    if (!file.startsWith(root + sep)) return response.writeHead(403).end();
    response.writeHead(200, { "Content-Type": `${mime[extname(file)] ?? "text/plain"};charset=utf-8`, "Cache-Control": "no-store" });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}${mount}`;
const defaults = { backgroundStrategy: "auto", textContrast: 8, mutedContrast: 4.7, accentContrast: 3.3, surfaceTextContrast: 4.5, accents: { seriesA: "#18B7A6", seriesB: "#F06B8A", seriesC: "#8F7DFF" } };
const hex = (css) => "#" + css.match(/[\d.]+/g).slice(0, 3).map((value) => Math.round(Number(value)).toString(16).padStart(2, "0")).join("").toUpperCase();
const rgb = (color) => color.startsWith("#") ? [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16)) : color.match(/[\d.]+/g).map(Number);
// Independent WCAG/sRGB calculation: raster regression must not trust the engine's
// background-only metric or merely compare CSS stroke declarations.
function renderedRatio(foreground, background) {
  const luminance = (channels) => channels.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const pixelReports = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForURL(`${base}examples/studio/`);
  await page.locator("#chart .series-path").first().waitFor();
  assert.match(await page.title(), /Studio/);

  async function axeCheck(label) {
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => (await window.axe.run(document)).violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((item) => item.target) })));
    assert.deepEqual(violations.filter(({ impact }) => ["serious", "critical"].includes(impact)), [], `${label}: serious/critical axe violations: ${JSON.stringify(violations)}`);
    console.log(`PASS Studio axe: ${label}`);
  }
  async function applyAnalytics(background) {
    await page.locator("#analytics-picker").evaluate((element, value) => {
      element.value = value; element.dispatchEvent(new Event("input", { bubbles: true }));
    }, background);
    return page.evaluate(async ({ source, background, options }) => (await import(source)).createContrastFit(background, options),
      { source: `${base}src/contrast-fit.js`, background, options: defaults });
  }
  async function verifyChart(expected) {
    for (const name of ["interface", "commerce", "reading", "analytics"]) assert.equal(await page.locator(`#scene-${name}`).isVisible(), true);
    const chart = await page.locator("#chart").evaluate((element) => ({
      series: [...element.querySelectorAll("[data-chart-series]")].map((group) => ({
        name: group.dataset.chartSeries, d: group.querySelector(".series-path").getAttribute("d"),
        stroke: getComputedStyle(group.querySelector(".series-path")).stroke,
        dash: group.querySelector(".series-path").getAttribute("stroke-dasharray"),
        markers: [...group.querySelectorAll(".series-marker")].map((marker) => marker.tagName),
      })),
      labels: [...element.querySelectorAll("text")].map((item) => item.textContent),
    }));
    const rows = await page.locator("#fixture-data tr").evaluateAll((rows) => rows.map((row) => [...row.querySelectorAll("td")].map((cell) => Number(cell.textContent))));
    assert.equal(rows.length, 6); assert.deepEqual(rows[0], [24, 18, 12]); assert.deepEqual(rows.at(-1), [82, 67, 64]);
    assert.deepEqual(chart.labels, ["0", "20", "40", "60", "80", "100", "P1", "P2", "P3", "P4", "P5", "P6"]);
    for (const [index, series] of chart.series.entries()) {
      assert.equal(series.dash, expected.seriesStyles[series.name].dashArray);
      assert.equal(hex(series.stroke), expected.colors[series.name]);
      assert.deepEqual([...new Set(series.markers)], [["circle"], ["rect"], ["path"]][index]);
      const points = [...series.d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((match) => match.slice(1).map(Number));
      assert.equal(points.length, 6);
      points.forEach(([x, y], period) => { assert.equal(x, 48 + period * 116); assert.ok(Math.abs(y - (228 - rows[period][index] * 2.1)) < 1e-8); });
      const legend = page.locator("#chart-legend > span").nth(index);
      assert.equal(await legend.locator(".series-path").getAttribute("stroke-dasharray"), series.dash);
      assert.equal(await legend.locator(".series-marker").evaluate((element) => element.tagName), series.markers[0]);
    }
  }
  async function verifyRenderedSeries(expected, label) {
    await verifyChart(expected);
    await page.evaluate(() => window.scrollTo(0, 0));
    const samples = await page.evaluate(() => {
      const svg = document.querySelector("#chart");
      const point = (element, x, y) => {
        const p = new DOMPoint(x, y).matrixTransform(element.getScreenCTM());
        return { x: p.x + scrollX, y: p.y + scrollY };
      };
      const series = [...svg.querySelectorAll("[data-chart-series]")].map((group, index) => {
        const path = group.querySelector(".series-path");
        const points = [...path.getAttribute("d").matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((match) => match.slice(1).map(Number));
        const crossings = [];
        for (let i = 1; i < points.length; i++) for (const value of [20, 40, 60, 80]) {
          const y = 228 - value * 2.1; const [a, b] = [points[i - 1], points[i]];
          if (y < Math.min(a[1], b[1]) || y > Math.max(a[1], b[1]) || a[1] === b[1]) continue;
          crossings.push(point(svg, a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y));
        }
        const legend = document.querySelectorAll(".legend-key")[index];
        return { key: group.dataset.chartSeries, crossings,
          markers: [...group.querySelectorAll(".series-marker")].map((marker) => {
            const box = marker.getBBox(); return point(svg, box.x + box.width / 2, box.y + box.height / 2);
          }),
          line: Array.from({ length: 48 }, (_, i) => { const p = path.getPointAtLength(path.getTotalLength() * (i + 0.5) / 48); return point(svg, p.x, p.y); }),
          legend: point(legend, 17, 7), legendBackground: point(legend, 17, 0),
          backingOrder: path.previousElementSibling?.classList.contains("series-halo") && [...group.querySelectorAll(".series-marker")].every((marker) => marker.previousElementSibling?.classList.contains("series-marker-halo")),
        };
      });
      return { series, clear: [point(svg, 120, 205), point(svg, 120, 150)], grid: point(svg, 90, 18), axis: point(svg, 90, 228),
        grids: svg.querySelectorAll(".chart-grid").length, axes: svg.querySelectorAll(".chart-axis").length, areas: svg.querySelectorAll(".chart-area").length };
    });
    const foreground = await page.screenshot({ fullPage: true });
    // Expose the backdrop at the *same* data coordinates, leaving the real opaque
    // knockouts, grid, axis and decoration in place. This is not a clean fake SVG.
    const hideData = await page.addStyleTag({ content: "#chart .series-path,#chart .series-marker,#chart-legend .series-path,#chart-legend .series-marker{visibility:hidden!important}" });
    let backdrop;
    try { backdrop = await page.screenshot({ fullPage: true }); } finally { await hideData.evaluate((element) => element.remove()); }
    const pixels = await page.evaluate(async ({ foreground, backdrop, samples }) => {
      async function decode(base64) {
        const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d"); context.drawImage(image, 0, 0); return context;
      }
      const [front, back] = await Promise.all([decode(foreground), decode(backdrop)]);
      // Sample the pixel containing the SVG center, not its rounded neighbor.
      const at = (context, point) => [...context.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data];
      const around = (context, point) => [...context.getImageData(Math.round(point.x) - 1, Math.round(point.y) - 1, 3, 3).data].reduce((colors, _, i, all) => i % 4 ? colors : [...colors, all.slice(i, i + 4)], []);
      return { series: samples.series.map((series) => ({ key: series.key, backingOrder: series.backingOrder,
        markers: series.markers.map((point) => ({ foreground: at(front, point), background: at(back, point) })),
        line: series.line.map((point) => ({ foreground: around(front, point), background: around(back, point) })),
        crossings: series.crossings.map((point) => at(back, point)),
        legend: { foreground: at(front, series.legend), background: at(back, series.legend), clear: at(front, series.legendBackground) },
      })), clear: samples.clear.map((point) => at(front, point)), grid: around(front, samples.grid), axis: around(front, samples.axis) };
    }, { foreground: foreground.toString("base64"), backdrop: backdrop.toString("base64"), samples });
    if (screenshotDir) {
      await writeFile(resolve(screenshotDir, `studio-raster-${label}.png`), foreground);
      await writeFile(resolve(screenshotDir, `studio-raster-${label}-backdrop.png`), backdrop);
      await writeFile(resolve(screenshotDir, `studio-raster-${label}.json`), JSON.stringify({ samples, pixels }, null, 2) + "\n");
    }
    const bg = [...rgb(expected.background), 255];
    assert.equal(samples.areas, 0, "no translucent area beneath meaningful data");
    assert.equal(samples.grids, 6, "decorative grid remains"); assert.equal(samples.axes, 1, "axis remains");
    for (const pixel of pixels.clear) assert.deepEqual(pixel, bg, `${label}: clear plot uses the opaque resolved background`);
    for (const boundary of ["grid", "axis"]) assert.ok(pixels[boundary].some((pixel) => pixel.some((channel, i) => channel !== bg[i])), `${label}: ${boundary} remains visibly rendered outside the data knockouts`);
    let crossings = 0;
    for (const series of pixels.series) {
      const color = [...rgb(expected.colors[series.key]), 255];
      const checkPixel = (pixel) => {
        assert.deepEqual(pixel.foreground, color, `${label}/${series.key}: actual data pixel color`);
        assert.deepEqual(pixel.background, bg, `${label}/${series.key}: actual backing below data`);
        const actualRatio = renderedRatio(pixel.foreground, pixel.background);
        assert.ok(actualRatio >= expected.targets.accentContrast, `${label}/${series.key}: actual rendered ${actualRatio} meets ${expected.targets.accentContrast}`);
        assert.ok(Math.abs(actualRatio - expected.metrics[`${series.key}Contrast`]) < 1e-10);
      };
      assert.equal(series.backingOrder, true, "each knockout immediately precedes its own data mark");
      assert.equal(series.markers.length, 6); for (const marker of series.markers) checkPixel(marker);
      const solidLinePixels = series.line.flatMap((sample) => sample.foreground.flatMap((foreground, index) => foreground.every((channel, i) => channel === color[i]) ? [{ foreground, background: sample.background[index] }] : []));
      assert.ok(solidLinePixels.length >= 3, `${label}/${series.key}: raster contains opaque line pixels, including returned dash patterns`);
      for (const pixel of solidLinePixels) checkPixel(pixel);
      assert.ok(series.crossings.length >= 2);
      for (const pixel of series.crossings) assert.deepEqual(pixel, bg, `${label}/${series.key}: real grid-intersection backing is exact, not alpha-composited`);
      crossings += series.crossings.length;
      checkPixel(series.legend); assert.deepEqual(series.legend.clear, bg, "legend has the same resolved background");
    }
    pixelReports.push({ label, background: expected.background, target: expected.targets.accentContrast, gridCrossings: crossings,
      series: pixels.series.map((series) => ({ key: series.key, ...series.markers[0], ratio: renderedRatio(series.markers[0].foreground, series.markers[0].background) })) });
    console.log(`PASS Studio raster: ${label}, 18 markers + all 3 lines/legends + ${crossings} grid intersections preserve actual ${expected.targets.accentContrast}:1 target`);
  }
  for (const [label, background] of [["default-midnight", "#101D29"], ["default-midgray", "#777777"], ["default-paper", "#F1F5FA"], ["default-black", "#000000"], ["default-magenta", "#FF00FF"], ["default-yellow", "#FFFF00"]]) {
    const expected = await applyAnalytics(background);
    // The production renderer has no configurable targets: strict option/API cases
    // remain in core/package contracts, not a fabricated reachable demo workflow.
    assert.equal(expected.targets.accentContrast, 3.3);
    assert.equal(expected.background, createContrastFit(background).background);
    await verifyRenderedSeries(expected, label);
  }
  await verifyScenarios({ page, base, screenshotDir, axeCheck, renderedRatio });
  const links = await page.locator('a[href="../dashboard/"], a[href="../../docs/"]').evaluateAll((items) => items.map((item) => item.href));
  for (const url of links) assert.equal((await context.request.get(url)).status(), 200, "project-subpath docs/legacy route works");
  assert.deepEqual(errors, [], `No console, network, or page errors: ${JSON.stringify(errors)}`);
  console.log(`PASS Studio: root/project-subpath routing, keyboard, 320/375/768px fit, local chart scrolling, accessible descriptions; Chromium ${browser.version()}`);
  if (screenshotDir) { await writeFile(resolve(screenshotDir, "studio-rendered-contrast.json"), JSON.stringify(pixelReports, null, 2) + "\n"); console.log(`Screenshots and actual rendered contrast: ${screenshotDir}`); }
} finally {
  await browser?.close();
  await new Promise((done) => { server.close(done); server.closeAllConnections(); });
}
