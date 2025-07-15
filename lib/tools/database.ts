import { tool } from "ai";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  createTrip,
  getUserTrips,
  createBooking,
  getUserBookings,
  updateUserPreferences,
  getUpcomingTrips,
  updateTripStatus,
  updateBookingStatus,
  deleteTrip,
  logSearchQuery,
  getRecentSearches,
  upsertUserByClerkId,
  createTimeline,
  getTimelineByTripId,
  createTimelineItem,
  updateTimelineItem,
  deleteTimelineItem,
  createTimelineAlternative,
  createTimelineLocation,
  updateTimelineMood,
  reorderTimelineItems,
  bulkCreateTimelineItems,
} from "../db";

export const databaseTool = tool({
  description:
    "Manage travel data including trips, bookings, timelines, and user preferences in the database",
  parameters: z.object({
    action: z.enum([
      "create_trip",
      "get_user_trips",
      "get_upcoming_trips",
      "update_trip_status",
      "delete_trip",
      "create_booking",
      "get_user_bookings",
      "update_booking_status",
      "update_user_preferences",
      "log_search",
      "get_recent_searches",
      "upsert_user",
      // Timeline actions
      "create_timeline",
      "get_timeline",
      "create_timeline_item",
      "update_timeline_item",
      "delete_timeline_item",
      "create_timeline_alternative",
      "create_timeline_location",
      "update_timeline_mood",
      "reorder_timeline_items",
      "bulk_create_timeline_items",
    ]),
    clerkUserId: z.string().optional(),
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    tripId: z.string().optional(),
    bookingId: z.string().optional(),
    timelineId: z.string().optional(),
    timelineItemId: z.string().optional(),

    // Trip data
    tripData: z
      .object({
        title: z.string(),
        description: z.string().optional(),
        destination: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      })
      .optional(),

    // Booking data
    bookingData: z
      .object({
        tripId: z.string().optional(),
        type: z.enum(["FLIGHT", "HOTEL", "RENTAL_CAR", "ACTIVITY", "OTHER"]),
        flightNumber: z.string().optional(),
        airline: z.string().optional(),
        departure: z.string().optional(),
        arrival: z.string().optional(),
        departureAirport: z.string().optional(),
        arrivalAirport: z.string().optional(),
        hotelName: z.string().optional(),
        checkIn: z.string().optional(),
        checkOut: z.string().optional(),
        roomType: z.string().optional(),
        totalAmount: z.number().optional(),
        currency: z.string().optional(),
        externalId: z.string().optional(),
        bookingData: z.record(z.unknown()).optional(),
      })
      .optional(),

    // Timeline data
    timelineData: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        mood: z.string().optional(),
      })
      .optional(),

    // Timeline item data
    timelineItemData: z
      .object({
        parentId: z.string().optional(),
        title: z.string(),
        description: z.string().optional(),
        type: z.enum([
          "FLIGHT",
          "STAY",
          "ACTIVITY",
          "DINING",
          "TRANSPORT",
          "FREE_TIME",
          "LOCATION_CHANGE",
          "CHECKPOINT",
          "CUSTOM",
        ]),
        startTime: z.string(),
        endTime: z.string().optional(),
        duration: z.number().optional(),
        locationId: z.string().optional(),
        order: z.number(),
        level: z.number().optional(),
        flightData: z.record(z.unknown()).optional(),
        stayData: z.record(z.unknown()).optional(),
        activityData: z.record(z.unknown()).optional(),
        preferences: z.record(z.unknown()).optional(),
        mood: z.string().optional(),
        isLocked: z.boolean().optional(),
      })
      .optional(),

    // Timeline item update data
    timelineItemUpdateData: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        duration: z.number().optional(),
        locationId: z.string().optional(),
        order: z.number().optional(),
        flightData: z.record(z.unknown()).optional(),
        stayData: z.record(z.unknown()).optional(),
        activityData: z.record(z.unknown()).optional(),
        preferences: z.record(z.unknown()).optional(),
        mood: z.string().optional(),
        isLocked: z.boolean().optional(),
        status: z
          .enum([
            "PLANNED",
            "BOOKED",
            "IN_PROGRESS",
            "COMPLETED",
            "CANCELLED",
            "ALTERNATIVE",
          ])
          .optional(),
      })
      .optional(),

    // Timeline alternative data
    timelineAlternativeData: z
      .object({
        title: z.string(),
        description: z.string().optional(),
        type: z.enum([
          "FLIGHT",
          "STAY",
          "ACTIVITY",
          "DINING",
          "TRANSPORT",
          "FREE_TIME",
          "LOCATION_CHANGE",
          "CHECKPOINT",
          "CUSTOM",
        ]),
        startTime: z.string(),
        endTime: z.string().optional(),
        duration: z.number().optional(),
        flightData: z.record(z.unknown()).optional(),
        stayData: z.record(z.unknown()).optional(),
        activityData: z.record(z.unknown()).optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        reason: z.string().optional(),
        score: z.number().optional(),
      })
      .optional(),

    // Timeline location data
    timelineLocationData: z
      .object({
        name: z.string(),
        city: z.string().optional(),
        country: z.string().optional(),
        iataCode: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        type: z.enum([
          "AIRPORT",
          "CITY",
          "HOTEL",
          "ATTRACTION",
          "RESTAURANT",
          "TRANSPORT_HUB",
          "CUSTOM",
        ]),
        description: z.string().optional(),
        timezone: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      })
      .optional(),

    // Bulk timeline items
    timelineItems: z
      .array(
        z.object({
          parentId: z.string().optional(),
          title: z.string(),
          description: z.string().optional(),
          type: z.enum([
            "FLIGHT",
            "STAY",
            "ACTIVITY",
            "DINING",
            "TRANSPORT",
            "FREE_TIME",
            "LOCATION_CHANGE",
            "CHECKPOINT",
            "CUSTOM",
          ]),
          startTime: z.string(),
          endTime: z.string().optional(),
          duration: z.number().optional(),
          locationId: z.string().optional(),
          order: z.number(),
          level: z.number().optional(),
          flightData: z.record(z.unknown()).optional(),
          stayData: z.record(z.unknown()).optional(),
          activityData: z.record(z.unknown()).optional(),
          preferences: z.record(z.unknown()).optional(),
          mood: z.string().optional(),
        })
      )
      .optional(),

    // Reorder data
    reorderData: z
      .array(
        z.object({
          id: z.string(),
          order: z.number(),
          parentId: z.string().optional(),
        })
      )
      .optional(),

    // User preferences
    preferences: z
      .object({
        preferredAirline: z.string().optional(),
        seatPreference: z.string().optional(),
        mealPreference: z.string().optional(),
        budgetRange: z.string().optional(),
      })
      .optional(),

    // Search query logging
    searchQuery: z.string().optional(),
    searchType: z
      .enum(["FLIGHT", "HOTEL", "DESTINATION", "ACTIVITY"])
      .optional(),
    searchResults: z.record(z.unknown()).optional(),

    // Status updates
    status: z
      .union([
        z.enum(["PLANNED", "BOOKED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
        z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]),
      ])
      .optional(),

    // Mood update
    mood: z.string().optional(),

    // Pagination
    limit: z.number().default(10),
  }),
  execute: async (params) => {
    const {
      action,
      clerkUserId,
      userEmail,
      userName,
      tripId,
      bookingId,
      timelineId,
      timelineItemId,
    } = params;

    try {
      switch (action) {
        case "upsert_user":
          if (!clerkUserId || !userEmail)
            throw new Error("Clerk user ID and email are required");
          return await upsertUserByClerkId(clerkUserId, userEmail, userName);

        case "create_trip":
          if (!clerkUserId || !params.tripData)
            throw new Error("Clerk user ID and trip data are required");
          return await createTrip(clerkUserId, {
            ...params.tripData,
            startDate: new Date(params.tripData.startDate),
            endDate: new Date(params.tripData.endDate),
          });

        case "get_user_trips":
          if (!clerkUserId) throw new Error("Clerk user ID is required");
          return await getUserTrips(clerkUserId);

        case "get_upcoming_trips":
          if (!clerkUserId) throw new Error("Clerk user ID is required");
          return await getUpcomingTrips(clerkUserId);

        case "update_trip_status":
          if (!tripId || !params.status)
            throw new Error("Trip ID and status are required");
          return await updateTripStatus(
            tripId,
            params.status as
              | "PLANNED"
              | "BOOKED"
              | "IN_PROGRESS"
              | "COMPLETED"
              | "CANCELLED"
          );

        case "delete_trip":
          if (!tripId || !clerkUserId)
            throw new Error("Trip ID and Clerk user ID are required");
          return await deleteTrip(tripId, clerkUserId);

        case "create_booking":
          if (!clerkUserId || !params.bookingData)
            throw new Error("Clerk user ID and booking data are required");

          const bookingDataProcessed = {
            clerkUserId,
            ...params.bookingData,
            departure: params.bookingData.departure
              ? new Date(params.bookingData.departure)
              : undefined,
            arrival: params.bookingData.arrival
              ? new Date(params.bookingData.arrival)
              : undefined,
            checkIn: params.bookingData.checkIn
              ? new Date(params.bookingData.checkIn)
              : undefined,
            checkOut: params.bookingData.checkOut
              ? new Date(params.bookingData.checkOut)
              : undefined,
            bookingData: params.bookingData.bookingData as
              | Prisma.InputJsonValue
              | undefined,
          };

          return await createBooking(bookingDataProcessed);

        case "get_user_bookings":
          if (!clerkUserId) throw new Error("Clerk user ID is required");
          return await getUserBookings(clerkUserId);

        case "update_booking_status":
          if (!bookingId || !params.status)
            throw new Error("Booking ID and status are required");
          return await updateBookingStatus(
            bookingId,
            params.status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
          );

        case "update_user_preferences":
          if (!clerkUserId || !params.preferences)
            throw new Error("Clerk user ID and preferences are required");
          return await updateUserPreferences(clerkUserId, params.preferences);

        case "log_search":
          if (!params.searchQuery || !params.searchType)
            throw new Error("Search query and type are required");
          return await logSearchQuery(
            params.searchQuery,
            params.searchType,
            params.searchResults,
            clerkUserId
          );

        case "get_recent_searches":
          return await getRecentSearches(clerkUserId, params.limit);

        // Timeline operations
        case "create_timeline":
          if (!tripId || !params.timelineData)
            throw new Error("Trip ID and timeline data are required");
          return await createTimeline(tripId, params.timelineData);

        case "get_timeline":
          if (!tripId || !clerkUserId)
            throw new Error("Trip ID and Clerk user ID are required");
          return await getTimelineByTripId(tripId, clerkUserId);

        case "create_timeline_item":
          if (!timelineId || !params.timelineItemData)
            throw new Error("Timeline ID and timeline item data are required");

          const timelineItemDataProcessed = {
            ...params.timelineItemData,
            startTime: new Date(params.timelineItemData.startTime),
            endTime: params.timelineItemData.endTime
              ? new Date(params.timelineItemData.endTime)
              : undefined,
            flightData: params.timelineItemData.flightData as
              | Prisma.InputJsonValue
              | undefined,
            stayData: params.timelineItemData.stayData as
              | Prisma.InputJsonValue
              | undefined,
            activityData: params.timelineItemData.activityData as
              | Prisma.InputJsonValue
              | undefined,
            preferences: params.timelineItemData.preferences as
              | Prisma.InputJsonValue
              | undefined,
          };

          return await createTimelineItem(
            timelineId,
            timelineItemDataProcessed
          );

        case "update_timeline_item":
          if (!timelineItemId || !params.timelineItemUpdateData)
            throw new Error("Timeline item ID and update data are required");

          const updateData = {
            ...params.timelineItemUpdateData,
            startTime: params.timelineItemUpdateData.startTime
              ? new Date(params.timelineItemUpdateData.startTime)
              : undefined,
            endTime: params.timelineItemUpdateData.endTime
              ? new Date(params.timelineItemUpdateData.endTime)
              : undefined,
            flightData: params.timelineItemUpdateData.flightData as
              | Prisma.InputJsonValue
              | undefined,
            stayData: params.timelineItemUpdateData.stayData as
              | Prisma.InputJsonValue
              | undefined,
            activityData: params.timelineItemUpdateData.activityData as
              | Prisma.InputJsonValue
              | undefined,
            preferences: params.timelineItemUpdateData.preferences as
              | Prisma.InputJsonValue
              | undefined,
          };

          return await updateTimelineItem(timelineItemId, updateData);

        case "delete_timeline_item":
          if (!timelineItemId) throw new Error("Timeline item ID is required");
          return await deleteTimelineItem(timelineItemId);

        case "create_timeline_alternative":
          if (!timelineItemId || !params.timelineAlternativeData)
            throw new Error(
              "Timeline item ID and alternative data are required"
            );

          const alternativeData = {
            ...params.timelineAlternativeData,
            startTime: new Date(params.timelineAlternativeData.startTime),
            endTime: params.timelineAlternativeData.endTime
              ? new Date(params.timelineAlternativeData.endTime)
              : undefined,
            flightData: params.timelineAlternativeData.flightData as
              | Prisma.InputJsonValue
              | undefined,
            stayData: params.timelineAlternativeData.stayData as
              | Prisma.InputJsonValue
              | undefined,
            activityData: params.timelineAlternativeData.activityData as
              | Prisma.InputJsonValue
              | undefined,
          };

          return await createTimelineAlternative(
            timelineItemId,
            alternativeData
          );

        case "create_timeline_location":
          if (!timelineId || !params.timelineLocationData)
            throw new Error("Timeline ID and location data are required");
          return await createTimelineLocation(
            timelineId,
            params.timelineLocationData
          );

        case "update_timeline_mood":
          if (!timelineId || !params.mood)
            throw new Error("Timeline ID and mood are required");
          return await updateTimelineMood(timelineId, params.mood);

        case "reorder_timeline_items":
          if (!timelineId || !params.reorderData)
            throw new Error("Timeline ID and reorder data are required");
          return await reorderTimelineItems(timelineId, params.reorderData);

        case "bulk_create_timeline_items":
          if (!timelineId || !params.timelineItems)
            throw new Error("Timeline ID and timeline items are required");

          const processedItems = params.timelineItems.map((item) => ({
            ...item,
            startTime: new Date(item.startTime),
            endTime: item.endTime ? new Date(item.endTime) : undefined,
            flightData: item.flightData as Prisma.InputJsonValue | undefined,
            stayData: item.stayData as Prisma.InputJsonValue | undefined,
            activityData: item.activityData as
              | Prisma.InputJsonValue
              | undefined,
            preferences: item.preferences as Prisma.InputJsonValue | undefined,
          }));

          return await bulkCreateTimelineItems(timelineId, processedItems);

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error("Database tool error:", error);
      throw error;
    }
  },
});
