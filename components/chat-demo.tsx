"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { Chat } from "@/components/ui/chat";
import type { Message } from "ai";

interface ChatDemoProps {
  tripId: string;
  onToolCallFinished?: () => void;
}

export function ChatDemo({ tripId, onToolCallFinished }: ChatDemoProps) {
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
  });

  const prevMessagesRef = useRef<Message[]>([]);

  useEffect(() => {
    // Check if the last message is from a tool and the previous message was not
    if (
      messages.length > prevMessagesRef.current.length &&
      messages[messages.length - 1]?.role === "tool"
    ) {
      onToolCallFinished?.();
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
