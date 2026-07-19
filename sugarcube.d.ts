// SugarCube's runtime globals for your editor. `setup`, story variables, and
// settings are relaxed to permissive index signatures so ad-hoc properties
// type-check without being declared first; the rest of the API stays fully typed.
// Replace these with specific declarations as your story grows.
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
