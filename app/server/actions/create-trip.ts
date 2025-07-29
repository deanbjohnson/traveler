"use server";

import { auth } from "@clerk/nextjs/server";
import { createTrip, ensureUserExists } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { addDays } from "date-fns";

export async function createNewTrip() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  // Ensure user exists in database
  await ensureUserExists(userId);

  // Create a new trip with default values
  const trip = await createTrip(userId, {
    title: "My New Trip",
    description: "Plan your perfect adventure",
    destination: "To be determined",
    startDate: new Date(),
    endDate: addDays(new Date(), 7), // Default to 7 days from now
  });

  // Invalidate cache so the new trip appears on the dashboard
  try {
    revalidatePath("/");
    revalidateTag(`user-trips-${userId}`);
    revalidateTag('trips');
  } catch (e) {
    console.warn("[CREATE-TRIP] Could not invalidate cache after trip creation", e);
  }

  // Redirect to the specific trip page
  redirect(`/discover/${trip.id}`);
}
