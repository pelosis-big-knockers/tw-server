// Try the editor features here (with tw-server installed as a project dependency
// and `tw-server init` run — see README.md):
//
//   1. Delete the `.length` below, type `setup.` and you should see completions
//      for `playerName` and `attack` (gathered from player.ts / combat.ts).
//   2. Ctrl+click `setup.attack` -> jumps to combat.ts.
//      Ctrl+click `setup.playerName` -> jumps to player.ts.
const damage: number = setup.attack(setup.playerName().length);
