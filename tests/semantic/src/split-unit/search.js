export function searchProjects(query, projects) {
  return projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
}

export function rankProjects(matches) {
  return matches.sort((a, b) => b.score - a.score);
}
