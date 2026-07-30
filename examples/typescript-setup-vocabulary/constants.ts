// A fixed vocabulary published on `setup`, the ordinary SugarCube way.
setup.COLORS = ["red", "green", "blue"] as const;

// The same kind of vocabulary held in a module-level const instead. Story .ts
// files are script-mode (tweego concatenates them, no bundler), so this is a
// global declaration visible to the other files. This one is the CONTROL: it
// never round-trips through `setup`, so nothing about it depends on how the
// build types the container.
const SHAPES = ["circle", "square"] as const;
setup.SHAPES = SHAPES;
