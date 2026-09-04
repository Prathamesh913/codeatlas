export function readAppState() {
  return store.state;
}

export function writeAppState(patch) {
  store.state = { ...store.state, ...patch };
}
