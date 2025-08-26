"use client";

import { useState, useEffect } from "react";

interface AITripSummaryProps {
  timeline: any;
  tripData?: any;
  tripId: string;
}

export function AITripSummaryNew({ timeline, tripData, tripId }: AITripSummaryProps) {
  // VERSION 2.0.1 - Force cache refresh
  const VERSION = "2.0.1";
  
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [cachedSummary, setCachedSummary] = useState<string | null>(null);
  const [timelineHash, setTimelineHash] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false); // Prevent multiple simultaneous calls

  // Debug component lifecycle
  useEffect(() => {
    console.log("🤖 AITripSummaryNew component MOUNTED - VERSION", VERSION);
    return () => {
      console.log("🤖 AITripSummaryNew component UNMOUNTED");
    };
  }, []);

  // Generate a hash of the timeline to detect changes
  const generateTimelineHash = (timeline: any) => {
    if (!timeline?.items) return "";
    
    const items = (timeline.items || []).map((item: any) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      startTime: item.startTime,
      duration: item.duration,
      description: item.description,
      // Include flight data for change detection
      flightData: item.flightData ? {
        slices: item.flightData.slices?.map((slice: any) => ({
          origin: slice.origin?.iata_code,
          destination: slice.destination?.iata_code,
          departure_datetime: slice.departure_datetime,
          arrival_datetime: slice.arrival_datetime,
        })),
        owner: item.flightData.owner?.name,
        total_amount: item.flightData.total_amount,
        total_currency: item.flightData.total_currency,
      } : null,
      // Include stay data for change detection
      stayData: item.stayData ? {
        id: item.stayData.id,
        name: item.stayData.name,
        location: item.stayData.location,
      } : null,
    }));
    
    return JSON.stringify(items);
  };

  const generateAISummary = async (forceRefresh = false) => {
    // Prevent multiple simultaneous API calls
    if (isGenerating) {
      console.log("🤖 Skipping generation - already in progress");
      return;
    }
    
    if (!timeline?.items || timeline.items.length === 0) {
      setSummary("No timeline items yet. Start planning your trip to see an AI-generated summary!");
      return;
    }

    // Generate current timeline hash
    const currentHash = generateTimelineHash(timeline);
    
    // Check if we have a cached summary for this exact timeline (unless forcing refresh)
    console.log("🤖 Cache check:", {
      hasCachedSummary: !!cachedSummary,
      cachedSummaryLength: cachedSummary?.length || 0,
      currentHash: currentHash.substring(0, 100) + "...",
      timelineHash: timelineHash.substring(0, 100) + "...",
      hashesMatch: currentHash === timelineHash,
      forceRefresh,
      willUseCache: !forceRefresh && !!cachedSummary && currentHash === timelineHash
    });
    
    if (!forceRefresh && cachedSummary && currentHash === timelineHash) {
      console.log("🤖 Using cached AI summary - no timeline changes detected");
      setSummary(cachedSummary);
      return;
    }

    console.log("🤖 Generating new AI summary...", forceRefresh ? "(forced refresh)" : "(timeline changed)");
    setIsLoading(true);
    setIsGenerating(true);
    try {
      console.log("🤖 Starting AI summary generation...");
      
      // Prepare minimal timeline data for AI analysis (much smaller token usage)
      const timelineData = (timeline.items || []).map((item: any) => ({
        type: item.type,
        title: item.title,
        startTime: item.startTime,
        duration: item.duration,
        // Only include essential flight info
        ...(item.type === 'FLIGHT' && item.flightData ? {
          from: item.flightData.slices?.[0]?.origin?.iata_code,
          to: item.flightData.slices?.[0]?.destination?.iata_code,
          airline: item.flightData.owner?.name,
          price: item.flightData.total_amount ? `${item.flightData.total_currency} ${item.flightData.total_amount}` : null
        } : {}),
        // Only include essential stay info
        ...(item.type === 'STAY' && item.stayData ? {
          name: item.stayData.name,
          location: item.stayData.location?.address
        } : {})
      }));

      // Create a much shorter prompt for the AI
      const prompt = `[VERSION ${VERSION}] Summarize this trip in 2-3 sentences:

Flights: ${timelineData.filter((item: any) => item.type === 'FLIGHT').map((f: any) => `${f.from}→${f.to} on ${new Date(f.startTime).toLocaleDateString()} (${f.airline}, ${f.price})`).join(', ') || 'None'}
Stays: ${timelineData.filter((item: any) => item.type === 'STAY').map((s: any) => `${s.name} on ${new Date(s.startTime).toLocaleDateString()}`).join(', ') || 'None'}
Activities: ${timelineData.filter((item: any) => item.type === 'ACTIVITY').map((a: any) => `${a.title} on ${new Date(a.startTime).toLocaleDateString()}`).join(', ') || 'None planned'}

Be conversational and mention destination, key flights with dates, and any notable details.`;

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
          tripId: tripId,
          model: 'command-r-plus' // Use cheaper model for summaries
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
        const cleanedResponse = aiResponse
          .replace(/\[VERSION \d+\.\d+\.\d+\]/g, '') // Remove version tag
          .replace(/\n+/g, ' ') // Replace multiple newlines with single space
          .trim();

        console.log("🤖 Cleaned AI response:", cleanedResponse);
        
        // Cache the successful response
        setCachedSummary(cleanedResponse);
        setTimelineHash(currentHash);
        setSummary(cleanedResponse);
        console.log("🤖 Caching AI summary");
      } else {
        throw new Error('Empty AI response');
      }
    } catch (error) {
      console.error("🤖 Error generating AI summary:", error);
      setError(error instanceof Error ? error.message : 'Failed to generate summary');
      
      // Fallback to basic summary
              const basicSummary = generateBasicSummary(timeline.items || [], tripData);
      setSummary(basicSummary);
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  // Effect to generate summary when timeline changes
  useEffect(() => {
    console.log("🤖 useEffect triggered - timeline changed");
    generateAISummary();
  }, [timeline?.id, timeline?.items?.length, tripId]);

  const generateBasicSummary = (items: any[], tripData: any) => {
    if (!items || items.length === 0) {
      return "No timeline items yet. Start planning your trip to see an AI-generated summary!";
    }

    const flights = items.filter((item: any) => item.type === 'FLIGHT');
    const stays = items.filter((item: any) => item.type === 'STAY');
    const activities = items.filter((item: any) => item.type === 'ACTIVITY');

    let summary = "Your trip includes: ";
    
    if (flights.length > 0) {
      summary += `${flights.length} flight${flights.length > 1 ? 's' : ''}`;
    }
    
    if (stays.length > 0) {
      summary += `${summary.includes('flight') ? ', ' : ''}${stays.length} accommodation${stays.length > 1 ? 's' : ''}`;
    }
    
    if (activities.length > 0) {
      summary += `${summary.includes('flight') || summary.includes('accommodation') ? ', ' : ''}${activities.length} activit${activities.length > 1 ? 'ies' : 'y'}`;
    }

    if (flights.length === 0 && stays.length === 0 && activities.length === 0) {
      summary = "No timeline items yet. Start planning your trip to see an AI-generated summary!";
    }

    return summary;
  };

  const handleManualRefresh = () => {
    console.log("🤖 Manual refresh requested");
    generateAISummary(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">AI Trip Summary</h3>
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        <div className="text-sm text-gray-600">
          <div className="animate-pulse">Generating AI summary...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Trip Summary</h3>
        <button
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          Error: {error}
        </div>
      )}
      
      <div className="text-sm text-gray-700 leading-relaxed">
        {summary}
      </div>
    </div>
  );
} 