// Public reads go through the client Firestore SDK.
import { db } from "./firebase";
import { Poster } from "./posters";

export function loadPublishedPosters() {
  return getDocs(collection(db, "posters"));
}

export function fetchPosterById(id) {
  return getDoc(doc(db, "posters", id));
}
