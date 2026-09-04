// This file imports from a non-existent module to test unresolved import detection
import { NonExistentComponent } from '../components/NonExistentComponent';

export function BrokenComponent() {
  return <NonExistentComponent />;
}
