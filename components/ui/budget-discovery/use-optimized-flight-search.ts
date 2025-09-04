import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { FlightResult, FlightSearchParams } from './types';
import { convertOffersToFlightResults } from './convert-offers';
import { emitPerformanceEvent } from './performance-monitor';

// Cache for search results to avoid duplicate API calls
const searchCache = new Map<string, { results: FlightResult[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useOptimizedFlightSearch = () => {
  const [specificFlightSearchParams, setSpecificFlightSearchParams] = useState<FlightSearchParams | null>(null);
  const [specificFlightResults, setSpecificFlightResults] = useState<FlightResult[]>([]);
  const [isSpecificFlightLoading, setIsSpecificFlightLoading] = useState(false);

  // Generate cache key from search parameters
  const getCacheKey = useCallback((params: FlightSearchParams): string => {
    return `${params.origin}-${params.destination}-${params.departureDate?.toISOString().split('T')[0]}-${params.returnDate?.toISOString().split('T')[0] || 'oneway'}-${params.passengers}-${params.cabinClass}-${params.maxPrice || 'unlimited'}`;
  }, []);

  // Check cache first
  const getCachedResults = useCallback((params: FlightSearchParams): FlightResult[] | null => {
    const cacheKey = getCacheKey(params);
    const cached = searchCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log('🎯 Using cached results for:', cacheKey);
      return cached.results;
    }
    
    return null;
  }, [getCacheKey]);

  // Store results in cache
  const setCachedResults = useCallback((params: FlightSearchParams, results: FlightResult[]) => {
    const cacheKey = getCacheKey(params);
    searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
    console.log('💾 Cached results for:', cacheKey);
  }, [getCacheKey]);

  const handleOptimizedFlightSearch = async (searchParams: FlightSearchParams) => {
    const searchStartTime = Date.now();
    console.log('🚀 Starting optimized flight search with params:', searchParams);
    setSpecificFlightSearchParams(searchParams);
    
    // Check cache first
    const cachedResults = getCachedResults(searchParams);
    if (cachedResults) {
      const searchTime = Date.now() - searchStartTime;
      setSpecificFlightResults(cachedResults);
      emitPerformanceEvent(searchTime, cachedResults.length, true);
      toast.success(`Found ${cachedResults.length} flights (from cache)!`);
      return;
    }
    
    setIsSpecificFlightLoading(true);
    
    try {
      if (!searchParams.departureDate) {
        throw new Error('Departure date is required');
      }
      
      // Use direct API call instead of chat API for faster response
      const response = await fetch('/api/find-flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: searchParams.origin,
          to: searchParams.destination,
          date: searchParams.departureDate.toISOString().split('T')[0],
          returnDate: searchParams.returnDate?.toISOString().split('T')[0],
          passengers: searchParams.passengers,
          cabinClass: searchParams.cabinClass,
          maxResults: 10, // Limit results for faster response
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🔍 Direct API response:', data);
      
      if (data.success && data.data?.offers) {
        const flightResults = convertOffersToFlightResults(data.data.offers, searchParams);
        const searchTime = Date.now() - searchStartTime;
        
        setSpecificFlightResults(flightResults);
        setCachedResults(searchParams, flightResults);
        emitPerformanceEvent(searchTime, flightResults.length, false);
        
        if (flightResults.length > 0) {
          toast.success(`Found ${flightResults.length} flights!`);
        } else {
          toast.error("No flights found for the specified criteria.");
        }
      } else {
        throw new Error(data.error || 'No flight data received');
      }
      
    } catch (error) {
      console.error('Error in optimized flight search:', error);
      toast.error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSpecificFlightLoading(false);
    }
  };

  return {
    specificFlightSearchParams,
    specificFlightResults,
    isSpecificFlightLoading,
    handleSpecificFlightSearch: handleOptimizedFlightSearch,
  };
};
