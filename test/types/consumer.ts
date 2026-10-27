import {
  applyPaletteToElement,
  createContrastFit,
  contrastRatio,
  normalizeHex,
  mix,
  rgba,
  readableTone,
  readableAccent,
  relativeLuminance,
  toHex,
  paletteToCssVariables,
  parseHex,
  type PaletteOptions,
  type ContrastFitPalette,
  type PaletteAdjustment,
  type SeriesStyles,
} from "contrast-fit";

const palette: ContrastFitPalette = createContrastFit("#123456", {
  textContrast: 7,
  backgroundStrategy: "auto",
  accents: { seriesA: "#0FA" },
});

const perceptualDistance: number = palette.metrics.seriesABPerceptualDistance;
const panelAlpha: number = palette.tokens.find(({ name }) => name === "Panel")?.alpha ?? 0;
const effectivePanel: string = palette.effectiveColors.panel;
const cssVariables: Record<string, string> = applyPaletteToElement(
  { style: { setProperty() {} } },
  palette,
);
const ratio: number = contrastRatio(parseHex(palette.colors.text), parseHex(palette.background));
const inputBackground: string = palette.inputBackground;
const usable: boolean = palette.usable;
const adjustments: PaletteAdjustment[] = palette.adjustments;
const styles: SeriesStyles = palette.seriesStyles;
const seriesBMarker: "square" = styles.seriesB.marker;
const seriesCDashes: "2 5" = styles.seriesC.dashArray;
createContrastFit("#777", { backgroundStrategy: "preserve" });

void perceptualDistance;
void panelAlpha;
void effectivePanel;
void cssVariables;
void ratio;
void inputBackground;
void usable;
void adjustments;
void seriesBMarker;
void seriesCDashes;

const serverVariables: Record<string, string> = paletteToCssVariables(palette, "server");
const rgb = parseHex("#123456");
const utilities: [string | null, string, string, number] = [
  normalizeHex(123),
  toHex(mix(rgb, rgb, 0.5)),
  rgba(readableAccent(rgb, readableTone(rgb, rgb, 4.5)), 0.4),
  relativeLuminance(rgb),
];
const domElement = document.createElement("article");
applyPaletteToElement(domElement, palette);
// @ts-expect-error Misspelled accent keys must be rejected.
const invalid: PaletteOptions = { accents: { seriseA: "#fff" } };
// @ts-expect-error Contrast targets are numbers, not strings.
createContrastFit("#fff", { textContrast: "7" });
// @ts-expect-error Only auto and preserve are supported background strategies.
createContrastFit("#fff", { backgroundStrategy: "warn" });
void serverVariables;
void utilities;
void invalid;
