// UI control for loading drafts.
import { loadDraft } from "./load-core";

export function LoadDialog({ id }: { id: string }) {
  return <dialog open>{loadDraft(id)}</dialog>;
}
