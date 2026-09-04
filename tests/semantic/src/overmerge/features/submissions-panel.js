import { writeAppState } from "../shared/app-state";

export function SubmissionsPanel() {
  return `<div aria-label="Poster Submissions"><h1>Poster Submissions</h1><button onClick={() => writeAppState({ pending: form })}>Submit Poster</button></div>`;
}
