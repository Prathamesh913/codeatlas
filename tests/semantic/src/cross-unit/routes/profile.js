import { createRoute } from "@tanstack/react-router";

export const profileRoute = createRoute({
  path: "/profile",
  handler: () => `<h1>Profile Settings</h1>`,
});
