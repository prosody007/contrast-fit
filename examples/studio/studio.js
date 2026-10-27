import {
  createContrastFit, applyPaletteToElement, paletteToCssVariables,
  normalizeHex, parseHex, contrastRatio,
} from "../../src/contrast-fit.js";
import { initializeScenes } from "./scenes.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const VERSION = "0.1.0";
const DEFAULTS = {
  background: "#243044",
  options: { backgroundStrategy: "auto", textContrast: 8, mutedContrast: 4.7,
    accentContrast: 3.3, surfaceTextContrast: 4.5,
    accents: { seriesA: "#18B7A6", seriesB: "#F06B8A", seriesC: "#8F7DFF" } },
  prefix: "contrast-fit",
};
const examples = {
  interface: { name: "Project workspace", background: "#243044", preview: "#live-preview", frame: "#preview-frame" },
  commerce: { name: "Commerce desk", background: "#F4EFE5", preview: "#commerce-preview", frame: "#commerce-frame" },
  reading: { name: "Reading room", background: "#FCFCF9", preview: "#reading-preview", frame: "#reading-frame" },
  analytics: { name: "Analytics", background: "#101D29", preview: "#analytics-preview", frame: "#analytics-frame" },
};
const models = Object.fromEntries(Object.entries(examples).map(([key, example]) => {
  const state = { ...structuredClone(DEFAULTS), background: example.background };
  return [key, { state, palette: createContrastFit(state.background, state.options), drafts: {}, errors: new Map() }];
}));
let active = "interface";
let state = models[active].state;
let palette = models[active].palette;
let panel = "tokens";
let format = "css";
let selectedToken = 1;
let errors = models[active].errors;
const targetKeys = ["textContrast", "mutedContrast", "accentContrast", "surfaceTextContrast"];
const seriesKeys = ["seriesA", "seriesB", "seriesC"];
const fixture = [
  { period: "P1", values: [24, 18, 12] }, { period: "P2", values: [40, 28, 23] },
  { period: "P3", values: [36, 40, 31] }, { period: "P4", values: [58, 46, 40] },
  { period: "P5", values: [68, 56, 52] }, { period: "P6", values: [82, 67, 64] },
];
const checks = [
  ["text", "Primary text / background", "textContrast", "textContrast"],
  ["muted", "Muted text / background", "mutedContrast", "mutedContrast"],
  ["panelText", "Primary text / panel", "panelTextContrast", "surfaceTextContrast"],
  ["panelMuted", "Muted text / panel", "panelMutedContrast", "surfaceTextContrast"],
  ["metricText", "Primary text / metric", "metricTextContrast", "surfaceTextContrast"],
  ["metricMuted", "Muted text / metric", "metricMutedContrast", "surfaceTextContrast"],
  ["seriesA", "Series A / background", "seriesAContrast", "accentContrast"],
  ["seriesB", "Series B / background", "seriesBContrast", "accentContrast"],
  ["seriesC", "Series C / background", "seriesCContrast", "accentContrast"],
  ["goodText", "Good text / good background", "goodTextContrast", "surfaceTextContrast"],
  ["warnText", "Warning text / warning background", "warnTextContrast", "surfaceTextContrast"],
];
const tokenInfo = {
  Background: ["background", "The resolved content background. Apply it with the foregrounds; the original chosen color belongs on the outside frame."],
  Text: ["text", "Primary copy and headings, measured against the resolved background. Also checked separately on panel and metric surfaces."],
  Muted: ["muted", "Secondary copy, labels, and chart tick labels. Muted does not mean unmeasured."],
  "Metric BG": ["metric", "A translucent metric surface, directly over the resolved background. Text and muted copy each have a surface check."],
  Panel: ["panel", "A translucent grouping surface. The preview avoids nesting other translucent surfaces inside it."],
  Border: ["border", "Decorative dividers and outlines. Not a guaranteed accessible control boundary."],
  Grid: ["grid", "Decorative chart grid lines. They provide context, not the only way to read values."],
  Axis: ["axis", "Decorative axis strokes. Readable tick labels use the muted token instead."],
  "Plot Fill": ["plotFill", "A decorative fill token, shown here only. It is not placed behind chart data: that would change the background used for the series measurements."],
  Bars: ["bars", "Decorative period accents in this fixture, not a separately encoded dataset. No certified non-text contrast target."],
  "Series A": ["seriesA", "Design scores: contrast-fitted color, solid line, circle marker. Match all three encodings in the legend."],
  "Series B": ["seriesB", "Research scores: contrast-fitted color, 9 5 dash pattern, square marker."],
  "Series C": ["seriesC", "Product scores: contrast-fitted color, 2 5 dash pattern, diamond marker."],
  "Good BG": ["goodBg", "Positive status background. Pair it with Good Text, not an arbitrary foreground."],
  "Good Text": ["goodText", "Positive status foreground, measured against Good BG rather than the content background."],
  "Warn BG": ["warnBg", "Attention status background. The status is also named in text; color alone does not carry meaning."],
  "Warn Text": ["warnText", "Attention status foreground, measured against Warn BG rather than the content background."],
};

function node(tag, text, attributes = {}) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = text;
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}
function text(id, value) { $(`#${id}`).textContent = value; }
function ratio(value) { return `${value.toFixed(2)}:1`; }
function setError(id, message = "") {
  const input = $(`#${id}`);
  input.setAttribute("aria-invalid", String(Boolean(message)));
  const output = $(`#${id}-error`);
  output.textContent = message;
  output.hidden = !message;
  if (message) errors.set(id, message); else errors.delete(id);
  text("input-status", errors.size ? `${errors.size} invalid input${errors.size > 1 ? "s" : ""}. ${[...errors.values()].join(" ")} Last valid palette retained.` : "Inputs valid. Preview updated.");
}
function currentValue(id) {
  if (id === "background" || id === "prefix") return state[id];
  return seriesKeys.includes(id) ? state.options.accents[id] : state.options[id];
}
// One transaction per accepted field: invalid drafts never partially mutate options,
// CSS, the preview, or exports. Draft strings are left intact while typing.
function acceptField(id, canonicalize = false) {
  const input = $(`#${id}`);
  models[active].drafts[id] = input.value;
  const candidate = structuredClone(state);
  let value;
  if (targetKeys.includes(id)) {
    value = input.value.trim() === "" ? NaN : Number(input.value);
    if (!Number.isFinite(value) || value < 1 || value > 21) {
      setError(id, "Enter a finite contrast ratio from 1 to 21."); return;
    }
    candidate.options[id] = value;
  } else if (id === "prefix") {
    value = input.value;
    try { paletteToCssVariables(palette, value); }
    catch { setError(id, "Start with a letter or underscore; then use letters, numbers, hyphens, or underscores. Last valid prefix retained."); return; }
    candidate.prefix = value;
  } else {
    value = normalizeHex(input.value);
    if (!value) { setError(id, "Use an opaque 3- or 6-digit hex color, such as #777 or #777777. Last valid palette retained."); return; }
    if (id === "background") candidate.background = value;
    else candidate.options.accents[id] = value;
  }
  const next = id === "prefix" ? palette : createContrastFit(candidate.background, candidate.options);
  state = candidate;
  palette = next;
  setError(id);
  if (canonicalize) input.value = String(value);
  models[active].drafts[id] = input.value;
  if (id === "prefix") { models[active].state = state; renderExport(); }
  else render();
}
for (const id of ["background", ...targetKeys, ...seriesKeys, "prefix"]) {
  const input = $(`#${id}`);
  input.addEventListener("input", () => acceptField(id));
  input.addEventListener("blur", () => acceptField(id, true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); acceptField(id, true); }
    if (event.key === "Escape") { input.value = String(currentValue(id)); models[active].drafts[id] = input.value; setError(id); renderExample(active); }
  });
}
function update(next) {
  const result = createContrastFit(next.background, next.options);
  state = next; palette = result;
  render();
}
$("#background-picker").addEventListener("input", (event) => {
  $("#background").value = event.target.value.toUpperCase();
  acceptField("background", true);
});
for (const button of $$("[data-preset]")) button.addEventListener("click", () => {
  $("#background").value = button.dataset.preset; acceptField("background", true);
});
for (const radio of $$("[name=strategy]")) radio.addEventListener("change", () => {
  const next = structuredClone(state); next.options.backgroundStrategy = radio.value; update(next);
});
$("#extreme-targets").addEventListener("click", () => {
  const next = structuredClone(state);
  for (const key of targetKeys) { next.options[key] = 21; $(`#${key}`).value = "21"; models[active].drafts[key] = "21"; setError(key); }
  update(next);
});
$("#same-seeds").addEventListener("click", () => {
  const next = structuredClone(state);
  for (const key of seriesKeys) { next.options.accents[key] = "#18B7A6"; $(`#${key}`).value = "#18B7A6"; models[active].drafts[key] = "#18B7A6"; setError(key); }
  update(next);
});
function resetPalette(key) {
  const model = models[key];
  model.state = { ...structuredClone(DEFAULTS), background: examples[key].background };
  model.palette = createContrastFit(model.state.background, model.state.options);
  model.drafts = {}; model.errors.clear();
  if (key === active) {
    state = model.state; palette = model.palette; selectedToken = 1;
    syncTools(); renderTools(); text("input-status", `${examples[key].name} default palette restored. Application state retained.`);
  }
  renderExample(key);
}
$("#reset").addEventListener("click", () => resetPalette(active));
for (const button of $$("[data-example-reset]")) button.addEventListener("click", () => resetPalette(button.dataset.exampleReset));
initializeScenes();
function syncTools() {
  for (const id of ["background", ...targetKeys, ...seriesKeys, "prefix"]) {
    $(`#${id}`).value = models[active].drafts[id] ?? String(currentValue(id));
    const message = errors.get(id) ?? "";
    $(`#${id}`).setAttribute("aria-invalid", String(Boolean(message)));
    $(`#${id}-error`).textContent = message; $(`#${id}-error`).hidden = !message;
  }
  $(`[name=strategy][value=${state.options.backgroundStrategy}]`).checked = true;
  $("#inspect-example").value = active;
}
function inspectExample(key) {
  active = key; state = models[key].state; palette = models[key].palette; errors = models[key].errors;
  syncTools(); renderTools();
}
$("#inspect-example").addEventListener("change", (event) => inspectExample(event.target.value));
for (const button of $$("[data-inspect]")) button.addEventListener("click", () => {
  inspectExample(button.dataset.inspect); $("#palette-lab").open = true;
  $("#inspector-title").focus();
});
function acceptExample(key, canonicalize = false) {
  const model = models[key], input = $(`#${key}-background`);
  model.drafts.background = input.value;
  const background = normalizeHex(input.value);
  if (!background) model.errors.set("background", "Use an opaque 3- or 6-digit hex color. Last valid palette retained.");
  else {
    model.errors.delete("background");
    model.state = { ...model.state, background };
    model.palette = createContrastFit(background, model.state.options);
    if (canonicalize) model.drafts.background = input.value = background;
  }
  if (key === active) { state = model.state; palette = model.palette; syncTools(); renderTools(); }
  renderExample(key);
}
for (const [key] of Object.entries(examples)) {
  const input = $(`#${key}-background`);
  input.addEventListener("input", () => acceptExample(key));
  input.addEventListener("blur", () => acceptExample(key, true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); acceptExample(key, true); }
    if (event.key === "Escape") {
      input.value = models[key].state.background; models[key].drafts.background = input.value; models[key].errors.delete("background");
      renderExample(key); if (key === active) syncTools();
    }
  });
  $(`#${key}-picker`).addEventListener("input", (event) => { input.value = event.target.value; acceptExample(key, true); });
}
for (const button of $$("[data-example-preset]")) button.addEventListener("click", () => {
  $(`#${button.dataset.examplePreset}-background`).value = button.dataset.color; acceptExample(button.dataset.examplePreset, true);
});
for (const button of $$("[data-panel]")) button.addEventListener("click", () => {
  panel = button.dataset.panel;
  for (const item of $$("[data-panel]")) item.setAttribute("aria-pressed", String(item.dataset.panel === panel));
  for (const id of ["tokens", "measurements", "export", "compare"]) $(`#panel-${id}`).hidden = panel !== id;
});
for (const button of $$("[data-format]")) button.addEventListener("click", () => {
  format = button.dataset.format;
  for (const item of $$("[data-format]")) item.setAttribute("aria-pressed", String(item.dataset.format === format));
  renderExport();
});

function marker(shape, x, y, color, size = 2, halo = false) {
  const attributes = `class="${halo ? "series-marker-halo" : "series-marker"}" fill="${color}" stroke="${color}"`;
  if (shape === "circle") return `<circle ${attributes} cx="${x}" cy="${y}" r="${size}"/>`;
  if (shape === "square") return `<rect ${attributes} x="${x - size}" y="${y - size}" width="${size * 2}" height="${size * 2}"/>`;
  return `<path ${attributes} d="M${x} ${y - size - 1}l${size + 1} ${size + 1}l-${size + 1} ${size + 1}l-${size + 1} -${size + 1}Z"/>`;
}
function renderChart(palette) {
  const x = (index) => 48 + index * 116;
  const y = (value) => 228 - value * 2.1;
  const points = (index) => fixture.map((row, period) => `${period ? "L" : "M"}${x(period)} ${y(row.values[index])}`).join(" ");
  let content = '<title id="chart-title">Illustrative project progress</title><desc id="chart-desc">Design, Research, and Product scores across six periods, on a shared 0 to 100 score axis. Matching values are in the data table. Faint bottom bars are decorative period accents, not another dataset.</desc>';
  for (const value of [0, 20, 40, 60, 80, 100]) {
    content += `<line class="chart-grid" x1="48" x2="628" y1="${y(value)}" y2="${y(value)}"/><text x="34" y="${y(value) + 4}" text-anchor="end">${value}</text>`;
  }
  fixture.forEach((row, index) => {
    content += `<rect class="chart-bars" x="${x(index) - 9}" y="218" width="18" height="10"/><text x="${x(index)}" y="251" text-anchor="middle">${row.period}</text>`;
  });
  content += '<line class="chart-axis" x1="48" x2="628" y1="228" y2="228"/>';
  seriesKeys.forEach((key, index) => {
    const style = palette.seriesStyles[key];
    // Each data mark is backed by the opaque resolved background, not a translucent
    // fill/grid/other series. Keep the backing immediately before its own mark.
    content += `<g data-chart-series="${key}"><path class="series-halo" d="${points(index)}" stroke="${palette.background}"/><path class="series-path" d="${points(index)}" stroke="${palette.colors[key]}" stroke-dasharray="${style.dashArray}"/>`;
    fixture.forEach((row, period) => {
      content += marker(style.marker, x(period), y(row.values[index]), palette.background, 2, true);
      content += marker(style.marker, x(period), y(row.values[index]), palette.colors[key]);
    });
    content += "</g>";
  });
  $("#chart").innerHTML = content; // All values are normalized engine output or local numeric fixture data.
  const names = ["Design", "Research", "Product"];
  $("#chart-legend").replaceChildren(...seriesKeys.map((key, index) => {
    const item = node("span");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 34 14"); svg.setAttribute("aria-hidden", "true"); svg.classList.add("legend-key");
    const style = palette.seriesStyles[key];
    svg.innerHTML = `<path class="series-halo" d="M1 7H33" stroke="${palette.background}"/><path class="series-path" d="M1 7H33" stroke="${palette.colors[key]}" stroke-dasharray="${style.dashArray}"/>${marker(style.marker, 17, 7, palette.background, 2.5, true)}${marker(style.marker, 17, 7, palette.colors[key], 2.5)}`;
    item.append(svg, node("span", `${"ABC"[index]} · ${names[index]}`));
    return item;
  }));
  text("encoding-note", palette.meetsTarget.seriesDistinct
    ? "Color separation heuristic passes. Solid / dashed / dotted lines and circle / square / diamond markers are applied to the chart and legend."
    : "Color-only separation fails. The chart and legend use the returned solid / dashed / dotted patterns and circle / square / diamond markers. Do not rely on color alone.");
}
$("#fixture-data").replaceChildren(...fixture.map((row) => {
  const tr = node("tr"); tr.append(node("th", row.period, { scope: "row" }), ...row.values.map((value) => node("td", value))); return tr;
}));

function renderComparison() {
  const baseline = { background: state.background, text: "#FFFFFF", muted: "#A1A1AA", seriesA: "#18B7A6" };
  const fitted = palette.colors;
  const comparisons = [
    ["Primary text", "text", palette.targets.textContrast],
    ["Muted text", "muted", palette.targets.mutedContrast],
    ["Series A", "seriesA", palette.targets.accentContrast],
  ];
  for (const [name, colors] of [["baseline", baseline], ["fitted", fitted]]) {
    const svg = $(`#${name}-preview`);
    // SVG image samples intentionally visualize failing colors; each image has a
    // measured, accessible alternative outside it rather than inaccessible controls.
    svg.innerHTML = `<rect width="350" height="200" fill="${colors.background}"/><text x="24" y="36" font-family="system-ui" font-size="11" fill="${colors.muted}">PROJECT MOMENTUM</text><text x="24" y="93" font-family="system-ui" font-size="45" fill="${colors.text}">86%</text><text x="24" y="119" font-family="system-ui" font-size="12" fill="${colors.muted}">A little clarity goes a long way.</text><path d="M24 171 L75 153 L124 162 L175 142 L225 149 L277 130 L326 135" fill="none" stroke="${colors.seriesA}" stroke-width="3"/>`;
    const description = [];
    const rows = comparisons.map(([label, key, target]) => {
      const actual = contrastRatio(parseHex(colors[key]), parseHex(colors.background));
      const pass = actual >= target;
      description.push(`${label} ${ratio(actual)}, ${pass ? "passes" : "fails"} requested ${target}:1`);
      const row = node("div", null, { "data-comparison": key, "data-ratio": actual, "data-pass": pass });
      const dd = node("dd", ratio(actual));
      dd.append(node("span", `${pass ? "PASS" : "FAIL"} / ${target}`, { class: pass ? "pass-label" : "fail-label" }));
      row.append(node("dt", label), dd); return row;
    });
    svg.setAttribute("aria-label", `${name === "baseline" ? "Naive fixed palette" : "Fitted palette"} on ${colors.background}. ${description.join(". ")}.`);
    $(`#${name}-ratios`).replaceChildren(...rows);
  }
  applyPaletteToElement($("#fitted-preview"), palette);
}

function renderTokens() {
  const focusedIndex = document.activeElement?.closest("[data-token-index]")?.dataset.tokenIndex;
  $("#token-list").replaceChildren(...palette.tokens.map((token, index) => {
    const button = node("button", null, { type: "button", class: "token-button", "data-token-index": index,
      "aria-pressed": String(index === selectedToken), "aria-controls": "token-detail" });
    const swatch = node("i", null, { "aria-hidden": "true" });
    swatch.style.background = token.effectiveColor;
    button.append(swatch, node("strong", token.name), node("small", token.css));
    button.title = `${token.name}: ${token.css}`;
    return button;
  }));
  if (focusedIndex !== undefined) $(`[data-token-index="${focusedIndex}"]`).focus({ preventScroll: true });
  renderTokenDetail();
}
function renderTokenDetail() {
  const token = palette.tokens[selectedToken];
  const [key, usage] = tokenInfo[token.name];
  // Map by semantic key, not value: extreme palettes may have duplicate colors.
  const suffix = { background: "bg", plotFill: "plot-fill", seriesA: "series-a", seriesB: "series-b", seriesC: "series-c", goodBg: "good-bg", goodText: "good-text", warnBg: "warn-bg", warnText: "warn-text" }[key] ?? key;
  const details = node("dl");
  for (const [label, value] of [
    ["CSS variable", `--contrast-fit-${suffix}`], ["Authored CSS", token.css],
    ["Source color / alpha", `${token.color} / ${token.alpha}`], ["Effective on resolved background", token.effectiveColor],
    ["Measured relationship", token.contrast === null ? "No evaluated contrast target for this token" : `${ratio(token.contrast)} · ${key === "goodText" ? "on Good BG" : key === "warnText" ? "on Warn BG" : "on resolved background"}`],
  ]) {
    const row = node("div"); row.append(node("dt", label), node("dd", value)); details.append(row);
  }
  const sample = node("div", null, { class: "token-detail-swatch", role: "img", "aria-label": `Effective color ${token.effectiveColor}` });
  sample.style.background = token.effectiveColor;
  $("#token-detail").replaceChildren(node("p", "SEMANTIC ROLE", { class: "eyebrow" }), node("h3", token.name), node("p", usage), details, sample);
}
$("#token-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-token-index]"); if (!button) return;
  selectedToken = Number(button.dataset.tokenIndex);
  for (const item of $$("[data-token-index]")) item.setAttribute("aria-pressed", String(Number(item.dataset.tokenIndex) === selectedToken));
  renderTokenDetail();
});
function renderMeasurements() {
  $("#measurements-body").replaceChildren(...checks.map(([flag, label, metric, target]) => {
    const pass = palette.meetsTarget[flag];
    const row = node("tr", null, { "data-check": flag, "data-value": palette.metrics[metric], "data-target": palette.targets[target], "data-pass": pass });
    row.append(node("th", label, { scope: "row" }), node("td", ratio(palette.metrics[metric])), node("td", `${palette.targets[target]}:1`), node("td", pass ? "Pass" : "Fail", { class: pass ? "pass-label" : "fail-label" }));
    return row;
  }));
  $("#adjustment-log").replaceChildren(...(palette.adjustments.length ? palette.adjustments.map((adjustment) => {
    const item = node("li"); item.append(node("span", adjustment.type.toUpperCase(), { class: "log-type" }), node("span", `${adjustment.from ? `${adjustment.from} → ${adjustment.to}. ` : ""}${adjustment.message}`)); return item;
  }) : [node("li", "No recorded background, status, or series-encoding adjustment. Foreground and alpha fitting are reflected in the output, not logged as individual search steps.")]));
  $("#warning-log").replaceChildren(...(palette.warnings.length ? palette.warnings.map((warning) => node("li", warning)) : [node("li", "No unresolved engine warnings. This is not a whole-page accessibility audit.")]));
  text("separation-result", palette.meetsTarget.seriesDistinct ? "Heuristic passes" : "Color alone fails");
  $("#separation-result").className = palette.meetsTarget.seriesDistinct ? "pass-label" : "fail-label";
  $("#separation-pairs").replaceChildren(...["AB", "AC", "BC"].map((pair) => {
    const item = node("div", null, { "data-pair": pair });
    item.append(node("strong", `${pair[0]} ↔ ${pair[1]}`), node("span", `RGB ${palette.metrics[`series${pair}Distance`].toFixed(2)}`), node("span", `OKLab ${palette.metrics[`series${pair}PerceptualDistance`].toFixed(4)}`)); return item;
  }));
}
function exportContent() {
  const variables = paletteToCssVariables(palette, state.prefix);
  if (format === "json") return JSON.stringify({ version: VERSION, inputBackground: state.background, options: state.options, prefix: state.prefix, palette, cssVariables: variables }, null, 2);
  if (format === "js") return `// npm install contrast-fit@${VERSION}\nimport { createContrastFit, applyPaletteToElement, paletteToCssVariables } from "contrast-fit";\n\nconst options = ${JSON.stringify(state.options, null, 2)};\nconst palette = createContrastFit(${JSON.stringify(state.background)}, options);\n// Resolved background with v${VERSION}: ${palette.background}\nconst variables = paletteToCssVariables(palette, ${JSON.stringify(state.prefix)});\n\n// Self-contained browser example: replace this with your own element.\nconst element = document.createElement("section");\nelement.textContent = "Your contrast-fitted interface";\ndocument.body.append(element);\napplyPaletteToElement(element, palette, ${JSON.stringify(state.prefix)});\nelement.style.background = variables[${JSON.stringify(`--${state.prefix}-bg`)}];\nelement.style.color = variables[${JSON.stringify(`--${state.prefix}-text`)}];\n\n// Your chart adapter must also apply palette.seriesStyles (dash + marker).\n// Inspect palette.meetsTarget, palette.usable, and palette.warnings.\nconsole.log({ palette, variables });\n`;
  return `.contrast-fit-preview {\n${Object.entries(variables).map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}\n`;
}
function renderExport() {
  text("export-output", exportContent());
  text("export-status", "Exports reflect the last valid inputs. JSON includes options, measurements, and series styles; CSS contains colors only.");
}
$("#copy").addEventListener("click", async () => {
  const content = exportContent();
  let copied = false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(content); copied = true; } } catch { /* Continue with the user-gesture fallback. */ }
  if (!copied) {
    const area = node("textarea", content, { readonly: "", "aria-label": "Clipboard fallback" });
    // Kept on screen (not display:none) so older clipboard implementations can select it.
    area.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0";
    document.body.append(area); area.select();
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    area.remove(); $("#copy").focus();
  }
  if (copied) text("export-status", `Copied ${format === "js" ? "JavaScript" : format.toUpperCase()} for the current palette.`);
  else {
    $("#export-code").focus();
    const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents($("#export-output")); selection.removeAllRanges(); selection.addRange(range);
    text("export-status", "Clipboard unavailable. Code selected: press Control+C or Command+C, or use Download.");
  }
});
$("#download").addEventListener("click", () => {
  try {
    const types = { css: "text/css", json: "application/json", js: "text/javascript" };
    const url = URL.createObjectURL(new Blob([exportContent()], { type: `${types[format]};charset=utf-8` }));
    const link = node("a", null, { href: url, download: `contrast-fit-palette.${format}` });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    text("export-status", `Download prepared: contrast-fit-palette.${format}.`);
  } catch { text("export-status", "Download unavailable in this browser. Use Copy code or select the code manually."); }
});

// Each palette owns only its example. Existing issue/order/reading nodes are never
// replaced by palette rendering. The single inspector reads a selected record.
function renderExample(key) {
  const model = models[key], value = model.palette, example = examples[key];
  const preview = $(example.preview); applyPaletteToElement(preview, value);
  preview.dataset.resolved = value.background; preview.dataset.usable = String(value.usable);
  $(example.frame).style.setProperty("--input-bg", value.inputBackground);
  $(example.frame).dataset.input = value.inputBackground;
  $(`#${key}-picker`).value = value.inputBackground;
  $(`#${key}-background`).value = model.drafts.background ?? model.state.background;
  const error = model.errors.get("background") ?? "";
  $(`#${key}-background`).setAttribute("aria-invalid", String(Boolean(error)));
  $(`#${key}-error`).textContent = error; $(`#${key}-error`).hidden = !error;
  const count = checks.filter(([flag]) => value.meetsTarget[flag]).length;
  const low = ["textContrast", "mutedContrast", "surfaceTextContrast"].some((target) => value.targets[target] < 4.5);
  text(`${key}-feedback`, [
    value.background !== value.inputBackground ? `Applied ${value.background}` : "",
    !value.usable ? `Targets unresolved · ${11 - count} checks fail` : "",
    low ? "Experimental low text targets" : "",
    key === "analytics" && !value.meetsTarget.seriesDistinct ? "Color-only separation fails" : "",
  ].filter(Boolean).join(" · "));
  for (const button of $$(`[data-example-preset=${key}]`)) button.setAttribute("aria-pressed", String(button.dataset.color === model.state.background));
  if (key === "analytics") renderChart(value);
}
function render() {
  models[active].state = state; models[active].palette = palette;
  renderExample(active); renderTools();
}
function renderTools() {
  $("#background-picker").value = palette.inputBackground;
  $("#chosen-swatch").style.background = palette.inputBackground;
  $("#resolved-swatch").style.background = palette.background;
  text("chosen-color", palette.inputBackground); text("resolved-color", palette.background);
  text("resolution-label", palette.background !== palette.inputBackground ? "Background adjusted · original on frame" : state.options.backgroundStrategy === "preserve" ? "Exact background preserved" : "No background repair needed");
  text("strategy-hint", state.options.backgroundStrategy === "auto" ? "Allow content to adjust when the chosen color cannot support your targets." : "Keep the exact input background. Some requested targets may remain unresolved; inspect the measurements.");
  for (const button of $$("[data-preset]")) button.setAttribute("aria-pressed", String(button.dataset.preset === state.background));
  const count = checks.filter(([key]) => palette.meetsTarget[key]).length;
  for (const key of seriesKeys) {
    const output = $(`#${key}-applied`);
    const retained = state.options.accents[key] === palette.colors[key];
    const swatch = node("i", null, { "aria-hidden": "true" });
    swatch.style.background = palette.colors[key];
    output.dataset.color = palette.colors[key]; output.dataset.retained = String(retained);
    output.replaceChildren(swatch, node("span", `Applied ${palette.colors[key]}`), node("strong", retained ? "Seed retained" : "Adjusted"));
  }
  text("text-result", ratio(palette.metrics.textContrast)); text("text-target", `${palette.targets.textContrast}:1 requested · ${palette.meetsTarget.text ? "pass" : "fail"}`);
  text("muted-result", ratio(palette.metrics.mutedContrast)); text("muted-target", `${palette.targets.mutedContrast}:1 requested · ${palette.meetsTarget.muted ? "pass" : "fail"}`);
  text("series-result", ratio(Math.min(...seriesKeys.map((key) => palette.metrics[`${key}Contrast`]))));
  text("series-target", `${palette.targets.accentContrast}:1 requested · ${seriesKeys.every((key) => palette.meetsTarget[key]) ? "all pass" : "unresolved"}`);
  text("checks-result", `${count} / ${checks.length} pass`);
  const status = $("#result-status"); status.dataset.state = palette.usable ? "success" : "warning";
  status.replaceChildren(node("strong", palette.usable ? (palette.background !== palette.inputBackground ? "Auto-fit complete. " : "Numeric targets satisfied. ") : "Targets unresolved. "), node("span", !palette.usable ? `${checks.length - count} numeric checks fail with the current options. ${palette.warnings[0] ?? "Inspect measurements for details."}` : !palette.meetsTarget.seriesDistinct ? "All numeric checks pass, but color-only series separation fails. Use the supplied patterns and markers." : palette.background !== palette.inputBackground ? "Content adjusted to support your targets. Your chosen color stays on the frame; targets stay intact." : "Background retained. Measurements and series separation are available below; this is not a whole-page audit."));
  $("#experimental-warning").hidden = !["textContrast", "mutedContrast", "surfaceTextContrast"].some((key) => palette.targets[key] < 4.5);
  renderComparison(); renderTokens(); renderMeasurements(); renderExport();
}
for (const key of Object.keys(examples)) renderExample(key);
syncTools(); renderTools();
