import { getSavedStore } from "./savedStore";

export function useSavedPosters() {
  return { saved: getSavedStore().list() };
}
