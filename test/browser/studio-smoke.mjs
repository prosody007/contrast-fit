// Real-engine regression for the built Studio, including a GitHub Pages project mount.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, realpath, stat, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import axe from "axe-core";
import { createContrastFit, paletteToCssVariables, contrastRatio, parseHex } from "../../src/contrast-fit.js";

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
const stable = (value) => typeof value === "number" ? Number(value.toFixed(11)) : Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, stable(child)])) : value;
const hex = (css) => "#" + css.match(/[\d.]+/g).slice(0, 3).map((value) => Math.round(Number(value)).toString(16).padStart(2, "0")).join("").toUpperCase();
const rgb = (color) => color.startsWith("#") ? [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16)) : color.match(/[\d.]+/g).map(Number);
const composite = (color, background) => color.slice(0, 3).map((channel, index) => Math.round(channel * (color[3] ?? 1) + background[index] * (1 - (color[3] ?? 1))));
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForURL(`${base}examples/studio/`);
  await page.locator("[data-token-index='16']").waitFor();
  assert.match(await page.title(), /Studio/);
  assert.equal(await page.locator("#resolved-color").textContent(), createContrastFit("#777777").background);

  async function choosePanel(name) { await page.locator(`[data-panel=${name}]`).click(); }
  async function chooseFormat(name) { await page.locator(`[data-format=${name}]`).click(); }
  async function json() { await choosePanel("export"); await chooseFormat("json"); return JSON.parse(await page.locator("#export-output").textContent()); }
  async function axeCheck(label) {
    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => (await window.axe.run(document)).violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((item) => item.target) })));
    assert.deepEqual(violations.filter(({ impact }) => ["serious", "critical"].includes(impact)), [], `${label}: serious/critical axe violations: ${JSON.stringify(violations)}`);
    console.log(`PASS Studio axe: ${label}`);
  }
  async function fill(id, value) { await page.locator(`#${id}`).fill(value); await page.locator(`#${id}`).press("Enter"); }
  async function verifyEngine(background, options = defaults, prefix = "contrast-fit", browserEngine = false) {
    const expected = browserEngine ? await page.evaluate(async ({ background, options, source }) => {
      const { createContrastFit } = await import(source);
      return createContrastFit(background, options);
    }, { background, options, source: `${base}src/contrast-fit.js` }) : createContrastFit(background, options);
    const actual = await json();
    assert.equal(actual.version, "0.1.0"); assert.equal(actual.inputBackground, expected.inputBackground);
    assert.deepEqual(stable(actual.options), stable(options)); assert.equal(actual.prefix, prefix);
    assert.deepEqual(stable(actual.palette), stable(expected), "full JSON matches actual source engine");
    assert.deepEqual(actual.cssVariables, paletteToCssVariables(expected, prefix));
    const rendered = await page.locator("#live-preview").evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor, text: getComputedStyle(element).color,
      variables: Object.fromEntries([...element.style].filter((name) => name.startsWith("--contrast-fit-")).map((name) => [name, getComputedStyle(element).getPropertyValue(name).trim()])),
      frame: getComputedStyle(document.querySelector("#preview-frame")).borderTopColor,
      metric: getComputedStyle(element.querySelector(".sample-metric")).backgroundColor,
      panel: getComputedStyle(element.querySelector(".sample-panel")).backgroundColor,
      muted: getComputedStyle(element.querySelector(".sample-muted")).color,
      goodBg: getComputedStyle(element.querySelector(".good")).backgroundColor,
      goodText: getComputedStyle(element.querySelector(".good")).color,
      warnBg: getComputedStyle(element.querySelector(".warn")).backgroundColor,
      warnText: getComputedStyle(element.querySelector(".warn")).color,
    }));
    assert.equal(hex(rendered.background), expected.background); assert.equal(hex(rendered.text), expected.colors.text);
    assert.equal(hex(rendered.frame), expected.inputBackground); assert.equal(hex(rendered.muted), expected.colors.muted);
    assert.equal(hex(rendered.goodBg), expected.colors.goodBg); assert.equal(hex(rendered.goodText), expected.colors.goodText);
    assert.equal(hex(rendered.warnBg), expected.colors.warnBg); assert.equal(hex(rendered.warnText), expected.colors.warnText);
    assert.deepEqual(rendered.variables, paletteToCssVariables(expected));
    assert.equal(rendered.metric, expected.colors.metric); assert.equal(rendered.panel, expected.colors.panel);
    const bg = rgb(rendered.background);
    const domRatios = {
      text: renderedRatio(rgb(rendered.text), bg), muted: renderedRatio(rgb(rendered.muted), bg),
      panelText: renderedRatio(rgb(rendered.text), composite(rgb(rendered.panel), bg)),
      panelMuted: renderedRatio(rgb(rendered.muted), composite(rgb(rendered.panel), bg)),
      metricText: renderedRatio(rgb(rendered.text), composite(rgb(rendered.metric), bg)),
      metricMuted: renderedRatio(rgb(rendered.muted), composite(rgb(rendered.metric), bg)),
      goodText: renderedRatio(rgb(rendered.goodText), rgb(rendered.goodBg)),
      warnText: renderedRatio(rgb(rendered.warnText), rgb(rendered.warnBg)),
    };
    for (const [key, actualRatio] of Object.entries(domRatios)) assert.ok(Math.abs(actualRatio - expected.metrics[`${key}Contrast`]) < 1e-10, `${key}: real rendered role relationship agrees with the reported metric`);
    for (const key of ["seriesA", "seriesB", "seriesC"]) {
      const applied = page.locator(`#${key}-applied`);
      const retained = options.accents[key] === expected.colors[key];
      assert.equal(await applied.getAttribute("data-color"), expected.colors[key]);
      assert.equal(await applied.getAttribute("data-retained"), String(retained));
      assert.ok((await applied.textContent()).includes(`Applied ${expected.colors[key]}`));
      assert.equal(await applied.locator("strong").textContent(), retained ? "Seed retained" : "Adjusted");
      assert.equal(hex(await applied.locator("i").evaluate((element) => getComputedStyle(element).backgroundColor)), expected.colors[key]);
      assert.ok((await page.locator(`#${key}`).getAttribute("aria-describedby")).includes(`${key}-applied`));
    }
    assert.equal(await page.locator("#live-preview").getAttribute("data-usable"), String(expected.usable));
    assert.equal(await page.locator("#checks-result").textContent(), `${Object.entries(expected.meetsTarget).filter(([key, pass]) => key !== "seriesDistinct" && pass).length} / 11 pass`);
    await choosePanel("measurements");
    const checks = await page.locator("#measurements-body tr").evaluateAll((rows) => rows.map((row) => ({ key: row.dataset.check, value: Number(row.dataset.value), target: Number(row.dataset.target), pass: row.dataset.pass === "true" })));
    assert.equal(checks.length, 11);
    for (const check of checks) {
      assert.equal(check.pass, expected.meetsTarget[check.key]);
      assert.equal(check.value, expected.metrics[`${check.key}Contrast`]);
      const targetKey = check.key === "text" ? "textContrast" : check.key === "muted" ? "mutedContrast" : check.key.startsWith("series") ? "accentContrast" : "surfaceTextContrast";
      assert.equal(check.target, expected.targets[targetKey]);
    }
    for (const adjustment of expected.adjustments) assert.ok((await page.locator("#adjustment-log").textContent()).includes(adjustment.message));
    for (const warning of expected.warnings) assert.ok((await page.locator("#warning-log").textContent()).includes(warning));
    for (const pair of ["AB", "AC", "BC"]) {
      const label = await page.locator(`[data-pair=${pair}]`).textContent();
      assert.ok(label.includes(expected.metrics[`series${pair}Distance`].toFixed(2)));
      assert.ok(label.includes(expected.metrics[`series${pair}PerceptualDistance`].toFixed(4)));
    }
    return expected;
  }
  async function verifyChart(expected) {
    await page.locator("[data-scene=analytics]").click();
    assert.equal(await page.locator("#scene-interface").isVisible(), false);
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
    await verifyChart(expected); await choosePanel("measurements");
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
      const at = (context, point) => [...context.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data];
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
  async function verifyComparison(expected) {
    await page.locator("[data-scene=compare]").click();
    assert.equal(await page.locator("#live-preview").isVisible(), false);
    const baseline = { text: "#FFFFFF", muted: "#A1A1AA", seriesA: "#18B7A6" };
    for (const name of ["baseline", "fitted"]) for (const key of ["text", "muted", "seriesA"]) {
      const color = name === "baseline" ? baseline[key] : expected.colors[key];
      const bg = name === "baseline" ? expected.inputBackground : expected.background;
      const result = page.locator(`#${name}-ratios [data-comparison=${key}]`);
      assert.ok(Math.abs(Number(await result.getAttribute("data-ratio")) - contrastRatio(parseHex(color), parseHex(bg))) < 1e-10);
      assert.equal(await page.locator(`#${name}-preview rect`).getAttribute("fill"), bg);
    }
    assert.match(await page.locator("#scene-compare").textContent(), /Baseline: text #FFFFFF/);
  }
  const initial = await verifyEngine("#777777");
  await choosePanel("tokens");
  const tokens = await page.locator("[data-token-index]").evaluateAll((items) => items.map((item) => ({ name: item.querySelector("strong").textContent, value: item.querySelector("small").textContent })));
  assert.equal(tokens.length, 17);
  tokens.forEach((token, index) => { assert.equal(token.name, initial.tokens[index].name); assert.equal(token.value, initial.tokens[index].css); });
  for (const index of [3, 4, 14, 16]) {
    await page.locator(`[data-token-index='${index}']`).click();
    const detail = await page.locator("#token-detail").textContent();
    assert.ok(detail.includes(initial.tokens[index].effectiveColor)); assert.ok(detail.includes(`${initial.tokens[index].color} / ${initial.tokens[index].alpha}`));
  }
  await page.locator("[data-token-index='4']").focus(); await page.keyboard.press("Enter");
  for (const background of ["#204060", "#777777"]) {
    await page.locator("#background-picker").evaluate((element, value) => { element.value = value; element.dispatchEvent(new Event("input", { bubbles: true })); }, background);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.tokenIndex), "4", "palette rerender preserves a focused token button");
    assert.match(await page.locator("#token-detail").textContent(), /CSS variable--contrast-fit-panel/);
  }
  await axeCheck("default interface + token explorer");
  await verifyChart(initial); await page.locator(".sample-data summary").click(); await axeCheck("analytics with expanded equivalent data");
  await verifyRenderedSeries(initial, "default-midgray");
  await verifyComparison(initial); await axeCheck("measured naive/fitted image comparison");
  await page.locator("[data-scene=interface]").click();

  // Invalid drafts are kept for correction; the palette and the complete export remain unchanged.
  const previous = await json();
  await page.locator("#background").fill("#12XZ");
  assert.equal(await page.locator("#background").getAttribute("aria-invalid"), "true");
  await page.locator("#background").press("Tab");
  assert.equal(await page.locator("#background").inputValue(), "#12XZ");
  assert.deepEqual(await json(), previous);
  await page.locator("#background").press("Escape"); assert.equal(await page.locator("#background").inputValue(), "#777777");
  await page.locator("#background").fill(""); await page.locator("#background").pressSequentially("#abcdef");
  assert.equal(await page.locator("#background").inputValue(), "#abcdef", "six-digit typing is not rewritten after a valid shorthand preview");
  await page.locator("#background").press("Enter"); assert.equal(await page.locator("#background").inputValue(), "#ABCDEF");
  await fill("background", " #f0a "); assert.equal(await page.locator("#background").inputValue(), "#FF00AA");
  await verifyEngine("#FF00AA");
  await page.locator("#background-picker").evaluate((element) => { element.value = "#204060"; element.dispatchEvent(new Event("input", { bubbles: true })); });
  await verifyEngine("#204060");
  for (const color of ["#000000", "#FFFFFF", "#FF00FF", "#FFFF00", "#090D12", "#777777"]) {
    await fill("background", color); await verifyEngine(color);
  }
  await page.locator("[name=strategy][value=preserve]").check();
  let options = structuredClone(defaults); options.backgroundStrategy = "preserve";
  const preserved = await verifyEngine("#777777", options);
  assert.equal(preserved.background, "#777777"); assert.equal(preserved.usable, false); assert.ok(preserved.warnings.length);
  assert.match(await page.locator("#result-status").textContent(), /Targets unresolved/);
  await axeCheck("preserved mid-gray with unresolved requested target");
  await page.locator("#target-controls summary").click();
  for (const [key, value] of [["textContrast", "12"], ["mutedContrast", "7"], ["accentContrast", "5"], ["surfaceTextContrast", "6"]]) {
    await fill(key, value); options[key] = Number(value);
  }
  await verifyEngine("#777777", options);
  const validTargets = await json(); await fill("textContrast", "22");
  assert.equal(await page.locator("#textContrast").getAttribute("aria-invalid"), "true"); assert.deepEqual(await json(), validTargets);
  await page.locator("#textContrast").press("Escape");
  await page.locator("[name=strategy][value=auto]").check(); options.backgroundStrategy = "auto";
  await verifyEngine("#777777", options);
  await page.locator("#extreme-targets").click();
  for (const key of ["textContrast", "mutedContrast", "accentContrast", "surfaceTextContrast"]) options[key] = 21;
  const extreme = await verifyEngine("#777777", options);
  assert.equal(extreme.usable, true); assert.equal(extreme.meetsTarget.seriesDistinct, false);
  assert.ok(extreme.adjustments.some(({ type }) => type === "series-encoding"));
  await verifyRenderedSeries(extreme, "all-targets-21"); await choosePanel("measurements"); await axeCheck("21:1 numeric pass with honest series collapse");
  await choosePanel("tokens");
  for (const [index, suffix] of [[10, "series-a"], [11, "series-b"], [12, "series-c"]]) {
    await page.locator(`[data-token-index='${index}']`).click();
    assert.ok((await page.locator("#token-detail").textContent()).includes(`--contrast-fit-${suffix}`), "collapsed colors retain semantic token identities");
  }
  async function independentTargetCase(background, changes = {}) {
    await page.locator("#reset").click();
    for (const id of ["target-controls", "accent-controls"]) await page.locator(`#${id}`).evaluate((element) => { element.open = true; });
    await fill("background", background);
    const next = structuredClone(defaults);
    for (const [key, value] of Object.entries(changes)) { await fill(key, String(value)); next[key] = value; }
    return { next, result: await verifyEngine(background, next) };
  }
  let focused = await independentTargetCase("#777777", { textContrast: 12 });
  assert.equal(focused.result.background, "#363636");
  assert.ok(Math.abs(focused.result.metrics.textContrast - 12.08432088306438) < 1e-10);
  focused = await independentTargetCase("#2B3548", { textContrast: 1, mutedContrast: 1, accentContrast: 1, surfaceTextContrast: 12 });
  assert.equal(focused.result.background, "#2B3548"); assert.equal(focused.result.colors.text, "#FDFDFD");
  assert.equal(focused.result.alphas.panel, 0.02); assert.equal(focused.result.alphas.metric, 0.03);
  focused = await independentTargetCase("#2B3548", { accentContrast: 21 });
  assert.equal(focused.result.background, "#000000"); assert.equal(focused.result.targets.mutedContrast, 4.7);
  assert.ok(Math.abs(focused.result.metrics.mutedContrast - 4.756415446013557) < 1e-10);
  assert.equal(focused.result.meetsTarget.seriesDistinct, false);
  await verifyRenderedSeries(focused.result, "accent-only-21");
  focused = await independentTargetCase("#000000", { surfaceTextContrast: 10 });
  assert.equal(focused.result.colors.goodText, "#C2F9E2"); assert.equal(focused.result.colors.warnText, "#FFF3DC");
  focused = await independentTargetCase("#000000", { surfaceTextContrast: 21 });
  for (const key of ["goodBg", "warnBg"]) assert.equal(focused.result.colors[key], "#000000");
  for (const key of ["goodText", "warnText"]) assert.equal(focused.result.colors[key], "#FFFFFF");
  focused = await independentTargetCase("#777777", { textContrast: 4.69, mutedContrast: 1, surfaceTextContrast: 1 });
  await page.locator("[name=strategy][value=preserve]").check(); focused.next.backgroundStrategy = "preserve";
  const roundedFailure = await verifyEngine("#777777", focused.next);
  assert.ok(roundedFailure.metrics.textContrast < 4.69); assert.equal(roundedFailure.meetsTarget.text, false);
  assert.match(await page.locator('[data-check="text"]').textContent(), /4.69:14.69:1Fail/);
  await independentTargetCase("#777777");
  await page.locator("#background").fill("#12XZ"); await fill("textContrast", "12");
  let transactional = { ...structuredClone(defaults), textContrast: 12 };
  await verifyEngine("#777777", transactional);
  assert.equal(await page.locator("#background").inputValue(), "#12XZ");
  await page.locator("#seriesB").fill("nothex"); await fill("mutedContrast", "7"); transactional.mutedContrast = 7;
  await verifyEngine("#777777", transactional);
  assert.equal(await page.locator("#seriesB").inputValue(), "nothex", "unrelated valid changes retain invalid drafts and last-valid applied seeds");
  await choosePanel("export"); await fill("prefix", "report_ui"); await page.locator("#prefix").fill("bad prefix;");
  await page.locator("[name=strategy][value=preserve]").check(); transactional.backgroundStrategy = "preserve";
  await verifyEngine("#777777", transactional, "report_ui");
  assert.equal(await page.locator("#prefix").inputValue(), "bad prefix;");
  assert.equal(await page.locator("#prefix").getAttribute("aria-invalid"), "true");
  await independentTargetCase("#000000"); await page.locator("#same-seeds").click();
  const identicalOptions = structuredClone(defaults);
  for (const key of ["seriesA", "seriesB", "seriesC"]) identicalOptions.accents[key] = "#18B7A6";
  // Floating-point tie ordering can differ across Node and Chromium in this existing
  // engine case. Compare exact per-series UI output to the actual browser engine;
  // independently retain the expected color set, distinctness and unchanged source tests.
  const identicalBlack = await verifyEngine("#000000", identicalOptions, "contrast-fit", true);
  assert.deepEqual(["seriesA", "seriesB", "seriesC"].map((key) => identicalBlack.colors[key]).sort(), ["#18B7A6", "#7635DB", "#B54708"].sort());
  assert.equal(identicalBlack.meetsTarget.seriesDistinct, true); assert.deepEqual(identicalBlack.adjustments, []);
  assert.match(await page.locator("#adjustment-log").textContent(), /No recorded/);
  const browserRuns = await page.evaluate(async ({ options, source }) => {
    const { createContrastFit } = await import(source); return [1, 2, 3].map(() => createContrastFit("#000000", options));
  }, { options: identicalOptions, source: `${base}src/contrast-fit.js` });
  for (const result of browserRuns) assert.deepEqual(result, identicalBlack);
  await choosePanel("tokens"); await axeCheck("expanded seeds with adjacent applied colors");
  if (screenshotDir) await page.locator("#accent-controls").screenshot({ path: resolve(screenshotDir, "studio-seed-results-identical-black.png") });
  console.log("PASS Studio independent targets: primary12 gray, surface12 slate + low alpha, accent-only21, black status10/21, identical-black exact browser engine and expected color set");
  await page.locator("#reset").click(); options = structuredClone(defaults);
  await page.locator("#accent-controls").evaluate((element) => { element.open = true; });
  await page.locator("#same-seeds").click();
  for (const key of ["seriesA", "seriesB", "seriesC"]) options.accents[key] = "#18B7A6";
  await verifyEngine("#777777", options);
  for (const [key, seed] of [["seriesA", "#f00"], ["seriesB", "#ff0101"], ["seriesC", "#ff0202"]]) {
    await fill(key, seed); options.accents[key] = key === "seriesA" ? "#FF0000" : seed.toUpperCase();
  }
  const custom = await verifyEngine("#777777", options); await verifyChart(custom);
  const validSeeds = await json(); await fill("seriesB", "rebeccapurple"); assert.deepEqual(await json(), validSeeds);
  assert.equal(await page.locator("#seriesB").getAttribute("aria-invalid"), "true"); await page.locator("#seriesB").press("Escape");
  console.log("PASS Studio engine: auto/preserve, six presets and extremes, all target controls, 21:1, custom/similar/identical seeds, warnings, separation and exact returned encodings");

  await choosePanel("export"); await fill("prefix", "report_ui");
  await verifyEngine("#777777", options, "report_ui");
  await choosePanel("tokens"); await page.locator("[data-token-index='16']").click();
  assert.ok((await page.locator("#token-detail").textContent()).includes("--contrast-fit-warn-text"), "custom prefix changes exports, not internal token metadata");
  await choosePanel("export");
  await chooseFormat("css"); const css = await page.locator("#export-output").textContent();
  assert.equal(css, `.contrast-fit-preview {\n${Object.entries(paletteToCssVariables(custom, "report_ui")).map(([key, value]) => `  ${key}: ${value};`).join("\n")}\n}\n`);
  await fill("prefix", "bad prefix;"); assert.equal(await page.locator("#prefix").getAttribute("aria-invalid"), "true"); assert.equal(await page.locator("#export-output").textContent(), css); await page.locator("#prefix").press("Escape");
  await chooseFormat("js"); const js = await page.locator("#export-output").textContent();
  assert.ok(js.includes(JSON.stringify(options, null, 2))); assert.ok(js.includes(`Resolved background with v0.1.0: ${custom.background}`));
  const runnable = js.replace('from "contrast-fit"', `from ${JSON.stringify(`${base}src/contrast-fit.js`)}`);
  const execution = await page.evaluate(async (source) => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    await import(url); URL.revokeObjectURL(url);
    const element = document.body.lastElementChild;
    const result = { background: getComputedStyle(element).backgroundColor, text: getComputedStyle(element).color, variable: element.style.getPropertyValue("--report_ui-bg") };
    element.remove(); return result;
  }, runnable);
  assert.equal(hex(execution.background), custom.background); assert.equal(hex(execution.text), custom.colors.text); assert.equal(execution.variable, custom.background);
  // Exercise modern copy, denied-API fallback, and completely unavailable clipboard.
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => { window.copiedStudio = value; } } }); });
  await page.locator("#copy").click(); assert.equal(await page.evaluate(() => window.copiedStudio), js); assert.match(await page.locator("#export-status").textContent(), /Copied JavaScript/);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error("denied"); }; document.execCommand = () => { window.fallbackStudio = document.querySelector("textarea").value; return true; }; });
  await page.locator("#copy").click(); assert.equal(await page.evaluate(() => window.fallbackStudio), js); assert.match(await page.locator("#export-status").textContent(), /Copied JavaScript/);
  await page.evaluate(() => { document.execCommand = () => false; }); await page.locator("#copy").click();
  assert.match(await page.locator("#export-status").textContent(), /Clipboard unavailable/); assert.equal((await page.evaluate(() => getSelection().toString())).trimEnd(), js.trimEnd(), "manual selection contains all code; browser selection may omit the final line break");
  await chooseFormat("json"); const expectedDownload = await page.locator("#export-output").textContent();
  const downloadPromise = page.waitForEvent("download"); await page.locator("#download").click(); const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "contrast-fit-palette.json"); assert.equal(await readFile(await download.path(), "utf8"), expectedDownload);
  await axeCheck("exports with custom prefix, copy and download status");
  const staticSnippet = (await page.locator('[aria-label="JavaScript integration example"] code').textContent()).replace('from "contrast-fit"', `from ${JSON.stringify(`${base}src/contrast-fit.js`)}`);
  const staticResult = await page.evaluate(async (source) => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" })); await import(url); URL.revokeObjectURL(url);
    const element = document.body.lastElementChild; const computed = getComputedStyle(element);
    const result = { text: computed.color, background: computed.backgroundColor }; element.remove(); return result;
  }, staticSnippet);
  assert.equal(hex(staticResult.text), initial.colors.text); assert.equal(hex(staticResult.background), initial.background);
  console.log("PASS Studio exports: exact 17-variable CSS, full JSON, runnable current-options JS and visible static snippet, prefix/metadata, modern/fallback/manual copy, downloaded bytes");

  await page.locator("#reset").click(); await page.locator("[data-scene=interface]").click(); await choosePanel("tokens");
  // Native radio keyboard handling and visible focus; no custom roving-tab trap.
  await page.locator("[name=strategy][value=auto]").focus(); await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("[name=strategy][value=preserve]").isChecked(), true);
  await page.keyboard.press("ArrowLeft"); assert.equal(await page.locator("[name=strategy][value=auto]").isChecked(), true);
  await page.locator("#background").focus(); await page.keyboard.press("Tab");
  assert.equal(await page.locator("[data-preset]").first().evaluate((element) => element === document.activeElement && element.matches(":focus-visible") && parseFloat(getComputedStyle(element).outlineWidth) >= 2), true);
  await page.keyboard.press("Enter");
  const ids = await page.locator("[id]").evaluateAll((items) => items.map((item) => item.id)); assert.equal(new Set(ids).size, ids.length);
  // Collapse advanced controls for screenshot/default first-screen consistency.
  for (const id of ["target-controls", "accent-controls"]) await page.locator(`#${id}`).evaluate((element) => { element.open = false; });
  if (screenshotDir) {
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.locator("#page-title").click(); await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(screenshotDir, "studio-desktop-1440.png"), fullPage: true });
    await page.screenshot({ path: resolve(screenshotDir, "studio-desktop-firstscreen-1440.png") });
    for (const name of ["analytics", "compare"]) { await page.locator(`[data-scene=${name}]`).click(); await page.screenshot({ path: resolve(screenshotDir, `studio-desktop-${name}.png`), fullPage: true }); }
    await page.locator("[data-scene=interface]").click(); await choosePanel("measurements"); await page.screenshot({ path: resolve(screenshotDir, "studio-desktop-measurements.png"), fullPage: true }); await choosePanel("tokens");
  }
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    if (width <= 375) {
      const link = page.locator("#see-result");
      assert.equal(await link.isVisible(), true); assert.equal(await link.getAttribute("href"), "#preview-heading");
      assert.match(await page.locator("#compact-result").textContent(), /Applied #A0A0A0 · 11\/11 numeric pass/);
      await link.focus(); await page.keyboard.press("Enter");
      assert.equal(new URL(page.url()).hash, "#preview-heading");
      assert.equal(await page.locator("#preview-heading").evaluate((element) => element === document.activeElement && element.matches(":focus-visible")), true);
      assert.ok(await page.locator("#preview-heading").evaluate((element) => element.getBoundingClientRect().top >= 0 && element.getBoundingClientRect().top < innerHeight), "See result scrolls to its actual focused destination");
    }
    for (const name of ["interface", "compare", "analytics"]) {
      await page.locator(`[data-scene=${name}]`).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}px ${name}: no horizontal page overflow`);
    }
    const scroll = page.locator(".chart-scroll"); await scroll.focus(); await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector(".chart-scroll").scrollLeft > 0);
    assert.equal(await page.evaluate(() => scrollX), 0);
    assert.equal(await scroll.evaluate((element) => element.matches(":focus-visible") && parseFloat(getComputedStyle(element).outlineWidth) >= 2), true);
    const minText = await page.locator("#chart text").evaluateAll((items) => Math.min(...items.map((item) => parseFloat(getComputedStyle(item).fontSize) * Math.hypot(item.getScreenCTM().a, item.getScreenCTM().b))));
    assert.ok(minText >= 10, `${width}px: chart tick labels stay at readable size`);
    await choosePanel("export"); await chooseFormat("js");
    const code = page.locator("#export-code");
    await page.locator("#download").focus(); await page.keyboard.press("Tab");
    assert.equal(await code.evaluate((element) => element === document.activeElement), true, "the export region is naturally keyboard reachable after Download");
    const codeOverflows = await code.evaluate((element) => element.scrollWidth > element.clientWidth);
    if (width <= 375) assert.equal(codeOverflows, true, "narrow code stays locally scrollable rather than wrapping or overflowing the page");
    if (codeOverflows) {
      await code.evaluate((element) => { element.scrollLeft = 0; }); await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector("#export-code").scrollLeft > 0);
    }
    assert.equal(await code.evaluate((element) => element.matches(":focus-visible") && parseFloat(getComputedStyle(element).outlineWidth) >= 2), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    if (width === 320) await axeCheck("320px analytics + expanded table + export");
    await page.locator("[data-scene=interface]").click(); await choosePanel("tokens");
    if (width === 320) await axeCheck("320px default interface + tokens");
    if (screenshotDir && width !== 768) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: resolve(screenshotDir, `studio-mobile-${width}.png`), fullPage: true }); await page.screenshot({ path: resolve(screenshotDir, `studio-mobile-firstscreen-${width}.png`) }); }
  }
  const links = await page.locator('a[href="../dashboard/"], a[href="../../docs/"]').evaluateAll((items) => items.map((item) => item.href));
  for (const url of links) assert.equal((await context.request.get(url)).status(), 200, "project-subpath docs/legacy route works");
  assert.deepEqual(errors, [], `No console, network, or page errors: ${JSON.stringify(errors)}`);
  console.log(`PASS Studio: root/project-subpath routing, keyboard, 320/375/768px fit, local chart/code scrolling, accessible descriptions; Chromium ${browser.version()}`);
  if (screenshotDir) { await writeFile(resolve(screenshotDir, "studio-rendered-contrast.json"), JSON.stringify(pixelReports, null, 2) + "\n"); console.log(`Screenshots and actual rendered contrast: ${screenshotDir}`); }
} finally {
  await browser?.close();
  await new Promise((done) => { server.close(done); server.closeAllConnections(); });
}
