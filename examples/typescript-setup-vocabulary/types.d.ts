// Ambient, script-mode (no import/export), the way a story project's domain
// types are written.

/**
 * Derived from the vocabulary on `setup`, so this is "red" | "green" | "blue" —
 * in the editor AND in the build, which is the point of the fixture. It used to
 * widen to `any` in the build, and every downstream use then tripped
 * `noImplicitAny`. See the README.
 */
type Color = (typeof setup.COLORS)[number];

/** Derived from the module-level const, so it is "circle" | "square" everywhere. */
type Shape = (typeof SHAPES)[number];

interface Palette {
  red: number;
  green: number;
  blue: number;
}

interface Widths {
  circle: number;
  square: number;
}
