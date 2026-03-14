import { tool } from "ai";
import { z } from "zod";
import { searchFlights } from "@/app/actions/flight-search";
import { updateTimelineItem } from "@/lib/db";

export const replaceFlightLegTool = tool({
  description: `
    Replace a specific leg of a round-trip flight with new criteria.
    Use this when a user wants to modify part of their existing flight booking.
    
    Examples:
    - "Change my return flight to first class"
    - "Find a different return date" 
    - "Replace the outbound leg with a direct flight"
    - "I want to leave a day earlier but keep the same return"
  `,
  parameters: z.object({
    tripId: z.string().describe("The trip ID containing the flight to modify"),
    timelineItemId: z.string().describe("The timeline item ID of the flight to modify"),
    legToReplace: z.enum(["outbound", "return", "both"]).describe("Which leg(s) to replace"),
    newCriteria: z.object({
      // Date changes
      departureDate: z.string().optional().describe("New departure date (YYYY-MM-DD)"),
      returnDate: z.string().optional().describe("New return date (YYYY-MM-DD)"),
      
      // Class changes
      cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional().describe("New cabin class"),
      
      // Route changes
      preferDirect: z.boolean().optional().describe("Prefer direct flights (no stops)"),
      maxStops: z.number().optional().describe("Maximum number of stops allowed"),
      
      // Airline preferences
      preferredAirlines: z.array(z.string()).optional().describe("Preferred airline codes"),
      avoidAirlines: z.array(z.string()).optional().describe("Airlines to avoid"),
      
      // Price constraints
      maxPrice: z.number().optional().describe("Maximum price for the new leg(s)"),
      priceChange: z.enum(["cheaper", "same", "any"]).optional().describe("Price preference relative to current"),
      
      // Timing preferences
      departureTime: z.enum(["morning", "afternoon", "evening", "any"]).optional().describe("Preferred departure time"),
      arrivalTime: z.enum(["morning", "afternoon", "evening", "any"]).optional().describe("Preferred arrival time"),
    }),
    reason: z.string().optional().describe("Why the user wants to change this leg"),
  }),
  
  execute: async ({ tripId, timelineItemId, legToReplace, newCriteria, reason }) => {
    console.log(`🔄 Replacing ${legToReplace} leg for trip ${tripId}, item ${timelineItemId}`);
    console.log(`📋 New criteria:`, newCriteria);
    
    try {
      // 1. Get current flight data from timeline item
      // This would need to be implemented - getting the current flight data
      const currentFlightData = await getCurrentFlightData(timelineItemId);
      
      if (!currentFlightData) {
        return {
          success: false,
          error: "Could not find current flight data",
        };
      }
      
      // 2. Build search parameters for the new leg(s)
      const searchParams = buildSearchParams(currentFlightData, legToReplace, newCriteria);
      
      // 3. Search for new flights
      const searchResults = await searchFlights(searchParams);
      
      if (!searchResults.success || !searchResults.data?.offers?.length) {
        return {
          success: false,
          error: "No flights found matching your criteria",
          suggestions: [
            "Try a different date range",
            "Consider more stops for better prices",
            "Check different cabin classes"
          ]
        };
      }
      
      // 4. Present options to user
      const alternatives = searchResults.data.offers.slice(0, 5).map((offer: any) => ({
        id: offer.id,
        price: offer.total_amount,
        currency: offer.total_currency,
        airline: offer.owner?.name,
        route: `${offer.slices[0]?.origin?.iata_code} → ${offer.slices[0]?.destination?.iata_code}`,
        departure: offer.slices[0]?.departure_datetime,
        arrival: offer.slices[0]?.arrival_datetime,
        stops: offer.slices[0]?.segments?.length - 1,
        cabinClass: newCriteria.cabinClass || "economy",
        priceDifference: calculatePriceDifference(currentFlightData, offer, legToReplace),
        timingChange: calculateTimingChange(currentFlightData, offer, legToReplace),
      }));
      
      return {
        success: true,
        message: `Found ${alternatives.length} alternatives for your ${legToReplace} leg`,
        alternatives,
        currentFlight: {
          price: currentFlightData.total_amount,
          route: `${currentFlightData.slices[0]?.origin?.iata_code} → ${currentFlightData.slices[0]?.destination?.iata_code}`,
        },
        nextSteps: [
          "Review the alternatives above",
          "Say 'Replace with option 1' to confirm your choice",
          "Or ask for different criteria like 'Show me cheaper options'"
        ]
      };
      
    } catch (error) {
      console.error('Replace flight leg error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find alternatives',
      };
    }
  }
});

// Helper functions (would need to be implemented)
async function getCurrentFlightData(timelineItemId: string) {
  // Get current flight data from timeline item
  // This would query the database for the timeline item's flightData
  return null; // Placeholder
}

function buildSearchParams(currentFlight: any, legToReplace: string, newCriteria: any) {
  // Build search parameters based on current flight and new criteria
  return {
    from: currentFlight.slices[0]?.origin?.iata_code,
    to: currentFlight.slices[0]?.destination?.iata_code,
    departure: newCriteria.departureDate || currentFlight.slices[0]?.departure_datetime,
    return: newCriteria.returnDate || currentFlight.slices[1]?.departure_datetime,
    passengers: 1,
    cabinClass: newCriteria.cabinClass || "economy",
    maxStops: newCriteria.maxStops,
  };
}

function calculatePriceDifference(currentFlight: any, newOffer: any, legToReplace: string) {
  // Calculate price difference between current and new flight
  const currentPrice = parseFloat(currentFlight.total_amount);
  const newPrice = parseFloat(newOffer.total_amount);
  return newPrice - currentPrice;
}

function calculateTimingChange(currentFlight: any, newOffer: any, legToReplace: string) {
  // Calculate timing changes (earlier/later departure/arrival)
  return "No significant timing change"; // Placeholder
}
