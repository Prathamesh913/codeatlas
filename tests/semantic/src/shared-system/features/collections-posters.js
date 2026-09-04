import { saveRecord } from "../infra/persistence";

export function addPosterToCollection(id, poster) {
  return saveRecord(id, poster);
}
