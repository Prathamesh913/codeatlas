export function loadProfile(id) {
  return fetchProfile(id);
}

export function updateProfile(patch) {
  return saveProfile(patch);
}
