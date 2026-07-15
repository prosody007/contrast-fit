const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

const DEFAULT_ACCENTS = {
  seriesA: "#18B7A6",
  seriesB: "#F06B8A",
  seriesC: "#8F7DFF",
};

export function normalizeHex(hex) {
  if (typeof hex !== "string") return null;

  const clean = hex.replace("#", "").trim();

  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean
      .split("")
      .map((char) => char + char)
      .join("")}`.toUpperCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean}`.toUpperCase();
  }

  return null;
}

export function parseHex(hex) {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const value = normalized.slice(1);

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function rgba(color, alpha) {
  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
}

export function mix(first, second, amount) {
  return {
    r: first.r + (second.r - first.r) * amount,
    g: first.g + (second.g - first.g) * amount,
    b: first.b + (second.b - first.b) * amount,
  };
}

function srgb(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  return 0.2126 * srgb(color.r) + 0.7152 * srgb(color.g) + 0.0722 * srgb(color.b);
}

export function contrastRatio(first, second) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (light + 0.05) / (dark + 0.05);
}

export function readableTone(background, base, minimumContrast) {
  for (let amount = 0.32; amount <= 1; amount += 0.02) {
    const color = mix(background, base, amount);

    if (contrastRatio(background, color) >= minimumContrast) {
      return color;
    }
  }

  return base;
}

export function readableAccent(background, accent, minimumContrast = 3.3) {
  let current = accent;
  const isDark = relativeLuminance(background) < 0.45;

  for (let index = 0; index < 24; index += 1) {
    if (contrastRatio(background, current) >= minimumContrast) {
      return current;
    }

    current = isDark ? mix(current, WHITE, 0.12) : mix(current, BLACK, 0.1);
  }

  return contrastRatio(background, WHITE) > contrastRatio(background, BLACK) ? WHITE : BLACK;
}

function token(name, value, swatch = value, contrast = null) {
  return { name, value, swatch, contrast };
}

export function createAdaptivePalette(backgroundHex, options = {}) {
  const bgHex = normalizeHex(backgroundHex);

  if (!bgHex) {
    throw new Error(`Invalid background color: ${backgroundHex}`);
  }

  const background = parseHex(bgHex);
  const isDark = relativeLuminance(background) < 0.45;
  const baseText = contrastRatio(background, WHITE) >= contrastRatio(background, BLACK) ? WHITE : BLACK;
  const accents = { ...DEFAULT_ACCENTS, ...options.accents };

  const text = readableTone(background, baseText, options.textContrast ?? 8);
  const muted = readableTone(background, baseText, options.mutedContrast ?? 4.7);
  const panel = isDark ? mix(background, WHITE, 0.1) : mix(background, BLACK, 0.045);
  const metric = isDark ? mix(background, WHITE, 0.08) : mix(background, WHITE, 0.88);
  const border = isDark ? mix(background, WHITE, 0.18) : mix(background, BLACK, 0.14);
  const grid = isDark ? mix(background, WHITE, 0.22) : mix(background, BLACK, 0.18);
  const axis = isDark ? mix(background, WHITE, 0.34) : mix(background, BLACK, 0.28);
  const plotFill = isDark ? mix(background, WHITE, 0.08) : mix(background, BLACK, 0.12);
  const bars = isDark ? mix(background, WHITE, 0.32) : mix(background, BLACK, 0.18);

  const seriesA = readableAccent(background, parseHex(accents.seriesA));
  const seriesB = readableAccent(background, parseHex(accents.seriesB));
  const seriesC = readableAccent(background, parseHex(accents.seriesC));

  const goodBg = isDark ? parseHex("#153F34") : parseHex("#DDF8EB");
  const goodText = readableTone(goodBg, isDark ? parseHex("#9DF6D0") : parseHex("#064E36"), 4.5);
  const warnBg = isDark ? parseHex("#4B3920") : parseHex("#FFF1C2");
  const warnText = readableTone(warnBg, isDark ? parseHex("#FFD891") : parseHex("#6B4500"), 4.5);

  const alpha = {
    panel: isDark ? 0.76 : 0.45,
    metric: isDark ? 0.42 : 0.78,
    border: isDark ? 0.88 : 0.72,
    grid: isDark ? 0.68 : 0.56,
    axis: isDark ? 0.78 : 0.62,
    plotFill: isDark ? 0.38 : 0.6,
    bars: isDark ? 0.58 : 0.46,
  };

  const colors = {
    background: bgHex,
    text: toHex(text),
    muted: toHex(muted),
    panel: rgba(panel, alpha.panel),
    metric: rgba(metric, alpha.metric),
    border: rgba(border, alpha.border),
    grid: rgba(grid, alpha.grid),
    axis: rgba(axis, alpha.axis),
    plotFill: rgba(plotFill, alpha.plotFill),
    bars: rgba(bars, alpha.bars),
    seriesA: toHex(seriesA),
    seriesB: toHex(seriesB),
    seriesC: toHex(seriesC),
    goodBg: toHex(goodBg),
    goodText: toHex(goodText),
    warnBg: toHex(warnBg),
    warnText: toHex(warnText),
  };

  return {
    background: bgHex,
    isDark,
    colors,
    metrics: {
      textContrast: contrastRatio(text, background),
      mutedContrast: contrastRatio(muted, background),
      seriesAContrast: contrastRatio(seriesA, background),
      seriesBContrast: contrastRatio(seriesB, background),
      seriesCContrast: contrastRatio(seriesC, background),
      goodTextContrast: contrastRatio(goodText, goodBg),
      warnTextContrast: contrastRatio(warnText, warnBg),
    },
    tokens: [
      token("Background", bgHex),
      token("Text", colors.text, colors.text, contrastRatio(text, background)),
      token("Muted", colors.muted, colors.muted, contrastRatio(muted, background)),
      token("Metric BG", `${toHex(metric)} / ${alpha.metric}`, colors.metric),
      token("Panel", `${toHex(panel)} / ${alpha.panel}`, colors.panel),
      token("Border", `${toHex(border)} / ${alpha.border}`, colors.border),
      token("Grid", `${toHex(grid)} / ${alpha.grid}`, colors.grid),
      token("Axis", `${toHex(axis)} / ${alpha.axis}`, colors.axis),
      token("Bars", `${toHex(bars)} / ${alpha.bars}`, colors.bars),
      token("Series A", colors.seriesA, colors.seriesA, contrastRatio(seriesA, background)),
      token("Series B", colors.seriesB, colors.seriesB, contrastRatio(seriesB, background)),
      token("Series C", colors.seriesC, colors.seriesC, contrastRatio(seriesC, background)),
      token("Good BG", colors.goodBg),
      token("Good Text", colors.goodText, colors.goodText, contrastRatio(goodText, goodBg)),
      token("Warn BG", colors.warnBg),
      token("Warn Text", colors.warnText, colors.warnText, contrastRatio(warnText, warnBg)),
    ],
  };
}

export function applyPaletteToElement(element, palette, prefix = "adaptive") {
  const cssVars = {
    [`--${prefix}-bg`]: palette.colors.background,
    [`--${prefix}-text`]: palette.colors.text,
    [`--${prefix}-muted`]: palette.colors.muted,
    [`--${prefix}-panel`]: palette.colors.panel,
    [`--${prefix}-metric`]: palette.colors.metric,
    [`--${prefix}-border`]: palette.colors.border,
    [`--${prefix}-grid`]: palette.colors.grid,
    [`--${prefix}-axis`]: palette.colors.axis,
    [`--${prefix}-plot-fill`]: palette.colors.plotFill,
    [`--${prefix}-bars`]: palette.colors.bars,
    [`--${prefix}-series-a`]: palette.colors.seriesA,
    [`--${prefix}-series-b`]: palette.colors.seriesB,
    [`--${prefix}-series-c`]: palette.colors.seriesC,
    [`--${prefix}-good-bg`]: palette.colors.goodBg,
    [`--${prefix}-good-text`]: palette.colors.goodText,
    [`--${prefix}-warn-bg`]: palette.colors.warnBg,
    [`--${prefix}-warn-text`]: palette.colors.warnText,
  };

  Object.entries(cssVars).forEach(([name, value]) => {
    element.style.setProperty(name, value);
  });

  return cssVars;
}
