import { checklistService } from "./service";
export const checklistController = { list() { return checklistService.fetchChecklistFrequencyMappings(); } };
