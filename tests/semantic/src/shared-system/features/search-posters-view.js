import { searchPosters } from "./search-posters";

export function PosterSearchView() {
  return `<div aria-label="Search posters"><input placeholder="Search posters by title" onInput={(e) => searchPosters(e.value)} /></div>`;
}
