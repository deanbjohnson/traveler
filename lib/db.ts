import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Helper function to ensure user exists in database with full Clerk info
export async function ensureUserExists(clerkUserId: string) {
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existingUser) {
      return existingUser;
    }

    // Get full user info from Clerk
    const clerkUser = await currentUser();

    if (!clerkUser) {
      throw new Error(`No Clerk user found for ID: ${clerkUserId}`);
    }

    // Create user with full info
    return await upsertUserByClerkId(
      clerkUserId,
      clerkUser.primaryEmailAddress?.emailAddress || "",
      clerkUser.fullName || undefined
    );
  } catch (error) {
    console.error("Error ensuring user exists:", error);
    throw error;
  }
}

// Helper function to get internal user ID from Clerk user ID
async function getInternalUserId(clerkUserId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found for Clerk ID: ${clerkUserId}`);
  }

  return user.id;
}

// Database utility functions
export async function getUser(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      preferences: true,
      trips: {
        include: {
          bookings: true,
        },
      },
    },
  });
}

export async function getUserByClerkId(clerkUserId: string) {
  return await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      preferences: true,
      trips: {
        include: {
          bookings: true,
        },
      },
    },
  });
}

export async function createUser(email: string, name?: string) {
  return await prisma.user.create({
    data: {
      email,
      name,
    },
  });
}

export async function upsertUser(email: string, name?: string) {
  return await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
}

export async function upsertUserByClerkId(
  clerkUserId: string,
  email: string,
  name?: string
) {
  return await prisma.user.upsert({
    where: { clerkUserId },
    update: { email, name },
    create: { clerkUserId, email, name },
  });
}

export async function createTrip(
  clerkUserId: string,
  data: {
    title: string;
    description?: string;
    destination: string;
    startDate: Date;
    endDate: Date;
  }
) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.trip.create({
    data: {
      userId: internalUserId,
      ...data,
    },
  });
}

export async function getUserTrips(clerkUserId: string) {
  return unstable_cache(
    async (clerkUserId: string) => {
      const internalUserId = await getInternalUserId(clerkUserId);

      return await prisma.trip.findMany({
        where: { userId: internalUserId },
        include: {
          bookings: true,
          timeline: {
            include: {
              items: {
                include: {
                  alternatives: true,
                  location: true,
                  children: true,
                },
                orderBy: [{ level: "asc" }, { order: "asc" }],
              },
              locations: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    },
    [`user-trips-${clerkUserId}`],
    {
      tags: [`user-trips-${clerkUserId}`, 'trips'],
      revalidate: false, // No cache, always fresh
    }
  )(clerkUserId);
}

export async function createBooking(data: {
  clerkUserId: string;
  tripId?: string;
  type: "FLIGHT" | "HOTEL" | "RENTAL_CAR" | "ACTIVITY" | "OTHER";
  flightNumber?: string;
  airline?: string;
  departure?: Date;
  arrival?: Date;
  departureAirport?: string;
  arrivalAirport?: string;
  hotelName?: string;
  checkIn?: Date;
  checkOut?: Date;
  roomType?: string;
  totalAmount?: number;
  currency?: string;
  externalId?: string;
  bookingData?: Prisma.InputJsonValue;
}) {
  const internalUserId = await getInternalUserId(data.clerkUserId);

  return await prisma.booking.create({
    data: {
      userId: internalUserId,
      tripId: data.tripId,
      type: data.type,
      flightNumber: data.flightNumber,
      airline: data.airline,
      departure: data.departure,
      arrival: data.arrival,
      departureAirport: data.departureAirport,
      arrivalAirport: data.arrivalAirport,
      hotelName: data.hotelName,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      roomType: data.roomType,
      totalAmount: data.totalAmount,
      currency: data.currency,
      externalId: data.externalId,
      bookingData: data.bookingData,
    },
  });
}

export async function getUserBookings(clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.booking.findMany({
    where: { userId: internalUserId },
    include: {
      trip: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function logSearchQuery(
  query: string,
  type: "FLIGHT" | "HOTEL" | "DESTINATION" | "ACTIVITY",
  results?: Record<string, unknown>,
  clerkUserId?: string
) {
  let internalUserId: string | undefined;

  if (clerkUserId) {
    try {
      internalUserId = await getInternalUserId(clerkUserId);
    } catch {
      // If user not found, log without userId
      console.warn(`User not found for search query logging: ${clerkUserId}`);
    }
  }

  return await prisma.searchQuery.create({
    data: {
      userId: internalUserId,
      query,
      type,
      results: results ? JSON.stringify(results) : undefined,
    },
  });
}

export async function updateUserPreferences(
  clerkUserId: string,
  preferences: {
    preferredAirline?: string;
    seatPreference?: string;
    mealPreference?: string;
    budgetRange?: string;
  }
) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.userPreferences.upsert({
    where: { userId: internalUserId },
    update: preferences,
    create: {
      userId: internalUserId,
      ...preferences,
    },
  });
}

export async function getRecentSearches(clerkUserId?: string, limit = 10) {
  let internalUserId: string | undefined;

  if (clerkUserId) {
    try {
      internalUserId = await getInternalUserId(clerkUserId);
    } catch {
      // If user not found, return empty array
      return [];
    }
  }

  return await prisma.searchQuery.findMany({
    where: internalUserId ? { userId: internalUserId } : {},
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

export async function getUpcomingTrips(clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.trip.findMany({
    where: {
      userId: internalUserId,
      startDate: {
        gte: new Date(),
      },
    },
    include: {
      bookings: true,
      timeline: {
        include: {
          items: {
            include: {
              alternatives: true,
              location: true,
              children: true,
            },
            orderBy: [{ level: "asc" }, { order: "asc" }],
          },
          locations: true,
        },
      },
    },
    orderBy: {
      startDate: "asc",
    },
  });
}

export async function getTripById(tripId: string, clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.trip.findUnique({
    where: {
      id: tripId,
      userId: internalUserId, // Ensure user owns the trip
    },
    include: {
      bookings: true,
      timeline: {
        include: {
          items: {
            include: {
              alternatives: true,
              location: true,
              children: true,
            },
            orderBy: [{ level: "asc" }, { order: "asc" }],
          },
          locations: true,
        },
      },
    },
  });
}

export async function updateTripStatus(
  tripId: string,
  status: "PLANNED" | "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
) {
  return await prisma.trip.update({
    where: { id: tripId },
    data: { status },
  });
}

export async function deleteTrip(tripId: string, clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.trip.delete({
    where: {
      id: tripId,
      userId: internalUserId, // Ensure user owns the trip
    },
  });
}

export async function getBookingById(bookingId: string, clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: internalUserId, // Ensure user owns the booking
    },
    include: {
      trip: true,
    },
  });
}

export async function updateBookingStatus(
  bookingId: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
) {
  return await prisma.booking.update({
    where: { id: bookingId },
    data: { status },
  });
}

// Timeline-related functions
export async function createTimeline(
  tripId: string,
  data: {
    title?: string;
    description?: string;
    mood?: string;
  }
) {
  return await prisma.timeline.create({
    data: {
      tripId,
      ...data,
    },
  });
}

export async function getTimelineByTripId(tripId: string, clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  // First ensure user owns the trip
  const trip = await prisma.trip.findUnique({
    where: {
      id: tripId,
      userId: internalUserId,
    },
  });

  if (!trip) {
    throw new Error("Trip not found or unauthorized");
  }

  return await prisma.timeline.findUnique({
    where: { tripId },
    include: {
      items: {
        include: {
          alternatives: true,
          location: true,
          children: {
            include: {
              alternatives: true,
              location: true,
              children: true,
            },
          },
        },
        orderBy: [{ level: "asc" }, { order: "asc" }],
      },
      locations: true,
    },
  });
}

export async function createTimelineItem(
  timelineId: string,
  data: {
    parentId?: string;
    title: string;
    description?: string;
    type:
      | "FLIGHT"
      | "STAY"
      | "ACTIVITY"
      | "DINING"
      | "TRANSPORT"
      | "FREE_TIME"
      | "LOCATION_CHANGE"
      | "CHECKPOINT"
      | "CUSTOM";
    startTime: Date;
    endTime?: Date;
    duration?: number;
    locationId?: string;
    order: number;
    level?: number;
    flightData?: Prisma.InputJsonValue;
    stayData?: Prisma.InputJsonValue;
    activityData?: Prisma.InputJsonValue;
    preferences?: Prisma.InputJsonValue;
    mood?: string;
    isLocked?: boolean;
  }
) {
  return await prisma.timelineItem.create({
    data: {
      timelineId,
      ...data,
    },
  });
}

export async function updateTimelineItem(
  itemId: string,
  data: {
    title?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    locationId?: string;
    order?: number;
    flightData?: Prisma.InputJsonValue;
    stayData?: Prisma.InputJsonValue;
    activityData?: Prisma.InputJsonValue;
    preferences?: Prisma.InputJsonValue;
    mood?: string;
    isLocked?: boolean;
    status?:
      | "PLANNED"
      | "BOOKED"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "CANCELLED"
      | "ALTERNATIVE";
  }
) {
  return await prisma.timelineItem.update({
    where: { id: itemId },
    data,
  });
}

export async function deleteTimelineItem(itemId: string) {
  return await prisma.timelineItem.delete({
    where: { id: itemId },
  });
}

export async function createTimelineAlternative(
  timelineItemId: string,
  data: {
    title: string;
    description?: string;
    type:
      | "FLIGHT"
      | "STAY"
      | "ACTIVITY"
      | "DINING"
      | "TRANSPORT"
      | "FREE_TIME"
      | "LOCATION_CHANGE"
      | "CHECKPOINT"
      | "CUSTOM";
    startTime: Date;
    endTime?: Date;
    duration?: number;
    flightData?: Prisma.InputJsonValue;
    stayData?: Prisma.InputJsonValue;
    activityData?: Prisma.InputJsonValue;
    price?: number;
    currency?: string;
    reason?: string;
    score?: number;
  }
) {
  return await prisma.timelineAlternative.create({
    data: {
      timelineItemId,
      ...data,
    },
  });
}

export async function createTimelineLocation(
  timelineId: string,
  data: {
    name: string;
    city?: string;
    country?: string;
    iataCode?: string;
    latitude?: number;
    longitude?: number;
    type:
      | "AIRPORT"
      | "CITY"
      | "HOTEL"
      | "ATTRACTION"
      | "RESTAURANT"
      | "TRANSPORT_HUB"
      | "CUSTOM";
    description?: string;
    timezone?: string;
    color?: string;
    icon?: string;
  }
) {
  return await prisma.timelineLocation.create({
    data: {
      timelineId,
      ...data,
    },
  });
}

export async function updateTimelineMood(timelineId: string, mood: string) {
  return await prisma.timeline.update({
    where: { id: timelineId },
    data: { mood },
  });
}

export async function reorderTimelineItems(
  timelineId: string,
  items: { id: string; order: number; parentId?: string }[]
) {
  return await prisma.$transaction(
    items.map((item) =>
      prisma.timelineItem.update({
        where: { id: item.id },
        data: {
          order: item.order,
          parentId: item.parentId || null,
        },
      })
    )
  );
}

export async function bulkCreateTimelineItems(
  timelineId: string,
  items: Array<{
    parentId?: string;
    title: string;
    description?: string;
    type:
      | "FLIGHT"
      | "STAY"
      | "ACTIVITY"
      | "DINING"
      | "TRANSPORT"
      | "FREE_TIME"
      | "LOCATION_CHANGE"
      | "CHECKPOINT"
      | "CUSTOM";
    startTime: Date;
    endTime?: Date;
    duration?: number;
    locationId?: string;
    order: number;
    level?: number;
    flightData?: Prisma.InputJsonValue;
    stayData?: Prisma.InputJsonValue;
    activityData?: Prisma.InputJsonValue;
    preferences?: Prisma.InputJsonValue;
    mood?: string;
  }>
) {
  return await prisma.timelineItem.createMany({
    data: items.map((item) => ({
      timelineId,
      ...item,
    })),
  });
}
