export function AddIdea({ onAdd }: { onAdd: (t: string) => void }) {
  return <button onClick={() => onAdd("new")}>Add Idea</button>;
}
