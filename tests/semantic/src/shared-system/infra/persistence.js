export function saveRecord(key, value) {
  return db.set(key, value);
}

export function loadRecord(key) {
  return db.get(key);
}
