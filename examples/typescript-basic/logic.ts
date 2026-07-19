interface Player {
  name: string;
  hp: number;
}

const player: Player = { name: "Hero", hp: 10 };

setup.playerName = (): string => player.name;
