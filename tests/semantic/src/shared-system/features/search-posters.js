import { loadRecord } from "../infra/persistence";

export function searchPosters(q) {
  return loadRecord("posters").filter((p) => p.title.includes(q));
}
