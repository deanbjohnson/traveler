// Export individual tools
export { foobarTool } from "./foobar";
export { calculatorTool } from "./calculator";
export { findFlightUnifiedTool } from "./find-flight-unified";
export { findStayTool } from "./find-stay";
export { addToTimelineTool } from "./add-to-timeline";
export { budgetDiscoveryTool } from "./budget-discovery";
export { parseFlightEmailTool } from "./parse-flight-email";
//export { databaseTool } from "./database"; // REMOVED - AI should not have direct DB access
//export { addToItineraryUnifiedTool } from "./add-to-itinerary-unified";
//export { bookFlightTool } from "./book-flight";

// Central tools object for easy import and usage
import { foobarTool } from "./foobar";
import { calculatorTool } from "./calculator";
import { findFlightUnifiedTool } from "./find-flight-unified";
import { findStayTool } from "./find-stay";
import { addToTimelineTool } from "./add-to-timeline";
import { budgetDiscoveryTool } from "./budget-discovery";
import { parseFlightEmailTool } from "./parse-flight-email";
import { replaceFlightLegTool } from "./replace-flight-leg";
import { buildCustomFlightTool } from "./build-custom-flight";
//import { databaseTool } from "./database"; // REMOVED - AI should not have direct DB access
//import { addToItineraryUnifiedTool } from "./add-to-itinerary-unified";
//import { bookFlightTool } from "./book-flight";

export const tools = {
  foobar: foobarTool,
  calculator: calculatorTool,
  findFlight: findFlightUnifiedTool,
  findStayOriginal: findStayTool, // Keep original as alternative
  addToTimeline: addToTimelineTool,
  budgetDiscovery: budgetDiscoveryTool,
  parseFlightEmail: parseFlightEmailTool,
  replaceFlightLeg: replaceFlightLegTool,
  buildCustomFlight: buildCustomFlightTool,
} as const;

// Type helpers for tool calls and results
export type ToolsType = typeof tools;
