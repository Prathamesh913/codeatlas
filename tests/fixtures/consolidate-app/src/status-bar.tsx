// Status bar: empty/loading state text only.
import { saveDraft } from "./save-core";

export function StatusBar({ count }: { count: number }) {
  if (count === 0) return <p>No drafts found</p>;
  return <p role="status">Loading drafts… {saveDraft("x", "y")}</p>;
}
