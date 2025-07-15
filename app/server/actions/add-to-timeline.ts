"use server";

import { auth } from "@clerk/nextjs/server";
import {
  createTimeline,
  getTimelineByTripId,
  createTimelineItem,
  createTimelineLocation,
  getTripById,
  bulkCreateTimelineItems,
} from "@/lib/db";
import type { DuffelOffer } from "./flight-search";
import type { Prisma } from "@prisma/client";

// Types for different item types
type FlightItemData = {
  type: "FLIGHT";
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  flightData: DuffelOffer;
  locationId?: string;
};

type StayItemData = {
  type: "STAY";
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  stayData: Record<string, unknown>;
  locationId?: string;
};

type ActivityItemData = {
  type: "ACTIVITY" | "DINING" | "TRANSPORT" | "FREE_TIME" | "CUSTOM";
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  activityData?: Record<string, unknown>;
  locationId?: string;
};

export type TimelineItemData = FlightItemData | StayItemData | ActivityItemData;

interface AddToTimelineParams {
  tripId: string;
  items: TimelineItemData[];
  mood?: string;
  parentId?: string;
  level?: number;
}

interface AddToTimelineResult {
  success: boolean;
  data?: {
    timelineId: string;
    itemIds: string[];
    timeline: Record<string, unknown> | null;
    isNewTimeline: boolean;
  };
  error?: string;
}

// Helper function to extract destination from flight data
function extractDestination(flightData: DuffelOffer): string {
  if (flightData.slices && flightData.slices.length > 0) {
    const firstSlice = flightData.slices[0];
    if (firstSlice.destination) {
      const destName =
        firstSlice.destination.name || firstSlice.destination.iata_code;

      // Clean up common airport suffixes
      const cleanName = destName
        .replace(/\s+(International\s+)?Airport/i, "")
        .replace(/\s+(Intl\.?)/i, "")
        .replace(/\s+Municipal/i, "")
        .trim();

      return cleanName;
    }
  }
  return "Unknown Destination";
}

// Helper function to extract origin from flight data
function extractOrigin(flightData: DuffelOffer): string {
  if (flightData.slices && flightData.slices.length > 0) {
    const firstSlice = flightData.slices[0];
    if (firstSlice.origin) {
      const originName = firstSlice.origin.name || firstSlice.origin.iata_code;

      // Clean up common airport suffixes
      const cleanName = originName
        .replace(/\s+(International\s+)?Airport/i, "")
        .replace(/\s+(Intl\.?)/i, "")
        .replace(/\s+Municipal/i, "")
        .trim();

      return cleanName;
    }
  }
  return "Unknown Origin";
}

// Helper function to generate timeline title
function generateTimelineTitle(items: TimelineItemData[]): string {
  const firstItem = items[0];

  if (firstItem.type === "FLIGHT") {
    const flightData = firstItem.flightData as DuffelOffer;
    const destination = extractDestination(flightData);
    const origin = extractOrigin(flightData);

    // Check if it's a round trip (multiple slices with return)
    const isRoundTrip = flightData.slices && flightData.slices.length > 1;

    if (isRoundTrip) {
      return `Trip to ${destination}`;
    } else {
      return `Flight from ${origin} to ${destination}`;
    }
  } else if (firstItem.type === "STAY") {
    // Extract location from stay data
    const stayData = firstItem.stayData;
    const location =
      (stayData?.location as Record<string, unknown>)?.name ||
      stayData?.city ||
      "Unknown Location";
    return `Stay in ${location}`;
  } else {
    return `${firstItem.title} Trip`;
  }
}

// Helper function to create timeline locations from flight data
async function createLocationsFromFlight(
  timelineId: string,
  flightData: DuffelOffer
): Promise<string[]> {
  const locationIds: string[] = [];

  if (flightData.slices) {
    for (const slice of flightData.slices) {
      // Create origin location
      if (slice.origin) {
        const originLocation = await createTimelineLocation(timelineId, {
          name: slice.origin.name || slice.origin.iata_code,
          city: slice.origin.name,
          iataCode: slice.origin.iata_code,
          type: "AIRPORT",
          description: `Origin airport: ${slice.origin.name}`,
        });
        locationIds.push(originLocation.id);
      }

      // Create destination location
      if (slice.destination) {
        const destLocation = await createTimelineLocation(timelineId, {
          name: slice.destination.name || slice.destination.iata_code,
          city: slice.destination.name,
          iataCode: slice.destination.iata_code,
          type: "AIRPORT",
          description: `Destination airport: ${slice.destination.name}`,
        });
        locationIds.push(destLocation.id);
      }
    }
  }

  return locationIds;
}

// Helper function to create timeline items from flight data
function createTimelineItemsFromFlight(
  timelineId: string,
  flightData: DuffelOffer,
  locationIds: string[]
): Array<{
  title: string;
  description?: string;
  type: "FLIGHT" | "LOCATION_CHANGE";
  startTime: Date;
  endTime?: Date;
  duration?: number;
  locationId?: string;
  order: number;
  level: number;
  flightData: Record<string, unknown>;
}> {
  const items: Array<{
    title: string;
    description?: string;
    type: "FLIGHT" | "LOCATION_CHANGE";
    startTime: Date;
    endTime?: Date;
    duration?: number;
    locationId?: string;
    order: number;
    level: number;
    flightData: Record<string, unknown>;
  }> = [];

  if (flightData.slices) {
    flightData.slices.forEach((slice, index) => {
      // Handle different date formats - try DuffelOffer format first, then segments format
      let departureTime: Date;
      let arrivalTime: Date;

      const sliceData = slice as unknown as Record<string, unknown>;

      if (sliceData.departure_datetime && sliceData.arrival_datetime) {
        // Standard DuffelOffer format
        departureTime = new Date(sliceData.departure_datetime as string);
        arrivalTime = new Date(sliceData.arrival_datetime as string);
      } else if (
        sliceData.segments &&
        Array.isArray(sliceData.segments) &&
        sliceData.segments.length > 0
      ) {
        // Alternative format with segments
        const firstSegment = sliceData.segments[0] as Record<string, unknown>;
        const lastSegment = sliceData.segments[
          sliceData.segments.length - 1
        ] as Record<string, unknown>;
        departureTime = new Date(
          (firstSegment.departing_at ||
            firstSegment.departure_datetime) as string
        );
        arrivalTime = new Date(
          (lastSegment.arriving_at || lastSegment.arrival_datetime) as string
        );
      } else {
        // Fallback - try to parse from any available date fields
        departureTime = new Date(
          (sliceData.departing_at ||
            sliceData.departure_datetime ||
            new Date()) as string
        );
        arrivalTime = new Date(
          (sliceData.arriving_at ||
            sliceData.arrival_datetime ||
            new Date()) as string
        );
      }

      // Validate dates
      if (isNaN(departureTime.getTime()) || isNaN(arrivalTime.getTime())) {
        console.error(`Invalid dates in flight slice:`, {
          slice,
          departureTime: departureTime.toString(),
          arrivalTime: arrivalTime.toString(),
        });
        // Skip this slice if dates are invalid
        return;
      }

      console.log(`Parsed flight dates:`, {
        departureTime: departureTime.toISOString(),
        arrivalTime: arrivalTime.toISOString(),
      });

      // Parse duration (ISO 8601 format like "PT2H30M")
      let durationInMinutes = 0;
      if (slice.duration) {
        const durationMatch = slice.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1] || "0", 10);
          const minutes = parseInt(durationMatch[2] || "0", 10);
          durationInMinutes = hours * 60 + minutes;
        }
      }

      const origin = slice.origin.name || slice.origin.iata_code;
      const destination = slice.destination.name || slice.destination.iata_code;

      // Create flight item
      items.push({
        title: `Flight ${slice.origin.iata_code} → ${slice.destination.iata_code}`,
        description: `${origin} to ${destination} • ${
          slice.segments.length === 1
            ? "Direct"
            : `${slice.segments.length - 1} stop${
                slice.segments.length > 2 ? "s" : ""
              }`
        }`,
        type: "FLIGHT",
        startTime: departureTime,
        endTime: arrivalTime,
        duration: durationInMinutes,
        locationId: locationIds[index * 2], // Origin location
        order: index + 1,
        level: 0,
        flightData: slice as unknown as Record<string, unknown>,
      });

      // Create location change item if this is not the last slice
      if (index < flightData.slices.length - 1) {
        items.push({
          title: `Arrive in ${destination}`,
          description: `Location change to ${destination}`,
          type: "LOCATION_CHANGE",
          startTime: arrivalTime,
          locationId: locationIds[index * 2 + 1], // Destination location
          order: index + 2,
          level: 0,
          flightData: {},
        });
      }
    });
  }

  return items;
}

export async function addToTimeline(
  params: AddToTimelineParams
): Promise<AddToTimelineResult> {
  const actionStartTime = Date.now();
  const actionId = Math.random().toString(36).substring(7);

  console.log(`[ADD-TIMELINE-${actionId}] === ACTION START ===`);
  console.log(
    `[ADD-TIMELINE-${actionId}] Timestamp: ${new Date().toISOString()}`
  );
  console.log(`[ADD-TIMELINE-${actionId}] Input params:`, {
    tripId: params.tripId,
    itemsCount: params.items.length,
    mood: params.mood,
    parentId: params.parentId,
    level: params.level,
    itemTypes: params.items.map((item) => item.type),
    itemTitles: params.items.map((item) => item.title),
  });

  // Auth check
  console.log(`[ADD-TIMELINE-${actionId}] Checking authentication...`);
  const authStartTime = Date.now();
  const { userId } = await auth();
  const authDuration = Date.now() - authStartTime;

  console.log(`[ADD-TIMELINE-${actionId}] Auth result:`, {
    userId: userId || "NOT_AUTHENTICATED",
    authDurationMs: authDuration,
  });

  if (!userId) {
    console.error(`[ADD-TIMELINE-${actionId}] ERROR: Unauthorized - no userId`);
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  try {
    const { tripId, items, mood, parentId, level = 0 } = params;

    console.log(
      `[ADD-TIMELINE-${actionId}] Processing ${items.length} items for trip ${tripId}`
    );

    // Check if timeline already exists
    console.log(`[ADD-TIMELINE-${actionId}] Checking for existing timeline...`);
    const timelineCheckStartTime = Date.now();
    const timeline = await getTimelineByTripId(tripId, userId);
    const timelineCheckDuration = Date.now() - timelineCheckStartTime;

    console.log(`[ADD-TIMELINE-${actionId}] Timeline check result:`, {
      exists: !!timeline,
      timelineId: timeline?.id,
      timelineTitle: timeline?.title,
      existingItemsCount: timeline?.items
        ? Array.isArray(timeline.items)
          ? timeline.items.length
          : 0
        : 0,
      checkDurationMs: timelineCheckDuration,
    });

    let isNewTimeline = false;
    let timelineId: string;

    if (!timeline) {
      console.log(
        `[ADD-TIMELINE-${actionId}] No existing timeline found, creating new one...`
      );

      // Create new timeline
      const tripCheckStartTime = Date.now();
      const trip = await getTripById(tripId, userId);
      const tripCheckDuration = Date.now() - tripCheckStartTime;

      console.log(`[ADD-TIMELINE-${actionId}] Trip check result:`, {
        tripExists: !!trip,
        tripId: trip?.id,
        tripDestination: trip?.destination,
        checkDurationMs: tripCheckDuration,
      });

      if (!trip) {
        console.error(`[ADD-TIMELINE-${actionId}] ERROR: Trip not found`, {
          tripId,
          userId,
        });
        return {
          success: false,
          error: "Trip not found",
        };
      }

      const timelineTitle = generateTimelineTitle(items);
      console.log(
        `[ADD-TIMELINE-${actionId}] Generated timeline title: "${timelineTitle}"`
      );

      const timelineCreateStartTime = Date.now();
      const createdTimeline = await createTimeline(tripId, {
        title: timelineTitle,
        description: `Timeline for ${trip.destination}`,
        mood: mood || "adventure",
      });
      const timelineCreateDuration = Date.now() - timelineCreateStartTime;

      console.log(`[ADD-TIMELINE-${actionId}] Timeline created:`, {
        timelineId: createdTimeline.id,
        title: createdTimeline.title,
        mood: createdTimeline.mood,
        createDurationMs: timelineCreateDuration,
      });

      timelineId = createdTimeline.id;
      isNewTimeline = true;
    } else {
      timelineId = timeline.id;
      console.log(
        `[ADD-TIMELINE-${actionId}] Using existing timeline: ${timelineId}`
      );
    }

    const createdItemIds: string[] = [];
    console.log(`[ADD-TIMELINE-${actionId}] Starting item processing...`);

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemStartTime = Date.now();

      console.log(
        `[ADD-TIMELINE-${actionId}] Processing item ${i + 1}/${items.length}:`,
        {
          type: item.type,
          title: item.title,
          startTime: item.startTime,
          endTime: item.endTime,
          duration: item.duration,
          locationId: item.locationId,
          hasFlightData: item.type === "FLIGHT" ? !!item.flightData : undefined,
          hasStayData: item.type === "STAY" ? !!item.stayData : undefined,
          hasActivityData:
            item.type !== "FLIGHT" && item.type !== "STAY"
              ? !!item.activityData
              : undefined,
        }
      );

      console.log(`[ADD-TIMELINE-${actionId}] Item type check:`, {
        itemType: item.type,
        isFlightType: item.type === "FLIGHT",
        isStayType: item.type === "STAY",
        isOtherType: item.type !== "FLIGHT" && item.type !== "STAY",
      });

      if (item.type === "FLIGHT") {
        console.log(
          `[ADD-TIMELINE-${actionId}] ✅ ENTERING FLIGHT PROCESSING PATH`
        );
        console.log(`[ADD-TIMELINE-${actionId}] Processing FLIGHT item...`);
        const flightData = item.flightData as DuffelOffer;

        console.log(`[ADD-TIMELINE-${actionId}] Flight data overview:`, {
          id: flightData.id,
          slicesCount: flightData.slices?.length || 0,
          totalAmount: flightData.total_amount,
          totalCurrency: flightData.total_currency,
          owner: flightData.owner,
        });

        // Create locations for this flight
        console.log(
          `[ADD-TIMELINE-${actionId}] Creating locations for flight...`
        );
        const locationCreateStartTime = Date.now();
        const locationIds = await createLocationsFromFlight(
          timelineId,
          flightData
        );
        const locationCreateDuration = Date.now() - locationCreateStartTime;

        console.log(`[ADD-TIMELINE-${actionId}] Flight locations created:`, {
          locationIds,
          count: locationIds.length,
          createDurationMs: locationCreateDuration,
        });

        // Create timeline items for this flight
        console.log(
          `[ADD-TIMELINE-${actionId}] Creating timeline items for flight...`
        );
        const timelineItems = createTimelineItemsFromFlight(
          timelineId,
          flightData,
          locationIds
        );

        console.log(
          `[ADD-TIMELINE-${actionId}] Flight timeline items prepared:`,
          {
            itemsCount: timelineItems.length,
            items: timelineItems.map((item) => ({
              title: item.title,
              type: item.type,
              startTime: item.startTime,
              order: item.order,
              level: item.level,
            })),
          }
        );

        // Get the current max order to avoid conflicts
        const existingTimeline =
          timeline || (await getTimelineByTripId(tripId, userId));
        const existingItems =
          existingTimeline && Array.isArray(existingTimeline.items)
            ? existingTimeline.items
            : [];
        const maxOrder =
          existingItems.length > 0
            ? Math.max(
                ...existingItems.map(
                  (item: Record<string, unknown>) => (item.order as number) || 0
                )
              )
            : 0;

        console.log(`[ADD-TIMELINE-${actionId}] Order calculation:`, {
          existingItemsCount: existingItems.length,
          maxOrder,
        });

        // Adjust orders to avoid conflicts
        const adjustedItems = timelineItems.map((item, index) => ({
          ...item,
          order: maxOrder + index + 1,
          parentId: parentId || undefined,
          level: level,
          flightData: item.flightData as Prisma.InputJsonValue,
        }));

        console.log(`[ADD-TIMELINE-${actionId}] Adjusted items orders:`, {
          orders: adjustedItems.map((item) => item.order),
        });

        // Bulk create the items
        console.log(`[ADD-TIMELINE-${actionId}] Bulk creating flight items...`);
        const bulkCreateStartTime = Date.now();
        await bulkCreateTimelineItems(timelineId, adjustedItems);
        const bulkCreateDuration = Date.now() - bulkCreateStartTime;

        console.log(`[ADD-TIMELINE-${actionId}] Flight items bulk created:`, {
          itemsCount: adjustedItems.length,
          createDurationMs: bulkCreateDuration,
        });

        // Add the IDs (we'll need to query them back since createMany doesn't return IDs)
        createdItemIds.push(...adjustedItems.map(() => `flight-${i}`));
      } else if (item.type === "STAY") {
        console.log(
          `[ADD-TIMELINE-${actionId}] ✅ ENTERING STAY PROCESSING PATH`
        );
        console.log(`[ADD-TIMELINE-${actionId}] Processing STAY item...`);
        const stayData = item.stayData;

        console.log(`[ADD-TIMELINE-${actionId}] Stay data overview:`, {
          stayData:
            typeof stayData === "object"
              ? Object.keys(stayData as Record<string, unknown>)
              : typeof stayData,
        });

        // Create location for stay if needed
        let locationId = item.locationId;
        if (!locationId && stayData && typeof stayData === "object") {
          console.log(
            `[ADD-TIMELINE-${actionId}] Creating location for stay...`
          );
          const location = stayData.location as Record<string, unknown>;
          const name = (location?.name || stayData.name || "Hotel") as string;
          const city = location?.city as string;

          const locationCreateStartTime = Date.now();
          const createdLocation = await createTimelineLocation(timelineId, {
            name,
            city,
            type: "HOTEL",
            description: `Hotel: ${name}`,
          });
          const locationCreateDuration = Date.now() - locationCreateStartTime;

          console.log(`[ADD-TIMELINE-${actionId}] Stay location created:`, {
            locationId: createdLocation.id,
            name,
            city,
            createDurationMs: locationCreateDuration,
          });

          locationId = createdLocation.id;
        }

        const existingTimeline =
          timeline || (await getTimelineByTripId(tripId, userId));
        const existingItems =
          existingTimeline && Array.isArray(existingTimeline.items)
            ? existingTimeline.items
            : [];
        const maxOrder =
          existingItems.length > 0
            ? Math.max(
                ...existingItems.map(
                  (item: Record<string, unknown>) => (item.order as number) || 0
                )
              )
            : 0;

        console.log(
          `[ADD-TIMELINE-${actionId}] Creating stay timeline item...`
        );
        const stayCreateStartTime = Date.now();
        const createdItem = await createTimelineItem(timelineId, {
          title: item.title,
          description: item.description,
          type: item.type,
          startTime: item.startTime,
          endTime: item.endTime,
          duration: item.duration,
          locationId,
          order: maxOrder + 1,
          level: level,
          parentId: parentId || undefined,
          stayData: stayData as Prisma.InputJsonValue,
        });
        const stayCreateDuration = Date.now() - stayCreateStartTime;

        console.log(`[ADD-TIMELINE-${actionId}] Stay item created:`, {
          itemId: createdItem.id,
          title: createdItem.title,
          order: createdItem.order,
          createDurationMs: stayCreateDuration,
        });

        createdItemIds.push(createdItem.id);
      } else {
        console.log(
          `[ADD-TIMELINE-${actionId}] ✅ ENTERING OTHER ITEM PROCESSING PATH`
        );
        console.log(
          `[ADD-TIMELINE-${actionId}] Processing ${item.type} item...`
        );

        // Handle other item types (activities, dining, etc.)
        const existingTimeline =
          timeline || (await getTimelineByTripId(tripId, userId));
        const existingItems =
          existingTimeline && Array.isArray(existingTimeline.items)
            ? existingTimeline.items
            : [];
        const maxOrder =
          existingItems.length > 0
            ? Math.max(
                ...existingItems.map(
                  (item: Record<string, unknown>) => (item.order as number) || 0
                )
              )
            : 0;

        console.log(
          `[ADD-TIMELINE-${actionId}] Creating ${item.type} timeline item...`
        );
        const activityCreateStartTime = Date.now();
        const createdItem = await createTimelineItem(timelineId, {
          title: item.title,
          description: item.description,
          type: item.type,
          startTime: item.startTime,
          endTime: item.endTime,
          duration: item.duration,
          locationId: item.locationId,
          order: maxOrder + 1,
          level: level,
          parentId: parentId || undefined,
          activityData: item.activityData as Prisma.InputJsonValue | undefined,
        });
        const activityCreateDuration = Date.now() - activityCreateStartTime;

        console.log(`[ADD-TIMELINE-${actionId}] ${item.type} item created:`, {
          itemId: createdItem.id,
          title: createdItem.title,
          order: createdItem.order,
          createDurationMs: activityCreateDuration,
        });

        createdItemIds.push(createdItem.id);
      }

      const itemProcessDuration = Date.now() - itemStartTime;
      console.log(
        `[ADD-TIMELINE-${actionId}] Item ${
          i + 1
        } processed in ${itemProcessDuration}ms`
      );
    }

    console.log(
      `[ADD-TIMELINE-${actionId}] All items processed, fetching updated timeline...`
    );

    console.log(`[ADD-TIMELINE-${actionId}] Final createdItemIds array:`, {
      createdItemIds,
      count: createdItemIds.length,
    });

    // Fetch the updated timeline
    const timelineFetchStartTime = Date.now();
    const updatedTimeline = await getTimelineByTripId(tripId, userId);
    const timelineFetchDuration = Date.now() - timelineFetchStartTime;

    console.log(`[ADD-TIMELINE-${actionId}] Updated timeline fetched:`, {
      timelineId: updatedTimeline?.id,
      itemsCount: updatedTimeline?.items
        ? Array.isArray(updatedTimeline.items)
          ? updatedTimeline.items.length
          : 0
        : 0,
      fetchDurationMs: timelineFetchDuration,
    });

    const totalActionDuration = Date.now() - actionStartTime;

    console.log(`[ADD-TIMELINE-${actionId}] === ACTION SUCCESS ===`);
    console.log(`[ADD-TIMELINE-${actionId}] Success result:`, {
      timelineId: timelineId,
      itemIds: createdItemIds,
      isNewTimeline,
      totalDurationMs: totalActionDuration,
    });

    // Create a clean, serializable timeline object
    const cleanTimeline = updatedTimeline
      ? {
          id: updatedTimeline.id,
          title: updatedTimeline.title,
          description: updatedTimeline.description,
          mood: updatedTimeline.mood,
          itemsCount:
            updatedTimeline.items && Array.isArray(updatedTimeline.items)
              ? updatedTimeline.items.length
              : 0,
          createdAt: updatedTimeline.createdAt?.toISOString(),
          updatedAt: updatedTimeline.updatedAt?.toISOString(),
        }
      : null;

    console.log(
      `[ADD-TIMELINE-${actionId}] Clean timeline object:`,
      cleanTimeline
    );

    return {
      success: true,
      data: {
        timelineId: timelineId,
        itemIds: createdItemIds,
        timeline: cleanTimeline,
        isNewTimeline,
      },
    };
  } catch (error) {
    const totalActionDuration = Date.now() - actionStartTime;

    console.error(`[ADD-TIMELINE-${actionId}] === ACTION ERROR ===`);
    console.error(
      `[ADD-TIMELINE-${actionId}] Error type:`,
      error?.constructor?.name
    );
    console.error(
      `[ADD-TIMELINE-${actionId}] Error message:`,
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      `[ADD-TIMELINE-${actionId}] Error stack:`,
      error instanceof Error ? error.stack : "No stack trace available"
    );
    console.error(
      `[ADD-TIMELINE-${actionId}] Action duration before error: ${totalActionDuration}ms`
    );
    console.error(`[ADD-TIMELINE-${actionId}] Params:`, {
      tripId: params.tripId,
      itemsCount: params.items.length,
      mood: params.mood,
      parentId: params.parentId,
      level: params.level,
    });
    console.error(
      `[ADD-TIMELINE-${actionId}] Timestamp: ${new Date().toISOString()}`
    );

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add to timeline",
    };
  }
}
