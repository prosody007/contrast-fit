import ContrastFit = require("contrast-fit");

const options: ContrastFit.PaletteOptions = { backgroundStrategy: "auto" };
const palette: ContrastFit.ContrastFitPalette = ContrastFit.createContrastFit("#777", options);
const css: Record<string, string> = ContrastFit.paletteToCssVariables(palette);
const applied: Record<string, string> = ContrastFit.applyPaletteToElement(
  { style: { setProperty(_name: string, _value: string) {} } }, palette,
);
const marker: "square" = palette.seriesStyles.seriesB.marker;
// @ts-expect-error String contrast targets are not accepted by the require declaration.
ContrastFit.createContrastFit("#fff", { textContrast: "7" });
// @ts-expect-error CommonJS does not expose a default factory alias.
ContrastFit.default("#fff");
void css;
void applied;
void marker;
