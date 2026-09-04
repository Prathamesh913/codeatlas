export class CollectionKrudSvc {
  static getCollectionCore(id) {
    return db.ref(id).get();
  }
  static createCollectionCore(input) {
    return db.ref(input.name).set(input);
  }
}

export function submitCollectionName(form) {
  return CollectionKrudSvc.createCollectionCore(form);
}
