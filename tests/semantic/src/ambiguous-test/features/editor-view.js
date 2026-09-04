import { openEditorForProject } from "./editor";

export function EditorButton() {
  return `<button onClick={() => openEditorForProject(p)}>Open in Editor</button>`;
}
