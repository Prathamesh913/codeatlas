export function createIdeaStore() {
  const ideas: string[] = [];
  return { ideas, add: (t: string) => ideas.push(t) };
}
export const ideaStore = createIdeaStore();
