import { tool } from "ai";
import { z } from "zod";
import { addToTimeline } from "@/app/server/actions/add-to-timeline";

export const addToTimelineTool = tool({
  description: `
    Add flights to a user's trip timeline. Use this when a user wants to add a specific flight.
    
    The flight data should come from the findFlightUnified tool results.
    For specific searches, use the 'offers' array.
    For flexible searches, you'll need to get specific flight details first.
  `,
  parameters: z.object({
    tripId: z.string().describe("The trip ID to add the flight to"),
    flightId: z.string().describe("The flight ID from search results"),
    flightData: z.object({
      // Clean flight data structure from findFlightUnified
      id: z.string(),
      price: z.object({
        amount: z.string(),
        currency: z.string(),
      }),
      airline: z.object({
        name: z.string(),
        code: z.string(),
      }),
      route: z.object({
        from: z.object({
          code: z.string(),
          name: z.string(),
          city: z.string().optional(),
        }),
        to: z.object({
          code: z.string(),
          name: z.string(),
          city: z.string().optional(),
        }),
      }),
      timing: z.object({
        departure: z.string(),
        arrival: z.string(),
        duration: z.string(),
      }),
      segments: z.array(z.object({
        from: z.string(),
        to: z.string(),
        airline: z.string(),
        departure: z.string(),
        arrival: z.string(),
      })),
      timelineData: z.object({
        id: z.string(),
        total_amount: z.string(),
        total_currency: z.string(),
        slices: z.array(z.object({
          origin: z.object({
            iata_code: z.string(),
            name: z.string(),
          }),
          destination: z.object({
            iata_code: z.string(),
            name: z.string(),
          }),
          departure_datetime: z.string(),
          arrival_datetime: z.string(),
          duration: z.string(),
        })),
        owner: z.object({
          name: z.string(),
          iata_code: z.string(),
        }),
      }),
    }).describe("Complete clean flight data from findFlightUnified results"),
  }),

  execute: async ({ tripId, flightId, flightData }) => {
    console.log(`📅 Adding flight ${flightId} to timeline for trip ${tripId}`);
    
    try {
      // Create the timeline item with clean data
      const timelineItem = {
        type: "FLIGHT" as const,
        title: `Flight ${flightData.route.from.code} → ${flightData.route.to.code} with ${flightData.airline.name}`,
        description: `${flightData.airline.name} flight from ${flightData.route.from.name} to ${flightData.route.to.name}. Duration: ${flightData.timing.duration}. Price: ${flightData.price.currency} ${flightData.price.amount}`,
        startTime: new Date(flightData.timing.departure),
        endTime: new Date(flightData.timing.arrival),
        duration: calculateDurationMinutes(flightData.timing.departure, flightData.timing.arrival),
        flightData: flightData.timelineData, // Use the clean timeline data
      };

      console.log(`📅 Timeline item prepared:`, {
        title: timelineItem.title,
        startTime: timelineItem.startTime,
        duration: timelineItem.duration,
        hasFlightData: !!timelineItem.flightData,
      });

      // Call your existing addToTimeline function
      const result = await addToTimeline({
        tripId,
        items: [timelineItem],
        mood: "adventure",
        level: 0,
      });

      if (result.success) {
        console.log(`✅ Flight added to timeline successfully`);
        
        // Return clean, simple response
        const response = {
          success: true,
          timelineId: result.data?.timelineId,
          itemId: result.data?.itemIds?.[0],
          message: `Added ${flightData.airline.name} flight from ${flightData.route.from.code} to ${flightData.route.to.code} to your timeline`,
          flight: {
            id: flightData.id,
            route: `${flightData.route.from.code} → ${flightData.route.to.code}`,
            airline: flightData.airline.name,
            departure: flightData.timing.departure,
            price: `${flightData.price.currency} ${flightData.price.amount}`,
          },
          timestamp: new Date().toISOString(),
        };

        // Safety check the response
        try {
          JSON.stringify(response);
          console.log(`📅 ✅ Add to timeline response is JSON safe`);
          return response;
        } catch (jsonError) {
          console.error(`📅 ❌ Response failed JSON test:`, jsonError);
          // Return ultra-minimal response
          return {
            success: true,
            message: `Added flight to timeline`,
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        console.error(`❌ Failed to add flight to timeline:`, result.error);
        return {
          success: false,
          error: result.error || 'Failed to add flight to timeline',
          timestamp: new Date().toISOString(),
        };
      }

    } catch (error) {
      console.error('Add to timeline error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add flight to timeline',
        timestamp: new Date().toISOString(),
      };
    }
  },
});

// Helper function to calculate duration in minutes
function calculateDurationMinutes(departure: string, arrival: string): number {
  try {
    const depTime = new Date(departure).getTime();
    const arrTime = new Date(arrival).getTime();
    return Math.round((arrTime - depTime) / (1000 * 60)); // Convert to minutes
  } catch {
    return 120; // Default 2 hours if calculation fails
  }
}