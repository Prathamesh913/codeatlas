import { openSession } from "../shared/session";

export function openEditorForProject(project) {
  return openSession(project.id);
}
