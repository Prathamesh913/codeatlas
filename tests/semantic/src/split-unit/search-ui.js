import { searchProjects } from "./search";

export function SearchInput() {
  return `<input placeholder="Search Projects" onInput={() => searchProjects(query)} />`;
}

export function renderSearch(root) {
  root.innerHTML = `<h1>Search Projects</h1><button>Search Projects</button>`;
}
