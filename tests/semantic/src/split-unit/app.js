// app wires the launcher together and mounts the two areas below.
import { renderSearch } from "./search-ui";
import { renderActions } from "./action-ui";

export function mountApp(root) {
  renderSearch(root);
  renderActions(root);
}
