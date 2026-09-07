import { checklistRoutes } from "./features/checklist/routes";
import { scoringRoutes } from "./features/scoring/routes";
import { requireUid } from "./middleware/authMiddleware";
export const appRouter = { start() { requireUid(); checklistRoutes.mount(); scoringRoutes.mount(); } };
