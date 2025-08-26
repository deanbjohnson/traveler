"use client";

import { useState, useEffect } from "react";

interface AITripSummaryProps {
  timeline: any;
  tripData?: any;
  tripId: string;
}

export function AITripSummary({ timeline, tripData, tripId }: AITripSummaryProps) {
  // VERSION 2.0.1 - Force cache refresh
  const VERSION = "2.0.1";
  
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  // State for caching - use sessionStorage to persist across remounts
  const [cachedSummary, setCachedSummary] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(`ai-summary-${tripId}`);
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });
  const [timelineHash, setTimelineHash] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`timeline-hash-${tripId}`) || '';
    }
    return '';
  });
  const [isGenerating, setIsGenerating] = useState(false); // Prevent multiple simultaneous calls

  // Debug component lifecycle
  useEffect(() => {
    console.log("🤖 AITripSummary component MOUNTED - VERSION", VERSION);
    return () => {
      console.log("🤖 AITripSummary component UNMOUNTED");
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
      const prompt = `Summarize this trip in 2-3 sentences:

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
          model: 'command-a-03-2025' // Use default model for now
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
            } else if (line.startsWith('3:')) {
              // Handle error responses like "3:"An error occurred.""
              const errorMatch = line.match(/3:"([^"]*)"/);
              if (errorMatch && errorMatch[1]) {
                console.log("🤖 Error response detected:", errorMatch[1]);
                aiResponse += errorMatch[1];
              }
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
                    
                    // Also save to sessionStorage for persistence across remounts
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem(`ai-summary-${tripId}`, JSON.stringify(cleanedResponse));
                      sessionStorage.setItem(`timeline-hash-${tripId}`, currentHash);
                    }
                    console.log("🤖 Caching AI summary (with sessionStorage)");
      } else {
        throw new Error('Empty AI response');
      }
    } catch (error) {
      console.error("🤖 Error generating AI summary:", error);
      setError(error instanceof Error ? error.message : 'Failed to generate summary');
      
      // Fallback to basic summary
      const basicSummary = generateBasicSummary(timeline.items, tripData);
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
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">AI Trip Summary</h3>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 shadow-md"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </div>
          </button>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-600 rounded-lg animate-pulse"></div>
          <div className="h-4 bg-slate-600 rounded-lg animate-pulse w-3/4"></div>
          <div className="h-4 bg-slate-600 rounded-lg animate-pulse w-1/2"></div>
          </div>
            </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white">AI Trip Summary</h3>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 shadow-md flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
            </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 text-red-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Error:</span>
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}
      
      <div className="text-base text-slate-200 leading-relaxed font-medium">
        {summary}
      </div>
    </div>
  );
} 