"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface AITripSummaryProps {
  timeline: any;
  tripData?: any;
  tripId: string;
}

export function AITripSummary({ timeline, tripData, tripId }: AITripSummaryProps) {
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const generateAISummary = async () => {
    if (!timeline?.items || timeline.items.length === 0) {
      setSummary("No timeline items yet. Start planning your trip to see an AI-generated summary!");
      return;
    }

    setIsLoading(true);
    try {
      console.log("🤖 Starting AI summary generation...");
      
      // Prepare the timeline data for AI analysis
      const timelineData = timeline.items.map((item: any) => ({
        type: item.type,
        title: item.title,
        startTime: item.startTime,
        duration: item.duration,
        description: item.description,
        flightDetails: item.flightData ? {
          from: item.flightData.slices?.[0]?.origin?.name || item.flightData.slices?.[0]?.origin?.iata_code,
          to: item.flightData.slices?.[0]?.destination?.name || item.flightData.slices?.[0]?.destination?.iata_code,
          airline: item.flightData.owner?.name,
          price: item.flightData.total_amount ? `${item.flightData.total_currency} ${item.flightData.total_amount}` : null
        } : null
      }));

      // Create a prompt for the AI
      const prompt = `Please analyze this trip data and provide a natural, helpful summary of the trip. Here's the timeline data:

${JSON.stringify(timelineData, null, 2)}

Trip details: ${JSON.stringify(tripData, null, 2)}

Please provide a concise, natural summary that includes:
- Where the person is traveling
- Key flights and their details
- Accommodations if any
- Activities if any
- Trip duration (only if you can determine it from actual flights/events, not from default trip dates)
- Any notable details

IMPORTANT: Do not assume trip duration from default trip start/end dates. Only mention duration if you can calculate it from actual timeline items (like return flights, hotel stays, etc.). For one-way flights without return flights or accommodations, do not mention trip duration.

Make it conversational and helpful, like you're explaining the trip to a friend. Keep it under 3 sentences.`;

      console.log("🤖 Sending request to AI with prompt:", prompt);

      // Call the chat API to generate the summary
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          tripId: tripId
        }),
      });

      console.log("🤖 API response status:", response.status);

      if (!response.ok) {
        console.error("🤖 API request failed:", response.status, response.statusText);
        throw new Error('Failed to generate AI summary');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        console.error("🤖 No response body available");
        throw new Error('No response body');
      }

      let aiResponse = '';
      const decoder = new TextDecoder();

      console.log("🤖 Starting to read streaming response...");

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          console.log("🤖 Received chunk:", chunk);
          const lines = chunk.split('\n');

          for (const line of lines) {
            // Handle the actual streaming format: 0:"character"
            if (line.includes(':"') && line.includes('"')) {
              try {
                // Extract the character from format like 0:"a" or 0:" "
                const match = line.match(/"([^"]*)"/);
                if (match && match[1]) {
                  // Skip metadata fields that shouldn't be part of the text
                  const text = match[1];
                  if (text === 'messageId' || text === 'finishReason' || text === 'usage' || text === 'promptTokens' || text === 'completionTokens' || text === 'isContinued') {
                    console.log("🤖 Skipping metadata:", text);
                    continue;
                  }
                  
                  // Skip if this looks like JSON metadata
                  if (text.startsWith('{') || text.startsWith('}') || text.includes(':')) {
                    console.log("🤖 Skipping JSON metadata:", text);
                    continue;
                  }
                  
                  aiResponse += match[1];
                  console.log("🤖 Added character:", match[1]);
                }
              } catch (e) {
                console.log("🤖 Skipping invalid line:", line);
              }
            } else if (line.startsWith('e:') || line.startsWith('d:')) {
              // End of stream markers
              console.log("🤖 End of stream detected");
              break;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      console.log("🤖 Final AI response:", aiResponse);

      if (aiResponse.trim()) {
        // Clean up any remaining metadata that might have slipped through
        let cleanResponse = aiResponse.trim();
        
        // Remove common metadata patterns
        cleanResponse = cleanResponse.replace(/messageId/g, '');
        cleanResponse = cleanResponse.replace(/finishReason/g, '');
        cleanResponse = cleanResponse.replace(/usage/g, '');
        cleanResponse = cleanResponse.replace(/promptTokens/g, '');
        cleanResponse = cleanResponse.replace(/completionTokens/g, '');
        cleanResponse = cleanResponse.replace(/isContinued/g, '');
        
        // Remove any JSON-like patterns
        cleanResponse = cleanResponse.replace(/\{[^}]*\}/g, '');
        cleanResponse = cleanResponse.replace(/"[^"]*":\s*[^,\s]+/g, '');
        
        // Clean up extra whitespace
        cleanResponse = cleanResponse.replace(/\s+/g, ' ').trim();
        
        console.log("🤖 Cleaned AI response:", cleanResponse);
        
        if (cleanResponse.length > 10) { // Only use if we have substantial content
          console.log("🤖 Using AI-generated summary");
          setSummary(cleanResponse);
        } else {
          console.log("🤖 Cleaned response too short, falling back to basic summary");
          setSummary(generateBasicSummary(timelineData, tripData));
        }
      } else {
        console.log("🤖 No AI response, falling back to basic summary");
        setSummary(generateBasicSummary(timelineData, tripData));
      }

    } catch (error) {
      console.error("Error generating AI summary:", error);
      console.log("🤖 Error occurred, falling back to basic summary");
      // Fallback to basic summary
      const timelineData = timeline.items.map((item: any) => ({
        type: item.type,
        title: item.title,
        startTime: item.startTime,
        duration: item.duration,
        description: item.description,
        flightDetails: item.flightData ? {
          from: item.flightData.slices?.[0]?.origin?.name || item.flightData.slices?.[0]?.origin?.iata_code,
          to: item.flightData.slices?.[0]?.destination?.name || item.flightData.slices?.[0]?.destination?.iata_code,
          airline: item.flightData.owner?.name,
          price: item.flightData.total_amount ? `${item.flightData.total_currency} ${item.flightData.total_amount}` : null
        } : null
      }));
      setSummary(generateBasicSummary(timelineData, tripData));
    } finally {
      setIsLoading(false);
    }
  };

  const generateBasicSummary = (items: any[], tripData: any) => {
    if (items.length === 0) {
      return "No timeline items yet. Start planning your trip!";
    }

    const flights = items.filter(item => item.type === 'FLIGHT');
    const stays = items.filter(item => item.type === 'STAY');
    const activities = items.filter(item => item.type === 'ACTIVITY');
    const transport = items.filter(item => item.type === 'TRANSPORT');

    let summary = "";

    // Trip overview
    if (tripData?.destination && tripData.destination !== "To be determined") {
      summary += `You're planning a trip to ${tripData.destination}. `;
    } else if (flights.length > 0) {
      const destinations = flights.map(f => f.flightDetails?.to).filter(Boolean);
      if (destinations.length > 0) {
        summary += `You're traveling to ${destinations[destinations.length - 1]}. `;
      }
    }

    // Flight summary
    if (flights.length > 0) {
      if (flights.length === 1) {
        const flight = flights[0];
        summary += `You have one flight booked: ${flight.flightDetails?.airline || 'Unknown airline'} from ${flight.flightDetails?.from || 'Unknown'} to ${flight.flightDetails?.to || 'Unknown'}`;
        if (flight.flightDetails?.price) {
          summary += ` for ${flight.flightDetails.price}`;
        }
        summary += ". ";
      } else {
        summary += `You have ${flights.length} flights booked. `;
      }
    }

    // Stay summary
    if (stays.length > 0) {
      if (stays.length === 1) {
        summary += `You have one accommodation booked. `;
      } else {
        summary += `You have ${stays.length} accommodations booked. `;
      }
    }

    // Activities summary
    if (activities.length > 0) {
      if (activities.length === 1) {
        summary += `You have one activity planned. `;
      } else {
        summary += `You have ${activities.length} activities planned. `;
      }
    }

    // Transport summary
    if (transport.length > 0) {
      if (transport.length === 1) {
        summary += `You have one transportation option booked. `;
      } else {
        summary += `You have ${transport.length} transportation options booked. `;
      }
    }

    // Note: Removed trip duration calculation since it uses default trip dates, not actual flight dates
    // For one-way flights without return flights or accommodations, duration is unknown

    // Total items
    summary += `In total, you have ${items.length} items in your itinerary.`;

    return summary;
  };

  useEffect(() => {
    generateAISummary();
  }, [timeline, tripData, tripId]);

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-400" />
          AI Trip Summary
        </h3>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
      
      <div className="prose prose-invert max-w-none">
        <p className="text-gray-300 leading-relaxed">
          {summary || "Generating AI summary..."}
        </p>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {timeline?.items?.filter((item: any) => item.type === 'FLIGHT').length || 0}
            </div>
            <div className="text-gray-400">Flights</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {timeline?.items?.filter((item: any) => item.type === 'STAY').length || 0}
            </div>
            <div className="text-gray-400">Stays</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {timeline?.items?.filter((item: any) => item.type === 'ACTIVITY').length || 0}
            </div>
            <div className="text-gray-400">Activities</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {timeline?.items?.length || 0}
            </div>
            <div className="text-gray-400">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
} 