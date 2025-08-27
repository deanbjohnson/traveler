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
  // Filter states
  const [tripType, setTripType] = useState<'round-trip' | 'one-way'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-tripType-${tripId}`) as 'round-trip'|'one-way') || 'round-trip';
    }
    return 'round-trip';
  });
  
  const [passengers, setPassengers] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem(`bd-passengers-${tripId}`)) || 1;
    }
    return 1;
  });
  
  const [cabinClass, setCabinClass] = useState<'economy' | 'premium_economy' | 'business' | 'first'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-cabinClass-${tripId}`) as 'economy'|'premium_economy'|'business'|'first') || 'economy';
    }
    return 'economy';
  });
  
  const [maxStops, setMaxStops] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem(`bd-maxStops-${tripId}`);
      return v ? Number(v) : null;
    }
    return null;
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

  // Track which locations have been expanded to show multiple flights (persisted)
  const [expandedLocationsForSearch, setExpandedLocationsForSearch] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`bd-loc-expanded-${tripId}`);
      if (saved) {
        try { return new Set<string>(JSON.parse(saved)); } catch (_) {}
      }
    }
    return new Set<string>();
  });
  const [locationFlightResults, setLocationFlightResults] = useState<Record<string, FlightResult[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`bd-loc-results-${tripId}`);
      if (saved) {
        try {
          const parsed: Record<string, any[]> = JSON.parse(saved);
          const restored: Record<string, FlightResult[]> = {};
          for (const [loc, flights] of Object.entries(parsed)) {
            // For initial restoration, we can use the data as-is since it was already normalized when saved
            restored[loc] = (flights || []).map((flight: any) => ({
              id: flight.id || '',
              searchId: flight.searchId || '',
              route: flight.route || { origin: '', destination: '' },
              dates: flight.dates || { departure: '', return: undefined },
              price: flight.price || { total: 0, currency: 'USD' },
              duration: flight.duration || { outbound: 'PT0H0M', return: undefined, total: 'PT0H0M' },
              airlines: flight.airlines || [],
              connections: flight.connections || 0,
              offer: flight.offer || null,
              score: flight.score || 0,
              destinationContext: flight.destinationContext || 'Unknown',
              destinationAirport: flight.destinationAirport || { iata_code: '', city_name: '', country_name: '' },
              airline: flight.airline,
              timing: flight.timing,
              segments: flight.segments,
              timelineData: flight.timelineData,
            } as FlightResult));
          }
          return restored;
        } catch (_) {}
      }
    }
    return {};
  });
  
  // Track loading state for "Show 10 more" buttons
  const [loadingMoreFlights, setLoadingMoreFlights] = useState<Set<string>>(new Set());
  
  // Track sorting state for each location
  const [locationSortBy, setLocationSortBy] = useState<Record<string, 'price' | 'date'>>({});
  const [locationSortOrder, setLocationSortOrder] = useState<Record<string, 'asc' | 'desc'>>({});
  
  // Track when we're adding flight details to avoid triggering loading state
  const isAddingFlightDetails = useRef(false);
  
  // Track scroll position to maintain it when switching tabs
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);
  
  // Track filter changes to trigger new searches
  const [filterVersion, setFilterVersion] = useState(0);
  const lastSearchFilters = useRef<string>('');
  
  // Separate state for system messages (flight details) that shouldn't trigger AI responses
  const [systemMessages, setSystemMessages] = useState<Array<{
    id: string;
    content: string;
    timestamp: Date;
  }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`bd-system-messages-${tripId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        } catch (_) {}
      }
    }
    return [];
  });

  // Clear flight results when filters change (as requested by user)
  useEffect(() => {
    if (filterVersion > 0) {
      console.log('🔄 Filters changed, clearing flight results and chat history');
      // Clear system messages (chat history)
      setSystemMessages([]);
      // Clear flight results as requested by user
      setSearchResults([]);
      setLocationFlightResults({});
      setExpandedLocationsForSearch(new Set());
    }
  }, [filterVersion]);

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
    console.log('💾 Persisting addedFlightIds:', Array.from(addedFlightIds));
    localStorage.setItem(`bd-added-${tripId}`, JSON.stringify(Array.from(addedFlightIds)));
  }, [addedFlightIds, tripId]);

  // Persist expanded location state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-loc-expanded-${tripId}`, JSON.stringify(Array.from(expandedLocationsForSearch)));
  }, [expandedLocationsForSearch, tripId]);

  // Persist per-location flight results (compressed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const compact: Record<string, any[]> = {};
      for (const [loc, flights] of Object.entries(locationFlightResults)) {
        compact[loc] = compressFlightData(flights);
      }
      const dataString = JSON.stringify(compact);
      localStorage.setItem(`bd-loc-results-${tripId}`, dataString);
    } catch (err) {
      console.warn('Failed to persist location flight results', err);
    }
  }, [locationFlightResults, tripId]);

  // Persist system messages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`bd-system-messages-${tripId}`, JSON.stringify(systemMessages));
    } catch (err) {
      console.warn('Failed to persist system messages', err);
    }
  }, [systemMessages, tripId]);



  // Clean up old localStorage data to prevent quota issues
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      // Check total localStorage usage
      let totalSize = 0;
      const budgetDiscoveryKeys = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('budget-discovery')) {
          budgetDiscoveryKeys.push(key);
          totalSize += localStorage.getItem(key)?.length || 0;
        }
      }
      
      // If total size exceeds 3MB, remove oldest data
      if (totalSize > 3 * 1024 * 1024) {
        console.warn('localStorage quota exceeded, cleaning up old budget discovery data');
        
        // Remove old data for other trips (keep current trip)
        budgetDiscoveryKeys.forEach(key => {
          if (!key.includes(tripId)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to clean up localStorage:', error);
    }
  }, [tripId]);

  // Helper function to compress flight data for localStorage
  const compressFlightData = (flights: FlightResult[]) => {
    return flights.map(flight => ({
      id: flight.id,
      searchId: flight.searchId,
      route: flight.route,
      dates: flight.dates,
      price: flight.price,
      duration: flight.duration,
      airlines: flight.airlines,
      connections: flight.connections,
      destinationContext: flight.destinationContext,
      destinationAirport: flight.destinationAirport,
      // Only keep essential offer data, remove large objects
      offer: {
        id: flight.offer?.id,
        total_amount: flight.offer?.total_amount,
        total_currency: flight.offer?.total_currency,
        owner: flight.offer?.owner,
        // Keep minimal slice data for timeline compatibility
        slices: flight.offer?.slices?.map((slice: any) => ({
          origin: slice.origin,
          destination: slice.destination,
          departure_datetime: slice.departure_datetime,
          arrival_datetime: slice.arrival_datetime,
          duration: slice.duration,
        })) || [],
      },
      score: flight.score,
    }));
  };

  // Save results to localStorage whenever they change (with compression)
  useEffect(() => {
    if (typeof window !== 'undefined' && searchResults.length > 0) {
      try {
        const compressedData = compressFlightData(searchResults);
        const dataString = JSON.stringify(compressedData);
        
        // Check if data is too large (localStorage limit is ~5-10MB)
        if (dataString.length > 4 * 1024 * 1024) { // 4MB limit
          console.warn('Flight data too large for localStorage, truncating to latest 50 flights');
          const truncatedData = compressedData.slice(-50); // Keep only latest 50 flights
          localStorage.setItem(`budget-discovery-results-${tripId}`, JSON.stringify(truncatedData));
        } else {
          localStorage.setItem(`budget-discovery-results-${tripId}`, dataString);
        }
      } catch (error) {
        console.error('Failed to save flight results to localStorage:', error);
        // If still failing, try with even more compression
        try {
          const minimalData = searchResults.slice(-20).map(flight => ({
            id: flight.id,
            route: flight.route,
            price: flight.price,
            destinationContext: flight.destinationContext,
            destinationAirport: flight.destinationAirport,
          }));
          localStorage.setItem(`budget-discovery-results-${tripId}`, JSON.stringify(minimalData));
        } catch (fallbackError) {
          console.error('Failed to save even minimal flight data:', fallbackError);
        }
      }
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
      // Include filter parameters in the request body
      filters: {
        tripType,
        passengers,
        cabinClass,
        maxStops,
        priceFilter,
      },
      filterVersion, // Include filter version to detect changes
    },
    // Save chat history to localStorage
    onFinish: async (message) => {
      // Check if the message contains flight search results
      const messageAny = message as any;
      const hasBudgetDiscovery = messageAny?.toolInvocations?.some((call: any) => call.toolName === 'budgetDiscovery');
      const hasAddToTimeline = messageAny?.toolInvocations?.some((call: any) => call.toolName === 'addToTimeline');
      
      if (hasBudgetDiscovery) {
        console.log('🔍 Flight search results detected');
        setIsLoading(false);
        // Extract flight results from the message
        extractFlightResults(messageAny);
      } else if (hasAddToTimeline) {
        console.log('📝 Add to timeline completed');
        // Clear loading state for addToTimeline calls
        setIsLoading(false);
        setProgress(null);
        // Refresh the router to update timeline after a short delay
        // This ensures the optimistic UI update has been processed
        setTimeout(() => {
          try { 
            router.refresh(); 
            console.log('🔄 Router refreshed after add to timeline');
          } catch (error) {
            console.warn('Failed to refresh router:', error);
          }
        }, 200);
      } else {
        // If no specific tool was called, stop the loading state
        setIsLoading(false);
        setProgress(null);
      }

      // If timeline was modified by a tool, refresh the server components
      if (hasAddToTimeline) {
        try { router.refresh(); } catch (_) {}
      }
      
      // Save messages to localStorage with proper serialization and error handling
      if (typeof window !== 'undefined') {
        try {
          const allMessages = [...messages, message];
          const serializedMessages = serializeMessages(allMessages);
          const messageString = JSON.stringify(serializedMessages);
          
          // Check if chat data is too large
          if (messageString.length > 2 * 1024 * 1024) { // 2MB limit for chat
            console.warn('Chat data too large for localStorage, keeping only latest 50 messages');
            const truncatedMessages = allMessages.slice(-50);
            localStorage.setItem(`budget-discovery-chat-${tripId}`, JSON.stringify(serializeMessages(truncatedMessages)));
          } else {
            localStorage.setItem(`budget-discovery-chat-${tripId}`, messageString);
          }
        } catch (error) {
          console.error('Failed to save chat messages to localStorage:', error);
          // If still failing, try with minimal data
          try {
            const minimalMessages = [...messages, message].slice(-20).map(msg => ({
              role: msg.role,
              content: msg.content?.substring(0, 500), // Truncate content
            }));
            localStorage.setItem(`budget-discovery-chat-${tripId}`, JSON.stringify(minimalMessages));
          } catch (fallbackError) {
            console.error('Failed to save even minimal chat data:', fallbackError);
          }
        }
      }
    },
    onResponse: (response) => {
      // Skip loading state if we're just adding flight details
      if (isAddingFlightDetails.current) {
        return;
      }
      
      // Only set loading state for actual tool calls initiated by user input
      try {
        const responseText = response.body?.toString() || '';
        // Check if this is a real tool call initiated by user input
        const isUserToolCall = responseText.includes('"toolInvocations"') && 
                              (responseText.includes('budgetDiscovery') || responseText.includes('findFlight'));
        
        // Don't set loading state for addToTimeline calls as they should be quick
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
    // Load initial messages from localStorage with proper deserialization
    initialMessages: (() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`budget-discovery-chat-${tripId}`);
        return saved ? deserializeMessages(JSON.parse(saved)) : [];
      }
      return [];
    })(),
  });


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
    
    // Also ensure expanded location results are properly restored
    const savedExpandedResults = localStorage.getItem(`bd-loc-results-${tripId}`);
    if (savedExpandedResults && Object.keys(locationFlightResults).length === 0) {
      try {
        const parsed: Record<string, any[]> = JSON.parse(savedExpandedResults);
        const restored: Record<string, FlightResult[]> = {};
        for (const [loc, flights] of Object.entries(parsed)) {
          restored[loc] = (flights || []).map((flight: any) => ({
            id: flight.id || '',
            searchId: flight.searchId || '',
            route: flight.route || { origin: '', destination: '' },
            dates: flight.dates || { departure: '', return: undefined },
            price: flight.price || { total: 0, currency: 'USD' },
            duration: flight.duration || { outbound: 'PT0H0M', return: undefined, total: 'PT0H0M' },
            airlines: flight.airlines || [],
            connections: flight.connections || 0,
            offer: flight.offer || null,
            score: flight.score || 0,
            destinationContext: flight.destinationContext || 'Unknown',
            destinationAirport: flight.destinationAirport || { iata_code: '', city_name: '', country_name: '' },
            airline: flight.airline,
            timing: flight.timing,
            segments: flight.segments,
            timelineData: flight.timelineData,
          } as FlightResult));
        }
        setLocationFlightResults(restored);
      } catch (error) {
        console.warn('Failed to restore expanded location results:', error);
      }
    }
  // run once on mount and when tripId changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // Save scroll position when component unmounts or tab changes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (chatScrollRef.current) {
        savedScrollPosition.current = chatScrollRef.current.scrollTop;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload(); // Save on cleanup
    };
  }, []);

  // Restore scroll position when component mounts
  useEffect(() => {
    if (chatScrollRef.current && savedScrollPosition.current > 0) {
      // Use setTimeout to ensure the chat has rendered
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = savedScrollPosition.current;
        }
      }, 100);
    }
  }, [messages, systemMessages]);

  // Normalize incoming flight result (handles both old cleaned shape and new FlightOption shape)
  const normalizeFlightResult = (raw: any): FlightResult => {
    const id: string = raw.id || raw.offer?.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const route = raw.route || {
      origin: raw.slices?.[0]?.origin?.iata_code || raw.timelineData?.slices?.[0]?.origin?.iata_code || "",
      destination: raw.slices?.[0]?.destination?.iata_code || raw.timelineData?.slices?.[0]?.destination?.iata_code || "",
    };

    // Prioritize actual flight departure dates from the offer data
    // For budget discovery results, the raw object IS the Duffel offer
    const actualDepartureDate = raw.slices?.[0]?.segments?.[0]?.departing_at || 
                               raw.slices?.[0]?.departure_datetime || 
                               raw.offer?.slices?.[0]?.departure_datetime || 
                               raw.timelineData?.slices?.[0]?.departure_datetime || 
                               raw.dates?.departure || "";
    
    const actualReturnDate = raw.slices?.[1]?.segments?.[0]?.departing_at || 
                            raw.slices?.[1]?.departure_datetime || 
                            raw.offer?.slices?.[1]?.departure_datetime || 
                            raw.timelineData?.slices?.[1]?.departure_datetime || 
                            raw.dates?.return || undefined;
    
    const dates = {
      departure: actualDepartureDate,
      return: actualReturnDate,
    };

    const price = raw.price || {
      total: typeof raw.total === 'number' ? raw.total : (parseFloat(raw.total_amount || raw.offer?.total_amount) || 0),
      currency: raw.currency || raw.total_currency || raw.offer?.total_currency || 'USD',
    };

    const duration = raw.duration || {
      outbound: raw.slices?.[0]?.duration || raw.timing?.duration || "PT0H0M",
      return: raw.slices?.[1]?.duration || undefined,
      total: raw.slices?.[0]?.duration || raw.timing?.duration || "PT0H0M",
    };

    const airlines: string[] = raw.airlines || (
      raw.owner?.iata_code ? [raw.owner.iata_code] : 
      raw.offer?.owner?.iata_code ? [raw.offer.owner.iata_code] : 
      raw.airline?.code ? [raw.airline.code] : []
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

      // Check if this is a location-specific search by looking at the user message
      const isLocationSpecificSearch = message.content && 
        (message.content.includes('Find 10 flights to') || 
         message.content.includes('Find flights to'));
      
      let targetLocation = '';
      if (isLocationSpecificSearch) {
        // Extract location name from the search message
        const match = message.content.match(/Find.*flights to ([^(]+)/);
        if (match) {
          targetLocation = match[1].trim();
        }
      }
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
                  if (firstResult && (firstResult.price || firstResult.route || firstResult.id || firstResult.total_amount || firstResult.slices)) {
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
                  
                  // Handle location-specific search results
                  if (isLocationSpecificSearch && targetLocation) {
                    setLocationFlightResults(prev => ({
                      ...prev,
                      [targetLocation]: normalized
                    }));
                    console.log(`✅ Stored ${normalized.length} flights for location: ${targetLocation}`);
                  } else {
                                      // Regular budget discovery results
                  mergeResults(normalized);
                  console.log(`✅ Extracted flight results from ${toolCall.toolName} tool call:`, flightData.length);
                  console.log(`🔍 Normalized results:`, normalized.map(f => ({
                    id: f.id,
                    destination: f.destinationAirport?.city_name || f.route?.destination,
                    price: f.price?.total,
                    context: f.destinationContext
                  })));
                  }
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

  // Debug: Log total flights before filtering
  console.log(`🔍 Total flights before filtering: ${searchResults.length}`);
  console.log(`🔍 Price filter: ${priceFilter ? `$${priceFilter}` : 'None'}`);
  
  const sortedAndFilteredResults = searchResults
    .filter((flight) => {
      // Filter out invalid flight data
      if (!flight || !flight.route || !flight.price) {
        console.warn('Invalid flight data:', flight);
        return false;
      }
      
      // Debug price filtering
      if (priceFilter && flight.price.total > priceFilter) {
        console.log(`🔍 Flight filtered out by price: $${flight.price.total} > $${priceFilter} (${flight.route.origin}-${flight.route.destination})`);
        return false;
      }
      
      if (destinationFilter && !flight.destinationContext.toLowerCase().includes(destinationFilter.toLowerCase())) return false;
      return true;
    });
    
  // Debug: Log total flights after filtering
  console.log(`🔍 Total flights after filtering: ${sortedAndFilteredResults.length}`);
  
  const sortedResults = sortedAndFilteredResults.sort((a, b) => {
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

  // For each location, keep only the cheapest flight initially (poster flight)
  const posterFlights = Object.entries(groupedFlights).reduce((acc, [idea, locations]) => {
    acc[idea] = {};
    Object.entries(locations).forEach(([location, flights]) => {
      // Sort flights by price and take the cheapest one as the poster flight
      const sortedFlights = [...flights].sort((a, b) => a.price.total - b.price.total);
      acc[idea][location] = [sortedFlights[0]]; // Only show the cheapest flight initially
    });
    return acc;
  }, {} as Record<string, Record<string, FlightResult[]>>);

  // Sort regions and countries (using poster flights for display)
  const sortedRegions = Object.entries(posterFlights)
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

  // Calculate total flights including expanded flights
  const getTotalFlightCount = () => {
    let total = searchResults.length;
    
    // Add flights from expanded locations
    for (const [location, flights] of Object.entries(locationFlightResults)) {
      total += flights.length;
    }
    
    return total;
  };

  // Sort flights for a specific location
  const getSortedFlightsForLocation = (location: string) => {
    const allFlights = [];
    
    // Add poster flight (cheapest from initial search)
    // Find the region that contains this location
    const regionData = sortedRegions.find(r => 
      r.countries.some(c => c.country === location)
    );
    if (regionData) {
      const locationData = regionData.countries.find(c => c.country === location);
      if (locationData && locationData.flights.length > 0) {
        allFlights.push(locationData.flights[0]); // Poster flight
      }
    }
    
    // Add expanded flights
    if (locationFlightResults[location]) {
      allFlights.push(...locationFlightResults[location]);
    }
    
    // Sort based on location-specific settings
    const sortBy = locationSortBy[location] || 'price';
    const sortOrder = locationSortOrder[location] || 'asc';
    
    return allFlights.sort((a, b) => {
      let aValue: number, bValue: number;
      
      if (sortBy === 'price') {
        aValue = a.price?.total || 0;
        bValue = b.price?.total || 0;
      } else { // date
        aValue = a.dates?.departure ? new Date(a.dates.departure).getTime() : 0;
        bValue = b.dates?.departure ? new Date(b.dates.departure).getTime() : 0;
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // Calculate total flights for a specific region including expanded flights
  const getRegionFlightCount = (region: string) => {
    // Get the base count from the region data
    const regionData = sortedRegions.find(r => r.region === region);
    if (!regionData) return 0;
    
    let total = regionData.totalFlights;
    
    // Add flights from expanded locations within this region
    for (const [location, flights] of Object.entries(locationFlightResults)) {
      // Check if this location belongs to the current region
      const belongsToRegion = regionData.countries.some(country => country.country === location);
      if (belongsToRegion) {
        total += flights.length;
      }
    }
    
    return total;
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

  const handleLocationClick = async (locationName: string, destinationAirport: string) => {
    // Toggle expanded state
    const isExpanded = expandedLocationsForSearch.has(locationName);
    setExpandedLocationsForSearch(prev => {
      const newSet = new Set(prev);
      if (isExpanded) newSet.delete(locationName); else newSet.add(locationName);
      return newSet;
    });

    if (isExpanded) return; // collapsing

    // If already loaded or currently loading, do nothing
    if (locationFlightResults[locationName] || loadingMoreFlights.has(locationName)) return;

    // Set loading state to prevent spam clicking
    setLoadingMoreFlights(prev => new Set(prev).add(locationName));
    
          // Fetch more flights directly via API (avoid chat) - FAST VERSION
      try {
        const origin = searchResults[0]?.route?.origin || 'JFK';
        const res = await fetch('/api/find-flights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
          origin, 
          destination: destinationAirport, 
          months: 6, // Keep 6 months for good coverage
          maxResults: 8, // Slightly reduced for speed while keeping good coverage
          directOnly: maxStops === 0, // If user chose direct only, hint backend
          passengers,
          cabinClass,
          tripType
        })
        });
      const data = await res.json();
      if (data?.success && Array.isArray(data.results)) {
        // Normalize
        let normalized = data.results.map((r: any) => normalizeFlightResult({
          ...r,
          destinationContext: locationName,
          destinationAirport: { iata_code: destinationAirport, city_name: locationName, country_name: '' },
        }));
        // Apply client-side filters that backend doesn't enforce
        if (typeof priceFilter === 'number' && priceFilter > 0) {
          normalized = normalized.filter(f => (f.price?.total ?? 0) <= priceFilter);
        }
        if (typeof maxStops === 'number' && maxStops >= 0) {
          normalized = normalized.filter(f => (f.connections ?? 0) <= maxStops);
        }
        // Deduplicate expanded results by fingerprint (route+date+airline+price)
        setLocationFlightResults(prev => {
          const existing = prev[locationName] || [];
          const byFingerprint = new Map<string, any>();
          const makeKey = (f: any) => `${getFlightFingerprint(f)}-${f.price?.total ?? 0}`;
          [...existing, ...normalized].forEach((f) => byFingerprint.set(makeKey(f), f));
          return { ...prev, [locationName]: Array.from(byFingerprint.values()) };
        });
        
        // Clear loading state
        setLoadingMoreFlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(locationName);
          return newSet;
        });
        
        // Add the expanded flight results to the chat so the AI knows about them
        const flightDetails = normalized.map((flight: FlightResult) => {
          const airline = flight.offer?.owner?.name || flight.airline?.name || flight.airlines?.[0] || 'Unknown Airline';
          const departureDate = flight.dates?.departure ? formatDate(flight.dates.departure) : 'Unknown Date';
          const price = formatPrice(flight.price.total, flight.price.currency);
          const duration = formatDuration(flight.duration.outbound);
          const connections = flight.connections > 0 ? ` (${flight.connections} stop${flight.connections > 1 ? 's' : ''})` : ' (Direct)';
          
          return `${airline} flight ${flight.route.origin} → ${flight.route.destination} on ${departureDate} for ${price} - ${duration}${connections}`;
        }).join('\n');
        
        const systemMessage = `I found ${normalized.length} flights to ${locationName}:\n\n${flightDetails}\n\nYou can now reference these flights when adding them to the timeline.`;
        
        // Add as a system message to avoid triggering AI response
        const newSystemMessage = {
          id: `expanded-flights-${locationName}-${Date.now()}`,
          content: systemMessage,
          timestamp: new Date(Date.now() - 5000) // Set timestamp 5 seconds ago to ensure it appears before new messages
        };
        setSystemMessages(prev => [...prev, newSystemMessage]);
        
      } else {
        console.warn('No results returned for location', locationName, data);
        setLocationFlightResults(prev => ({ ...prev, [locationName]: [] }));
      }
    } catch (error) {
      console.error('Error fetching more flights to location:', error);
      setLocationFlightResults(prev => ({ ...prev, [locationName]: [] }));
    } finally {
      // Clear loading state in all cases
      setLoadingMoreFlights(prev => {
        const newSet = new Set(prev);
        newSet.delete(locationName);
        return newSet;
      });
    }
  };

  // Load 10 more flights for an expanded location
  const handleLoadMoreFlights = async (locationName: string, destinationAirport: string) => {
    // Set loading state
    setLoadingMoreFlights(prev => new Set(prev).add(locationName));
    
    try {
      const origin = searchResults[0]?.route?.origin || 'JFK';
      const res = await fetch('/api/find-flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          origin, 
          destination: destinationAirport, 
          months: 6, // Keep 6 months for good coverage
          maxResults: 8, // Slightly reduced for speed while keeping good coverage
          directOnly: maxStops === 0,
          passengers,
          cabinClass,
          tripType
        })
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.results)) {
        let normalized = data.results.map((r: any) => normalizeFlightResult({
          ...r,
          destinationContext: locationName,
          destinationAirport: { iata_code: destinationAirport, city_name: locationName, country_name: '' },
        }));
        if (typeof priceFilter === 'number' && priceFilter > 0) {
          normalized = normalized.filter(f => (f.price?.total ?? 0) <= priceFilter);
        }
        if (typeof maxStops === 'number' && maxStops >= 0) {
          normalized = normalized.filter(f => (f.connections ?? 0) <= maxStops);
        }
        setLocationFlightResults(prev => {
          const existing = prev[locationName] || [];
          // Dedupe by fingerprint (route+date+airline+price) instead of offer id
          const byFingerprint = new Map<string, any>();
          const makeKey = (f: any) => `${getFlightFingerprint(f)}-${f.price?.total ?? 0}`;
          ;[...existing, ...normalized].forEach((f) => byFingerprint.set(makeKey(f), f));
          return { ...prev, [locationName]: Array.from(byFingerprint.values()) };
        });
        
        // Add the additional flight results to the chat so the AI knows about them
        const flightDetails = normalized.map((flight: FlightResult) => {
          const airline = flight.offer?.owner?.name || flight.airline?.name || flight.airlines?.[0] || 'Unknown Airline';
          const departureDate = flight.dates?.departure ? formatDate(flight.dates.departure) : 'Unknown Date';
          const price = formatPrice(flight.price.total, flight.price.currency);
          const duration = formatDuration(flight.duration.outbound);
          const connections = flight.connections > 0 ? ` (${flight.connections} stop${flight.connections > 1 ? 's' : ''})` : ' (Direct)';
          
          return `${airline} flight ${flight.route.origin} → ${flight.route.destination} on ${departureDate} for ${price} - ${duration}${connections}`;
        }).join('\n');
        
        const systemMessage = `I found ${normalized.length} more flights to ${locationName}:\n\n${flightDetails}\n\nYou can now reference these flights when adding them to the timeline.`;
        
        // Add as a system message to avoid triggering AI response
        const newSystemMessage = {
          id: `more-flights-${locationName}-${Date.now()}`,
          content: systemMessage,
          timestamp: new Date(Date.now() - 5000) // Set timestamp 5 seconds ago to ensure it appears before new messages
        };
        setSystemMessages(prev => [...prev, newSystemMessage]);
      }
    } catch (error) {
      console.error('Error loading more flights:', error);
    } finally {
      // Clear loading state
      setLoadingMoreFlights(prev => {
        const newSet = new Set(prev);
        newSet.delete(locationName);
        return newSet;
      });
    }
  };

  const handleAddToTimeline = async (flight: FlightResult, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the card click
    
    try {
      // Set flag to prevent loading state from being triggered
      isAddingFlightDetails.current = true;
      
      // IMMEDIATELY mark as added in UI for instant feedback
      setAddedFlightIds((prev) => {
        const newSet = new Set<string>(prev);
        newSet.add(flight.id);
        console.log('✅ Optimistically marked flight as added:', flight.id, 'New set size:', newSet.size);
        return newSet;
      });
      
      // Get airline name
      const airlineName = flight.offer?.owner?.name || 
                         flight.airline?.name || 
                         (Array.isArray(flight.airlines) && flight.airlines.length > 0 ? flight.airlines[0] : 'Unknown Airline');
      
      // Get departure date
      const departureDate = flight.dates?.departure ? formatDate(flight.dates.departure) : 'Unknown Date';
      
      // Get destination
      const destination = flight.destinationAirport?.city_name || flight.route.destination;
      const origin = flight.route.origin;
      
      // Get price
      const price = formatPrice(flight.price.total, flight.price.currency);
      
      // Create a more specific message that includes all the details the AI needs
      const message = `Add this specific flight to my timeline: ${airlineName} flight ${origin} → ${destination} on ${departureDate} for ${price} (Flight ID: ${flight.id})`;

      console.log('📤 Sending add to timeline message:', message);

      // Use chat append to send without navigation
      await append({ role: 'user', content: message });

      console.log('✅ Message sent successfully, flight should be added to timeline');
      // Guaranteed local ack in chat so the user always sees confirmation
      try {
        const ack = {
          id: `ack-add-${flight.id}-${Date.now()}`,
          content: `I've added the ${airlineName} flight ${origin} → ${destination} on ${departureDate} to your timeline.`,
          timestamp: new Date(),
        };
        setSystemMessages(prev => [...prev, ack]);
      } catch (e) {
        // noop
      }
      
      // Don't refresh router immediately - let the onFinish callback handle it
      // This prevents the component from re-rendering and losing the optimistic state
      
    } catch (error) {
      console.error('❌ Error adding flight to timeline:', error);
      // Revert the optimistic update on error
      setAddedFlightIds((prev) => {
        const newSet = new Set<string>(prev);
        newSet.delete(flight.id);
        console.log('🔄 Reverted optimistic update due to error:', flight.id);
        return newSet;
      });
    } finally {
      // Clear the flag after a short delay to ensure the response is processed
      setTimeout(() => {
        isAddingFlightDetails.current = false;
      }, 100);
    }
  };

  const isLoadingChat = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full p-4 gap-4">
      {/* Chat Section */}
      <div className="flex-1 min-w-0 overflow-hidden border border-gray-700 rounded-lg bg-gray-900/30">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-gray-200">Budget Discovery Chat</h2>
            <p className="text-sm text-gray-400">
              Ask me to find the best flight deals across months and destinations
            </p>
            
            {/* Filter Controls */}
            <div className="mt-4 flex flex-wrap gap-2">
              {/* Trip Type */}
              <div className="relative">
                <select
                  value={tripType}
                  onChange={(e) => {
                    setTripType(e.target.value as 'round-trip' | 'one-way');
                    localStorage.setItem(`bd-tripType-${tripId}`, e.target.value);
                    setFilterVersion(prev => prev + 1);
                  }}
                  className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="round-trip">Round trip</option>
                  <option value="one-way">One way</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Passengers */}
              <div className="relative">
                <select
                  value={passengers}
                  onChange={(e) => {
                    setPassengers(Number(e.target.value));
                    localStorage.setItem(`bd-passengers-${tripId}`, e.target.value);
                    setFilterVersion(prev => prev + 1);
                  }}
                  className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <option key={num} value={num}>{num} {num === 1 ? 'passenger' : 'passengers'}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Cabin Class */}
              <div className="relative">
                <select
                  value={cabinClass}
                  onChange={(e) => {
                    setCabinClass(e.target.value as 'economy' | 'premium_economy' | 'business' | 'first');
                    localStorage.setItem(`bd-cabinClass-${tripId}`, e.target.value);
                    setFilterVersion(prev => prev + 1);
                  }}
                  className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium Economy</option>
                  <option value="business">Business</option>
                  <option value="first">First Class</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Stops */}
              <div className="relative">
                <select
                  value={maxStops ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : Number(e.target.value);
                    setMaxStops(value);
                    localStorage.setItem(`bd-maxStops-${tripId}`, value?.toString() ?? '');
                    setFilterVersion(prev => prev + 1);
                  }}
                  className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Any stops</option>
                  <option value="0">Direct only</option>
                  <option value="1">Max 1 stop</option>
                  <option value="2">Max 2 stops</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Price */}
              <input
                type="number"
                placeholder="Any price"
                value={priceFilter?.toString() ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? null : Number(e.target.value);
                  setPriceFilter(value);
                  localStorage.setItem(`bd-priceFilter-${tripId}`, value?.toString() ?? '');
                  setFilterVersion(prev => prev + 1);
                }}
                className="bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                min="0"
                step="50"
              />
            </div>

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
          <div className="flex-1 min-h-0 overflow-hidden" ref={chatScrollRef}>
            <Chat
              messages={[...messages, ...systemMessages.map(msg => ({
                role: 'assistant' as const,
                content: msg.content,
                id: msg.id,
                createdAt: msg.timestamp
              }))].sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return aTime - bTime;
              })}
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
      <div className="flex-1 min-w-0 overflow-hidden border border-gray-700 rounded-lg bg-gray-900/30">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-gray-700 p-6 bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-200">Flight Results</h2>

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                >
                  Clear History
                </Button>
              </div>
            </div>


          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-gray-200">Flights by Idea</h3>
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
                            {getRegionFlightCount(region)} flights across {countries.length} locations • Avg: {formatPrice(avgPrice, 'USD')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">{getRegionFlightCount(region)}</Badge>
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
                          {region} • {getRegionFlightCount(region)} flights across {countries.length} locations
                        </div>
                        {countries.map(({ country, flights, count, avgPrice }) => {
                          const posterFlight = flights[0]; // The cheapest flight (poster flight)
                          const destinationAirport = posterFlight?.destinationAirport?.iata_code || posterFlight?.route?.destination || '';
                          const isExpanded = expandedLocationsForSearch.has(country);
                          
                          return (
                            <div key={country} className="border border-gray-600 rounded-lg overflow-hidden">
                              {/* Location header with poster flight */}
                              <div
                                className="w-full p-3 bg-gray-700/50 hover:bg-gray-600/50 cursor-pointer flex items-center justify-between"
                                onClick={() => handleLocationClick(country, destinationAirport)}
                              >
                                <div className="flex items-center space-x-3">
                                  <MapPin className="h-4 w-4 text-green-400" />
                                  <div className="text-left">
                                    <h5 className="font-medium text-gray-200 capitalize">{country}</h5>
                                    <p className="text-xs text-gray-400">
                                      {(() => {
                                        const cheapest = getSortedFlightsForLocation(country)[0];
                                        return `Cheapest: ${formatPrice(cheapest?.price?.total || 0, cheapest?.price?.currency || 'USD')}`;
                                      })()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {/* Sorting buttons */}
                                  {isExpanded && (
                                    <div className="flex items-center space-x-1">
                                      <Button
                                        variant={locationSortBy[country] === 'price' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLocationSortBy(prev => ({
                                            ...prev,
                                            [country]: 'price'
                                          }));
                                        }}
                                        className="h-6 px-2 text-xs"
                                      >
                                        Price
                                      </Button>
                                      <Button
                                        variant={locationSortBy[country] === 'date' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLocationSortBy(prev => ({
                                            ...prev,
                                            [country]: 'date'
                                          }));
                                        }}
                                        className="h-6 px-2 text-xs"
                                      >
                                        Date
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLocationSortOrder(prev => ({
                                            ...prev,
                                            [country]: prev[country] === 'asc' ? 'desc' : 'asc'
                                          }));
                                        }}
                                        className="h-6 px-2 text-xs"
                                      >
                                        {locationSortOrder[country] === 'asc' ? '↑' : '↓'}
                                      </Button>
                                    </div>
                                  )}
                                  {isExpanded && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleLoadMoreFlights(country, destinationAirport); }}
                                      disabled={loadingMoreFlights.has(country)}
                                      className={`text-xs underline transition-colors ${
                                        loadingMoreFlights.has(country)
                                          ? 'text-gray-500 cursor-not-allowed'
                                          : 'text-blue-400 hover:text-blue-300'
                                      }`}
                                    >
                                      {loadingMoreFlights.has(country) ? (
                                        <span className="flex items-center gap-1">
                                          <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full"></div>
                                          Loading...
                                        </span>
                                      ) : (
                                        'Show 10 more'
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Show flights only when expanded (poster + extras) */}
                              {isExpanded && (
                                <div className="p-3 space-y-2 bg-gray-800/30 border-t border-gray-600">
                                  <div className="text-xs text-gray-400 mb-2">
                                    {country} • Flight options
                                  </div>
                                                                    <div className="space-y-2">
                                    {/* Display sorted flights */}
                                    {getSortedFlightsForLocation(country).map((flight: FlightResult) => (
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
                                                <Calendar className="h-2 w-2" />
                                                <span>Return</span>
                                              </div>
                                              <p className="text-gray-200">
                                                {flight.dates?.return ? formatDate(flight.dates.return) : '—'}
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
                                                {flight.airlines?.length > 0 ? flight.airlines.join(', ') : 'N/A'}
                                              </p>
                                            </div>
                                            <div className="space-y-1">
                                              <div className="flex items-center space-x-1 text-gray-400">
                                                <Plane className="h-2 w-2" />
                                                <span>Stops</span>
                                              </div>
                                              <p className="text-gray-200">
                                                {flight.connections === 0 ? 'Direct' : `${flight.connections} stop${flight.connections > 1 ? 's' : ''}`}
                                              </p>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                    
                                    {/* Loading state when fetching more flights */}
                                    {loadingMoreFlights.has(country) && (
                                      <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                                        <p className="text-gray-400 mt-2 text-xs">Searching for more flights to {country}...</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
