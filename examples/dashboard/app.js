import {
  applyPaletteToElement,
  createContrastFit,
  normalizeHex,
  paletteToCssVariables,
} from "../../src/contrast-fit.js";

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

function getChartData(offset) {
  return {
    series: chartSeries.map((series, seriesIndex) =>
      series.map((value) => value + offset + seriesIndex * offset * 0.25),
    ),
    volume: volumeSeries.map((value) => value + offset),
    scoreMax: 126 + offset,
  };
}

function renderChart(svg, data) {
  const width = 760;
  const left = 58;
  const right = 24;
  const top = 34;
  const chartBottom = 292;
  const barTop = 322;
  const barBottom = 384;
  const plotWidth = width - left - right;
  const min = 12;
  const max = data.scoreMax;
  const volumeMax = Math.max(...data.volume);
  const xAt = (index) => left + (plotWidth / (data.series[0].length - 1)) * index;
  const barWidth = plotWidth / data.volume.length - 5;
  const points = data.series.map((series) =>
    series.map((value, index) => [xAt(index), scale(value, min, max, top, chartBottom)]),
  );

  const grid = [20, 40, 60, 80, 100, 120]
    .map((tick) => {
      const y = scale(tick, min, max, top, chartBottom);
      return `
        <g class="score-tick">
          <line class="grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" />
          <text class="axis-label" x="${left - 12}" y="${y + 4}" text-anchor="end">${tick}</text>
        </g>
      `;
    })
    .join("");

  const guides = [0, 3, 6, 9, 12, 15, 18, 21, 23].map((index) => {
    const x = xAt(index);
    return `
      <g class="period-tick">
        <line class="grid" x1="${x}" y1="${top}" x2="${x}" y2="${barBottom}" />
        <text class="axis-label" x="${x}" y="${barBottom + 26}" text-anchor="middle">P${index + 1}</text>
      </g>
    `;
  }).join("");

  const bars = data.volume
    .map((value, index) => {
      const x = xAt(index) - barWidth / 2;
      const height = (value / volumeMax) * (barBottom - barTop);
      return `<rect class="bar" x="${x.toFixed(1)}" y="${(barBottom - height).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" rx="3" />`;
    })
    .join("");

  const markers = points.map((series, seriesIndex) => series
    .filter((_, index) => index % 3 === 2)
    .map(([x, y]) => {
      const name = `point line-${String.fromCharCode(97 + seriesIndex)}`;
      if (seriesIndex === 1) return `<rect class="${name}" x="${(x - 4).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="8" height="8" />`;
      if (seriesIndex === 2) return `<path class="${name}" d="M ${x.toFixed(1)} ${(y - 5).toFixed(1)} l 5 5 l -5 5 l -5 -5 Z" />`;
      return `<circle class="${name}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" />`;
    }).join("")).join("");

  const latest = points[0].at(-1);

  svg.innerHTML = `
    ${grid}
    ${guides}
    <line class="axis" x1="${left}" y1="${chartBottom}" x2="${width - right}" y2="${chartBottom}" />
    <g class="volume-tick">
      <line class="grid" x1="${left}" y1="${barTop}" x2="${width - right}" y2="${barTop}" />
      <text class="axis-label" x="${left - 12}" y="${barTop + 4}" text-anchor="end">${volumeMax}</text>
    </g>
    <g class="volume-tick">
      <line class="axis" x1="${left}" y1="${barBottom}" x2="${width - right}" y2="${barBottom}" />
      <text class="axis-label" x="${left - 12}" y="${barBottom + 4}" text-anchor="end">0</text>
    </g>
    ${bars}
    <path class="series-line line-c" d="${pointsToPath(points[2])}" />
    <path class="series-line line-b" d="${pointsToPath(points[1])}" />
    <path class="series-line line-a" d="${pointsToPath(points[0])}" />
    ${markers}
    <rect class="callout" x="${latest[0] - 86}" y="${latest[1] - 48}" width="74" height="32" rx="8" />
    <text class="value-label" x="${latest[0] - 49}" y="${latest[1] - 28}" text-anchor="middle">${data.series[0].at(-1)}</text>
    <line class="axis" x1="${latest[0] - 12}" y1="${latest[1] - 16}" x2="${latest[0]}" y2="${latest[1]}" />
    <text class="axis-label" x="${left}" y="22">indexed score</text>
    <text class="axis-label" x="${left}" y="${barTop - 10}">volume</text>
  `;
}

function renderDataTable(container, data, seriesLabels) {
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = "Chart data by period";
  table.append(caption);

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Period", ...seriesLabels, "Volume"].forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  });
  header.append(headerRow);
  table.append(header);

  const body = document.createElement("tbody");
  data.series[0].forEach((_, index) => {
    const row = document.createElement("tr");
    const period = document.createElement("th");
    period.scope = "row";
    period.textContent = `Period ${index + 1}`;
    row.append(period);

    data.series.forEach((series) => {
      const cell = document.createElement("td");
      cell.textContent = String(series[index]);
      row.append(cell);
    });

    const volume = document.createElement("td");
    volume.textContent = String(data.volume[index]);
    row.append(volume);
    body.append(row);
  });

  table.append(body);
  container.replaceChildren(table);
}

function renderInspector(palette) {
  const list = document.querySelector(".js-token-output");
  if (!list) return;

  const rows = palette.tokens.map((token) => {
    const row = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "token-swatch";
    swatch.style.backgroundColor = palette.background;
    swatch.setAttribute("aria-hidden", "true");
    const layer = document.createElement("span");
    layer.style.backgroundColor = token.css;
    swatch.append(layer);

    const name = document.createElement("strong");
    name.textContent = token.name;
    const value = document.createElement("code");
    value.textContent = token.css;
    const detail = document.createElement("small");
    detail.textContent = `Effective ${token.effectiveColor}${token.contrast == null ? "" : ` · ${token.contrast.toFixed(2)}:1`}`;
    row.append(swatch, name, value, detail);
    return row;
  });
  list.replaceChildren(...rows);

  const css = Object.entries(paletteToCssVariables(palette))
    .map(([name, value]) => `  ${name}: ${value};`).join("\n");
  document.querySelector(".js-css-output").textContent = `.contrast-fit-surface {\n${css}\n}`;
  document.querySelector(".js-json-output").textContent = JSON.stringify(palette, null, 2);
  document.querySelector(".js-repair-output").textContent = palette.adjustments.length
    ? `${palette.inputBackground} → ${palette.background}. ${palette.adjustments.map(({ message }) => message).join(" ")}`
    : `${palette.inputBackground} → ${palette.background}. All measured contrast targets pass without a background adjustment.`;
}

function updateCard(card, { syncHex = true } = {}) {
  const palette = createContrastFit(card.dataset.bg);
  const picker = card.querySelector(".js-bg-picker");
  const input = card.querySelector(".js-bg-hex");
  const status = card.querySelector(".js-palette-status");

  applyPaletteToElement(card, palette);
  card.dataset.resolvedBg = palette.background;
  card.dataset.usable = String(palette.usable);
  card.style.setProperty("--demo-input-bg", palette.inputBackground);
  // Controls are nested inside the panel: use the opaque measured surface, not a second alpha layer.
  card.style.setProperty("--demo-metric-surface", palette.effectiveColors.metric);
  picker.value = palette.inputBackground;
  if (syncHex) input.value = palette.inputBackground;
  card.querySelector(".js-input-color").textContent = palette.inputBackground;
  card.querySelector(".js-resolved-color").textContent = palette.background;
  card.querySelector(".js-contrast-result").textContent =
    `Text ${palette.metrics.textContrast.toFixed(2)}:1 · secondary ${palette.metrics.mutedContrast.toFixed(2)}:1`;
  for (const [index, key] of ["seriesA", "seriesB", "seriesC"].entries()) {
    card.querySelectorAll(`.series-line.line-${String.fromCharCode(97 + index)}`).forEach((line) => {
      line.style.strokeDasharray = palette.seriesStyles[key].dashArray;
    });
  }
  picker.setAttribute("aria-invalid", "false");
  input.setAttribute("aria-invalid", "false");

  if (palette.adjustments.length > 0) {
    status.hidden = false;
    status.dataset.state = "adapted";
    status.textContent = palette.inputBackground !== palette.background
      ? `Auto-fitted content to ${palette.background}; your chosen color is kept on the frame.`
      : "Contrast fitted automatically; distinct line styles preserve series identity.";
  } else {
    status.hidden = true;
    status.dataset.state = "ok";
    status.textContent = "";
  }
  if (card === document.querySelector(".js-contrast-card")) renderInspector(palette);
}

function bindCard(card, index) {
  const picker = card.querySelector(".js-bg-picker");
  const input = card.querySelector(".js-bg-hex");
  const status = card.querySelector(".js-palette-status");
  const statusId = `palette-status-${index}`;

  status.id = statusId;
  picker.setAttribute("aria-describedby", statusId);
  input.setAttribute("aria-describedby", statusId);
  let committedBackground = card.dataset.bg;

  function setBackground(value, source, commit = false) {
    const normalized = normalizeHex(value);
    if (!normalized) {
      source.setAttribute("aria-invalid", "true");
      status.hidden = false;
      status.dataset.state = "error";
      status.textContent = "Enter a 3- or 6-digit hex color, such as #2B3548.";
      return;
    }

    card.dataset.bg = normalized;
    if (commit) committedBackground = normalized;
    // Preview valid drafts without expanding #abc mid-keystroke or moving the caret.
    updateCard(card, { syncHex: source !== input || commit });
  }

  picker.addEventListener("input", () => setBackground(picker.value, picker, true));
  picker.addEventListener("change", () => setBackground(picker.value, picker, true));
  input.addEventListener("input", () => setBackground(input.value, input));
  input.addEventListener("change", () => setBackground(input.value, input, true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setBackground(input.value, input, true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      card.dataset.bg = committedBackground;
      updateCard(card);
    }
  });

  const offset = Number(card.dataset.offset);
  const data = getChartData(offset);
  const seriesLabels = card.dataset.seriesLabels.split("|");
  const summary = card.querySelector(".js-chart-summary");

  renderChart(card.querySelector(".js-plot"), data);
  updateCard(card);
  renderDataTable(card.querySelector(".js-data-table"), data, seriesLabels);
  summary.textContent = `${seriesLabels.join(", ")} and volume across ${data.series[0].length} periods (P1–P24). Lines use solid/circle, dashed/square, and dotted/diamond styles, respectively. An accessible data table is available below.`;
}

document.querySelectorAll(".js-contrast-card").forEach(bindCard);

// A one-click example demonstrates a formerly failing background with a ready-to-use result.
document.querySelectorAll(".js-preview-background").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector(".js-contrast-card .js-bg-hex");
    input.value = button.dataset.background;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
});
