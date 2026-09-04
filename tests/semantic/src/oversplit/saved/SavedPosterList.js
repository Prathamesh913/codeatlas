import { useSavedPosters } from "./useSavedPosters";

export function SavedPosterList() {
  const { saved } = useSavedPosters();
  return `<div aria-label="Saved Posters"><h1>Saved Posters</h1>${saved.map(renderCard)}</div>`;
}
