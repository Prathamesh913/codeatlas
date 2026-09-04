import { openSession } from "../shared/session";

export function openTerminalForProject(project) {
  return openSession(project.id);
}
