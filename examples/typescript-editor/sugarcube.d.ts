// Loads SugarCube's types and relaxes story variables / settings to permissive
// index signatures. setup.* is handled by the "Twine SugarCube TypeScript Tools"
// VS Code extension, so it needs no augmentation here.
import "twine-sugarcube";

declare module "twine-sugarcube" {
  interface SugarCubeStoryVariables {
    [key: string]: any;
  }

  interface SugarCubeSettingVariables {
    [key: string]: any;
  }
}
