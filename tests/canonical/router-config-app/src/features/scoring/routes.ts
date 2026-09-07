import { scoringController } from "./controller";
export const scoringRoutes = { mount() { scoringController.grade(); } };
