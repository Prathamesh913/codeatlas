import { addPosterToCollection } from "./collections-posters";

export function CollectionsView() {
  return `<div aria-label="My collections"><h1>My collections</h1><button onClick={() => addPosterToCollection(id, poster)}>Add to collection</button></div>`;
}
