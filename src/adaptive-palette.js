const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };
const EPSILON = 1e-9;

const DEFAULT_ACCENTS = {
  seriesA: "#18B7A6",
  seriesB: "#F06B8A",
  seriesC: "#8F7DFF",
};

const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const ACTIVE_PALETTE_APPLICATIONS = new WeakMap();
const PALETTE_GENERATIONS = new WeakMap();

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundColor({ r, g, b }) {
  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(b, 0, 255)),
  };
}

function assertColor(color, label) {
  if (
    !color ||
    ![color.r, color.g, color.b].every(
      (channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255,
    )
  ) {
    throw new TypeError(`${label} must contain finite r, g, and b channels between 0 and 255`);
  }
}

function assertContrast(value, label) {
  if (!Number.isFinite(value) || value < 1 || value > 21) {
    throw new RangeError(`${label} must be a finite contrast ratio between 1 and 21`);
  }
}

export function normalizeHex(hex) {
  if (typeof hex !== "string") return null;

  const match = hex.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;

  const value = match[1];
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((character) => character + character)
          .join("")
      : value;

  return `#${expanded.toUpperCase()}`;
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

export function parseCssColor(value) {
  if (typeof value !== "string") return null;

  const input = value.trim();
  const normalized = normalizeHex(input);
  if (normalized) return { ...parseHex(normalized), alpha: 1 };

  const shortAlpha = input.match(/^#([0-9a-fA-F]{4})$/);
  if (shortAlpha) {
    const [r, g, b, a] = shortAlpha[1].split("").map((character) => parseInt(character + character, 16));
    return { r, g, b, alpha: a / 255 };
  }

  const longAlpha = input.match(/^#([0-9a-fA-F]{8})$/);
  if (longAlpha) {
    const valuePart = longAlpha[1];
    return {
      r: parseInt(valuePart.slice(0, 2), 16),
      g: parseInt(valuePart.slice(2, 4), 16),
      b: parseInt(valuePart.slice(4, 6), 16),
      alpha: parseInt(valuePart.slice(6, 8), 16) / 255,
    };
  }

  const named = input.toLowerCase();
  if (named === "black") return { ...BLACK, alpha: 1 };
  if (named === "white") return { ...WHITE, alpha: 1 };
  if (named === "transparent") return { ...BLACK, alpha: 0 };

  const rgbMatch = input.match(/^rgba?\((.*)\)$/i);
  if (!rgbMatch) return null;

  const body = rgbMatch[1].trim();
  const [channelsPart, alphaPart] = body.includes("/")
    ? body.split("/").map((part) => part.trim())
    : [body, null];
  const channelStrings = channelsPart.includes(",")
    ? channelsPart.split(",").map((part) => part.trim())
    : channelsPart.split(/\s+/);

  let resolvedAlpha = alphaPart;
  if (channelStrings.length === 4 && resolvedAlpha === null) {
    resolvedAlpha = channelStrings.pop();
  }
  if (channelStrings.length !== 3) return null;

  const parseChannel = (channel) => {
    if (channel.endsWith("%")) return (Number.parseFloat(channel) / 100) * 255;
    return Number.parseFloat(channel);
  };
  const channels = channelStrings.map(parseChannel);
  if (!channels.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)) {
    return null;
  }

  let alpha = 1;
  if (resolvedAlpha !== null) {
    alpha = resolvedAlpha.endsWith("%")
      ? Number.parseFloat(resolvedAlpha) / 100
      : Number.parseFloat(resolvedAlpha);
  }
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return null;

  return { r: channels[0], g: channels[1], b: channels[2], alpha };
}

export function toHex(color) {
  assertColor(color, "color");
  const { r, g, b } = roundColor(color);
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function rgba(color, alpha) {
  assertColor(color, "color");
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError("alpha must be between 0 and 1");
  }
  const rounded = roundColor(color);
  return `rgba(${rounded.r}, ${rounded.g}, ${rounded.b}, ${alpha})`;
}

export function mix(first, second, amount) {
  assertColor(first, "first color");
  assertColor(second, "second color");
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError("mix amount must be between 0 and 1");
  }

  return {
    r: first.r + (second.r - first.r) * amount,
    g: first.g + (second.g - first.g) * amount,
    b: first.b + (second.b - first.b) * amount,
  };
}

function srgbToLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel) {
  const value = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return value * 255;
}

export function relativeLuminance(color) {
  assertColor(color, "color");
  return (
    0.2126 * srgbToLinear(color.r) +
    0.7152 * srgbToLinear(color.g) +
    0.0722 * srgbToLinear(color.b)
  );
}

export function contrastRatio(first, second) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (light + 0.05) / (dark + 0.05);
}

export function compositeColors(foreground, background, alpha = 1) {
  assertColor(foreground, "foreground");
  assertColor(background, "background");
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError("alpha must be between 0 and 1");
  }

  return roundColor({
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
  });
}

function renderedContrast(foreground, background, alpha = 1) {
  return contrastRatio(compositeColors(roundColor(foreground), roundColor(background), alpha), roundColor(background));
}

export function solveContrast(background, base, minimumContrast = 4.5, options = {}) {
  assertColor(background, "background");
  assertColor(base, "base color");
  assertContrast(minimumContrast, "minimumContrast");

  const alpha = options.alpha ?? 1;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new RangeError("alpha must be greater than 0 and no more than 1");
  }

  const roundedBackground = roundColor(background);
  const roundedBase = roundColor(base);
  const maximum = renderedContrast(roundedBase, roundedBackground, alpha);

  if (maximum + EPSILON < minimumContrast) {
    return {
      color: roundedBase,
      css: alpha === 1 ? toHex(roundedBase) : rgba(roundedBase, alpha),
      target: minimumContrast,
      achieved: maximum,
      maximum,
      targetMet: false,
      amount: 1,
      alpha,
    };
  }

  let lower = 0;
  let upper = 1;
  let best = roundedBase;
  let bestAmount = 1;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const amount = (lower + upper) / 2;
    const candidate = roundColor(mix(roundedBackground, roundedBase, amount));
    const achieved = renderedContrast(candidate, roundedBackground, alpha);

    if (achieved + EPSILON >= minimumContrast) {
      best = candidate;
      bestAmount = amount;
      upper = amount;
    } else {
      lower = amount;
    }
  }

  const achieved = renderedContrast(best, roundedBackground, alpha);
  return {
    color: best,
    css: alpha === 1 ? toHex(best) : rgba(best, alpha),
    target: minimumContrast,
    achieved,
    maximum,
    targetMet: achieved + EPSILON >= minimumContrast,
    amount: bestAmount,
    alpha,
  };
}

// Backward-compatible convenience helper. Use solveContrast when callers need
// to distinguish a met target from the best reachable fallback.
export function readableTone(background, base, minimumContrast) {
  return solveContrast(background, base, minimumContrast).color;
}

function rgbToOklab(color) {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

function oklabToRawRgb({ l, a, b }) {
  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;
  const linearR = 4.0767416621 * lRoot ** 3 - 3.3077115913 * mRoot ** 3 + 0.2309699292 * sRoot ** 3;
  const linearG = -1.2684380046 * lRoot ** 3 + 2.6097574011 * mRoot ** 3 - 0.3413193965 * sRoot ** 3;
  const linearB = -0.0041960863 * lRoot ** 3 - 0.7034186147 * mRoot ** 3 + 1.707614701 * sRoot ** 3;

  return {
    r: linearToSrgb(linearR),
    g: linearToSrgb(linearG),
    b: linearToSrgb(linearB),
  };
}

function oklabToOklch({ l, a, b }) {
  return {
    l,
    c: Math.sqrt(a * a + b * b),
    h: Math.atan2(b, a),
  };
}

function oklchToOklab({ l, c, h }) {
  return { l, a: c * Math.cos(h), b: c * Math.sin(h) };
}

function inSrgbGamut(color) {
  return [color.r, color.g, color.b].every((channel) => channel >= -EPSILON && channel <= 255 + EPSILON);
}

function gamutMapOklch(oklch) {
  let candidate = oklabToRawRgb(oklchToOklab(oklch));
  if (inSrgbGamut(candidate)) return roundColor(candidate);

  let lower = 0;
  let upper = oklch.c;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const chroma = (lower + upper) / 2;
    const next = oklabToRawRgb(oklchToOklab({ ...oklch, c: chroma }));
    if (inSrgbGamut(next)) {
      candidate = next;
      lower = chroma;
    } else {
      upper = chroma;
    }
  }

  return roundColor(candidate);
}

export function perceptualDistance(first, second) {
  assertColor(first, "first color");
  assertColor(second, "second color");
  const firstLab = rgbToOklab(first);
  const secondLab = rgbToOklab(second);
  return Math.hypot(firstLab.l - secondLab.l, firstLab.a - secondLab.a, firstLab.b - secondLab.b);
}

function simulateColorVision(color, type) {
  const matrix = CVD_MATRICES[type];
  const input = [srgbToLinear(color.r), srgbToLinear(color.g), srgbToLinear(color.b)];
  const output = matrix.map((row) => row.reduce((sum, value, index) => sum + value * input[index], 0));
  return roundColor({
    r: linearToSrgb(clamp(output[0])),
    g: linearToSrgb(clamp(output[1])),
    b: linearToSrgb(clamp(output[2])),
  });
}

function accentCandidates(background, accent, minimumContrast, alpha = 1) {
  const original = roundColor(accent);
  const originalLch = oklabToOklch(rgbToOklab(original));
  const candidates = new Map();

  const addCandidate = (candidate) => {
    const rounded = roundColor(candidate);
    const achieved = renderedContrast(rounded, background, alpha);
    if (achieved + EPSILON < minimumContrast) return;
    const hex = toHex(rounded);
    const score = perceptualDistance(original, rounded);
    const previous = candidates.get(hex);
    if (!previous || score < previous.score) candidates.set(hex, { color: rounded, achieved, score });
  };

  addCandidate(original);
  for (let lightness = 0.02; lightness <= 0.98 + EPSILON; lightness += 0.025) {
    for (const chromaFactor of [1, 0.88, 0.72, 0.56, 0.4, 0.24]) {
      addCandidate(
        gamutMapOklch({
          l: clamp(lightness),
          c: originalLch.c * chromaFactor,
          h: originalLch.h,
        }),
      );
    }
  }
  addCandidate(BLACK);
  addCandidate(WHITE);

  return [...candidates.values()].sort((first, second) => first.score - second.score);
}

export function solveAccent(background, accent, minimumContrast = 3, options = {}) {
  assertColor(background, "background");
  assertColor(accent, "accent");
  assertContrast(minimumContrast, "minimumContrast");
  const alpha = options.alpha ?? 1;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new RangeError("alpha must be greater than 0 and no more than 1");
  }

  const candidates = accentCandidates(roundColor(background), roundColor(accent), minimumContrast, alpha);
  const best = candidates[0];
  if (!best) {
    const blackContrast = renderedContrast(BLACK, background, alpha);
    const whiteContrast = renderedContrast(WHITE, background, alpha);
    const color = blackContrast >= whiteContrast ? BLACK : WHITE;
    const achieved = Math.max(blackContrast, whiteContrast);
    return {
      color,
      css: alpha === 1 ? toHex(color) : rgba(color, alpha),
      target: minimumContrast,
      achieved,
      targetMet: false,
      alpha,
    };
  }

  return {
    color: best.color,
    css: alpha === 1 ? toHex(best.color) : rgba(best.color, alpha),
    target: minimumContrast,
    achieved: best.achieved,
    targetMet: true,
    alpha,
  };
}

// Backward-compatible convenience helper. Use solveAccent for status metadata.
export function readableAccent(background, accent, minimumContrast = 3) {
  return solveAccent(background, accent, minimumContrast).color;
}

function colorsAreDistinct(first, second, minimumDistance, minimumCvdDistance) {
  if (perceptualDistance(first, second) + EPSILON < minimumDistance) return false;
  return Object.keys(CVD_MATRICES).every(
    (type) =>
      perceptualDistance(simulateColorVision(first, type), simulateColorVision(second, type)) + EPSILON >=
      minimumCvdDistance,
  );
}

export function solveSeriesColors(background, accents, options = {}) {
  assertColor(background, "background");
  const minimumContrast = options.minimumContrast ?? 3;
  const minimumDistance = options.minimumDistance ?? 0.055;
  const minimumCvdDistance = options.minimumCvdDistance ?? 0.025;
  assertContrast(minimumContrast, "minimumContrast");
  if (!Number.isFinite(minimumDistance) || minimumDistance < 0) {
    throw new RangeError("minimumDistance must be a non-negative finite number");
  }
  if (!Number.isFinite(minimumCvdDistance) || minimumCvdDistance < 0) {
    throw new RangeError("minimumCvdDistance must be a non-negative finite number");
  }

  const entries = Object.entries(accents);
  if (entries.length === 0) throw new Error("At least one series accent is required");
  const candidateSets = entries.map(([name, value]) => {
    const color = typeof value === "string" ? parseHex(value) : value;
    assertColor(color, `${name} accent`);
    const candidates = accentCandidates(background, color, minimumContrast).slice(0, 48);
    if (candidates.length > 0) return candidates;

    const fallback = solveAccent(background, color, minimumContrast);
    return [{ color: fallback.color, achieved: fallback.achieved, score: Number.POSITIVE_INFINITY }];
  });
  const chosen = [];

  const search = (index) => {
    if (index === candidateSets.length) return true;
    for (const candidate of candidateSets[index]) {
      if (
        chosen.every((existing) =>
          colorsAreDistinct(existing.color, candidate.color, minimumDistance, minimumCvdDistance),
        )
      ) {
        chosen.push(candidate);
        if (search(index + 1)) return true;
        chosen.pop();
      }
    }
    return false;
  };

  const distinct = search(0);
  if (!distinct) {
    chosen.splice(0, chosen.length, ...candidateSets.map((candidates) => candidates[0]).filter(Boolean));
  }

  const colors = {};
  const metrics = {};
  entries.forEach(([name], index) => {
    const candidate = chosen[index];
    colors[name] = candidate ? toHex(candidate.color) : null;
    metrics[`${name}Contrast`] = candidate?.achieved ?? 0;
  });

  return {
    colors,
    metrics,
    targetMet: chosen.length === entries.length && chosen.every((candidate) => candidate.achieved >= minimumContrast),
    distinct,
    minimumContrast,
    minimumDistance,
    minimumCvdDistance,
  };
}

function token(name, value, swatch = value, contrast = null, targetMet = null) {
  return { name, value, swatch, contrast, targetMet };
}

function validateOptions(options) {
  for (const [name, fallback] of [
    ["textContrast", 4.5],
    ["preferredTextContrast", 7],
    ["mutedContrast", 4.5],
    ["graphicContrast", 3],
    ["seriesContrast", 3.3],
  ]) {
    assertContrast(options[name] ?? fallback, name);
  }
}

export function createAdaptivePalette(backgroundHex, options = {}) {
  const bgHex = normalizeHex(backgroundHex);

  if (!bgHex) {
    throw new Error(`Invalid background color: ${backgroundHex}`);
  }
  validateOptions(options);

  const background = parseHex(bgHex);
  const whiteContrast = contrastRatio(background, WHITE);
  const blackContrast = contrastRatio(background, BLACK);
  const isDark = whiteContrast >= blackContrast;
  const baseText = isDark ? WHITE : BLACK;
  const accents = { ...DEFAULT_ACCENTS, ...options.accents };
  const targets = {
    text: options.textContrast ?? 4.5,
    preferredText: options.preferredTextContrast ?? 7,
    muted: options.mutedContrast ?? 4.5,
    graphic: options.graphicContrast ?? 3,
    series: options.seriesContrast ?? 3.3,
  };

  const preferredText = solveContrast(background, baseText, targets.preferredText);
  const text = preferredText.targetMet
    ? preferredText
    : solveContrast(background, baseText, targets.text);
  const muted = solveContrast(background, baseText, targets.muted);
  const axis = solveContrast(background, baseText, targets.graphic);
  const bars = solveContrast(background, baseText, targets.graphic);
  const border = solveContrast(background, baseText, 1.5);
  const series = solveSeriesColors(background, accents, {
    minimumContrast: targets.series,
    minimumDistance: options.seriesDistance,
    minimumCvdDistance: options.seriesCvdDistance,
  });

  const panel = mix(background, baseText, isDark ? 0.1 : 0.045);
  const metric = isDark ? mix(background, WHITE, 0.08) : mix(background, WHITE, 0.88);
  const grid = mix(background, baseText, isDark ? 0.24 : 0.2);
  const plotFill = mix(background, baseText, isDark ? 0.08 : 0.1);
  const alpha = {
    panel: isDark ? 0.76 : 0.45,
    metric: isDark ? 0.42 : 0.78,
    grid: isDark ? 0.68 : 0.56,
    plotFill: isDark ? 0.38 : 0.6,
  };

  const goodBg = isDark ? parseHex("#153F34") : parseHex("#DDF8EB");
  const goodText = solveContrast(goodBg, isDark ? WHITE : BLACK, 4.5);
  const warnBg = isDark ? parseHex("#4B3920") : parseHex("#FFF1C2");
  const warnText = solveContrast(warnBg, isDark ? WHITE : BLACK, 4.5);

  const colors = {
    background: bgHex,
    text: text.css,
    muted: muted.css,
    panel: rgba(panel, alpha.panel),
    metric: rgba(metric, alpha.metric),
    border: border.css,
    grid: rgba(grid, alpha.grid),
    axis: axis.css,
    plotFill: rgba(plotFill, alpha.plotFill),
    bars: bars.css,
    seriesA: series.colors.seriesA,
    seriesB: series.colors.seriesB,
    seriesC: series.colors.seriesC,
    goodBg: toHex(goodBg),
    goodText: goodText.css,
    warnBg: toHex(warnBg),
    warnText: warnText.css,
  };

  const metrics = {
    textContrast: text.achieved,
    mutedContrast: muted.achieved,
    borderContrast: border.achieved,
    gridContrast: renderedContrast(grid, background, alpha.grid),
    axisContrast: axis.achieved,
    barsContrast: bars.achieved,
    ...series.metrics,
    goodTextContrast: goodText.achieved,
    warnTextContrast: warnText.achieved,
  };
  const contracts = {
    text: {
      ...text,
      target: targets.text,
      preferredTarget: targets.preferredText,
      preferredTargetMet: preferredText.targetMet,
    },
    muted,
    axis,
    bars,
    series: {
      target: targets.series,
      targetMet: series.targetMet,
      distinct: series.distinct,
      minimumDistance: series.minimumDistance,
      minimumCvdDistance: series.minimumCvdDistance,
    },
  };
  const failures = [];
  for (const [name, contract] of Object.entries(contracts)) {
    if (!contract.targetMet) failures.push(name);
    if (name === "series" && !contract.distinct) failures.push("series-distinctness");
  }

  return {
    background: bgHex,
    isDark,
    colors,
    metrics,
    contracts,
    compliance: {
      valid: failures.length === 0,
      failures,
      targets,
    },
    tokens: [
      token("Background", bgHex),
      token("Text", colors.text, colors.text, metrics.textContrast, text.targetMet),
      token("Muted", colors.muted, colors.muted, metrics.mutedContrast, muted.targetMet),
      token("Metric BG", colors.metric),
      token("Panel", colors.panel),
      token("Border", colors.border, colors.border, metrics.borderContrast, border.targetMet),
      token("Grid (decorative)", colors.grid, colors.grid, metrics.gridContrast, null),
      token("Axis", colors.axis, colors.axis, metrics.axisContrast, axis.targetMet),
      token("Bars", colors.bars, colors.bars, metrics.barsContrast, bars.targetMet),
      token("Series A", colors.seriesA, colors.seriesA, metrics.seriesAContrast, series.targetMet),
      token("Series B", colors.seriesB, colors.seriesB, metrics.seriesBContrast, series.targetMet),
      token("Series C", colors.seriesC, colors.seriesC, metrics.seriesCContrast, series.targetMet),
      token("Good BG", colors.goodBg),
      token("Good Text", colors.goodText, colors.goodText, metrics.goodTextContrast, goodText.targetMet),
      token("Warn BG", colors.warnBg),
      token("Warn Text", colors.warnText, colors.warnText, metrics.warnTextContrast, warnText.targetMet),
    ],
  };
}

function stylePropertyExists(style, name) {
  if (typeof style.length === "number" && typeof style.item === "function") {
    for (let index = 0; index < style.length; index += 1) {
      if (style.item(index) === name) return true;
    }
    return false;
  }
  if (typeof style.has === "function") return style.has(name);
  return typeof style.getPropertyValue === "function" && style.getPropertyValue(name) !== "";
}

function captureStyleProperty(style, name) {
  return {
    existed: stylePropertyExists(style, name),
    value: typeof style.getPropertyValue === "function" ? style.getPropertyValue(name) : "",
    priority: typeof style.getPropertyPriority === "function" ? style.getPropertyPriority(name) : "",
  };
}

export function applyPaletteToElement(element, palette, prefix = "adaptive") {
  if (!element?.style || typeof element.style.setProperty !== "function") {
    throw new TypeError("element must expose a CSSStyleDeclaration-compatible style object");
  }
  if (!palette?.colors) throw new TypeError("palette must be created by createAdaptivePalette");
  if (typeof prefix !== "string" || !/^[a-z][a-z0-9-]*$/i.test(prefix)) {
    throw new Error("prefix must be a non-empty CSS identifier fragment");
  }

  let activeByPrefix = ACTIVE_PALETTE_APPLICATIONS.get(element);
  if (!activeByPrefix) {
    activeByPrefix = new Map();
    ACTIVE_PALETTE_APPLICATIONS.set(element, activeByPrefix);
  }
  activeByPrefix.get(prefix)?.restore();

  let generationsByPrefix = PALETTE_GENERATIONS.get(element);
  if (!generationsByPrefix) {
    generationsByPrefix = new Map();
    PALETTE_GENERATIONS.set(element, generationsByPrefix);
  }
  const generation = (generationsByPrefix.get(prefix) ?? 0) + 1;
  generationsByPrefix.set(prefix, generation);

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
  const snapshot = new Map();

  Object.entries(cssVars).forEach(([name, value]) => {
    snapshot.set(name, captureStyleProperty(element.style, name));
    element.style.setProperty(name, value);
  });

  let restored = false;
  const restore = () => {
    if (restored || activeByPrefix.get(prefix)?.generation !== generation) return;
    snapshot.forEach((original, name) => {
      if (original.existed) {
        element.style.setProperty(name, original.value, original.priority);
      } else if (typeof element.style.removeProperty === "function") {
        element.style.removeProperty(name);
      }
    });
    activeByPrefix.delete(prefix);
    restored = true;
  };

  activeByPrefix.set(prefix, { generation, restore });

  Object.defineProperties(cssVars, {
    restore: { value: restore, enumerable: false },
    snapshot: { value: snapshot, enumerable: false },
  });
  return cssVars;
}
