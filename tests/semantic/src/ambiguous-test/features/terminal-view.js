import { openTerminalForProject } from "./terminal";

export function TerminalButton() {
  return `<button onClick={() => openTerminalForProject(p)}>Open Terminal</button>`;
}
