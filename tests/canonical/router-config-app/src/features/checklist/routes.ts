import { checklistController } from "./controller";
export const checklistRoutes = { mount() { checklistController.list(); } };
