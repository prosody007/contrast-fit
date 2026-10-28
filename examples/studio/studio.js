import { createContrastFit, applyPaletteToElement, normalizeHex } from "../../src/contrast-fit.js";
import { initializeScenes } from "./scenes.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const examples = {
  interface: { background: "#243044", preview: "#live-preview", frame: "#preview-frame" },
  commerce: { background: "#F4EFE5", preview: "#commerce-preview", frame: "#commerce-frame" },
  reading: { background: "#FCFCF9", preview: "#reading-preview", frame: "#reading-frame" },
  analytics: { background: "#101D29", preview: "#analytics-preview", frame: "#analytics-frame" },
};
const models = Object.fromEntries(Object.entries(examples).map(([key, example]) => [key, {
  background: example.background, palette: createContrastFit(example.background), draft: example.background, error: "",
}]));
const seriesKeys = ["seriesA", "seriesB", "seriesC"];
const fixture = [
  { period: "P1", values: [24, 18, 12] }, { period: "P2", values: [40, 28, 23] },
  { period: "P3", values: [36, 40, 31] }, { period: "P4", values: [58, 46, 40] },
  { period: "P5", values: [68, 56, 52] }, { period: "P6", values: [82, 67, 64] },
];
function node(tag, text, attributes = {}) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = text;
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}
function text(id, value) { $(`#${id}`).textContent = value; }

// Each example commits only valid background colors. Draft strings stay intact
// while typing; no unrelated palette or fixture node is changed.
function acceptExample(key, canonicalize = false) {
  const model = models[key], input = $(`#${key}-background`);
  model.draft = input.value;
  const background = normalizeHex(input.value);
  if (!background) model.error = "Use an opaque 3- or 6-digit hex color. Last valid palette retained.";
  else {
    model.error = ""; model.background = background;
    model.palette = createContrastFit(background);
    if (canonicalize) model.draft = background;
  }
  renderExample(key);
}
for (const key of Object.keys(examples)) {
  const input = $(`#${key}-background`);
  input.addEventListener("input", () => acceptExample(key));
  input.addEventListener("blur", () => acceptExample(key, true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); acceptExample(key, true); }
    if (event.key === "Escape") {
      models[key].draft = models[key].background; models[key].error = ""; renderExample(key);
    }
  });
  $(`#${key}-picker`).addEventListener("input", (event) => { input.value = event.target.value; acceptExample(key, true); });
}
for (const button of $$("[data-example-preset]")) button.addEventListener("click", () => {
  $(`#${button.dataset.examplePreset}-background`).value = button.dataset.color; acceptExample(button.dataset.examplePreset, true);
});
for (const button of $$("[data-example-reset]")) button.addEventListener("click", () => {
  const key = button.dataset.exampleReset, background = examples[key].background;
  models[key] = { background, palette: createContrastFit(background), draft: background, error: "" };
  renderExample(key);
});
initializeScenes();

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

// Apply only this example's palette; static fixture nodes are never replaced.
function renderExample(key) {
  const model = models[key], value = model.palette, example = examples[key];
  const preview = $(example.preview); applyPaletteToElement(preview, value);
  preview.dataset.resolved = value.background; preview.dataset.usable = String(value.usable);
  $(example.frame).style.setProperty("--input-bg", value.inputBackground);
  $(example.frame).dataset.input = value.inputBackground;
  $(`#${key}-picker`).value = value.inputBackground;
  $(`#${key}-background`).value = model.draft;
  const error = model.error;
  $(`#${key}-background`).setAttribute("aria-invalid", String(Boolean(error)));
  $(`#${key}-error`).textContent = error; $(`#${key}-error`).hidden = !error;
  const failed = Object.entries(value.meetsTarget).filter(([flag, pass]) => flag !== "seriesDistinct" && !pass).length;
  text(`${key}-feedback`, [
    value.background !== value.inputBackground ? `Applied ${value.background}` : "",
    !value.usable ? `Targets unresolved · ${failed} checks fail` : "",
    key === "analytics" && !value.meetsTarget.seriesDistinct ? "Color-only separation fails" : "",
  ].filter(Boolean).join(" · "));
  for (const button of $$(`[data-example-preset=${key}]`)) button.setAttribute("aria-pressed", String(button.dataset.color === model.background));
  if (key === "analytics") renderChart(value);
}
for (const key of Object.keys(examples)) renderExample(key);
