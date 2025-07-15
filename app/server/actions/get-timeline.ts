"use server";

import { auth } from "@clerk/nextjs/server";
import { getTimelineByTripId } from "@/lib/db";
import { unstable_cache as cache } from "next/cache";
import type { TimelineData } from "@/components/main-timeline";

export async function getTimeline(
  tripId: string
): Promise<TimelineData | null> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Using unstable_cache to cache the timeline data
  const getCachedTimeline = cache(
    async (id: string, uId: string) => {
      const timeline = await getTimelineByTripId(id, uId);
      // The data from Prisma has Date objects, which are not serializable
      // for client components. We need to ensure they are handled correctly.
      // However, since this is a server action used in a server component,
      // we can pass the dates directly.
      return timeline as unknown as TimelineData | null;
    },
    [`timeline-${tripId}`], // Cache key
    {
      tags: [`timeline-${tripId}`], // Tag for revalidation
      revalidate: 3600, // Revalidate every hour
    }
  );

  return getCachedTimeline(tripId, userId);
}
