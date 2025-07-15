"use client"

import { useChat } from "ai/react"

import { Chat } from "@/components/ui/chat"

export function ChatDemo() {
    const { messages, input, handleInputChange, handleSubmit, status, stop } =
        useChat()

    const isLoading = status === "submitted" || status === "streaming"

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
    )
} 
