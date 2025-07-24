import { ChatDemo } from "@/components/chat-demo";
import MainTimeline from "@/components/main-timeline";
import { getTimeline } from "@/app/server/actions/get-timeline";
import type { TimelineData } from "@/components/main-timeline";

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  
  console.log(`📋 Loading discover page for trip: ${tripId}`);
  
  const timeline = await getTimeline(tripId);
  
  console.log(`📋 Timeline loaded:`, {
    found: !!timeline,
    itemsCount: timeline?.items?.length || 0,
    source: 'SERVER_SIDE_INITIAL_LOAD'
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 min-w-0 max-w-[100%] gap-4 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-hidden">
          {/* Pass tripId to ChatDemo for auto-refresh */}
          <ChatDemo tripId={tripId} />
        </div>
        <div className="flex-1 overflow-hidden mt-4">
          <MainTimeline timeline={timeline as TimelineData} tripId={tripId} />
        </div>
      </div>
    </div>
  );
}