import { unstable_cache } from "next/cache";
import { prisma } from "./client";
import { getInternalUserId } from "./users";

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
      tags: [`user-trips-${clerkUserId}`, "trips"],
      revalidate: false,
    }
  )(clerkUserId);
}

export async function getTripById(tripId: string, clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.trip.findUnique({
    where: {
      id: tripId,
      userId: internalUserId,
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
      userId: internalUserId,
    },
  });
}
