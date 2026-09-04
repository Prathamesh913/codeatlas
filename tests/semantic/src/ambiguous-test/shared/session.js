const SESSION_TITLE = "Session Manager";

export function openSession(id) { return attach(id); }
export function listSessions() { return sessions; }
export function closeSession(id) { return detach(id); }
