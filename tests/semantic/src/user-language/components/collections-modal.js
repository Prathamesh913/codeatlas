import { submitCollectionName } from "../impl/collectionKrudSvc";

export function CreateCollectionModal() {
  return `<div aria-label="Create Collection"><button onClick={() => submitCollectionName(form)}>Create Collection</button><p>Name is required</p></div>`;
}
