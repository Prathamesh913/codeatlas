import { runProjectAction } from "./actions";

export function renderActions(root) {
  root.innerHTML = `<button>Delete Project</button><button>Open Actions</button>`;
}

export function ActionsMenu() {
  return `<div aria-label="Project Actions"><button onClick={() => runProjectAction('delete')}>Delete Project</button></div>`;
}
