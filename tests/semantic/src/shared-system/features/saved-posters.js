import { saveRecord, loadRecord } from "../infra/persistence";

export function toggleSavedPoster(id) {
  const saved = loadRecord("saved") || [];
  return saveRecord("saved", saved.concat(id));
}
