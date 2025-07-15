import { tool } from "ai";
import { z } from "zod";
import { addToTimeline } from "@/app/server/actions/add-to-timeline";
import type { DuffelOffer } from "@/app/server/actions/flight-search";
import type { TimelineItemData } from "@/app/server/actions/add-to-timeline";

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
        try {
          console.log(
            `[ADD-TIMELINE-TOOL-${toolCallId}] Processing item for server action:`,
            {
              type: item.type,
              title: item.title,
              hasFlightData:
                item.type === "FLIGHT" ? !!item.flightData : undefined,
              flightDataKeys:
                item.type === "FLIGHT" && item.flightData
                  ? Object.keys(item.flightData as Record<string, unknown>)
                  : undefined,
              flightDataType:
                item.type === "FLIGHT" ? typeof item.flightData : undefined,
            }
          );
        } catch (logError) {
          console.log(
            `[ADD-TIMELINE-TOOL-${toolCallId}] Processing item ${item.type} - logging error:`,
            logError instanceof Error ? logError.message : String(logError)
          );
        }

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
            try {
              console.log(
                `[ADD-TIMELINE-TOOL-${toolCallId}] FLIGHT item flightData:`,
                {
                  hasFlightData: !!item.flightData,
                  isObject: typeof item.flightData === "object",
                  isNull: item.flightData === null,
                  isUndefined: item.flightData === undefined,
                  flightDataKeys:
                    item.flightData && typeof item.flightData === "object"
                      ? Object.keys(item.flightData as Record<string, unknown>)
                      : undefined,
                }
              );
            } catch (logError) {
              console.log(
                `[ADD-TIMELINE-TOOL-${toolCallId}] FLIGHT item flightData logging error:`,
                logError instanceof Error ? logError.message : String(logError)
              );
            }

            // Validate flight data structure
            const flightData = item.flightData as Record<string, unknown>;
            if (!flightData || typeof flightData !== "object") {
              throw new Error("Flight data is required and must be an object");
            }

            // Check for required DuffelOffer properties
            const requiredProperties = [
              "id",
              "slices",
              "total_amount",
              "total_currency",
              "owner",
            ];
            const missingProperties = requiredProperties.filter(
              (prop) => !(prop in flightData)
            );

            if (missingProperties.length > 0) {
              console.error(
                `[ADD-TIMELINE-TOOL-${toolCallId}] Invalid flight data - missing properties:`,
                missingProperties
              );
              try {
                console.error(
                  `[ADD-TIMELINE-TOOL-${toolCallId}] Received flight data keys:`,
                  Object.keys(flightData)
                );
              } catch (logError) {
                console.error(
                  `[ADD-TIMELINE-TOOL-${toolCallId}] Could not log flight data keys:`,
                  logError instanceof Error
                    ? logError.message
                    : String(logError)
                );
              }
              throw new Error(
                `Invalid flight data: missing required properties: ${missingProperties.join(
                  ", "
                )}. Flight data must come from findFlight tool results (DuffelOffer format), not generic flight objects.`
              );
            }

            // Check if slices is an array with at least one item
            if (
              !Array.isArray(flightData.slices) ||
              flightData.slices.length === 0
            ) {
              console.error(
                `[ADD-TIMELINE-TOOL-${toolCallId}] Invalid flight data - slices must be a non-empty array`
              );
              try {
                console.error(
                  `[ADD-TIMELINE-TOOL-${toolCallId}] Received flight data keys:`,
                  Object.keys(flightData)
                );
              } catch (logError) {
                console.error(
                  `[ADD-TIMELINE-TOOL-${toolCallId}] Could not log flight data keys:`,
                  logError instanceof Error
                    ? logError.message
                    : String(logError)
                );
              }
              throw new Error(
                "Invalid flight data: slices must be a non-empty array. Flight data must come from findFlight tool results, not generic flight objects."
              );
            }

            console.log(
              `[ADD-TIMELINE-TOOL-${toolCallId}] Flight data validation passed`
            );

            return {
              ...baseItem,
              flightData: item.flightData as unknown as DuffelOffer,
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

      console.log(
        `[ADD-TIMELINE-TOOL-${toolCallId}] Server action completed:`,
        {
          success: result.success,
          error: result.error,
          timelineId: result.data?.timelineId,
          itemIds: result.data?.itemIds,
          isNewTimeline: result.data?.isNewTimeline,
          durationMs: addDuration,
          timelineDataType: result.data?.timeline
            ? typeof result.data.timeline
            : "undefined",
          timelineDataKeys:
            result.data?.timeline && typeof result.data.timeline === "object"
              ? Object.keys(result.data.timeline)
              : "N/A",
        }
      );

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

        const successResponse = {
          success: true,
          timelineId: result.data.timelineId,
          itemIds: result.data.itemIds,
          isNewTimeline: result.data.isNewTimeline,
          itemsAdded: {
            count: items.length,
            types: itemCounts,
            summary: itemTypesList,
          },
          timeline: {
            id: result.data.timelineId,
            hasItems: true,
            mood: mood || "adventure",
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

        console.log(`[ADD-TIMELINE-TOOL-${toolCallId}] === TOOL SUCCESS ===`);
        console.log(
          `[ADD-TIMELINE-TOOL-${toolCallId}] Returning success response with ${items.length} items`
        );

        // Test JSON serialization before returning
        try {
          JSON.stringify(successResponse);
          console.log(
            `[ADD-TIMELINE-TOOL-${toolCallId}] Response JSON serialization: OK`
          );
        } catch (jsonError) {
          console.error(
            `[ADD-TIMELINE-TOOL-${toolCallId}] JSON serialization error:`,
            jsonError
          );
          console.error(
            `[ADD-TIMELINE-TOOL-${toolCallId}] Problematic response:`,
            {
              ...successResponse,
              timeline: typeof successResponse.timeline,
              metadata: typeof successResponse.metadata,
            }
          );
        }

        return successResponse;
      } else {
        console.log(`[ADD-TIMELINE-TOOL-${toolCallId}] === TOOL FAILURE ===`);
        console.log(`[ADD-TIMELINE-TOOL-${toolCallId}] Server action failed:`, {
          error: result.error,
          tripId,
          itemsCount: items.length,
        });

        return {
          success: false,
          error: result.error || "Failed to add items to timeline",
          itemsAttempted: {
            count: items.length,
            types: items.map((item) => item.type),
          },
          troubleshooting: {
            commonIssues: [
              "Trip ID not found or invalid",
              "Invalid item data format",
              "Database connection issues",
              "Timeline creation failed",
            ],
            suggestions: [
              "Verify the trip ID is correct",
              "Check that all required fields are provided",
              "Ensure dates are in valid ISO format",
              "Try again with simplified item data",
            ],
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
        `[ADD-TIMELINE-TOOL-${toolCallId}] Exception type:`,
        error?.constructor?.name
      );
      console.error(
        `[ADD-TIMELINE-TOOL-${toolCallId}] Exception message:`,
        error instanceof Error ? error.message : String(error)
      );
      console.error(
        `[ADD-TIMELINE-TOOL-${toolCallId}] Exception stack:`,
        error instanceof Error ? error.stack : "No stack trace available"
      );
      console.error(
        `[ADD-TIMELINE-TOOL-${toolCallId}] Tool duration before error: ${addDuration}ms`
      );
      console.error(`[ADD-TIMELINE-TOOL-${toolCallId}] Params:`, {
        tripId,
        itemsCount: items.length,
        mood,
        parentId,
        level,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        itemsAttempted: {
          count: items.length,
          types: items.map((item) => item.type),
        },
        errorDetails: {
          type: error instanceof Error ? error.name : "UnknownError",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
          stack: error instanceof Error ? error.stack : undefined,
        },
        suggestions: [
          "Check network connectivity",
          "Verify all required parameters are provided",
          "Try again with fewer items",
          "Contact support if error persists",
        ],
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
