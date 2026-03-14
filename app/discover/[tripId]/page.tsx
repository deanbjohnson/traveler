import { ChatDemo } from "@/components/chat-demo";
import MainTimeline from "@/components/main-timeline";
import { TripTabs } from "@/components/ui/trip-tabs";
import { getTimeline } from "@/app/actions/get-timeline";
import { getTripById } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import type { TimelineData } from "@/components/main-timeline";

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { userId } = await auth();

  const timeline = await getTimeline(tripId);
  const tripData = userId ? await getTripById(tripId, userId) : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <TripTabs 
        tripId={tripId} 
        timeline={timeline as TimelineData} 
        tripData={tripData}
      />
    </div>
  );
}