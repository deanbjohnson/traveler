import type { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { getInternalUserId } from "./users";

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
