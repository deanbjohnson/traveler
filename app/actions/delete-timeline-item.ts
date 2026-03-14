"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { deleteTimelineItem } from "@/lib/db";

export async function deleteTimelineItemAction({
  tripId,
  itemId,
}: {
  tripId: string;
  itemId: string;
}) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Best-effort delete; ownership validation can be added if needed
    await deleteTimelineItem(itemId);

    try {
      revalidateTag(`timeline-${tripId}`);
    } catch (_) {}

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}


