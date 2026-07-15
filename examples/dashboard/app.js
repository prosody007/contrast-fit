import {
  applyPaletteToElement,
  createAdaptivePalette,
  normalizeHex,
} from "../../src/adaptive-palette.js";

const chartSeries = [
  [42, 46, 41, 50, 57, 54, 61, 66, 64, 70, 76, 73, 82, 86, 83, 89, 94, 91, 99, 103, 108, 104, 112, 118],
  [31, 34, 38, 35, 44, 48, 46, 52, 55, 51, 58, 63, 60, 67, 71, 74, 70, 78, 82, 79, 86, 89, 92, 96],
  [18, 22, 20, 26, 29, 31, 35, 33, 39, 42, 41, 46, 49, 53, 51, 56, 61, 59, 64, 68, 71, 69, 73, 77],
];

const volumeSeries = [
  34, 42, 38, 48, 54, 50, 62, 66, 59, 72, 76, 81, 74, 88, 91, 86, 97, 102, 94, 109, 115, 108, 122, 130,
];

function scale(value, min, max, start, end) {
  return end - ((value - min) / (max - min)) * (end - start);
}

function pointsToPath(points) {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
}

function renderChart(svg, offset = 0, id = "chart") {
  const width = 760;
  const left = 58;
  const right = 24;
  const top = 34;
  const chartBottom = 292;
  const barTop = 322;
  const barBottom = 384;
  const plotWidth = width - left - right;
  const min = 12;
  const max = 126;
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const shifted = chartSeries.map((series, seriesIndex) =>
    series.map((value) => value + offset + seriesIndex * offset * 0.25),
  );
  const xAt = (index) => left + (plotWidth / (shifted[0].length - 1)) * index;
  const barWidth = plotWidth / volumeSeries.length - 5;
  const points = shifted.map((series) =>
    series.map((value, index) => [xAt(index), scale(value, min, max + offset, top, chartBottom)]),
  );
  const areaPath = (seriesPoints) =>
    `${pointsToPath(seriesPoints)} L ${seriesPoints.at(-1)[0].toFixed(1)} ${chartBottom} L ${seriesPoints[0][0].toFixed(1)} ${chartBottom} Z`;

  const grid = [20, 40, 60, 80, 100, 120]
    .map((tick) => {
      const y = scale(tick + offset * 0.45, min, max + offset, top, chartBottom);
      return `
        <line class="grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" />
        <text class="axis-label" x="${left - 12}" y="${y + 4}" text-anchor="end">${tick}</text>
      `;
    })
    .join("");

  const guides = Array.from({ length: 8 }, (_, index) => {
    const x = left + (plotWidth / 7) * index;
    return `
      <line class="grid" x1="${x}" y1="${top}" x2="${x}" y2="${barBottom}" />
      <text class="axis-label" x="${x}" y="${barBottom + 26}" text-anchor="middle">${labels[index]}</text>
    `;
  }).join("");

  const bars = volumeSeries
    .map((value, index) => {
      const x = xAt(index) - barWidth / 2;
      const height = ((value + offset) / (130 + offset)) * (barBottom - barTop);
      return `<rect class="bar" x="${x.toFixed(1)}" y="${(barBottom - height).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" rx="3" />`;
    })
    .join("");

  const markers = points
    .map((series, seriesIndex) =>
      series
        .filter((_, index) => index % 3 === 2)
        .map(
          ([x, y]) =>
            `<circle class="point line-${String.fromCharCode(97 + seriesIndex)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" />`,
        )
        .join(""),
    )
    .join("");

  const latest = points[0].at(-1);

  svg.innerHTML = `
    <defs>
      <linearGradient id="area-a-${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--adaptive-series-a)" stop-opacity=".24" />
        <stop offset="100%" stop-color="var(--adaptive-series-a)" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="area-b-${id}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--adaptive-series-b)" stop-opacity=".2" />
        <stop offset="100%" stop-color="var(--adaptive-series-b)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect class="target-band" x="${left}" y="${scale(96 + offset, min, max + offset, top, chartBottom)}" width="${plotWidth}" height="34" rx="8" />
    ${grid}
    ${guides}
    <line class="axis" x1="${left}" y1="${chartBottom}" x2="${width - right}" y2="${chartBottom}" />
    <line class="axis" x1="${left}" y1="${barBottom}" x2="${width - right}" y2="${barBottom}" />
    ${bars}
    <path fill="url(#area-a-${id})" d="${areaPath(points[0])}" />
    <path fill="url(#area-b-${id})" d="${areaPath(points[1])}" />
    <path class="series-line line-c" d="${pointsToPath(points[2])}" />
    <path class="series-line line-b" d="${pointsToPath(points[1])}" />
    <path class="series-line line-a" d="${pointsToPath(points[0])}" />
    ${markers}
    <rect class="callout" x="${latest[0] - 86}" y="${latest[1] - 48}" width="74" height="32" rx="8" />
    <text class="value-label" x="${latest[0] - 49}" y="${latest[1] - 28}" text-anchor="middle">${Math.round(shifted[0].at(-1))}.2</text>
    <line class="axis" x1="${latest[0] - 12}" y1="${latest[1] - 16}" x2="${latest[0]}" y2="${latest[1]}" />
    <text class="axis-label" x="${left}" y="22">indexed score</text>
    <text class="axis-label" x="${width - right}" y="22" text-anchor="end">volume · conversion · expansion</text>
  `;
}

function updateCard(card) {
  const palette = createAdaptivePalette(card.dataset.bg);

  applyPaletteToElement(card, palette);
  card.querySelector(".js-bg-picker").value = palette.background;
  card.querySelector(".js-bg-hex").value = palette.background;
}

function bindCard(card, index) {
  const picker = card.querySelector(".js-bg-picker");
  const input = card.querySelector(".js-bg-hex");

  function setBackground(value) {
    const normalized = normalizeHex(value);
    if (!normalized) return;

    card.dataset.bg = normalized;
    updateCard(card);
  }

  picker.addEventListener("input", () => setBackground(picker.value));
  picker.addEventListener("change", () => setBackground(picker.value));
  input.addEventListener("input", () => setBackground(input.value));
  input.addEventListener("change", () => setBackground(input.value));

  updateCard(card);
  renderChart(card.querySelector(".js-plot"), Number(card.dataset.offset), `card-${index}`);
}

document.querySelectorAll(".js-adaptive-card").forEach(bindCard);
