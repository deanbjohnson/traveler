"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { Chat } from "@/components/ui/chat";
import type { Message } from "ai";

interface ChatDemoProps {
  tripId: string;
  onToolCallFinished?: () => void;
}

export function ChatDemo({ tripId, onToolCallFinished }: ChatDemoProps) {
  const router = useRouter();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
  } = useChat({
    body: {
      tripId,
    },
    onFinish: async (message) => {
      // Check if any tool calls were timeline-related
      const toolInvocations = message.toolInvocations || [];
      const hasTimelineUpdate = toolInvocations.some(
        (call: any) => call.toolName === 'addToTimeline'
      );
      
      if (hasTimelineUpdate) {
        console.log('✅ Timeline update detected - refreshing with router.refresh()');
        router.refresh();
      }
    },
  });

  const prevMessagesRef = useRef<Message[]>([]);

  useEffect(() => {
    // Check if messages length increased
    if (messages.length > prevMessagesRef.current.length) {
      const lastMessage = messages[messages.length - 1];
      const messageAny = lastMessage as any;
      
      if (messageAny?.role === "tool" || 
          messageAny?.toolInvocations?.length > 0) {
        console.log('🔧 Tool message detected');
        onToolCallFinished?.();
      }
    }
    prevMessagesRef.current = messages;
  }, [messages, onToolCallFinished]);

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-full p-4">
      <Chat
        messages={messages}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isGenerating={isLoading}
        stop={stop}
        className="flex-1"
      />
    </div>
  );
}