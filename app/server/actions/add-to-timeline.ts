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
      const departureTime = new Date(slice.departure_datetime);
      const arrivalTime = new Date(slice.arrival_datetime);

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
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }

  try {
    const { tripId, items, mood, parentId, level = 0 } = params;

    // Check if timeline already exists
    const timeline = await getTimelineByTripId(tripId, userId);
    let isNewTimeline = false;
    let timelineId: string;

    if (!timeline) {
      // Create new timeline
      const trip = await getTripById(tripId, userId);
      if (!trip) {
        return {
          success: false,
          error: "Trip not found",
        };
      }

      const timelineTitle = generateTimelineTitle(items);

      const createdTimeline = await createTimeline(tripId, {
        title: timelineTitle,
        description: `Timeline for ${trip.destination}`,
        mood: mood || "adventure",
      });

      timelineId = createdTimeline.id;
      isNewTimeline = true;
    } else {
      timelineId = timeline.id;
    }

    const createdItemIds: string[] = [];

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type === "FLIGHT") {
        const flightData = item.flightData as DuffelOffer;

        // Create locations for this flight
        const locationIds = await createLocationsFromFlight(
          timelineId,
          flightData
        );

        // Create timeline items for this flight
        const timelineItems = createTimelineItemsFromFlight(
          timelineId,
          flightData,
          locationIds
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

        // Adjust orders to avoid conflicts
        const adjustedItems = timelineItems.map((item, index) => ({
          ...item,
          order: maxOrder + index + 1,
          parentId: parentId || undefined,
          level: level,
          flightData: item.flightData as Prisma.InputJsonValue,
        }));

        // Bulk create the items
        await bulkCreateTimelineItems(timelineId, adjustedItems);

        // Add the IDs (we'll need to query them back since createMany doesn't return IDs)
        createdItemIds.push(...adjustedItems.map(() => `flight-${i}`));
      } else if (item.type === "STAY") {
        // Handle stay items
        const stayData = item.stayData;

        // Create location for stay if needed
        let locationId = item.locationId;
        if (!locationId && stayData && typeof stayData === "object") {
          const location = stayData.location as Record<string, unknown>;
          const name = (location?.name || stayData.name || "Hotel") as string;
          const city = location?.city as string;

          const createdLocation = await createTimelineLocation(timelineId, {
            name,
            city,
            type: "HOTEL",
            description: `Hotel: ${name}`,
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

        createdItemIds.push(createdItem.id);
      } else {
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

        createdItemIds.push(createdItem.id);
      }
    }

    // Fetch the updated timeline
    const updatedTimeline = await getTimelineByTripId(tripId, userId);

    return {
      success: true,
      data: {
        timelineId: timelineId,
        itemIds: createdItemIds,
        timeline: updatedTimeline,
        isNewTimeline,
      },
    };
  } catch (error) {
    console.error("Add to timeline error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add to timeline",
    };
  }
}
