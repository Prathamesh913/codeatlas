import { readAppState } from "../shared/app-state";

export function renderLikesPanel() {
  const s = readAppState();
  return `<h1>Liked Posters</h1><span>${s.likes.length}</span>`;
}
