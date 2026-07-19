// A setup member written the plain SugarCube way — no augmentation, no wrapper.
// The tw-server language-service plugin still gives it completion and
// go-to-definition wherever `setup.playerName` is used.
setup.playerName = (): string => State.variables.name ?? "Hero";
