export interface Color {
  r: number;
  g: number;
  b: number;
}

export interface AccentOptions {
  seriesA?: string;
  seriesB?: string;
  seriesC?: string;
}

export interface PaletteOptions {
  /** Auto repairs the content background when necessary; preserve keeps the input pixel color. */
  backgroundStrategy?: "auto" | "preserve";
  textContrast?: number;
  mutedContrast?: number;
  accentContrast?: number;
  surfaceTextContrast?: number;
  accents?: AccentOptions;
}

export interface PaletteColors {
  background: string;
  text: string;
  muted: string;
  panel: string;
  metric: string;
  border: string;
  grid: string;
  axis: string;
  plotFill: string;
  bars: string;
  seriesA: string;
  seriesB: string;
  seriesC: string;
  goodBg: string;
  goodText: string;
  warnBg: string;
  warnText: string;
}

export interface EffectiveColors {
  panel: string;
  metric: string;
  border: string;
  grid: string;
  axis: string;
  plotFill: string;
  bars: string;
}

export interface PaletteTargets {
  textContrast: number;
  mutedContrast: number;
  accentContrast: number;
  surfaceTextContrast: number;
}

export interface PaletteMetrics {
  textContrast: number;
  mutedContrast: number;
  panelTextContrast: number;
  panelMutedContrast: number;
  metricTextContrast: number;
  metricMutedContrast: number;
  seriesAContrast: number;
  seriesBContrast: number;
  seriesCContrast: number;
  goodTextContrast: number;
  warnTextContrast: number;
  seriesABDistance: number;
  seriesACDistance: number;
  seriesBCDistance: number;
  seriesABPerceptualDistance: number;
  seriesACPerceptualDistance: number;
  seriesBCPerceptualDistance: number;
}

export interface PaletteMeetsTarget {
  text: boolean;
  muted: boolean;
  panelText: boolean;
  panelMuted: boolean;
  metricText: boolean;
  metricMuted: boolean;
  seriesA: boolean;
  seriesB: boolean;
  seriesC: boolean;
  goodText: boolean;
  warnText: boolean;
  seriesDistinct: boolean;
}

export interface PaletteToken {
  name: string;
  value: string;
  css: string;
  color: string;
  alpha: number;
  effectiveColor: string;
  swatch: string;
  contrast: number | null;
}

export interface PaletteAdjustment {
  type: "background" | "status" | "series-encoding";
  message: string;
  from?: string;
  to?: string;
}

export interface SeriesStyles {
  seriesA: { dashArray: "none"; marker: "circle" };
  seriesB: { dashArray: "9 5"; marker: "square" };
  seriesC: { dashArray: "2 5"; marker: "diamond" };
}

export interface ContrastFitPalette {
  /** Normalized original input, suitable for an outside host or input control. */
  inputBackground: string;
  /** Actual resolved content background; metrics and alpha composites use this color. */
  background: string;
  isDark: boolean;
  colors: PaletteColors;
  effectiveColors: EffectiveColors;
  targets: PaletteTargets;
  meetsTarget: PaletteMeetsTarget;
  /** All numeric contrast targets pass. Color distinctness is reported separately. */
  usable: boolean;
  adjustments: PaletteAdjustment[];
  /** Apply these encodings to charts, especially when seriesDistinct is false. */
  seriesStyles: SeriesStyles;
  warnings: string[];
  metrics: PaletteMetrics;
  alphas: {
    panel: number;
    metric: number;
    border: number;
    grid: number;
    axis: number;
    plotFill: number;
    bars: number;
  };
  tokens: PaletteToken[];
}

export interface StyleLike {
  setProperty(name: string, value: string): void;
}

export interface ElementLike {
  style: StyleLike;
}

export function normalizeHex(hex: unknown): string | null;
export function parseHex(hex: string): Color;
export function toHex(color: Color): string;
export function rgba(color: Color, alpha: number): string;
export function mix(first: Color, second: Color, amount: number): Color;
export function relativeLuminance(color: Color): number;
export function contrastRatio(first: Color, second: Color): number;
export function readableTone(background: Color, base: Color, minimumContrast: number): Color;
export function readableAccent(
  background: Color,
  accent: Color,
  minimumContrast?: number,
): Color;
export function createContrastFit(
  backgroundHex: string,
  options?: PaletteOptions | null,
): ContrastFitPalette;
export function applyPaletteToElement(
  element: ElementLike,
  palette: ContrastFitPalette,
  prefix?: string,
): Record<string, string>;

/** Serializes CSS variables without reading or writing the DOM (SSR-safe). */
export function paletteToCssVariables(
  palette: Pick<ContrastFitPalette, "colors">,
  prefix?: string,
): Record<string, string>;
