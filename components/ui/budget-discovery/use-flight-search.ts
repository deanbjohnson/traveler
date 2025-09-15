import { useState, useRef } from 'react';
import { useChat } from 'ai/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FlightResult, FlightSearchParams, ChatMode } from './types';
import { normalizeFlightResult } from './normalize-flight-result';
import { convertOffersToFlightResults } from './convert-offers';
import { serializeMessages, deserializeMessages } from './utils';

export const useFlightSearch = (tripId: string, chatMode: ChatMode) => {
  const router = useRouter();
  const isAddingFlightDetails = useRef(false);
  
  const [searchResults, setSearchResults] = useState<FlightResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{current: number; total: number; etaMs: number; startedAt?: number} | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [systemMessages, setSystemMessages] = useState<Array<{
    id: string;
    content: string;
    timestamp: Date;
  }>>([]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    append,
  } = useChat({
    id: `budget-discovery-${tripId}-${chatMode}`,
    body: {
      tripId,
    },
    onFinish: async (message) => {
      console.log('🔍 onFinish callback triggered with message:', {
        role: message.role,
        contentLength: message.content?.length || 0,
        hasToolInvocations: !!(message as any)?.toolInvocations,
        messageType: typeof message,
        messageKeys: Object.keys(message || {})
      });
      
      const messageAny = message as any;
      const hasBudgetDiscovery = messageAny?.toolInvocations?.some((call: any) => call.toolName === 'budgetDiscovery');
      const hasFindFlight = messageAny?.toolInvocations?.some((call: any) => call.toolName === 'findFlight');
      const hasAddToTimeline = messageAny?.toolInvocations?.some((call: any) => call.toolName === 'addToTimeline');
      
      if (hasBudgetDiscovery || hasFindFlight) {
        console.log('🔍 Flight search results detected');
        setIsLoading(false);
        extractFlightResults(messageAny);
      } else if (hasAddToTimeline) {
        console.log('📝 Add to timeline completed');
        setIsLoading(false);
        setProgress(null);
        setTimeout(() => {
          try { 
            router.refresh(); 
            console.log('🔄 Router refreshed after add to timeline');
          } catch (error) {
            console.warn('Failed to refresh router:', error);
          }
        }, 200);
      } else {
        setIsLoading(false);
        setProgress(null);
      }

      if (hasAddToTimeline) {
        try { router.refresh(); } catch (_) {}
      }
      
      // Save messages to localStorage
      if (typeof window !== 'undefined') {
        try {
          const allMessages = [...messages, message];
          const serializedMessages = serializeMessages(allMessages);
          const messageString = JSON.stringify(serializedMessages);
          
          if (messageString.length > 2 * 1024 * 1024) {
            console.warn('Chat data too large for localStorage, keeping only latest 50 messages');
            const truncatedMessages = allMessages.slice(-50);
            localStorage.setItem(`budget-discovery-chat-${tripId}-${chatMode}`, JSON.stringify(serializeMessages(truncatedMessages)));
          } else {
            localStorage.setItem(`budget-discovery-chat-${tripId}-${chatMode}`, messageString);
          }
        } catch (error) {
          console.error('Failed to save chat messages to localStorage:', error);
        }
      }
    },
    onResponse: (response) => {
      console.log('🔍 onResponse called with:', {
        hasBody: !!response.body,
        bodyType: typeof response.body,
        bodyLength: response.body?.toString()?.length || 0
      });
      
      if (isAddingFlightDetails.current) {
        return;
      }
      
      try {
        const responseText = response.body?.toString() || '';
        const isUserToolCall = responseText.includes('"toolInvocations"') && 
                              (responseText.includes('budgetDiscovery') || responseText.includes('findFlight'));
        
        const isAddToTimeline = responseText.includes('addToTimeline');
        
        if (isUserToolCall && !isAddToTimeline) {
          setIsLoading(true);
          setRunStartedAt(Date.now());
          setProgress({ current: 0, total: 5, etaMs: 5 * 3000, startedAt: Date.now() });
        }
      } catch (error) {
        console.warn('Error in onResponse:', error);
      }
    },
    initialMessages: (() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`budget-discovery-chat-${tripId}`);
        return saved ? deserializeMessages(JSON.parse(saved)) : [];
      }
      return [];
    })(),
  });

  const extractFlightResults = (message: any) => {
    console.log('🔍 extractFlightResults called with message:', {
      hasToolInvocations: !!message.toolInvocations,
      toolInvocationsCount: message.toolInvocations?.length || 0,
      content: message.content?.substring(0, 200),
      messageKeys: Object.keys(message)
    });
    
    try {
      const mergeResults = (incoming: FlightResult[]) => {
        setSearchResults((prev) => {
          const byId = new Map<string, FlightResult>();
          [...prev, ...incoming].forEach((r) => {
            byId.set(r.id, r);
          });
          return Array.from(byId.values());
        });
      };

      if (message.toolInvocations) {
        for (const toolCall of message.toolInvocations) {
          if ((toolCall.toolName === 'budgetDiscovery' || toolCall.toolName === 'findFlight') && toolCall.result) {
            try {
              let result;
              if (typeof toolCall.result === 'string') {
                result = JSON.parse(toolCall.result);
              } else {
                result = toolCall.result;
              }
              
              if (result && typeof result === 'object') {
                let flightData;
                if (toolCall.toolName === 'findFlight') {
                  flightData = result.offers || result.data?.offers;
                } else {
                  flightData = result.results || result.data?.results || result;
                }
                
                if (Array.isArray(flightData) && flightData.length > 0) {
                  console.log(`🔍 First flight result structure (${toolCall.toolName}):`, JSON.stringify(flightData[0], null, 2));
                  
                  const meta = result.metadata || result.data?.metadata;
                  if (meta) {
                    const total = meta.plannedDestinations || 5;
                    setProgress({ current: total, total, etaMs: 0, startedAt: progress?.startedAt });
                  } else {
                    setProgress(null);
                  }

                  const firstResult = flightData[0];
                  if (firstResult && (firstResult.price || firstResult.route || firstResult.id || firstResult.total_amount || firstResult.slices)) {
                    // Clear cached location flight data when new search results come in
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem(`bd-loc-results-${tripId}-${chatMode}`);
                      localStorage.removeItem(`bd-loc-expanded-${tripId}-${chatMode}`);
                      // Also clear any other potential cached flight data
                      localStorage.removeItem(`budget-discovery-results-${tripId}-${chatMode}`);
                      console.log('🧹 Cleared all cached flight data to prevent stale data issues');
                    }
                    
                    const normalized = flightData.map(normalizeFlightResult);
                    mergeResults(normalized);
                    console.log(`✅ Extracted flight results from ${toolCall.toolName} tool call:`, flightData.length);
                    return;
                  }
                }
              }
            } catch (error) {
              console.error('Failed to parse tool call result:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to extract flight results:', error);
    }
  };

  const handleAddToTimeline = async (flight: FlightResult, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      isAddingFlightDetails.current = true;
      
      const airlineName = flight.offer?.owner?.name || 
                         flight.airline?.name || 
                         (Array.isArray(flight.airlines) && flight.airlines.length > 0 ? flight.airlines[0] : 'Unknown Airline');
      
      const departureDate = flight.dates?.departure ? new Date(flight.dates.departure).toLocaleDateString() : 'Unknown Date';
      const destination = flight.destinationAirport?.city_name || flight.route.destination;
      const origin = flight.route.origin;
      const price = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: flight.price.currency.toUpperCase(),
      }).format(flight.price.total);
      
      const message = `Add this specific flight to my timeline: ${airlineName} flight ${origin} → ${destination} on ${departureDate} for ${price} (Flight ID: ${flight.id})`;

      console.log('📤 Sending add to timeline message:', message);
      await append({ role: 'user', content: message });
      console.log('✅ Message sent successfully, flight should be added to timeline');
      
    } catch (error) {
      console.error('❌ Error adding flight to timeline:', error);
    } finally {
      setTimeout(() => {
        isAddingFlightDetails.current = false;
      }, 100);
    }
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    append,
    searchResults,
    setSearchResults,
    isLoading,
    setIsLoading,
    progress,
    systemMessages,
    setSystemMessages,
    handleAddToTimeline,
    extractFlightResults,
  };
};
