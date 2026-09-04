const SESSION_LABEL = "Dev Sessions";

export function SessionPanel() {
  return `<div aria-label="Dev Sessions"><button onClick={() => openSession(id)}>New Session</button><button>Attach Terminal</button><span>Session Manager</span></div>`;
}
