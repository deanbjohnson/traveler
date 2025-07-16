"use server";

import { auth } from "@clerk/nextjs/server";
import { getTimelineByTripId } from "@/lib/db";
import { unstable_cache as cache } from "next/cache";
import type { TimelineData } from "@/components/main-timeline";

// Helper function to safely serialize JSON data
function sanitizeJsonData(data: any): any {
  if (data === null || data === undefined) return undefined;
  
  try {
    // Test if it's already valid JSON by stringifying and parsing
    const testString = JSON.stringify(data);
    return JSON.parse(testString);
  } catch (error) {
    console.warn("Invalid JSON data detected, returning undefined:", error);
    return undefined;
  }
}

// Helper function to safely convert dates - ALWAYS returns a valid Date
function safeDate(dateInput: any): Date {
  if (!dateInput) {
    return new Date();
  }
  
  // If it's already a Date object, return it
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      return new Date();
    }
    return dateInput;
  }
  
  // If it's a string or number, try to convert it
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  } catch (error) {
    return new Date();
  }
}

export async function getTimeline(
  tripId: string
): Promise<TimelineData | null> {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("No authenticated user for timeline fetch");
      return null;
    }

    console.log(`Fetching timeline for trip ${tripId}, user ${userId}`);

    // Using unstable_cache to cache the timeline data
    const getCachedTimeline = cache(
      async (id: string, uId: string) => {
        try {
          const rawTimeline = await getTimelineByTripId(id, uId);
          
          // DEBUG LOGGING - Added here to see what the database returns
          console.log("DEBUG: Database query result:", {
            tripId: id,
            userId: uId,
            timelineFound: !!rawTimeline,
            timelineId: rawTimeline?.id,
            rawTimelineType: typeof rawTimeline,
            itemsFound: rawTimeline?.items ? rawTimeline.items.length : 0,
            locationsFound: rawTimeline?.locations ? rawTimeline.locations.length : 0,
            timelineTitle: rawTimeline?.title,
            timelineMood: rawTimeline?.mood,
          });
          
          if (!rawTimeline) {
            console.log(`No timeline found for trip ${id}`);
            return null;
          }

          console.log(`Found timeline with ${rawTimeline.items?.length || 0} items`);

          // SAFELY transform the database data to match MainTimeline's expected format
          const transformedTimeline: TimelineData = {
            id: rawTimeline.id,
            title: rawTimeline.title || undefined,
            description: rawTimeline.description || undefined,
            mood: rawTimeline.mood || undefined,
            items: (rawTimeline.items || []).map((item) => {
              try {
                return {
                  id: item.id,
                  title: item.title,
                  description: item.description || undefined,
                  type: item.type as any,
                  status: item.status as any,
                  startTime: safeDate(item.startTime), // FIXED: removed || new Date()
                  endTime: item.endTime ? safeDate(item.endTime) : undefined,
                  duration: item.duration || undefined,
                  locationId: item.locationId || undefined,
                  order: item.order,
                  level: item.level,
                  flightData: sanitizeJsonData(item.flightData),
                  stayData: sanitizeJsonData(item.stayData),
                  activityData: sanitizeJsonData(item.activityData),
                  preferences: sanitizeJsonData(item.preferences),
                  mood: item.mood || undefined,
                  isLocked: Boolean(item.isLocked),
                  isAlternative: Boolean(item.isAlternative),
                  location: item.location ? {
                    id: item.location.id,
                    name: item.location.name,
                    city: item.location.city || undefined,
                    country: item.location.country || undefined,
                    iataCode: item.location.iataCode || undefined,
                    latitude: item.location.latitude || undefined,
                    longitude: item.location.longitude || undefined,
                    type: item.location.type as any,
                    description: item.location.description || undefined,
                    timezone: item.location.timezone || undefined,
                    color: item.location.color || undefined,
                    icon: item.location.icon || undefined,
                  } : undefined,
                  alternatives: (item.alternatives || []).map((alt) => ({
                    id: alt.id,
                    title: alt.title,
                    description: alt.description || undefined,
                    type: alt.type as any,
                    startTime: safeDate(alt.startTime), // FIXED: removed || new Date()
                    endTime: alt.endTime ? safeDate(alt.endTime) : undefined,
                    duration: alt.duration || undefined,
                    flightData: sanitizeJsonData(alt.flightData),
                    stayData: sanitizeJsonData(alt.stayData),
                    activityData: sanitizeJsonData(alt.activityData),
                    price: alt.price || undefined,
                    currency: alt.currency || undefined,
                    reason: alt.reason || undefined,
                    score: alt.score || undefined,
                  })),
                  children: (item.children || []).map((child) => ({
                    id: child.id,
                    title: child.title,
                    description: child.description || undefined,
                    type: child.type as any,
                    status: child.status as any,
                    startTime: safeDate(child.startTime), // FIXED: removed || new Date()
                    endTime: child.endTime ? safeDate(child.endTime) : undefined,
                    duration: child.duration || undefined,
                    locationId: child.locationId || undefined,
                    order: child.order,
                    level: child.level,
                    flightData: sanitizeJsonData(child.flightData),
                    stayData: sanitizeJsonData(child.stayData),
                    activityData: sanitizeJsonData(child.activityData),
                    preferences: sanitizeJsonData(child.preferences),
                    mood: child.mood || undefined,
                    isLocked: Boolean(child.isLocked),
                    isAlternative: Boolean(child.isAlternative),
                    location: child.location ? {
                      id: child.location.id,
                      name: child.location.name,
                      city: child.location.city || undefined,
                      country: child.location.country || undefined,
                      iataCode: child.location.iataCode || undefined,
                      latitude: child.location.latitude || undefined,
                      longitude: child.location.longitude || undefined,
                      type: child.location.type as any,
                      description: child.location.description || undefined,
                      timezone: child.location.timezone || undefined,
                      color: child.location.color || undefined,
                      icon: child.location.icon || undefined,
                    } : undefined,
                    alternatives: [], // Simplify for children to avoid deep nesting issues
                    children: [], // Avoid circular references
                  })),
                };
              } catch (itemError) {
                console.error("Error transforming timeline item:", itemError);
                // Return a minimal safe item if transformation fails
                return {
                  id: item.id,
                  title: item.title || "Invalid Item",
                  description: "Error loading item data",
                  type: "CUSTOM" as any,
                  status: "PLANNED" as any,
                  startTime: new Date(), // This is OK since it's a fallback
                  order: item.order || 0,
                  level: item.level || 0,
                  isLocked: false,
                  isAlternative: false,
                  alternatives: [],
                  children: [],
                };
              }
            }),
            locations: (rawTimeline.locations || []).map((location) => ({
              id: location.id,
              name: location.name,
              city: location.city || undefined,
              country: location.country || undefined,
              iataCode: location.iataCode || undefined,
              latitude: location.latitude || undefined,
              longitude: location.longitude || undefined,
              type: location.type as any,
              description: location.description || undefined,
              timezone: location.timezone || undefined,
              color: location.color || undefined,
              icon: location.icon || undefined,
            })),
          };

          // Final validation - test if the result can be serialized
          try {
            JSON.stringify(transformedTimeline);
            console.log("Timeline data validation: PASSED");
            return transformedTimeline;
          } catch (serializationError) {
            console.error("Timeline serialization failed:", serializationError);
            // Return a minimal timeline if serialization fails
            return {
              id: rawTimeline.id,
              title: "Timeline (Data Error)",
              description: "Some timeline data could not be loaded",
              items: [],
              locations: []
            };
          }
        } catch (transformError) {
          console.error("Error in timeline transformation:", transformError);
          return null;
        }
      },
      [`timeline-${tripId}`], // Cache key
      {
        tags: [`timeline-${tripId}`], // Tag for revalidation
        revalidate: 3600, // Revalidate every hour
      }
    );

    const result = await getCachedTimeline(tripId, userId);
    console.log("Final timeline result:", result ? "SUCCESS" : "NULL");
    return result;
    
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return null;
  }
}