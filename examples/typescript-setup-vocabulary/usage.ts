// The regression case. Both of these read the vocabulary back off `setup`. When
// the build typed container members `any`, `Color` widened to `any` too and
// `strict` raised TS7053/TS7006 here — aborting the build on code the editor
// extension reports as perfectly fine. See README.md.

setup.brightest = (palette: Palette): Color => {
  let best: Color = "red";
  for (const color of setup.COLORS) {
    if (palette[color] > palette[best]) best = color;
  }
  return best;
};

setup.total = (palette: Palette): number =>
  setup.COLORS.reduce((sum, c) => sum + palette[c], 0);

// The control: identical shape, but derived from the module-level const in
// constants.ts. This always compiled, which is what isolates the cause to how
// the build types `setup` rather than to the code pattern.

setup.widest = (widths: Widths): Shape => {
  let best: Shape = "circle";
  for (const shape of SHAPES) {
    if (widths[shape] > widths[best]) best = shape;
  }
  return best;
};
