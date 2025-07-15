import { revalidateTag } from "next/cache";
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
  const timeline = await getTimeline(tripId);

  // Server action to be called from the client to refresh the timeline
  async function refreshTimeline() {
    "use server";
    revalidateTag(`timeline-${tripId}`);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 min-w-0 max-w-[100%] gap-4 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-hidden">
          <ChatDemo tripId={tripId} onToolCallFinished={refreshTimeline} />
        </div>
        <div className="flex-1 overflow-hidden mt-4">
          <MainTimeline timeline={timeline as TimelineData} />
        </div>
      </div>
    </div>
  );
} 