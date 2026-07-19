// A *type* error: a string assigned to a number-typed variable.
// ts.transpileModule strips types without checking them, so no diagnostic is
// reported and the build succeeds — the annotation is simply erased.
const count: number = "not a number";

setup.count = count;
