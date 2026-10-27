const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

const DEFAULT_ACCENTS = {
  seriesA: "#18B7A6",
  seriesB: "#F06B8A",
  seriesC: "#8F7DFF",
};

const FALLBACK_ACCENTS = [
  "#1D4ED8",
  "#B42318",
  "#047857",
  "#6D28D9",
  "#B54708",
  "#A61B4A",
];

const DEFAULT_TEXT_CONTRAST = 8;
const DEFAULT_MUTED_CONTRAST = 4.7;
const DEFAULT_ACCENT_CONTRAST = 3.3;
const DEFAULT_SURFACE_TEXT_CONTRAST = 4.5;
const SERIES_DISTANCE_THRESHOLD = 32;
const SERIES_PERCEPTUAL_DISTANCE_THRESHOLD = 0.075;

function assertContrastTarget(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 21) {
    throw new RangeError(`${name} must be a finite number between 1 and 21`);
  }

  return value;
}

function assertRecord(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${name} must be a plain object`);
  }
}

function assertKnownKeys(value, keys, name) {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new TypeError(`Unknown ${name} key: ${key}`);
  }
}

function normalizeOptions(options) {
  if (options == null) return {};
  assertRecord(options, "options");
  assertKnownKeys(options, ["textContrast", "mutedContrast", "accentContrast", "surfaceTextContrast", "accents", "backgroundStrategy"], "options");
  if (options.backgroundStrategy !== undefined && !["auto", "preserve"].includes(options.backgroundStrategy)) {
    throw new TypeError('backgroundStrategy must be "auto" or "preserve"');
  }
  return options;
}

function assertColor(color, name = "color") {
  if (!color || typeof color !== "object") throw new TypeError(`${name} must be an RGB object`);
  for (const channel of ["r", "g", "b"]) {
    if (typeof color[channel] !== "number" || !Number.isFinite(color[channel])) {
      throw new TypeError(`${name}.${channel} must be a finite number`);
    }
    if (color[channel] < 0 || color[channel] > 255) {
      throw new RangeError(`${name}.${channel} must be between 0 and 255`);
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHex(hex) {
  if (typeof hex !== "string") return null;

  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;

  const clean = match[1];

  if (clean.length === 3) {
    return `#${clean
      .split("")
      .map((char) => char + char)
      .join("")}`.toUpperCase();
  }

  return `#${clean}`.toUpperCase();
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

export function toHex(color) {
  assertColor(color);
  const { r, g, b } = color;
  return `#${[r, g, b]
    .map((channel) => {
      return Math.round(channel).toString(16).padStart(2, "0");
    })
    .join("")}`.toUpperCase();
}

export function rgba(color, alpha) {
  assertColor(color);
  if (typeof alpha !== "number" || !Number.isFinite(alpha)) {
    throw new TypeError("alpha must be a finite number");
  }

  const safeAlpha = Number(clamp(alpha, 0, 1).toFixed(4));
  return `rgba(${Math.round(clamp(color.r, 0, 255))}, ${Math.round(clamp(color.g, 0, 255))}, ${Math.round(clamp(color.b, 0, 255))}, ${safeAlpha})`;
}

export function mix(first, second, amount) {
  assertColor(first, "first");
  assertColor(second, "second");
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError("amount must be a finite number between 0 and 1");
  }
  return {
    r: first.r + (second.r - first.r) * amount,
    g: first.g + (second.g - first.g) * amount,
    b: first.b + (second.b - first.b) * amount,
  };
}

function srgb(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  assertColor(color);
  return 0.2126 * srgb(color.r) + 0.7152 * srgb(color.g) + 0.0722 * srgb(color.b);
}

export function contrastRatio(first, second) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (light + 0.05) / (dark + 0.05);
}

function quantize(color) {
  return parseHex(toHex(color));
}

function findReadableTone(background, base, minimumContrast) {
  assertContrastTarget(minimumContrast, "minimumContrast");

  let best = quantize(base);
  let bestContrast = contrastRatio(background, best);

  for (let step = 32; step <= 100; step += 1) {
    const color = quantize(mix(background, base, step / 100));
    const contrast = contrastRatio(background, color);

    if (contrast > bestContrast) {
      best = color;
      bestContrast = contrast;
    }

    if (contrast >= minimumContrast) {
      return { color, contrast, meetsTarget: true };
    }
  }

  return { color: best, contrast: bestContrast, meetsTarget: false };
}

export function readableTone(background, base, minimumContrast) {
  return findReadableTone(background, base, minimumContrast).color;
}

export function readableAccent(background, accent, minimumContrast = DEFAULT_ACCENT_CONTRAST) {
  assertContrastTarget(minimumContrast, "minimumContrast");

  const whiteContrast = contrastRatio(background, WHITE);
  const blackContrast = contrastRatio(background, BLACK);
  const endpoint = whiteContrast >= blackContrast ? WHITE : BLACK;
  let best = quantize(accent);
  let bestContrast = contrastRatio(background, best);

  for (let step = 0; step <= 100; step += 1) {
    const color = quantize(mix(accent, endpoint, step / 100));
    const contrast = contrastRatio(background, color);

    if (contrast > bestContrast) {
      best = color;
      bestContrast = contrast;
    }

    if (contrast >= minimumContrast) {
      return color;
    }
  }

  return best;
}

function composite(foreground, background, alpha) {
  return {
    r: background.r + (foreground.r - background.r) * alpha,
    g: background.g + (foreground.g - background.g) * alpha,
    b: background.b + (foreground.b - background.b) * alpha,
  };
}

function colorDistance(first, second) {
  return Math.sqrt(
    (first.r - second.r) ** 2 + (first.g - second.g) ** 2 + (first.b - second.b) ** 2,
  );
}

// OKLab transform: https://bottosson.github.io/posts/oklab/
function toOklab(color) {
  const r = srgb(color.r);
  const g = srgb(color.g);
  const b = srgb(color.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    r: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    g: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

function perceptualColorDistance(first, second) {
  return colorDistance(toOklab(first), toOklab(second));
}

function resolveBackground(background, minimumContrast) {
  if (Math.max(contrastRatio(background, WHITE), contrastRatio(background, BLACK)) >= minimumContrast) {
    return background;
  }

  // Near-smallest quantized adjustment along black/white sRGB mixes, not a
  // globally optimal search over all RGB colors. Compare both paths in OKLab.
  const candidates = [BLACK, WHITE].map((endpoint, index) => {
    const foreground = index === 0 ? WHITE : BLACK;
    let low = 0;
    let high = 1;
    let candidate = endpoint;
    for (let step = 0; step < 24; step += 1) {
      const amount = (low + high) / 2;
      const color = quantize(mix(background, endpoint, amount));
      if (contrastRatio(color, foreground) >= minimumContrast) {
        high = amount;
        candidate = color;
      } else {
        low = amount;
      }
    }
    return candidate;
  });
  return perceptualColorDistance(background, candidates[0]) <= perceptualColorDistance(background, candidates[1])
    ? candidates[0] : candidates[1];
}

function resolveStatus(backgroundHex, foregroundHex, minimumContrast, name, adjustments) {
  const originalBackground = parseHex(backgroundHex);
  const preferred = parseHex(foregroundHex);
  const initial = findReadableTone(originalBackground, preferred, minimumContrast);
  if (initial.meetsTarget) return { background: originalBackground, foreground: initial.color };

  // Try a stronger foreground before changing the generated status background.
  let background = originalBackground;
  let foreground = readableAccent(background, preferred, minimumContrast);
  if (contrastRatio(foreground, background) < minimumContrast) {
    background = resolveBackground(background, minimumContrast);
    foreground = readableAccent(background, preferred, minimumContrast);
    adjustments.push({
      type: "status", from: backgroundHex, to: toHex(background),
      message: `Adjusted ${name} status background to support ${minimumContrast}:1 text contrast.`,
    });
  }
  adjustments.push({
    type: "status", from: toHex(initial.color), to: toHex(foreground),
    message: `Strengthened ${name} status foreground to meet ${minimumContrast}:1 text contrast.`,
  });
  return { background, foreground };
}

function seriesColorsAreDistinct(first, second) {
  return (
    colorDistance(first, second) >= SERIES_DISTANCE_THRESHOLD &&
    perceptualColorDistance(first, second) >= SERIES_PERCEPTUAL_DISTANCE_THRESHOLD
  );
}

function fitSurfaceAlpha(surface, background, initialAlpha, foregrounds, minimumContrast) {
  const cssSurface = quantize(surface);
  const initialStep = Math.round(clamp(initialAlpha, 0, 1) * 100);

  for (let step = initialStep; step >= 0; step -= 1) {
    const alpha = step / 100;
    const compositeSurface = composite(cssSurface, background, alpha);
    const effectiveSurface = quantize(compositeSurface);
    if (foregrounds.every((foreground) =>
      contrastRatio(foreground, effectiveSurface) >= minimumContrast &&
      contrastRatio(foreground, compositeSurface) >= minimumContrast)) {
      return alpha;
    }
  }

  return 0;
}

function selectSeriesColors(background, accentHexes, minimumContrast) {
  const preferred = accentHexes.map((hex) => readableAccent(background, parseHex(hex), minimumContrast));
  if (preferred.every((color, index) =>
    preferred.slice(index + 1).every((other) => seriesColorsAreDistinct(color, other)))) {
    return preferred;
  }

  const sources = [...new Set([...accentHexes, ...Object.values(DEFAULT_ACCENTS), ...FALLBACK_ACCENTS])];
  const colors = [...new Set(sources.map((hex) =>
    toHex(readableAccent(background, parseHex(hex), minimumContrast))))].map(parseHex);
  const preferredHexes = preferred.map(toHex);
  const hexes = colors.map(toHex);
  const labs = colors.map(toOklab);
  const contrast = colors.map((color) => contrastRatio(color, background));
  const pairs = colors.map((first, i) => colors.map((second, j) => ({
    rgb: colorDistance(first, second),
    perceptual: colorDistance(labs[i], labs[j]),
  })));
  let best = null;
  let bestScore = null;
  for (let a = 0; a < colors.length; a += 1) {
    for (let b = 0; b < colors.length; b += 1) {
      for (let c = 0; c < colors.length; c += 1) {
        const indexes = [a, b, c];
        const distances = [pairs[a][b], pairs[a][c], pairs[b][c]];
        // Never choose duplicates just to increase the number of passing pairs.
        // Preserve the adjusted per-series accents before maximizing extra distance.
        const score = [
          indexes.filter((i) => contrast[i] >= minimumContrast).length,
          new Set(indexes).size,
          distances.filter((d) => d.rgb >= SERIES_DISTANCE_THRESHOLD &&
            d.perceptual >= SERIES_PERCEPTUAL_DISTANCE_THRESHOLD).length,
          indexes.filter((i, series) => hexes[i] === preferredHexes[series]).length,
          Math.min(...distances.map((d) => d.perceptual)),
          distances.reduce((sum, d) => sum + d.perceptual, 0),
        ];
        const firstDifference = bestScore ? score.findIndex((value, i) => value !== bestScore[i]) : -1;
        if (!bestScore || (firstDifference >= 0 && score[firstDifference] > bestScore[firstDifference])) {
          bestScore = score;
          best = indexes;
        }
      }
    }
  }
  return best.map((index) => colors[index]);
}

function token(name, css, color, alpha = 1, effectiveColor = color, contrast = null) {
  return {
    name,
    value: alpha === 1 ? css : `${color} / ${alpha}`,
    css,
    color,
    alpha,
    effectiveColor,
    swatch: css,
    contrast,
  };
}

export function createContrastFit(backgroundHex, options = {}) {
  const normalizedOptions = normalizeOptions(options);
  const inputBackground = normalizeHex(backgroundHex);

  if (!inputBackground) {
    throw new Error(`Invalid background color: ${backgroundHex}`);
  }

  const textContrastTarget = assertContrastTarget(
    normalizedOptions.textContrast ?? DEFAULT_TEXT_CONTRAST,
    "textContrast",
  );
  const mutedContrastTarget = assertContrastTarget(
    normalizedOptions.mutedContrast ?? DEFAULT_MUTED_CONTRAST,
    "mutedContrast",
  );
  const accentContrastTarget = assertContrastTarget(
    normalizedOptions.accentContrast ?? DEFAULT_ACCENT_CONTRAST,
    "accentContrast",
  );
  const surfaceTextContrastTarget = assertContrastTarget(
    normalizedOptions.surfaceTextContrast ?? DEFAULT_SURFACE_TEXT_CONTRAST,
    "surfaceTextContrast",
  );

  const auto = normalizedOptions.backgroundStrategy !== "preserve";
  const inputColor = parseHex(inputBackground);
  const background = auto ? resolveBackground(inputColor, Math.max(
    textContrastTarget, mutedContrastTarget, accentContrastTarget, surfaceTextContrastTarget,
  )) : inputColor;
  const bgHex = toHex(background);
  const adjustments = [];
  if (bgHex !== inputBackground) {
    adjustments.push({
      type: "background", from: inputBackground, to: bgHex,
      message: "Adjusted the content background along a black/white mix to support the requested contrast targets.",
    });
  }
  const whiteContrast = contrastRatio(background, WHITE);
  const blackContrast = contrastRatio(background, BLACK);
  const isDark = whiteContrast > blackContrast;
  const baseText = isDark ? WHITE : BLACK;
  const accentOptions = normalizedOptions.accents ?? {};

  assertRecord(accentOptions, "options.accents");
  assertKnownKeys(accentOptions, Object.keys(DEFAULT_ACCENTS), "accents");
  const accents = Object.fromEntries(Object.entries(DEFAULT_ACCENTS).map(
    ([key, value]) => [key, accentOptions[key] ?? value],
  ));
  const accentHexes = [accents.seriesA, accents.seriesB, accents.seriesC].map((accent) => {
    const normalized = normalizeHex(accent);
    if (!normalized) throw new Error(`Invalid accent color: ${accent}`);
    return normalized;
  });

  const textResult = findReadableTone(background, baseText, Math.max(textContrastTarget, surfaceTextContrastTarget));
  const mutedResult = findReadableTone(background, baseText, Math.max(mutedContrastTarget, surfaceTextContrastTarget));
  const panel = isDark ? mix(background, WHITE, 0.1) : mix(background, BLACK, 0.045);
  const metric = isDark ? mix(background, WHITE, 0.08) : mix(background, WHITE, 0.88);
  const border = isDark ? mix(background, WHITE, 0.18) : mix(background, BLACK, 0.14);
  const grid = isDark ? mix(background, WHITE, 0.22) : mix(background, BLACK, 0.18);
  const axis = isDark ? mix(background, WHITE, 0.34) : mix(background, BLACK, 0.28);
  const plotFill = isDark ? mix(background, WHITE, 0.08) : mix(background, BLACK, 0.12);
  const bars = isDark ? mix(background, WHITE, 0.32) : mix(background, BLACK, 0.18);

  const [seriesA, seriesB, seriesC] = selectSeriesColors(
    background,
    accentHexes,
    accentContrastTarget,
  );

  const { background: goodBg, foreground: goodText } = resolveStatus(
    isDark ? "#153F34" : "#DDF8EB", isDark ? "#9DF6D0" : "#064E36",
    surfaceTextContrastTarget, "good", adjustments,
  );
  const { background: warnBg, foreground: warnText } = resolveStatus(
    isDark ? "#4B3920" : "#FFF1C2", isDark ? "#FFD891" : "#6B4500",
    surfaceTextContrastTarget, "warning", adjustments,
  );

  const initialAlpha = {
    panel: isDark ? 0.76 : 0.45,
    metric: isDark ? 0.42 : 0.78,
    border: isDark ? 0.88 : 0.72,
    grid: isDark ? 0.68 : 0.56,
    axis: isDark ? 0.78 : 0.62,
    plotFill: isDark ? 0.38 : 0.6,
    bars: isDark ? 0.58 : 0.46,
  };
  const alpha = {
    ...initialAlpha,
    panel: fitSurfaceAlpha(
      panel,
      background,
      initialAlpha.panel,
      [textResult.color, mutedResult.color],
      surfaceTextContrastTarget,
    ),
    metric: fitSurfaceAlpha(
      metric,
      background,
      initialAlpha.metric,
      [textResult.color, mutedResult.color],
      surfaceTextContrastTarget,
    ),
  };

  const colors = {
    background: bgHex,
    text: toHex(textResult.color),
    muted: toHex(mutedResult.color),
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

  const effectiveColors = {
    panel: toHex(composite(quantize(panel), background, alpha.panel)),
    metric: toHex(composite(quantize(metric), background, alpha.metric)),
    border: toHex(composite(quantize(border), background, alpha.border)),
    grid: toHex(composite(quantize(grid), background, alpha.grid)),
    axis: toHex(composite(quantize(axis), background, alpha.axis)),
    plotFill: toHex(composite(quantize(plotFill), background, alpha.plotFill)),
    bars: toHex(composite(quantize(bars), background, alpha.bars)),
  };

  const text = parseHex(colors.text);
  const muted = parseHex(colors.muted);
  const metricSurface = parseHex(effectiveColors.metric);
  const panelSurface = parseHex(effectiveColors.panel);
  const series = {
    A: parseHex(colors.seriesA),
    B: parseHex(colors.seriesB),
    C: parseHex(colors.seriesC),
  };

  const metrics = {
    textContrast: contrastRatio(text, background),
    mutedContrast: contrastRatio(muted, background),
    panelTextContrast: contrastRatio(text, panelSurface),
    panelMutedContrast: contrastRatio(muted, panelSurface),
    metricTextContrast: contrastRatio(text, metricSurface),
    metricMutedContrast: contrastRatio(muted, metricSurface),
    seriesAContrast: contrastRatio(series.A, background),
    seriesBContrast: contrastRatio(series.B, background),
    seriesCContrast: contrastRatio(series.C, background),
    goodTextContrast: contrastRatio(parseHex(colors.goodText), goodBg),
    warnTextContrast: contrastRatio(parseHex(colors.warnText), warnBg),
    seriesABDistance: colorDistance(series.A, series.B),
    seriesACDistance: colorDistance(series.A, series.C),
    seriesBCDistance: colorDistance(series.B, series.C),
    seriesABPerceptualDistance: perceptualColorDistance(series.A, series.B),
    seriesACPerceptualDistance: perceptualColorDistance(series.A, series.C),
    seriesBCPerceptualDistance: perceptualColorDistance(series.B, series.C),
  };

  const meetsTarget = {
    text: metrics.textContrast >= textContrastTarget,
    muted: metrics.mutedContrast >= mutedContrastTarget,
    panelText: metrics.panelTextContrast >= surfaceTextContrastTarget,
    panelMuted: metrics.panelMutedContrast >= surfaceTextContrastTarget,
    metricText: metrics.metricTextContrast >= surfaceTextContrastTarget,
    metricMuted: metrics.metricMutedContrast >= surfaceTextContrastTarget,
    seriesA: metrics.seriesAContrast >= accentContrastTarget,
    seriesB: metrics.seriesBContrast >= accentContrastTarget,
    seriesC: metrics.seriesCContrast >= accentContrastTarget,
    goodText: metrics.goodTextContrast >= surfaceTextContrastTarget,
    warnText: metrics.warnTextContrast >= surfaceTextContrastTarget,
    seriesDistinct: [
      [series.A, series.B],
      [series.A, series.C],
      [series.B, series.C],
    ].every(([first, second]) => seriesColorsAreDistinct(first, second)),
  };

  const warnings = [];
  const usable = Object.entries(meetsTarget).every(([key, value]) => key === "seriesDistinct" || value);
  const seriesStyles = {
    seriesA: { dashArray: "none", marker: "circle" },
    seriesB: { dashArray: "9 5", marker: "square" },
    seriesC: { dashArray: "2 5", marker: "diamond" },
  };
  if (!meetsTarget.seriesDistinct) {
    adjustments.push({
      type: "series-encoding",
      message: "Use the supplied unique series dash patterns and markers; color alone cannot distinguish these series at the requested contrast.",
    });
  }
  const addWarning = (condition, message) => {
    if (!condition) warnings.push(message);
  };

  addWarning(
    meetsTarget.text,
    `Text contrast target ${textContrastTarget}:1 is not achievable with this background; actual value is ${metrics.textContrast.toFixed(2)}:1.`,
  );
  addWarning(
    meetsTarget.muted,
    `Muted text contrast target ${mutedContrastTarget}:1 is not achievable with this background; actual value is ${metrics.mutedContrast.toFixed(2)}:1.`,
  );
  addWarning(
    meetsTarget.panelText,
    `Text on the generated panel surface is ${metrics.panelTextContrast.toFixed(2)}:1, below the ${surfaceTextContrastTarget}:1 target.`,
  );
  addWarning(
    meetsTarget.panelMuted,
    `Muted text on the generated panel surface is ${metrics.panelMutedContrast.toFixed(2)}:1, below the ${surfaceTextContrastTarget}:1 target.`,
  );
  addWarning(
    meetsTarget.metricText,
    `Text on the generated metric surface is ${metrics.metricTextContrast.toFixed(2)}:1, below the ${surfaceTextContrastTarget}:1 target.`,
  );
  addWarning(
    meetsTarget.metricMuted,
    `Muted text on the generated metric surface is ${metrics.metricMutedContrast.toFixed(2)}:1, below the ${surfaceTextContrastTarget}:1 target.`,
  );
  addWarning(
    meetsTarget.seriesA && meetsTarget.seriesB && meetsTarget.seriesC,
    `One or more series colors are below the ${accentContrastTarget}:1 contrast target.`,
  );
  addWarning(
    auto || meetsTarget.seriesDistinct,
    "Generated series colors are not sufficiently distinct from one another; do not rely on color alone to identify data series.",
  );
  addWarning(
    meetsTarget.goodText && meetsTarget.warnText,
    "One or more status text colors are below the requested surface contrast target.",
  );

  return {
    inputBackground,
    background: bgHex,
    isDark,
    colors,
    effectiveColors,
    targets: {
      textContrast: textContrastTarget,
      mutedContrast: mutedContrastTarget,
      accentContrast: accentContrastTarget,
      surfaceTextContrast: surfaceTextContrastTarget,
    },
    meetsTarget,
    usable,
    adjustments,
    seriesStyles,
    warnings,
    metrics,
    alphas: { ...alpha },
    tokens: [
      token("Background", colors.background, colors.background, 1, colors.background),
      token("Text", colors.text, colors.text, 1, colors.text, metrics.textContrast),
      token("Muted", colors.muted, colors.muted, 1, colors.muted, metrics.mutedContrast),
      token("Metric BG", colors.metric, toHex(metric), alpha.metric, effectiveColors.metric),
      token("Panel", colors.panel, toHex(panel), alpha.panel, effectiveColors.panel),
      token("Border", colors.border, toHex(border), alpha.border, effectiveColors.border),
      token("Grid", colors.grid, toHex(grid), alpha.grid, effectiveColors.grid),
      token("Axis", colors.axis, toHex(axis), alpha.axis, effectiveColors.axis),
      token("Plot Fill", colors.plotFill, toHex(plotFill), alpha.plotFill, effectiveColors.plotFill),
      token("Bars", colors.bars, toHex(bars), alpha.bars, effectiveColors.bars),
      token("Series A", colors.seriesA, colors.seriesA, 1, colors.seriesA, metrics.seriesAContrast),
      token("Series B", colors.seriesB, colors.seriesB, 1, colors.seriesB, metrics.seriesBContrast),
      token("Series C", colors.seriesC, colors.seriesC, 1, colors.seriesC, metrics.seriesCContrast),
      token("Good BG", colors.goodBg, colors.goodBg),
      token("Good Text", colors.goodText, colors.goodText, 1, colors.goodText, metrics.goodTextContrast),
      token("Warn BG", colors.warnBg, colors.warnBg),
      token("Warn Text", colors.warnText, colors.warnText, 1, colors.warnText, metrics.warnTextContrast),
    ],
  };
}

export function paletteToCssVariables(palette, prefix = "contrast-fit") {
  if (!palette?.colors) throw new TypeError("palette must contain colors");
  if (typeof prefix !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) {
    throw new TypeError("prefix must be a valid CSS custom property prefix");
  }
  const keys = ["background", "text", "muted", "panel", "metric", "border", "grid", "axis",
    "plotFill", "bars", "seriesA", "seriesB", "seriesC", "goodBg", "goodText", "warnBg", "warnText"];
  for (const key of keys) {
    const value = palette.colors[key];
    if (typeof value !== "string" ||
        !(/^#[0-9A-F]{6}$/i.test(value) || /^rgba\(\d+, \d+, \d+, (?:0(?:\.\d+)?|1)\)$/.test(value))) {
      throw new TypeError(`palette.colors.${key} must contain a generated CSS color`);
    }
  }
  return {
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

}

export function applyPaletteToElement(element, palette, prefix = "contrast-fit") {
  if (!element?.style || typeof element.style.setProperty !== "function") {
    throw new TypeError("element must provide a style.setProperty function");
  }
  // Validate everything before mutating the element.
  const cssVars = paletteToCssVariables(palette, prefix);
  Object.entries(cssVars).forEach(([name, value]) => element.style.setProperty(name, value));
  return cssVars;
}
