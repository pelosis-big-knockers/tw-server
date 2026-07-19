// Try the editor features here (with the "Twine SugarCube TypeScript Tools"
// extension installed — see README.md):
//
//   - type `setup.` -> completes `playerName`, `attack`
//   - type `State.variables.` -> completes `hp`
//   - ctrl+click `setup.attack` -> combat.ts; `setup.playerName` -> player.ts
//   - no "property does not exist" squiggle, and no sugarcube.d.ts anywhere
State.variables.hp = 100;
const damage: number = setup.attack(setup.playerName().length);
const remaining: number = State.variables.hp - damage;
