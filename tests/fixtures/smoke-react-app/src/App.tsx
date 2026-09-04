import { AddIdea } from "./components/IdeaForm";
import { ideaStore } from "./lib/ideas";

export function App() {
  return (
    <main>
      <h1>Idea Board</h1>
      <AddIdea onAdd={(t) => ideaStore.add(t)} />
    </main>
  );
}
