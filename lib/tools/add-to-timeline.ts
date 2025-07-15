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
    tripId: z.string().min(1).describe("The ID of the trip to add items to"),

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
  }),

  execute: async ({ tripId, items, mood, parentId, level = 0 }) => {
    const addStartTime = Date.now();

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

        return {
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
      } else {
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
