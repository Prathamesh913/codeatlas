import { scoringService } from "./service";
export const scoringController = { grade() { return scoringService.computeScoringMaster(); } };
