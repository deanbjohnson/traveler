import { cohere } from "@ai-sdk/cohere";
import { streamText } from "ai";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { timelineData, tripData } = body;

    console.log("📝 [SUMMARIZE] Received summary request");
    console.log("📝 [SUMMARIZE] Timeline items:", timelineData?.length || 0);
    console.log("📝 [SUMMARIZE] Timeline data sample:", timelineData?.[0] ? {
      type: timelineData[0].type,
      title: timelineData[0].title,
      hasFlightData: !!timelineData[0].flightData,
      flightDataKeys: timelineData[0].flightData ? Object.keys(timelineData[0].flightData) : []
    } : 'No timeline data');
    console.log("📝 [SUMMARIZE] Trip data sample:", {
      id: tripData?.id,
      title: tripData?.title,
      destination: tripData?.destination
    });

    // Check if data is JSON-safe
    try {
      JSON.stringify(timelineData);
      JSON.stringify(tripData);
      console.log("📝 [SUMMARIZE] Data validation: JSON safe");
    } catch (jsonError) {
      console.error("📝 [SUMMARIZE] Data validation failed:", jsonError);
      return new Response("Invalid data format", { status: 400 });
    }

    const result = streamText({
      model: cohere("command-a-03-2025"),
      maxSteps: 1, // No tools needed
      system: `You are a helpful assistant. Provide a simple, friendly response.`,
      messages: [
        {
          role: 'user',
          content: `You have ${timelineData?.length || 0} trip items. Write a simple 2-sentence summary of what you see.`
        }
      ],
    });

    console.log("📝 [SUMMARIZE] StreamText initialized successfully");

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("📝 [SUMMARIZE] Error:", error);
    return new Response("Failed to generate summary", { status: 500 });
  }
} 