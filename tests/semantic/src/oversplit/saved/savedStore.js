export function getSavedStore() {
  return { list: () => savedIds, toggle: (id) => savedIds.push(id) };
}
