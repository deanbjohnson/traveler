"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/ui/chat";
import { FlightResultsAdapter } from './flight-results-adapter';
import { FlightResultsDisplay } from '../flight-results-display';
import { FlightSearchForm } from '../flight-search-form';
import { ModeToggle } from './mode-toggle';
import { FilterControls } from './filter-controls';
import { EmptyState } from './empty-state';
import { PerformanceMonitor } from './performance-monitor';
import { LocationGroupedResults } from './location-grouped-results';
import { useLocationExpansion } from './use-location-expansion';
import { useOptimizedChatSearch } from './use-optimized-chat-search';
import { useOptimizedFlightSearch } from './use-optimized-flight-search';
import { 
  TripDiscoverTabProps, 
  ChatMode, 
  ViewMode, 
  SortBy, 
  SortOrder, 
  TripType, 
  CabinClass,
  FlightResult 
} from './types';
import { formatPrice, formatDate, formatDuration, getFlightFingerprint } from './utils';

export function TripDiscoverTab({ tripId, timeline }: TripDiscoverTabProps) {
  // Chat mode state
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-chatMode-${tripId}`) as ChatMode) || 'trip-discover';
    }
    return 'trip-discover';
  });

  // Filter states
  const [tripType, setTripType] = useState<TripType>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-tripType-${tripId}`) as TripType) || 'round-trip';
    }
    return 'round-trip';
  });
  
  const [passengers, setPassengers] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem(`bd-passengers-${tripId}`)) || 1;
    }
    return 1;
  });
  
  const [cabinClass, setCabinClass] = useState<CabinClass>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-cabinClass-${tripId}`) as CabinClass) || 'economy';
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

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`bd-viewMode-${tripId}`) as ViewMode) || 'grouped';
    }
    return 'grouped';
  });

  const [addedFlightIds, setAddedFlightIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`bd-added-${tripId}`);
      if (saved) {
        try { return new Set<string>(JSON.parse(saved)); } catch (_) {}
      }
    }
    return new Set<string>();
  });

  // Timeline flight fingerprints
  const [timelineFlightFingerprints, setTimelineFlightFingerprints] = useState<Set<string>>(new Set());

  // Custom hooks - using optimized versions
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    searchResults,
    setSearchResults,
    isLoading,
    progress,
    systemMessages,
    handleAddToTimeline,
    append,
  } = useOptimizedChatSearch(tripId, chatMode, {
    tripType,
    passengers,
    cabinClass,
    maxStops,
    priceFilter
  });

  const {
    specificFlightSearchParams,
    specificFlightResults,
    isSpecificFlightLoading,
    handleSpecificFlightSearch,
  } = useOptimizedFlightSearch();

  // Location expansion management
  const {
    expandedLocations,
    locationFlightResults,
    loadingMoreFlights,
    toggleLocation,
    toggleLocationWithAutoLoad,
    loadMoreFlights,
    setLocationFlightResults
  } = useLocationExpansion({ tripId, chatMode });

  // Update timeline flight fingerprints when timeline changes
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

  // Persist added flights state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`bd-added-${tripId}`, JSON.stringify(Array.from(addedFlightIds)));
  }, [addedFlightIds, tripId]);

  const isLoadingChat = status === "submitted" || status === "streaming";

  // Helper function to convert FlightResult to the format expected by FlightResultsDisplay
  const convertFlightResult = (flight: FlightResult): import('../flight-results-display').FlightResult => {
    console.log('🔄 Converting flight result for display:', {
      id: flight.id,
      airline: flight.airline,
      airlines: flight.airlines,
      route: flight.route,
      dates: flight.dates,
      duration: flight.duration,
      price: flight.price
    });

    // Extract airline info with better fallbacks
    const airlineName = flight.airline?.name || 
                       flight.airlines?.[0] || 
                       flight.offer?.owner?.name || 
                       'Unknown Airline';
    
    const airlineCode = flight.airline?.code || 
                       airlineName.substring(0, 2).toUpperCase() ||
                       'UNK';

    // Extract timing info with better fallbacks
    const departureTime = flight.dates?.departure || 
                         flight.timing?.departure || 
                         flight.offer?.timelineData?.slices?.[0]?.segments?.[0]?.departing_at || '';
    
    const arrivalTime = flight.dates?.return || 
                       flight.timing?.arrival || 
                       flight.offer?.timelineData?.slices?.[0]?.segments?.[0]?.arriving_at || '';

    // Extract duration with better fallbacks
    const duration = flight.duration?.outbound || 
                    flight.duration?.total || 
                    flight.timing?.duration || 
                    flight.offer?.timelineData?.slices?.[0]?.duration || '';

    const converted = {
      id: flight.id,
      airline: {
        name: airlineName,
        code: airlineCode,
        logo: undefined
      },
      route: {
        from: flight.route.origin,
        to: flight.route.destination,
        fromCode: flight.route.origin,
        toCode: flight.route.destination
      },
      timing: {
        departure: departureTime,
        arrival: arrivalTime,
        duration: duration
      },
      price: {
        amount: flight.price.total,
        currency: flight.price.currency
      },
      stops: flight.connections || flight.stops || 0,
      cabinClass: flight.cabinClass || 'economy'
    };

    console.log('✅ Converted flight result:', converted);
    return converted;
  };

  // Wrapper function for adding flights to timeline from FlightResultsDisplay
  const handleAddToTripFromDisplay = (flight: import('../flight-results-display').FlightResult) => {
    const originalFlight: FlightResult = {
      id: flight.id,
      searchId: flight.id,
      route: {
        origin: flight.route.from,
        destination: flight.route.to
      },
      dates: {
        departure: flight.timing.departure,
        return: flight.timing.arrival
      },
      price: {
        total: flight.price.amount,
        currency: flight.price.currency
      },
      duration: {
        outbound: flight.timing.duration,
        return: undefined,
        total: flight.timing.duration
      },
      airlines: [flight.airline.name],
      connections: flight.stops,
      offer: null,
      score: 0,
      destinationContext: 'specific-flight-search',
      destinationAirport: {
        iata_code: flight.route.toCode,
        city_name: flight.route.to,
        country_name: 'Unknown'
      },
      stops: flight.stops,
      cabinClass: flight.cabinClass
    };
    
    handleAddToTimeline(originalFlight, {} as React.MouseEvent);
  };

  const clearHistory = () => {
    if (typeof window !== 'undefined') {
      // Clear localStorage
      localStorage.removeItem(`budget-discovery-results-${tripId}-${chatMode}`);
      localStorage.removeItem(`budget-discovery-chat-${tripId}-${chatMode}`);
      localStorage.removeItem(`bd-sortBy-${tripId}`);
      localStorage.removeItem(`bd-sortOrder-${tripId}`);
      localStorage.removeItem(`bd-priceFilter-${tripId}`);
      localStorage.removeItem(`bd-destFilter-${tripId}`);
      localStorage.removeItem(`bd-viewMode-${tripId}`);
      localStorage.removeItem(`bd-expanded-${tripId}`);
      localStorage.removeItem(`bd-loc-expanded-${tripId}-${chatMode}`);
      localStorage.removeItem(`bd-loc-results-${tripId}-${chatMode}`);
      localStorage.removeItem(`bd-system-messages-${tripId}-${chatMode}`);
      
      // Clear current state
      setAddedFlightIds(new Set());
      console.log('History cleared. Chat messages will be cleared on next page refresh.');
    }
  };

  return (
    <>
      <div className="flex h-full p-4 gap-4">
      {/* Chat Section */}
      <div className="flex-1 min-w-0 overflow-hidden border border-gray-700 rounded-lg bg-gray-900/30">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-700">
            {/* Mode Toggle */}
            <div className="flex items-center justify-between mb-4">
              <ModeToggle 
                chatMode={chatMode} 
                tripId={tripId} 
                onModeChange={setChatMode} 
              />
            </div>
            
            {chatMode === 'trip-discover' && (
              <>
                <h2 className="text-lg font-semibold text-gray-200">
                  Trip Discover Chat
                </h2>
                <p className="text-sm text-gray-400">
                  Ask me to find flights, plan your trip, and discover amazing destinations
                </p>
                
                {/* Filter Controls - Only show for Trip Discover mode */}
                <FilterControls
                  tripType={tripType}
                  passengers={passengers}
                  cabinClass={cabinClass}
                  maxStops={maxStops}
                  priceFilter={priceFilter}
                  onTripTypeChange={setTripType}
                  onPassengersChange={setPassengers}
                  onCabinClassChange={setCabinClass}
                  onMaxStopsChange={setMaxStops}
                  onPriceFilterChange={setPriceFilter}
                  tripId={tripId}
                />

                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">Try these examples:</p>
                  <ul className="text-xs text-gray-500 space-y-1 ml-4">
                    <li>• "Find cheap flights to warm places in the next 6 months"</li>
                    <li>• "Show me the best deals to Asia over the next year"</li>
                    <li>• "What are the cheapest flights to Europe in the next 3 months?"</li>
                    <li>• "Find budget-friendly trips to anywhere interesting"</li>
                  </ul>
                </div>
              </>
            )}
          </div>
          
          <div className="flex-1 min-h-0 overflow-hidden">
            {chatMode === 'specific-flight' ? (
              // Show flight search form instead of chat
              <div className="h-full p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-200 mb-2">Specific Flight Search</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Search for specific flights with exact dates and routes
                  </p>
                </div>
                
                <FlightSearchForm 
                  onSearch={handleSpecificFlightSearch}
                  isLoading={isSpecificFlightLoading}
                />
              </div>
            ) : (
              // Show chat for trip discover mode
              <Chat
                messages={[...messages, ...systemMessages.map((msg: any) => ({
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
            )}
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
                <h2 className="text-lg font-semibold text-gray-200">
                  {chatMode === 'trip-discover' ? 'Trip Results' : 'Flight Results'}
                </h2>

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
            ) : chatMode === 'specific-flight' ? (
              // Specific Flight Mode - Show flight results
              <div className="space-y-4">
                {specificFlightResults.length > 0 ? (
                  <FlightResultsDisplay
                    flights={specificFlightResults.map(convertFlightResult)}
                    onAddToTrip={handleAddToTripFromDisplay}
                    searchParams={specificFlightSearchParams ? {
                      origin: specificFlightSearchParams.origin,
                      destination: specificFlightSearchParams.destination,
                      departureDate: specificFlightSearchParams.departureDate!,
                      returnDate: specificFlightSearchParams.returnDate,
                      passengers: specificFlightSearchParams.passengers,
                      cabinClass: specificFlightSearchParams.cabinClass
                    } : undefined}
                  />
                ) : (
                  <EmptyState mode="specific-flight" />
                )}
              </div>
            ) : searchResults.length > 0 ? (
              // Trip Discover Mode - Show location-grouped results
              <LocationGroupedResults
                flights={searchResults}
                locationFlightResults={locationFlightResults}
                onAddToTrip={(flight, event) => handleAddToTimeline(flight, event)}
                onLoadMoreFlights={(locationName, destinationAirport) => {
                  loadMoreFlights(locationName, destinationAirport, {
                    origin: searchResults[0]?.route?.origin || 'JFK',
                    passengers: passengers,
                    cabinClass: cabinClass,
                    tripType: tripType,
                    maxStops: maxStops || undefined,
                    priceFilter: priceFilter || undefined
                  });
                }}
                loadingMoreFlights={loadingMoreFlights}
                expandedLocations={expandedLocations}
                onToggleLocation={(locationName) => {
                  const destinationAirport = searchResults.find((f: any) => 
                    (f.destinationAirport?.city_name || f.destinationContext) === locationName
                  )?.destinationAirport?.iata_code || '';
                  
                  toggleLocationWithAutoLoad(locationName, destinationAirport, {
                    origin: searchResults[0]?.route?.origin || 'JFK',
                    passengers: passengers,
                    cabinClass: cabinClass,
                    tripType: tripType,
                    maxStops: maxStops || undefined,
                    priceFilter: priceFilter || undefined
                  });
                }}
                addedFlightIds={addedFlightIds}
                onReplaceLeg={(data) => {
                  // Handle leg replacement
                  console.log('Leg replacement request:', data);
                  
                  // Create a new flight result with the replaced leg
                  const { flight, legType, newLeg, originalLeg, flightIndex } = data;
                  
                  // Debug: Log the flight data structure
                  console.log('Flight data structure:', {
                    id: flight.id,
                    route: flight.route,
                    dates: flight.dates,
                    price: flight.price
                  });
                  
                  // Calculate the price difference
                  const originalLegPrice = parseFloat(originalLeg.price || '0');
                  const newLegPrice = parseFloat(newLeg.price || '0');
                  const priceDifference = newLegPrice - originalLegPrice;
                  
                  // Create a new flight result by replacing the specified leg
                  const updatedFlight = {
                    ...flight,
                    // Update the specific leg data
                    ...(legType === 'outbound' ? {
                      dates: {
                        ...flight.dates,
                        departure: newLeg.departure
                      },
                      duration: {
                        ...flight.duration,
                        outbound: newLeg.duration
                      },
                      price: {
                        ...flight.price,
                        total: flight.price.total + priceDifference
                      }
                    } : {
                      dates: {
                        ...flight.dates,
                        return: newLeg.departure
                      },
                      duration: {
                        ...flight.duration,
                        return: newLeg.duration
                      },
                      price: {
                        ...flight.price,
                        total: flight.price.total + priceDifference
                      }
                    })
                  };
                  
                  // Update the flight results with the new flight
                  setSearchResults((prevResults: any) => {
                    console.log('🔍 Using flight index for replacement:', flightIndex);
                    console.log('🔍 Total search results:', prevResults.length);
                    
                    // Use index-based matching - much more reliable than ID matching
                    if (flightIndex >= 0 && flightIndex < prevResults.length) {
                      const matchingFlight = prevResults[flightIndex];
                      
                      // Debug: Log the flight structure before update
                      console.log('🔍 Original flight structure:', {
                        id: matchingFlight.id,
                        route: matchingFlight.route,
                        dates: matchingFlight.dates,
                        duration: matchingFlight.duration,
                        routing: matchingFlight.routing,
                        isRoundTrip: !!(matchingFlight.dates?.return && matchingFlight.duration?.return)
                      });
                      
                      console.log('🔍 New leg data:', {
                        route: newLeg.route,
                        departure: newLeg.departure,
                        duration: newLeg.duration,
                        price: newLeg.price,
                        legType
                      });
                      
                      // Create updated flight with new leg data
                      const updatedFlight = {
                        ...matchingFlight,
                        // Update the specific leg data
                        ...(legType === 'outbound' ? {
                          dates: {
                            ...matchingFlight.dates,
                            departure: newLeg.departure
                          },
                          duration: {
                            ...matchingFlight.duration,
                            outbound: newLeg.duration
                          },
                          price: {
                            ...matchingFlight.price,
                            total: matchingFlight.price.total - parseFloat(originalLeg.price || '0') + parseFloat(newLeg.price)
                          },
                          // Keep original routing - it's complex and route field already has the summary
                          routing: matchingFlight.routing
                        } : {
                          dates: {
                            ...matchingFlight.dates,
                            return: newLeg.departure
                          },
                          duration: {
                            ...matchingFlight.duration,
                            return: newLeg.duration
                          },
                          price: {
                            ...matchingFlight.price,
                            total: matchingFlight.price.total - parseFloat(originalLeg.price || '0') + parseFloat(newLeg.price)
                          },
                          // Keep original routing - it's complex and route field already has the summary
                          routing: matchingFlight.routing
                        })
                      };
                      
                      // Debug: Log the updated flight structure
                      console.log('🔍 Updated flight structure:', {
                        id: updatedFlight.id,
                        route: updatedFlight.route,
                        dates: updatedFlight.dates,
                        duration: updatedFlight.duration,
                        routing: updatedFlight.routing,
                        isRoundTrip: !!(updatedFlight.dates?.return && updatedFlight.duration?.return)
                      });
                      
                      // Update the flight in the results
                      const updatedResults = [...prevResults];
                      updatedResults[flightIndex] = updatedFlight;
                      
                      console.log('✅ Leg replaced successfully:', updatedFlight);
                      return updatedResults;
                    } else {
                      console.warn('❌ Invalid flight index! Index:', flightIndex, 'Total flights:', prevResults.length);
                      console.warn('Flight route:', flight.route, 'Flight dates:', flight.dates);
                      return prevResults;
                    }
                  });
                  
                  // Show success message
                  console.log('Leg replacement process completed');
                }}
              />
            ) : (
              <EmptyState mode="trip-discover" />
            )}
          </div>
        </div>
      </div>
      </div>
      
      {/* Performance Monitor - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <PerformanceMonitor isVisible={true} />
      )}
    </>
  );
}
