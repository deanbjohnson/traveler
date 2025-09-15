import { useState, useEffect, useCallback } from 'react';
import { FlightResult } from './types';
import { normalizeFlightResult } from './normalize-flight-result';

interface UseLocationExpansionProps {
  tripId: string;
  chatMode: 'trip-discover' | 'specific-flight';
}

export const useLocationExpansion = ({ tripId, chatMode }: UseLocationExpansionProps) => {
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [locationFlightResults, setLocationFlightResults] = useState<Record<string, FlightResult[]>>({});
  const [loadingMoreFlights, setLoadingMoreFlights] = useState<Set<string>>(new Set());

  // Load expanded locations from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedExpanded = localStorage.getItem(`bd-loc-expanded-${tripId}-${chatMode}`);
      if (savedExpanded) {
        try {
          setExpandedLocations(new Set(JSON.parse(savedExpanded)));
        } catch (_) {
          setExpandedLocations(new Set());
        }
      }
    }
  }, [tripId, chatMode]);

  // Load location flight results from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`bd-loc-results-${tripId}-${chatMode}`);
      if (saved) {
        try {
          const restored = JSON.parse(saved);
          setLocationFlightResults(restored);
        } catch (_) {
          setLocationFlightResults({});
        }
      }
    }
  }, [tripId, chatMode]);

  // Save expanded locations to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`bd-loc-expanded-${tripId}-${chatMode}`, JSON.stringify(Array.from(expandedLocations)));
    }
  }, [expandedLocations, tripId, chatMode]);

  // Save location flight results to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Compress the data by only storing essential fields to prevent quota issues
        const compressedResults = Array.isArray(locationFlightResults) 
          ? locationFlightResults.map(result => ({
              id: result.id,
              route: result.route,
              dates: result.dates,
              price: result.price,
              duration: result.duration,
              airline: result.airline,
              stops: result.stops
            }))
          : [];
        
        const dataString = JSON.stringify(compressedResults);
        if (dataString.length > 1024 * 1024) { // 1MB limit
          console.warn('Location flight results too large, truncating to prevent quota issues');
          const truncatedResults = compressedResults.slice(0, 10); // Keep only first 10 results
          localStorage.setItem(`bd-loc-results-${tripId}-${chatMode}`, JSON.stringify(truncatedResults));
        } else {
          localStorage.setItem(`bd-loc-results-${tripId}-${chatMode}`, dataString);
        }
      } catch (error) {
        console.warn('Failed to save location flight results:', error);
        // Clear old data to make space
        try {
          localStorage.removeItem(`bd-loc-results-${tripId}-${chatMode}`);
        } catch (clearError) {
          console.warn('Failed to clear old location results:', clearError);
        }
      }
    }
  }, [locationFlightResults, tripId, chatMode]);

  const toggleLocation = useCallback((locationName: string) => {
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(locationName)) {
        newSet.delete(locationName);
      } else {
        newSet.add(locationName);
      }
      return newSet;
    });
  }, []);

  const loadMoreFlights = useCallback(async (
    locationName: string, 
    destinationAirport: string,
    searchParams: {
      origin: string;
      passengers: number;
      cabinClass: string;
      tripType: string;
      maxStops?: number;
      priceFilter?: number;
    }
  ) => {
    // If already loaded or currently loading, do nothing
    if (locationFlightResults[locationName] || loadingMoreFlights.has(locationName)) return;

    // Set loading state
    setLoadingMoreFlights(prev => new Set(prev).add(locationName));
    
    try {
      const res = await fetch('/api/flexible-flight-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          from: searchParams.origin, 
          to: destinationAirport, 
          months: 6, // Keep 6 months for good coverage
          maxResults: 8, // Slightly reduced for speed while keeping good coverage
          passengers: searchParams.passengers,
          cabinClass: searchParams.cabinClass,
          tripType: searchParams.tripType,
          maxStops: searchParams.maxStops
        })
      });
      
      const data = await res.json();
      
      if (data?.success && Array.isArray(data.results)) {
        // Flexible flight search results are already in FlightOption format with routing data
        // We just need to convert them to FlightResult format without losing the routing
        let normalized = data.results.map((r: any) => ({
          id: r.id || r.searchId || `flight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          searchId: r.searchId || '',
          route: r.route,
          dates: r.dates,
          price: r.price,
          duration: r.duration,
          airlines: r.airlines,
          connections: r.connections,
          routing: r.routing, // This is the key - preserve the routing data!
          offer: r.offer,
          score: r.score,
          destinationContext: locationName,
          destinationAirport: { 
            iata_code: destinationAirport, 
            city_name: locationName, 
            country_name: '' 
          },
          stops: r.connections, // Ensure stops matches connections
          cabinClass: r.cabinClass || 'economy'
        }));

        // Apply client-side filters
        if (typeof searchParams.priceFilter === 'number' && searchParams.priceFilter > 0) {
          normalized = normalized.filter((f: FlightResult) => (f.price?.total ?? 0) <= searchParams.priceFilter);
        }
        if (typeof searchParams.maxStops === 'number' && searchParams.maxStops >= 0) {
          normalized = normalized.filter((f: FlightResult) => (f.connections ?? 0) <= searchParams.maxStops);
        }


        // Deduplicate by fingerprint (route+date+airline+price)
        setLocationFlightResults(prev => {
          const existing = prev[locationName] || [];
          const byFingerprint = new Map<string, FlightResult>();
          const makeKey = (f: FlightResult) => `${f.route.origin}-${f.route.destination}-${f.dates?.departure?.slice(0,10)}-${f.offer?.owner?.iata_code || f.airlines?.[0] || ''}-${f.price?.total ?? 0}`;
          
          [...existing, ...normalized].forEach((f) => {
            byFingerprint.set(makeKey(f), f);
          });
          
          const finalResults = Array.from(byFingerprint.values());
          
          return { ...prev, [locationName]: finalResults };
        });
      }
    } catch (error) {
      console.error('Failed to load more flights:', error);
    } finally {
      // Clear loading state
      setLoadingMoreFlights(prev => {
        const newSet = new Set(prev);
        newSet.delete(locationName);
        return newSet;
      });
    }
  }, [locationFlightResults, loadingMoreFlights]);

  const toggleLocationWithAutoLoad = useCallback(async (
    locationName: string,
    destinationAirport: string,
    searchParams: {
      origin: string;
      passengers: number;
      cabinClass: string;
      tripType: string;
      maxStops?: number;
      priceFilter?: number;
    }
  ) => {
    const isExpanding = !expandedLocations.has(locationName);
    
    // Toggle the location
    setExpandedLocations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(locationName)) {
        newSet.delete(locationName);
      } else {
        newSet.add(locationName);
      }
      return newSet;
    });

    // If expanding and no flights loaded yet, auto-load more flights
    if (isExpanding && !locationFlightResults[locationName] && !loadingMoreFlights.has(locationName)) {
      await loadMoreFlights(locationName, destinationAirport, searchParams);
    }
  }, [expandedLocations, locationFlightResults, loadingMoreFlights, loadMoreFlights]);

  return {
    expandedLocations,
    locationFlightResults,
    loadingMoreFlights,
    toggleLocation,
    toggleLocationWithAutoLoad,
    loadMoreFlights,
    setLocationFlightResults
  };
};
