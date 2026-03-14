// Export individual tools
export { calculatorTool } from "./calculator";
export { findFlightUnifiedTool } from "./find-flight-unified";
export { findStayTool } from "./find-stay";
export { addToTimelineTool } from "./add-to-timeline";
export { budgetDiscoveryTool } from "./budget-discovery";
export { parseFlightEmailTool } from "./parse-flight-email";
export { replaceFlightLegTool } from "./replace-flight-leg";
export { buildCustomFlightTool } from "./build-custom-flight";

// Central tools object for easy import and usage
import { calculatorTool } from "./calculator";
import { findFlightUnifiedTool } from "./find-flight-unified";
import { findStayTool } from "./find-stay";
import { addToTimelineTool } from "./add-to-timeline";
import { budgetDiscoveryTool } from "./budget-discovery";
import { parseFlightEmailTool } from "./parse-flight-email";
import { replaceFlightLegTool } from "./replace-flight-leg";
import { buildCustomFlightTool } from "./build-custom-flight";

export const tools = {
  calculator: calculatorTool,
  findFlight: findFlightUnifiedTool,
  findStay: findStayTool,
  addToTimeline: addToTimelineTool,
  budgetDiscovery: budgetDiscoveryTool,
  parseFlightEmail: parseFlightEmailTool,
  replaceFlightLeg: replaceFlightLegTool,
  buildCustomFlight: buildCustomFlightTool,
} as const;

export type ToolsType = typeof tools;
