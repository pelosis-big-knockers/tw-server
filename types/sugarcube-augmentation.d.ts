// Supplies SugarCube's types to the build's type-check for projects that don't
// bring their own @types/twine-sugarcube. The `import "twine-sugarcube"` loads
// the package's ambient globals (setup, State, Story, $, ...) and resolves
// against tw-server's own node_modules, so a story project needs nothing
// installed. tw-server hands this file to tsc when compiling such a project.
//
// SugarCubeSetupObject and the story/settings variable maps are intentionally
// empty interfaces in @types/twine-sugarcube, meant to be augmented per project.
// Relaxing them to an index signature keeps the idiomatic `setup.foo = ...`,
// `State.variables.foo`, and settings access type-checking without forcing every
// property to be declared up front, while every other SugarCube API stays fully
// typed (so real misuse is still caught).
import "twine-sugarcube";

declare module "twine-sugarcube" {
  interface SugarCubeSetupObject {
    [key: string]: any;
  }

  interface SugarCubeStoryVariables {
    [key: string]: any;
  }

  interface SugarCubeSettingVariables {
    [key: string]: any;
  }
}
