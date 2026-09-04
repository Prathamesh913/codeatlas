// UI control for saving drafts.
import { saveDraft } from "./save-core";

export function SaveButton({ id, content }: { id: string; content: string }) {
  return (
    <button onClick={() => saveDraft(id, content)}>Save Draft</button>
  );
}
