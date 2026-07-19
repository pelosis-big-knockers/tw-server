type Dice = 4 | 6 | 8 | 20;

setup.roll = (sides: Dice): number => Math.floor(Math.random() * sides) + 1;
