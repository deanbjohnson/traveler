import { tool } from "ai";
import { z } from "zod";
import { addToTimeline } from "@/app/server/actions/add-to-timeline";
import type { DuffelOffer } from "@/app/server/actions/flight-search";
import type { TimelineItemData } from "@/app/server/actions/add-to-timeline";

// Helper function to deeply sanitize flight data and remove circular references
function sanitizeFlightData(flightData: any): any {
  if (!flightData || typeof flightData !== 'object') {
    return {
      id: 'unknown',
      total_amount: '0',
      total_currency: 'USD'
    };
  }

  try {
    // First, test if it can be JSON serialized as-is
    JSON.stringify(flightData);
    return flightData;
  } catch (error) {
    console.warn("Flight data has circular references or invalid JSON, creating safe copy...");
    
    // Create a safe copy with only essential data that we know can be serialized
    const safeCopy = {
      id: flightData.id || 'unknown',
      total_amount: flightData.total_amount || '0',
      total_currency: flightData.total_currency || 'USD',
      tax_amount: flightData.tax_amount,
      tax_currency: flightData.tax_currency,
      owner: flightData.owner ? {
        name: flightData.owner.name || 'Unknown Airline',
        iata_code: flightData.owner.iata_code || 'XX'
      } : {
        name: 'Unknown Airline',
        iata_code: 'XX'
      },
      slices: flightData.slices ? flightData.slices.map((slice: any, index: number) => {
        try {
          return {
            id: slice.id || `slice-${index}`,
            origin: slice.origin ? {
              name: slice.origin.name || 'Unknown Airport',
              iata_code: slice.origin.iata_code || 'XXX'
            } : {
              name: 'Unknown Airport',
              iata_code: 'XXX'
            },
            destination: slice.destination ? {
              name: slice.destination.name || 'Unknown Airport',
              iata_code: slice.destination.iata_code || 'XXX'
            } : {
              name: 'Unknown Airport',
              iata_code: 'XXX'
            },
            departure_datetime: slice.departure_datetime || new Date().toISOString(),
            arrival_datetime: slice.arrival_datetime || new Date().toISOString(),
            duration: slice.duration || 'PT0H0M',
            segments: slice.segments ? slice.segments.map((seg: any, segIndex: number) => ({
              id: seg.id || `segment-${segIndex}`,
              operating_carrier: seg.operating_carrier ? {
                name: seg.operating_carrier.name || 'Unknown',
                iata_code: seg.operating_carrier.iata_code || 'XX'
              } : undefined,
              marketing_carrier: seg.marketing_carrier ? {
                name: seg.marketing_carrier.name || 'Unknown',
                iata_code: seg.marketing_carrier.iata_code || 'XX'
              } : undefined,
              departure_datetime: seg.departure_datetime || slice.departure_datetime,
              arrival_datetime: seg.arrival_datetime || slice.arrival_datetime,
              duration: seg.duration || 'PT0H0M'
            })).slice(0, 5) : [] // Limit segments to prevent huge objects
          };
        } catch (sliceError) {
          console.warn(`Error processing slice ${index}:`, sliceError);
          return {
            id: `slice-${index}`,
            origin: { name: 'Unknown Airport', iata_code: 'XXX' },
            destination: { name: 'Unknown Airport', iata_code: 'XXX' },
            departure_datetime: new Date().toISOString(),
            arrival_datetime: new Date().toISOString(),
            duration: 'PT0H0M',
            segments: []
          };
        }
      }).slice(0, 3) : [] // Limit slices to prevent huge objects
    };

    // Test the safe copy
    try {
      JSON.stringify(safeCopy);
      console.log("Safe flight data copy created successfully");
      return safeCopy;
    } catch (error2) {
      console.error("Even safe copy failed serialization:", error2);
      // Return absolute minimal data as last resort
      return {
        id: String(flightData.id || 'unknown'),
        total_amount: String(flightData.total_amount || '0'),
        total_currency: String(flightData.total_currency || 'USD'),
        owner: {
          name: 'Unknown Airline',
          iata_code: 'XX'
        },
        slices: []
      };
    }
  }
}

export const addToTimelineTool = tool({
  description: `
    Add travel items (flights, hotels, activities) to a user's timeline. 
    
    This tool will:
    - Create a timeline if it's the first item for a trip
    - Generate smart titles like "Trip to San Diego" based on destination
    - Add items with proper hierarchical structure
    - Handle flight data with locations and timing
    
    Use this when a user expresses interest in booking or adding something to their itinerary.
    Examples:
    - "I like this flight, add it to my timeline"
    - "Add this hotel to my trip"
    - "Book this activity for my vacation"
  `,
  parameters: z.object({
    items: z
      .array(
        z.discriminatedUnion("type", [
          // Flight item
          z.object({
            type: z.literal("FLIGHT"),
            title: z
              .string()
              .describe("Flight title (e.g., 'Flight SFO → LAX')"),
            description: z.string().optional().describe("Flight description"),
            startTime: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                "Must be ISO datetime"
              )
              .describe("Flight departure time"),
            endTime: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                "Must be ISO datetime"
              )
              .optional()
              .describe("Flight arrival time"),
            duration: z
              .number()
              .int()
              .positive()
              .optional()
              .describe("Flight duration in minutes"),
            flightData: z
              .record(z.unknown())
              .describe("Complete flight offer data from search"),
            locationId: z.string().optional().describe("Optional location ID"),
          }),

          // Hotel/Stay item
          z.object({
            type: z.literal("STAY"),
            title: z.string().describe("Hotel name or stay title"),
            description: z.string().optional().describe("Hotel description"),
            startTime: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                "Must be ISO datetime"
              )
              .describe("Check-in time"),
            endTime: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                "Must be ISO datetime"
              )
              .optional()
              .describe("Check-out time"),
            duration: z
              .number()
              .int()
              .positive()
              .optional()
              .describe("Stay duration in minutes"),
            stayData: z
              .record(z.unknown())
              .describe("Hotel/accommodation data from search"),
            locationId: z.string().optional().describe("Optional location ID"),
          }),

          // Activity item
          z.object({
            type: z.enum([
              "ACTIVITY",
              "DINING",
              "TRANSPORT",
              "FREE_TIME",
              "CUSTOM",
            ]),
            title: z.string().describe("Activity or item title"),
            description: z.string().optional().describe("Activity description"),
            startTime: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                "Must be ISO datetime"
              )
              .describe("Activity start time"),
            endTime: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
                "Must be ISO datetime"
              )
              .optional()
              .describe("Activity end time"),
            duration: z
              .number()
              .int()
              .positive()
              .optional()
              .describe("Activity duration in minutes"),
            activityData: z
              .record(z.unknown())
              .optional()
              .describe("Activity-specific data"),
            locationId: z.string().optional().describe("Optional location ID"),
          }),
        ])
      )
      .min(1)
      .describe("Array of items to add to timeline"),

    mood: z
      .enum([
        "adventure",
        "relaxing",
        "cultural",
        "business",
        "romantic",
        "family",
      ])
      .optional()
      .describe("Timeline mood/theme (used when creating new timeline)"),

    parentId: z
      .string()
      .optional()
      .describe("Parent item ID for hierarchical structure"),

    level: z
      .number()
      .int()
      .min(0)
      .max(5)
      .optional()
      .default(0)
      .describe("Hierarchy level (0 = top level, 1 = sub-item, etc.)"),
    tripId: z.string().describe("The trip ID to add items to"),
  }),

  execute: async ({ items, mood, parentId, level = 0, tripId }) => {
    const addStartTime = Date.now();
    const toolCallId = Math.random().toString(36).substring(7);

    console.log(
      `[ADD-TIMELINE-TOOL-${toolCallId}] === TOOL EXECUTION START ===`
    );
    console.log(
      `[ADD-TIMELINE-TOOL-${toolCallId}] Timestamp: ${new Date().toISOString()}`
    );
    console.log(`[ADD-TIMELINE-TOOL-${toolCallId}] Input parameters:`, {
      tripId,
      itemsCount: items.length,
      mood,
      parentId,
      level,
      itemDetails: items.map((item) => ({
        type: item.type,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        duration: item.duration,
        hasFlightData: item.type === "FLIGHT" ? !!item.flightData : undefined,
        hasStayData: item.type === "STAY" ? !!item.stayData : undefined,
        hasActivityData:
          item.type !== "FLIGHT" && item.type !== "STAY"
            ? !!item.activityData
            : undefined,
      })),
    });

    try {
      // Convert items to proper format
      const processedItems = items.map((item) => {
        const baseItem = {
          type: item.type,
          title: item.title,
          description: item.description,
          startTime: new Date(item.startTime),
          endTime: item.endTime ? new Date(item.endTime) : undefined,
          duration: item.duration,
          locationId: item.locationId,
        };

        switch (item.type) {
          case "FLIGHT":
            // Validate flight data structure first
            const flightData = item.flightData as Record<string, unknown>;
            if (!flightData || typeof flightData !== "object") {
              throw new Error("Flight data is required and must be an object");
            }

            // Sanitize flight data to prevent JSON serialization issues
            const sanitizedFlightData = sanitizeFlightData(flightData);
            
            console.log(`[ADD-TIMELINE-TOOL-${toolCallId}] Flight data sanitized successfully`);

            return {
              ...baseItem,
              flightData: sanitizedFlightData as unknown as DuffelOffer,
            };

          case "STAY":
            return {
              ...baseItem,
              stayData: item.stayData,
            };
          default:
            return {
              ...baseItem,
              activityData: item.activityData,
            };
        }
      });

      const result = await addToTimeline({
        tripId,
        items: processedItems as TimelineItemData[],
        mood,
        parentId,
        level,
      });

      const addDuration = Date.now() - addStartTime;

      if (result.success && result.data) {
        // Count different types of items
        const itemCounts = items.reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const itemTypesList = Object.entries(itemCounts)
          .map(
            ([type, count]) =>
              `${count} ${type.toLowerCase()}${count > 1 ? "s" : ""}`
          )
          .join(", ");

        // SIMPLIFIED SUCCESS RESPONSE - No complex objects that cause JSON serialization issues
        const successResponse = {
          success: true,
          timelineId: result.data.timelineId,
          itemIds: result.data.itemIds || [],
          isNewTimeline: result.data.isNewTimeline,
          itemsAdded: {
            count: items.length,
            types: itemCounts,
            summary: itemTypesList,
          },
          message: `Successfully added ${items.length} item${
            items.length > 1 ? "s" : ""
          } (${itemTypesList}) to your ${
            result.data.isNewTimeline ? "new" : "existing"
          } timeline!${
            result.data.isNewTimeline
              ? " I've created a timeline for this trip."
              : ""
          }`,
          metadata: {
            tripId,
            addedAt: new Date().toISOString(),
            processingDurationMs: addDuration,
            hierarchyLevel: level,
            parentId: parentId || null,
          },
          timestamp: new Date().toISOString(),
        };

        // Test JSON serialization before returning
        try {
          const testJson = JSON.stringify(successResponse);
          console.log(
            `[ADD-TIMELINE-TOOL-${toolCallId}] JSON test passed, length: ${testJson.length}`
          );
        } catch (jsonError) {
          console.error(
            `[ADD-TIMELINE-TOOL-${toolCallId}] JSON test failed:`,
            jsonError
          );
          // Return ultra-safe minimal response
          return {
            success: true,
            timelineId: result.data.timelineId,
            message: `Successfully added ${items.length} item(s) to timeline`,
            timestamp: new Date().toISOString(),
          };
        }

        console.log(`[ADD-TIMELINE-TOOL-${toolCallId}] === TOOL SUCCESS ===`);
        return successResponse;
        
      } else {
        console.log(`[ADD-TIMELINE-TOOL-${toolCallId}] === TOOL FAILURE ===`);
        
        return {
          success: false,
          error: result.error || "Failed to add items to timeline",
          itemsAttempted: {
            count: items.length,
            types: items.map((item) => item.type),
          },
          metadata: {
            tripId,
            attemptedAt: new Date().toISOString(),
            processingDurationMs: addDuration,
          },
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const addDuration = Date.now() - addStartTime;

      console.error(`[ADD-TIMELINE-TOOL-${toolCallId}] === TOOL EXCEPTION ===`);
      console.error(
        `[ADD-TIMELINE-TOOL-${toolCallId}] Exception:`,
        error instanceof Error ? error.message : String(error)
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        itemsAttempted: {
          count: items.length,
          types: items.map((item) => item.type),
        },
        metadata: {
          tripId,
          failedAt: new Date().toISOString(),
          processingDurationMs: addDuration,
        },
        timestamp: new Date().toISOString(),
      };
    }
  },
});