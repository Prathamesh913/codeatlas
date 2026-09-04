import { saveDraft } from "../src/save-core";
test("saves", () => {
  expect(saveDraft("a", "b")).toBe(true);
});
