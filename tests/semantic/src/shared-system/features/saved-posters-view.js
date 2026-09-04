import { toggleSavedPoster } from "./saved-posters";

export function SavedView() {
  return `<div aria-label="Saved posters"><h1>Saved posters</h1><button onClick={() => toggleSavedPoster(id)}>Save poster</button></div>`;
}
