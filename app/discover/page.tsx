import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getUserTrips, ensureUserExists } from "@/lib/db";

/** /discover without tripId: redirect to latest trip or home if none. */
export default async function DiscoverPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  await ensureUserExists(userId);
  const trips = await getUserTrips(userId);

  if (trips.length === 0) {
    redirect("/");
  }

  redirect(`/discover/${trips[0].id}`);
}
