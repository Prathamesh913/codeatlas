import { ideaStore } from "../src/lib/ideas";
test("adds", () => expect(ideaStore.add("x")).toBe(1));
