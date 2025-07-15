import { ChatDemo } from "@/components/chat-demo"
import MainTimeline from "@/components/main-timeline"

export default function DiscoverPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 min-w-0 max-w-[100%] gap-4 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-hidden">
          <ChatDemo />
        </div>
        <div className="flex-1 overflow-hidden mt-4">
          <MainTimeline />
        </div>
      </div>
    </div>
  )
} 