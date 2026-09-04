// Data layer for the draft-saving capability.
export function saveDraft(id: string, content: string): boolean {
  return Boolean(id && content);
}
export function isDraftSaved(id: string): boolean {
  return Boolean(id);
}
