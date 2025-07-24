"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import {
  createTimeline,
  createTimelineItem,
  getTimelineByTripId,
  createTimelineLocation,
} from "@/lib/db";

// Import Prisma types if available
import type { Timeline, TimelineItem } from "@prisma/client";

export interface TimelineItemData {
  type: "FLIGHT" | "STAY" | "ACTIVITY" | "DINING" | "TRANSPORT" | "FREE_TIME" | "LOCATION_CHANGE" | "CHECKPOINT" | "CUSTOM";
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  flightData?: Record<string, unknown>;
  stayData?: Record<string, unknown>;
  activityData?: Record<string, unknown>;
  locationId?: string;
}

// Define the timeline type (what comes back from database)
interface TimelineWithItems extends Timeline {
  items?: TimelineItem[];
}

// CRITICAL: Add the same sanitization function here
function sanitizeFlightData(flightData: any): any {
  console.log('🧹 Sanitizing flight data for database storage');
  
  if (!flightData || typeof flightData !== 'object') {
    return { id: 'unknown', total_amount: '0', total_currency: 'USD', sanitized: true };
  }

  // Create a completely clean object with only primitive values
  const safeData = {
    id: String(flightData.id || 'unknown'),
    total_amount: String(flightData.total_amount || '0'),
    total_currency: String(flightData.total_currency || 'USD'),
    owner: {
      name: String(flightData.owner?.name || 'Unknown Airline'),
      iata_code: String(flightData.owner?.iata_code || 'XX')
    },
    // Only include basic slice info, no complex nested objects
    slices: Array.isArray(flightData.slices) ? flightData.slices.slice(0, 2).map((slice: any, index: number) => ({
      id: String(slice?.id || `slice-${index}`),
      origin: {
        iata_code: String(slice?.origin?.iata_code || 'XXX'),
        name: String(slice?.origin?.name || 'Unknown')
      },
      destination: {
        iata_code: String(slice?.destination?.iata_code || 'XXX'), 
        name: String(slice?.destination?.name || 'Unknown')
      },
      departure_datetime: String(slice?.departure_datetime || new Date().toISOString()),
      arrival_datetime: String(slice?.arrival_datetime || new Date().toISOString()),
      duration: String(slice?.duration || 'PT0H0M')
    })) : [],
    sanitized: true,
    sanitized_at: new Date().toISOString()
  };

  // Final safety check
  try {
    JSON.stringify(safeData);
    console.log('✅ Flight data sanitization successful');
    return safeData;
  } catch (finalError) {
    console.error('💥 Even sanitized data failed JSON test:', finalError);
    return {
      id: 'fallback',
      total_amount: '0', 
      total_currency: 'USD',
      error: 'Ultra-safe fallback',
      sanitized: true
    };
  }
}

export async function addToTimeline({
  tripId,
  items,
  mood,
  parentId,
  level = 0,
}: {
  tripId: string;
  items: TimelineItemData[];
  mood?: string;
  parentId?: string;
  level?: number;
}) {
  const startTime = Date.now();
  const actionId = Math.random().toString(36).substring(7);
  
  console.log(`[ADD-TIMELINE-${actionId}] === STARTING ADD TO TIMELINE ===`);
  console.log(`[ADD-TIMELINE-${actionId}] Trip: ${tripId}, Items: ${items.length}`);

  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("User not authenticated");
    }

    console.log(`[ADD-TIMELINE-${actionId}] User authenticated: ${userId}`);

    // Check if timeline exists for this trip
    console.log(`[ADD-TIMELINE-${actionId}] Checking for existing timeline...`);
    let timeline: TimelineWithItems | null = await getTimelineByTripId(tripId, userId);
    let isNewTimeline = false;

    if (!timeline) {
      console.log(`[ADD-TIMELINE-${actionId}] No timeline found, creating new one...`);
      
      // Generate timeline title based on first flight destination
      const firstFlight = items.find(item => item.type === "FLIGHT");
      let timelineTitle = "Trip Timeline";
      
      if (firstFlight?.flightData) {
        try {
          const flightData = firstFlight.flightData as any;
          if (flightData.slices?.[0]?.destination?.name) {
            const destination = flightData.slices[0].destination.name;
            timelineTitle = `Trip to ${destination}`;
          }
        } catch (error) {
          console.warn(`[ADD-TIMELINE-${actionId}] Could not extract destination for title:`, error);
        }
      }

      timeline = await createTimeline(tripId, {
        title: timelineTitle,
        description: `Timeline created on ${new Date().toLocaleDateString()}`,
        mood: mood || "adventure",
      }) as TimelineWithItems;
      
      isNewTimeline = true;
      console.log(`[ADD-TIMELINE-${actionId}] ✅ Created new timeline: ${timeline.id}`);
    } else {
      console.log(`[ADD-TIMELINE-${actionId}] ✅ Using existing timeline: ${timeline.id}`);
    }

    // Add items to timeline - SANITIZE DATA BEFORE SAVING
    const addedItems = [];
    const existingItemsCount = timeline.items?.length || 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const order = existingItemsCount + i + 1;

      console.log(`[ADD-TIMELINE-${actionId}] Adding item ${i + 1}/${items.length}: ${item.title}`);

      try {
        // CRITICAL FIX: Sanitize flight data BEFORE saving to database
        const sanitizedFlightData = item.flightData ? sanitizeFlightData(item.flightData) : undefined;
        
        const timelineItem = await createTimelineItem(timeline.id, {
          parentId,
          title: item.title,
          description: item.description,
          type: item.type,
          startTime: item.startTime,
          endTime: item.endTime,
          duration: item.duration,
          locationId: item.locationId,
          order,
          level,
          flightData: sanitizedFlightData, // Use sanitized data
          stayData: item.stayData as any,
          activityData: item.activityData as any,
          mood: mood,
          isLocked: false,
        });

        addedItems.push({
          id: timelineItem.id,
          type: item.type,
          title: item.title,
        });

        console.log(`[ADD-TIMELINE-${actionId}] ✅ Added item: ${timelineItem.id} (${item.type})`);
      } catch (itemError) {
        console.error(`[ADD-TIMELINE-${actionId}] ❌ Failed to add item ${i + 1}:`, itemError);
        throw new Error(`Failed to add item "${item.title}": ${itemError instanceof Error ? itemError.message : 'Unknown error'}`);
      }
    }

    // PRODUCTION CACHE INVALIDATION: Immediately invalidate the cache
    console.log(`[ADD-TIMELINE-${actionId}] 🔄 Invalidating timeline cache...`);
    revalidateTag(`timeline-${tripId}`);
    console.log(`[ADD-TIMELINE-${actionId}] ✅ Cache invalidated for timeline-${tripId}`);

    const duration = Date.now() - startTime;
    console.log(`[ADD-TIMELINE-${actionId}] === COMPLETED IN ${duration}ms ===`);

    // CRITICAL FIX: Return ultra-simple response to avoid JSON serialization issues
    return {
      success: true,
      data: {
        timelineId: timeline.id,
        itemIds: addedItems.map(item => item.id),
        isNewTimeline,
        // Simplified itemsAdded - no complex objects
        itemsAdded: {
          count: addedItems.length,
          summary: addedItems.map(item => item.type.toLowerCase()).join(", "),
        },
      },
      message: `Successfully added ${addedItems.length} item${
        addedItems.length > 1 ? "s" : ""
      } to your ${isNewTimeline ? "new" : "existing"} timeline!`,
      // Simplified metadata
      metadata: {
        tripId,
        timelineId: timeline.id,
        processingDurationMs: duration,
        cacheInvalidated: true,
      },
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ADD-TIMELINE-${actionId}] === ERROR AFTER ${duration}ms ===`);
    console.error(`[ADD-TIMELINE-${actionId}] Error:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      metadata: {
        tripId,
        processingDurationMs: duration,
      },
      timestamp: new Date().toISOString(),
    };
  }
}