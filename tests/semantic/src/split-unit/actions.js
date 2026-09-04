export function runProjectAction(action, project) {
  return actions[action](project);
}

export function deleteProject(project) {
  return removeProject(project.id);
}
