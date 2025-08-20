"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { Chat } from "@/components/ui/chat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plane, 
  Clock, 
  DollarSign, 
  MapPin, 
  Calendar,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  ChevronDown,
  Plus,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "ai";

interface FlightResult {
  id: string;
  searchId: string;
  route: {
    origin: string;
    destination: string;
  };
  dates: {
    departure: string;
    return?: string;
  };
  price: {
    total: number;
    currency: string;
  };
  duration: {
    outbound: string;
    return?: string;
    total: string;
  };
  airlines: string[];
  connections: number;
  offer: any; // The raw Duffel offer
  score: number;
  destinationContext: string;
  destinationAirport: {
    iata_code: string;
    city_name: string;
    country_name: string;
  };
  // Legacy properties for backward compatibility
  airline?: {
    name: string;
    code: string;
  };
  timing?: {
    duration: string;
  };
  segments?: Array<{
    from: string;
    to: string;
    airline: string;
  }>;
  timelineData?: {
    id: string;
    total_amount: string;
    total_currency: string;
    slices: Array<{
      origin: {
        iata_code: string;
        name: string;
        city_name: string;
      };
      destination: {
        iata_code: string;
        name: string;
        city_name: string;
      };
      departure_datetime?: string;
      arrival_datetime?: string;
      duration: string;
    }>;
    owner: {
      name: string;
      iata_code: string;
    };
  };
}

interface BudgetDiscoveryTabProps {
  tripId: string;
  timeline?: any;
}

export function BudgetDiscoveryTab({ tripId, timeline }: BudgetDiscoveryTabProps) {
  const router = useRouter();
  
  // Helper functions - defined first to avoid initialization issues
  const serializeMessages = (messages: any[]) => {
    return messages.map(msg => ({
      ...msg,
      createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : undefined,
    }));
  };

  const deserializeMessages = (messages: any[]) => {
    return messages.map(msg => ({
      ...msg,
      createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
    }));
  };

  const parseDurationToMinutes = (duration: string): number => {
    // Parse ISO 8601 duration format (e.g., "PT2H30M")
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
  };

  const formatDuration = (duration: string) => {
    const minutes = parseDurationToMinutes(duration);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const [searchResults, setSearchResults] = useState<FlightResult[]>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`budget-discovery-results-${tripId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.map(normalizeFlightResult);
          }
          return [];
        } catch (_) {
          return [];
        }
      }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'date'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-sortBy-${tripId}`) as 'price'|'duration'|'date') || 'price';
    }
    return 'price';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-sortOrder-${tripId}`) as 'asc'|'desc') || 'asc';
    }
    return 'asc';
  });
  const [priceFilter, setPriceFilter] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem(`bd-priceFilter-${tripId}`);
      return v ? Number(v) : null;
    }
    return null;
  });
  const [destinationFilter, setDestinationFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`bd-destFilter-${tripId}`) || '';
    }
    return '';
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-viewMode-${tripId}`) as 'list'|'grouped') || 'grouped';
    }
    return 'grouped';
  });
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`bd-expanded-${tripId}`);
      if (saved) {
        try { return new Set(JSON.parse(saved)); } catch (_) {}
      }
    }
    return new Set();
  });
  const [progress, setProgress] = useState<{current: number; total: number; etaMs: number; startedAt?: number} | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [addedFlightIds, setAddedFlightIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`bd-added-${tripId}`);
      if (saved) {
        try { return new Set<string>(JSON.parse(saved)); } catch (_) {}
      }
    }
    return new Set<string>();
  });

  // Build a set of fingerprints for already-added flights on the timeline
  const [timelineFlightFingerprints, setTimelineFlightFingerprints] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const fps = new Set<string>();
      const items = timeline?.items || [];
      for (const item of items) {
        if (item?.type === 'FLIGHT' && item?.flightData?.slices?.[0]) {
          const sl = item.flightData.slices[0];
          const origin = sl?.origin?.iata_code || '';
          const destination = sl?.destination?.iata_code || '';
          const dep = sl?.departure_datetime ? new Date(sl.departure_datetime).toISOString().slice(0,10) : '';
          const airline = item.flightData?.owner?.iata_code || '';
          if (origin && destination && dep) {
            fps.add(`${origin}-${destination}-${dep}-${airline}`.toUpperCase());
          }
        }
      }
      setTimelineFlightFingerprints(fps);
    } catch (_) {}
  }, [timeline]);

  // Persist UI state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-sortBy-${tripId}`, sortBy);
  }, [sortBy, tripId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-sortOrder-${tripId}`, sortOrder);
  }, [sortOrder, tripId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (priceFilter != null) localStorage.setItem(`bd-priceFilter-${tripId}`, String(priceFilter));
    else localStorage.removeItem(`bd-priceFilter-${tripId}`);
  }, [priceFilter, tripId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-destFilter-${tripId}`, destinationFilter);
  }, [destinationFilter, tripId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-viewMode-${tripId}`, viewMode);
  }, [viewMode, tripId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-expanded-${tripId}`, JSON.stringify(Array.from(expandedLocations)));
  }, [expandedLocations, tripId]);

  // Persist added flights state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-added-${tripId}`, JSON.stringify(Array.from(addedFlightIds)));
  }, [addedFlightIds, tripId]);

  // Save results to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && searchResults.length > 0) {
      localStorage.setItem(`budget-discovery-results-${tripId}`, JSON.stringify(searchResults));
    }
  }, [searchResults, tripId]);

  useEffect(() => {
    if (!isLoading) return;
    let stop = false;
    async function tick() {
      if (stop) return;
      try {
        const res = await fetch(`/api/progress?tripId=${encodeURIComponent(tripId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.progress) {
            const p = data.progress as { current: number; total: number; startedAt: number; updatedAt?: number; done?: boolean };

            // Ignore stale progress from a previous run
            if (runStartedAt && p.startedAt && p.startedAt + 200 < runStartedAt) {
              // stale, skip this tick
            } else {
              // Compute dynamic ETA based on average per-step time so far
              const steps = Math.max(p.current, 1);
              const elapsedMs = Math.max(0, (p.updatedAt || Date.now()) - (p.startedAt || Date.now()));
              const perStepMs = Math.max(250, Math.round(elapsedMs / steps));
              const remaining = Math.max(0, (p.total || 0) - p.current);
              const etaMs = remaining * perStepMs;
              setProgress(prev => ({ current: p.current, total: p.total || prev?.total || 5, etaMs, startedAt: p.startedAt || prev?.startedAt }));
            }
            // force re-render of bar even if counts unchanged
            if (p.total) {
              // no-op state change to trigger UI
              setSortOrder(s => s);
            }
            if ((runStartedAt ? (p.startedAt || 0) >= runStartedAt - 200 : true) && (p.done || (p.total && p.current >= p.total))) {
              stop = true;
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (_) {
        // ignore
      }
      setTimeout(tick, 1500); // poll ~1.5s to cut down noise
    }
    tick();
    return () => { stop = true; };
  }, [isLoading, tripId, runStartedAt]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    append,
  } = useChat({
    body: {
      tripId,
    },
    // Save chat history to localStorage
    onFinish: async (message) => {
      // Check if the message contains flight search results
      const messageAny = message as any;
      if (messageAny?.toolInvocations?.some((call: any) => call.toolName === 'budgetDiscovery' || call.toolName === 'findFlight')) {
        console.log('🔍 Flight search results detected');
        setIsLoading(false);
        // Extract flight results from the message
        extractFlightResults(messageAny);
      }

      // If timeline was modified by a tool, refresh the server components
      if (messageAny?.toolInvocations?.some((call: any) => call.toolName === 'addToTimeline')) {
        try { router.refresh(); } catch (_) {}
      }
      
      // Save messages to localStorage with proper serialization
      if (typeof window !== 'undefined') {
        const allMessages = [...messages, message];
        localStorage.setItem(`budget-discovery-chat-${tripId}`, JSON.stringify(serializeMessages(allMessages)));
      }
    },
    onResponse: (response) => {
      // Check if a flight search is starting
      const responseText = response.body?.toString() || '';
      if (responseText.includes('budgetDiscovery') || responseText.includes('budget-discovery') || 
          responseText.includes('findFlight') || responseText.includes('find-flight')) {
        setIsLoading(true);
        // Initialize progress indicator with a rough estimate
        setProgress({ current: 0, total: 5, etaMs: 5 * 3000, startedAt: Date.now() });
      }
    },
    // Load initial messages from localStorage with proper deserialization
    initialMessages: (() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`budget-discovery-chat-${tripId}`);
        return saved ? deserializeMessages(JSON.parse(saved)) : [];
      }
      return [];
    })(),
  });

  // Mirror chat status to show progress regardless of text heuristics
  useEffect(() => {
    // Mirror chat status to show progress regardless of text heuristics
    if (status === 'submitted' || status === 'streaming') {
      setIsLoading(true);
      // Always re-init progress for a new search
      const now = Date.now();
      setRunStartedAt(now);
      setProgress({ current: 0, total: 5, etaMs: 5 * 3000, startedAt: now });
    } else if (status === 'ready') {
      setIsLoading(false);
      // Do not null progress here if results are still streaming via tool; onFinish will finalize
    }
  }, [status]);

  // Ensure results restore on mount even if initializer missed due to hydration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (searchResults.length === 0) {
      const saved = localStorage.getItem(`budget-discovery-results-${tripId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSearchResults(parsed.map(normalizeFlightResult));
          }
        } catch (_) {
          // ignore
        }
      }
    }
  // run once on mount and when tripId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Normalize incoming flight result (handles both old cleaned shape and new FlightOption shape)
  const normalizeFlightResult = (raw: any): FlightResult => {
    const id: string = raw.id || raw.offer?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const route = raw.route || {
      origin: raw.timelineData?.slices?.[0]?.origin?.iata_code || "",
      destination: raw.timelineData?.slices?.[0]?.destination?.iata_code || "",
    };

    // Prioritize actual flight departure dates from the offer data
    const actualDepartureDate = raw.offer?.slices?.[0]?.departure_datetime || 
                               raw.timelineData?.slices?.[0]?.departure_datetime || 
                               raw.dates?.departure || "";
    
    const actualReturnDate = raw.offer?.slices?.[1]?.departure_datetime || 
                            raw.timelineData?.slices?.[1]?.departure_datetime || 
                            raw.dates?.return || undefined;
    
    const dates = {
      departure: actualDepartureDate,
      return: actualReturnDate,
    };

    const price = raw.price || {
      total: typeof raw.total === 'number' ? raw.total : (parseFloat(raw.offer?.total_amount) || 0),
      currency: raw.currency || raw.offer?.total_currency || 'USD',
    };

    const duration = raw.duration || {
      outbound: raw.timing?.duration || "PT0H0M",
      return: undefined,
      total: raw.timing?.duration || "PT0H0M",
    };

    const airlines: string[] = raw.airlines || (
      raw.offer?.owner?.iata_code ? [raw.offer.owner.iata_code] : (raw.airline?.code ? [raw.airline.code] : [])
    );

    const connections: number = typeof raw.connections === 'number'
      ? raw.connections
      : (Array.isArray(raw.segments) ? Math.max(raw.segments.length - 1, 0) : 0);

    const offer = raw.offer || null;
    const score = typeof raw.score === 'number' ? raw.score : 0;

    return {
      id,
      searchId: raw.searchId || '',
      route,
      dates,
      price,
      duration,
      airlines,
      connections,
      offer,
      score,
      destinationContext: raw.destinationContext || 'Unknown',
      destinationAirport: raw.destinationAirport || {
        iata_code: route.destination || '',
        city_name: '',
        country_name: '',
      },
      // Legacy fields retained if present
      airline: raw.airline,
      timing: raw.timing,
      segments: raw.segments,
      timelineData: raw.timelineData,
    } as FlightResult;
  };

  // Helper to compute the same fingerprint from a flight result
  const getFlightFingerprint = (flight: FlightResult) => {
    const origin = flight.route?.origin || '';
    const destination = flight.route?.destination || '';
    const dep = flight.dates?.departure ? new Date(flight.dates.departure).toISOString().slice(0,10) : '';
    const airline = flight.offer?.owner?.iata_code || flight.airlines?.[0] || '';
    return `${origin}-${destination}-${dep}-${airline}`.toUpperCase();
  };

  const extractFlightResults = (message: any) => {
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
      // Check tool call results first
      if (message.toolInvocations) {
        for (const toolCall of message.toolInvocations) {
          // Handle both budgetDiscovery and findFlight results
          if ((toolCall.toolName === 'budgetDiscovery' || toolCall.toolName === 'findFlight') && toolCall.result) {
            try {
              // Handle both string and object results
              let result;
              if (typeof toolCall.result === 'string') {
                result = JSON.parse(toolCall.result);
              } else {
                result = toolCall.result;
              }
              
              // Check if the result has the expected structure
              if (result && typeof result === 'object') {
                // Handle different result formats from different tools
                let flightData;
                if (toolCall.toolName === 'findFlight') {
                  // findFlight returns offers
                  flightData = result.offers || result.data?.offers;
                } else {
                  // budgetDiscovery returns results
                  flightData = result.results || result.data?.results || result;
                }
                
                if (Array.isArray(flightData) && flightData.length > 0) {
                  // Debug: Log the first result structure
                  console.log(`🔍 First flight result structure (${toolCall.toolName}):`, JSON.stringify(flightData[0], null, 2));
                  
                  // Update progress finalization if metadata is present
                  const meta = result.metadata || result.data?.metadata;
                  if (meta) {
                    const total = meta.plannedDestinations || 5;
                    setProgress({ current: total, total, etaMs: 0, startedAt: progress?.startedAt });
                  } else {
                    setProgress(null);
                  }

                  // Check if the results have the expected flight structure
                  const firstResult = flightData[0];
                  if (firstResult && (firstResult.price || firstResult.route || firstResult.id)) {
                                      const normalized = flightData.map(normalizeFlightResult);
                  
                  // Debug: Log the first result's date information
                  if (normalized.length > 0) {
                    const firstResult = normalized[0];
                    console.log('🔍 Date debugging for first result:', {
                      originalDates: flightData[0]?.dates,
                      originalOfferDates: flightData[0]?.offer?.slices?.[0]?.departure_datetime,
                      normalizedDates: firstResult.dates,
                      rawData: flightData[0]
                    });
                  }
                  
                  mergeResults(normalized);
                  console.log(`✅ Extracted flight results from ${toolCall.toolName} tool call:`, flightData.length);
                    return;
                  }
                } else if (result.success && ((toolCall.toolName === 'findFlight' && result.offers) || (toolCall.toolName === 'budgetDiscovery' && result.results))) {
                  // Handle success case with explicit results/offers
                  const successData = toolCall.toolName === 'findFlight' ? result.offers : result.results;
                  
                  // Debug: Log the first result structure
                  console.log(`🔍 First flight result structure (${toolCall.toolName} success):`, JSON.stringify(successData[0], null, 2));
                  
                  // Finalize progress with metadata
                  const meta = result.metadata;
                  if (meta) {
                    const total = meta.plannedDestinations || 5;
                    setProgress({ current: total, total, etaMs: 0, startedAt: progress?.startedAt });
                  } else {
                    setProgress(null);
                  }

                  const normalized = successData.map(normalizeFlightResult);
                  mergeResults(normalized);
                  console.log(`✅ Extracted flight results from ${toolCall.toolName} tool call:`, successData.length);
                  return;
                }
              }
            } catch (error) {
              console.error('Failed to parse tool call result:', error);
            }
          }
        }
      }

      // Also check message content for results
      const content = message.content;
      if (typeof content === 'string') {
        // Look for JSON-like structure in the content
        const jsonMatch = content.match(/\{[^{}]*"success"[^{}]*"results"[^{}]*\[[^\]]*\][^{}]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.success && parsed.results && Array.isArray(parsed.results)) {
              const normalized = parsed.results.map(normalizeFlightResult);
              mergeResults(normalized);
              console.log('✅ Extracted flight results from content:', parsed.results.length);
              return;
            }
          } catch (error) {
            console.error('Failed to parse content JSON:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to extract flight results:', error);
    }
  };

  const sortedAndFilteredResults = searchResults
    .filter((flight) => {
      // Filter out invalid flight data
      if (!flight || !flight.route || !flight.price) {
        console.warn('Invalid flight data:', flight);
        return false;
      }
      
      if (priceFilter && flight.price.total > priceFilter) return false;
      if (destinationFilter && !flight.destinationContext.toLowerCase().includes(destinationFilter.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'price':
          comparison = a.price.total - b.price.total;
          break;
        case 'duration':
          // Parse duration for proper comparison (shortest to longest)
          const durationA = a.duration?.outbound ? parseDurationToMinutes(a.duration.outbound) : 0;
          const durationB = b.duration?.outbound ? parseDurationToMinutes(b.duration.outbound) : 0;
          comparison = durationA - durationB;
          break;
        case 'date':
          comparison = (a.dates?.departure ? new Date(a.dates.departure).getTime() : 0) - 
                      (b.dates?.departure ? new Date(b.dates.departure).getTime() : 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Group flights by idea (query/interest) then by location (city/airport city)
  const groupedFlights = sortedAndFilteredResults.reduce((groups, flight) => {
    // Idea name taken from destinationContext (e.g., "Skiing", "Beach", etc.)
    const idea = (flight.destinationContext || 'Ideas').toString();
    // Location name from destination airport city; fall back to destination code
    const location = flight.destinationAirport?.city_name || flight.route.destination || 'Unknown';

    if (!groups[idea]) groups[idea] = {};
    if (!groups[idea][location]) groups[idea][location] = [];
    groups[idea][location].push(flight);
    return groups;
  }, {} as Record<string, Record<string, FlightResult[]>>);

  // Sort regions and countries
  const sortedRegions = Object.entries(groupedFlights)
    .map(([idea, locations]) => {
      const locationEntries = Object.entries(locations).map(([location, flights]) => ({
        location,
        flights,
        count: flights.length,
        avgPrice: flights.reduce((sum, f) => sum + f.price.total, 0) / flights.length,
      }));

      // Sort locations by flight count then by average price
      locationEntries.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.avgPrice - b.avgPrice;
      });

      return {
        region: idea, // keep property name 'region' to minimize changes downstream
        countries: locationEntries.map((e) => ({ country: e.location, flights: e.flights, count: e.count, avgPrice: e.avgPrice })),
        totalFlights: locationEntries.reduce((sum, c) => sum + c.count, 0),
        avgPrice: locationEntries.reduce((sum, c) => sum + c.avgPrice * c.count, 0) / locationEntries.reduce((sum, c) => sum + c.count, 0),
      };
    })
    .sort((a, b) => {
      // Sort regions by total flight count first, then by average price
      if (b.totalFlights !== a.totalFlights) return b.totalFlights - a.totalFlights;
      return a.avgPrice - b.avgPrice;
    });

  const toggleLocation = (location: string) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(location)) {
        newSet.delete(location);
      } else {
        newSet.add(location);
      }
      return newSet;
    });
  };

  const expandAllLocations = () => {
    setExpandedLocations(new Set(sortedRegions.map(r => r.region)));
  };

  const collapseAllLocations = () => {
    setExpandedLocations(new Set());
  };

  const clearHistory = () => {
    if (typeof window !== 'undefined') {
      // Clear localStorage
      localStorage.removeItem(`budget-discovery-results-${tripId}`);
      localStorage.removeItem(`budget-discovery-chat-${tripId}`);
      localStorage.removeItem(`bd-sortBy-${tripId}`);
      localStorage.removeItem(`bd-sortOrder-${tripId}`);
      localStorage.removeItem(`bd-priceFilter-${tripId}`);
      localStorage.removeItem(`bd-destFilter-${tripId}`);
      localStorage.removeItem(`bd-viewMode-${tripId}`);
      localStorage.removeItem(`bd-expanded-${tripId}`);
      
      // Clear current state
      setSearchResults([]);
      setSortBy('price');
      setSortOrder('asc');
      setPriceFilter(null);
      setDestinationFilter('');
      setViewMode('grouped');
      setExpandedLocations(new Set());
      
      // Clear chat messages without page reload to avoid database issues
      // The chat will be cleared on next manual refresh
      console.log('History cleared. Chat messages will be cleared on next page refresh.');
    }
  };

  const handleFlightClick = (flight: FlightResult) => {
    // TODO: Implement flight selection/booking functionality
    console.log('Flight selected:', flight);
  };

  const handleAddToTimeline = async (flight: FlightResult, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the card click
    
    try {
      // Get airline name
      const airlineName = flight.offer?.owner?.name || 
                         flight.airline?.name || 
                         (Array.isArray(flight.airlines) && flight.airlines.length > 0 ? flight.airlines[0] : 'Unknown Airline');
      
      // Get departure date
      const departureDate = flight.dates?.departure ? formatDate(flight.dates.departure) : 'Unknown Date';
      
      // Get destination
      const destination = flight.destinationAirport?.city_name || flight.route.destination;
      const origin = flight.route.origin;
      
      // Create the message to send to the chat
      const message = `Add the ${airlineName} flight on ${departureDate} to ${destination} from ${origin} to my timeline`;

      // Use chat append to send without navigation
      await append({ role: 'user', content: message });

      // Optimistically mark as added in UI
      setAddedFlightIds((prev) => new Set<string>(prev).add(flight.id));
      try { router.refresh(); } catch (_) {}
      
      console.log('Adding flight to timeline:', {
        airline: airlineName,
        date: departureDate,
        destination,
        origin,
        message
      });
    } catch (error) {
      console.error('Error adding flight to timeline:', error);
    }
  };

  const isLoadingChat = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full">
      {/* Chat Section */}
      <div className="flex-1 min-w-0 overflow-hidden border-r border-gray-700">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-gray-200">Budget Discovery Chat</h2>
            <p className="text-sm text-gray-400">
              Ask me to find the best flight deals across months and destinations
            </p>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500">Try these examples:</p>
              <ul className="text-xs text-gray-500 space-y-1 ml-4">
                <li>• "Find cheap flights to warm places in the next 6 months"</li>
                <li>• "Show me the best deals to Asia over the next year"</li>
                <li>• "What are the cheapest flights to Europe in the next 3 months?"</li>
                <li>• "Find budget-friendly trips to anywhere interesting"</li>
              </ul>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <Chat
              messages={messages}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isGenerating={isLoadingChat}
              stop={stop}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* Flight Results Section */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-gray-700 p-4 bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-200">Flight Results</h2>
                <p className="text-sm text-gray-400">
                  {sortedAndFilteredResults.length} flights found
                </p>
                {isLoading && progress && (
                  <div className="mt-2 w-full max-w-md">
                    <div className="h-2 bg-gray-800 rounded">
                      <div
                        className="h-2 bg-blue-500 rounded transition-all"
                        style={{ width: `${Math.min(100, Math.round((progress.current / Math.max(progress.total,1)) * 100))}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Searching {progress.current}/{progress.total} • ETA {Math.max(0, Math.ceil(progress.etaMs / 1000))}s
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    List
                  </Button>
                  <Button
                    variant={viewMode === 'grouped' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grouped')}
                  >
                    Grouped
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="text-sm text-gray-400">Max Price</label>
                    <input
                      type="number"
                      placeholder="Max price"
                      value={priceFilter || ''}
                      onChange={(e) => setPriceFilter(e.target.value ? Number(e.target.value) : null)}
                      className="ml-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Destination</label>
                    <input
                      type="text"
                      placeholder="Filter by destination"
                      value={destinationFilter}
                      onChange={(e) => setDestinationFilter(e.target.value)}
                      className="ml-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {['price', 'duration', 'date'].map((sort) => (
                    <Button
                      key={sort}
                      variant={sortBy === sort ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSortBy(sort as 'price' | 'duration' | 'date')}
                    >
                      {sort.charAt(0).toUpperCase() + sort.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-gray-400 mt-2">Searching for flights...</p>
                </div>
              </div>
            ) : sortedAndFilteredResults.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No flights found. Try searching for budget flights!</p>
                </div>
              </div>
            ) : viewMode === 'grouped' ? (
              <div className="space-y-4">
                {/* Grouped View Controls */}
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-semibold text-gray-200">Flights by Idea</h3>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={expandAllLocations}
                    >
                      Expand All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={collapseAllLocations}
                    >
                      Collapse All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearHistory}
                    >
                      Clear History
                    </Button>
                  </div>
                </div>

                {/* Location Groups */}
                {sortedRegions.map(({ region, countries, totalFlights, avgPrice }) => (
                  <div key={region} className="border border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleLocation(region)}
                      className="w-full p-4 bg-gray-800/50 hover:bg-gray-700/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <MapPin className="h-5 w-5 text-blue-400" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-200 capitalize">{region}</h4>
                          <p className="text-sm text-gray-400">
                            {totalFlights} flights across {countries.length} countries • Avg: {formatPrice(avgPrice, 'USD')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">{totalFlights}</Badge>
                        <ChevronDown 
                          className={cn(
                            "h-4 w-4 text-gray-400 transition-transform",
                            expandedLocations.has(region) && "rotate-180"
                          )} 
                        />
                      </div>
                    </button>
                    
                    {expandedLocations.has(region) && (
                      <div className="p-4 space-y-3 bg-gray-900/30 border-t border-gray-700">
                        <div className="text-sm text-gray-400 mb-2">
                          {region} • {totalFlights} flights across {countries.length} locations
                        </div>
                        {countries.map(({ country, flights, count, avgPrice }) => (
                          <div key={country} className="border border-gray-600 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleLocation(country)}
                              className="w-full p-3 bg-gray-700/50 hover:bg-gray-600/50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-3">
                                <MapPin className="h-4 w-4 text-green-400" />
                                <div className="text-left">
                                  <h5 className="font-medium text-gray-200 capitalize">{country}</h5>
                                  <p className="text-xs text-gray-400">
                                    {count} flights • Avg: {formatPrice(avgPrice, 'USD')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary" className="text-xs">{count}</Badge>
                                <ChevronDown 
                                  className={cn(
                                    "h-3 w-3 text-gray-400 transition-transform",
                                    expandedLocations.has(country) && "rotate-180"
                                  )} 
                                />
                              </div>
                            </button>
                            
                            {expandedLocations.has(country) && (
                              <div className="p-3 space-y-2 bg-gray-800/30 border-t border-gray-600">
                                <div className="text-xs text-gray-400 mb-2">
                                  {country} • {count} flights
                                </div>
                                {flights.map((flight) => (
                                  <Card
                                    key={flight.id}
                                    className="cursor-pointer hover:bg-gray-700/50 transition-colors border-gray-600 relative"
                                    onClick={() => handleFlightClick(flight)}
                                  >
                                    <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                                      {(addedFlightIds.has(flight.id) || timelineFlightFingerprints.has(getFlightFingerprint(flight))) ? (
                                        <div className="flex items-center gap-1 text-emerald-400 text-xs bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-700">
                                          <Check className="h-3 w-3" /> Added
                                        </div>
                                      ) : (
                                        <button
                                          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-0 flex items-center gap-1"
                                          onClick={(e) => handleAddToTimeline(flight, e)}
                                        >
                                          <Plus className="h-3 w-3" />
                                          Add to Trip
                                        </button>
                                      )}
                                      <Badge variant="outline" className="text-green-400 border-green-400 text-xs">
                                        {formatPrice(flight.price.total, flight.price.currency)}
                                      </Badge>
                                    </div>
                                    <CardHeader className="pb-2">
                                      <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center space-x-2">
                                          <Plane className="h-3 w-3 text-blue-400" />
                                          <span>
                                            {flight.route.origin} → {flight.route.destination}
                                          </span>
                                        </CardTitle>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                      <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="space-y-1">
                                          <div className="flex items-center space-x-1 text-gray-400">
                                            <Calendar className="h-2 w-2" />
                                            <span>Departure</span>
                                          </div>
                                          <p className="text-gray-200">
                                            {flight.dates?.departure ? formatDate(flight.dates.departure) : 'N/A'}
                                          </p>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="flex items-center space-x-1 text-gray-400">
                                            <Clock className="h-2 w-2" />
                                            <span>Duration</span>
                                          </div>
                                          <p className="text-gray-200">
                                            {flight.duration?.outbound ? formatDuration(flight.duration.outbound) : 'N/A'}
                                          </p>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="flex items-center space-x-1 text-gray-400">
                                            <DollarSign className="h-2 w-2" />
                                            <span>Airline</span>
                                          </div>
                                          <p className="text-gray-200">
                                            {flight.offer?.owner?.name 
                                              || flight.airline?.name 
                                              || (Array.isArray(flight.airlines) && flight.airlines.length > 0 ? flight.airlines[0] : 'N/A')}
                                           </p>
                                        </div>
                                        {flight.connections > 0 ? (
                                          <div className="space-y-1">
                                            <div className="flex items-center space-x-1 text-gray-400">
                                              <span>Connections</span>
                                            </div>
                                            <p className="text-gray-200">{flight.connections} stop{flight.connections > 1 ? 's' : ''}</p>
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            <div className="flex items-center space-x-1 text-gray-400">
                                              <span>Type</span>
                                            </div>
                                            <p className="text-gray-200">Direct</p>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // List View (original)
              sortedAndFilteredResults.map((flight) => (
                <Card
                  key={flight.id}
                  className="cursor-pointer hover:bg-gray-800/50 transition-colors border-gray-700 relative"
                  onClick={() => handleFlightClick(flight)}
                >
                  <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                    {(addedFlightIds.has(flight.id) || timelineFlightFingerprints.has(getFlightFingerprint(flight))) ? (
                      <div className="flex items-center gap-1 text-emerald-400 text-xs bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-700">
                        <Check className="h-3 w-3" /> Added
                      </div>
                    ) : (
                      <button
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-0 flex items-center gap-1"
                        onClick={(e) => handleAddToTimeline(flight, e)}
                      >
                        <Plus className="h-3 w-3" />
                        Add to Trip
                      </button>
                    )}
                    <Badge variant="outline" className="text-green-400 border-green-400 text-xs">
                      {formatPrice(flight.price.total, flight.price.currency)}
                    </Badge>
                  </div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center space-x-2">
                        <Plane className="h-4 w-4 text-blue-400" />
                        <span>
                          {flight.route.origin} → {flight.route.destination}
                        </span>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-gray-400">
                          <Calendar className="h-3 w-3" />
                          <span>Departure</span>
                        </div>
                        <p className="text-gray-200">
                          {flight.dates?.departure ? formatDate(flight.dates.departure) : 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>Duration</span>
                        </div>
                        <p className="text-gray-200">
                          {flight.duration?.outbound ? formatDuration(flight.duration.outbound) : 'N/A'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-gray-400">
                          <MapPin className="h-3 w-3" />
                          <span>Destination</span>
                        </div>
                        <p className="text-gray-200 capitalize">{flight.destinationContext}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-gray-400">
                          <DollarSign className="h-3 w-3" />
                          <span>Airline</span>
                        </div>
                        <p className="text-gray-200">
                          {flight.offer?.owner?.name || flight.airlines?.[0] || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {flight.connections > 0 && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {flight.connections} stop{flight.connections > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
