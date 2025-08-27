import { tool } from "ai";
import { z } from "zod";
import { addToTimeline } from "@/app/server/actions/add-to-timeline";
import { Duffel } from "@duffel/api";

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
      // Ensure we have both legs for round trips. If slices are missing, fetch full offer from Duffel.
      try {
        const slices = flightData?.timelineData?.slices;
        const offerId = flightData?.timelineData?.id || flightData?.id || flightId;
        const needsHydration = !Array.isArray(slices) || slices.length < 2;
        if (offerId && needsHydration && process.env.DUFFEL_ACCESS_TOKEN) {
          console.log(`🧩 Hydrating offer from Duffel for full slices: ${offerId}`);
          const duffel = new Duffel({ token: process.env.DUFFEL_ACCESS_TOKEN! });
          const offerResp = await duffel.offers.get(offerId as string).catch((e) => {
            console.warn("⚠️ Duffel offer hydration failed", e?.message || e);
            return null;
          });
          if (offerResp && (offerResp.data as any)?.slices?.length) {
            const full = offerResp.data as any;
            // Normalize to timelineData shape we already store
            flightData.timelineData = {
              id: String(full.id),
              total_amount: String(full.total_amount),
              total_currency: String(full.total_currency),
              owner: {
                name: String(full.owner?.name || flightData.airline?.name || "Unknown Airline"),
                iata_code: String(full.owner?.iata_code || flightData.airline?.code || "XX"),
              },
              slices: (full.slices || []).map((sl: any, idx: number) => ({
                id: String(sl.id || `slice-${idx}`),
                origin: { iata_code: String(sl.origin?.iata_code || ''), name: String(sl.origin?.name || '') },
                destination: { iata_code: String(sl.destination?.iata_code || ''), name: String(sl.destination?.name || '') },
                departure_datetime: String(sl.departure_datetime || ''),
                arrival_datetime: String(sl.arrival_datetime || ''),
                duration: String(sl.duration || ''),
              })),
            } as any;
            console.log(`✅ Offer hydrated. slices: ${flightData.timelineData.slices.length}`);
          }
        }
      } catch (hydrateError) {
        console.warn("Hydration step failed (non-fatal)", hydrateError);
      }

      // If this is a round trip (two slices), add a parent group and two child items
      const slices = (flightData.timelineData?.slices ?? []) as any[];
      const hasReturn = Array.isArray(slices) && slices.length >= 2;

      if (hasReturn) {
        const out = slices[0];
        const ret = slices[1];

        // Parent group representing the round-trip package
        const parentItem = {
          type: "LOCATION_CHANGE" as const,
          title: `Round trip: ${out?.origin?.iata_code || flightData.route.from.code} ↔ ${out?.destination?.iata_code || flightData.route.to.code}`,
          description: `${flightData.airline.name} round-trip package` ,
          startTime: new Date(out?.departure_datetime || flightData.timing.departure),
          endTime: new Date(ret?.arrival_datetime || flightData.timing.arrival),
          duration: calculateDurationMinutes(out?.departure_datetime || flightData.timing.departure, ret?.arrival_datetime || flightData.timing.arrival),
        };

        const parentRes = await addToTimeline({
          tripId,
          items: [parentItem],
          mood: "adventure",
          level: 0,
        });

        if (!parentRes.success) {
          throw new Error(parentRes.error || 'Failed creating round-trip parent');
        }
        const parentId = parentRes.data?.itemIds?.[0];

        // Child: outbound
        const childOut = {
          type: "FLIGHT" as const,
          title: `Flight ${out?.origin?.iata_code || flightData.route.from.code} → ${out?.destination?.iata_code || flightData.route.to.code} (${flightData.airline.name})`,
          description: `${flightData.airline.name} outbound flight. Duration: ${formatISODuration(out?.duration || flightData.timing.duration)}. Price: ${flightData.price.currency} ${flightData.price.amount}`,
          startTime: new Date(out?.departure_datetime || flightData.timing.departure),
          endTime: new Date(out?.arrival_datetime || flightData.timing.arrival),
          duration: calculateDurationMinutes(out?.departure_datetime || flightData.timing.departure, out?.arrival_datetime || flightData.timing.arrival),
          flightData: flightData.timelineData,
        };

        // Child: return
        const childRet = {
          type: "FLIGHT" as const,
          title: `Flight ${ret?.origin?.iata_code || flightData.route.to.code} → ${ret?.destination?.iata_code || flightData.route.from.code} (${flightData.airline.name})`,
          description: `${flightData.airline.name} return flight. Duration: ${formatISODuration(ret?.duration || flightData.timing.duration)}. Price: ${flightData.price.currency} ${flightData.price.amount}`,
          startTime: new Date(ret?.departure_datetime || flightData.timing.departure),
          endTime: new Date(ret?.arrival_datetime || flightData.timing.arrival),
          duration: calculateDurationMinutes(ret?.departure_datetime || flightData.timing.departure, ret?.arrival_datetime || flightData.timing.arrival),
          flightData: flightData.timelineData,
        };

        const childrenRes = await addToTimeline({
          tripId,
          items: [childOut, childRet],
          mood: "adventure",
          parentId,
          level: 1,
        });

        if (!childrenRes.success) {
          throw new Error(childrenRes.error || 'Failed adding round-trip child items');
        }

        return {
          success: true,
          timelineId: parentRes.data?.timelineId,
          itemId: childrenRes.data?.itemIds?.[0],
          message: `Added round-trip ${flightData.airline.name} flights ${flightData.route.from.code} ↔ ${flightData.route.to.code} to your timeline`,
          flight: {
            id: flightData.id,
            route: `${flightData.route.from.code} ↔ ${flightData.route.to.code}`,
            airline: flightData.airline.name,
            departure: out?.departure_datetime || flightData.timing.departure,
            price: `${flightData.price.currency} ${flightData.price.amount}`,
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Single slice/default
      const timelineItem = {
        type: "FLIGHT" as const,
        title: `Flight ${flightData.route.from.code} → ${flightData.route.to.code} with ${flightData.airline.name}`,
        description: `${flightData.airline.name} flight from ${flightData.route.from.name} to ${flightData.route.to.name}. Duration: ${formatISODuration(flightData.timing.duration)}. Price: ${flightData.price.currency} ${flightData.price.amount}`,
        startTime: new Date(flightData.timing.departure),
        endTime: new Date(flightData.timing.arrival),
        duration: calculateDurationMinutes(flightData.timing.departure, flightData.timing.arrival),
        flightData: flightData.timelineData,
      };

      const result = await addToTimeline({ tripId, items: [timelineItem], mood: "adventure", level: 0 });

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

// Helper function to convert ISO duration to readable format
function formatISODuration(isoDuration: string): string {
  try {
    // Parse ISO 8601 duration format (e.g., "PT6H7M")
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) {
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      
      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      }
    }
    return isoDuration; // Fallback to original if parsing fails
  } catch {
    return isoDuration; // Fallback to original if parsing fails
  }
}