import React, { useState, useEffect } from 'react';
import { Button } from '../button';
import { Card, CardContent } from '../card';
import { Badge } from '../badge';
import { 
  MapPin, 
  Plane, 
  Clock, 
  DollarSign, 
  ChevronDown, 
  ChevronUp,
  Plus,
  Check,
  Edit
} from 'lucide-react';
import { FlightResult } from './types';
import { format } from 'date-fns';
import { LegEditModal } from './leg-edit-modal';

interface LocationGroupedResultsProps {
  flights: FlightResult[];
  locationFlightResults?: Record<string, FlightResult[]>;
  onAddToTrip: (flight: FlightResult, event: React.MouseEvent) => void;
  onLoadMoreFlights: (locationName: string, destinationAirport: string) => void;
  loadingMoreFlights: Set<string>;
  expandedLocations: Set<string>;
  onToggleLocation: (locationName: string) => void;
  addedFlightIds: Set<string>;
  onReplaceLeg?: (data: { flight: FlightResult, legType: 'outbound' | 'return', newLeg: any, originalLeg: any }) => void;
}

interface LocationGroup {
  name: string;
  flights: FlightResult[];
  avgPrice: number;
  cheapestPrice: number;
  currency: string;
  destinationAirport: string;
}

export function LocationGroupedResults({
  flights,
  locationFlightResults = {},
  onAddToTrip,
  onLoadMoreFlights,
  loadingMoreFlights,
  expandedLocations,
  onToggleLocation,
  addedFlightIds,
  onReplaceLeg
}: LocationGroupedResultsProps) {
  const [locationSortBy, setLocationSortBy] = useState<Record<string, 'price' | 'duration' | 'date'>>({});
  const [expandedFlights, setExpandedFlights] = useState<Set<string>>(new Set());
  const [addingToTimeline, setAddingToTimeline] = useState<Set<string>>(new Set());

  const toggleFlightExpansion = (flightId: string) => {
    setExpandedFlights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(flightId)) {
        newSet.delete(flightId);
      } else {
        newSet.add(flightId);
      }
      return newSet;
    });
  };

  // Handler function for leg replacement
  const handleReplaceLeg = (data: { flight: FlightResult, legType: 'outbound' | 'return', newLeg: any, originalLeg: any }) => {
    console.log('Replacing leg:', data);
    if (onReplaceLeg) {
      onReplaceLeg(data);
    }
  };

  const isFlightExpanded = (flightId: string) => expandedFlights.has(flightId);

  const handleAddToTrip = async (flight: FlightResult, event: React.MouseEvent) => {
    setAddingToTimeline(prev => new Set(prev).add(flight.id));
    try {
      await onAddToTrip(flight, event);
    } finally {
      // Remove loading state after a short delay to show feedback
      setTimeout(() => {
        setAddingToTimeline(prev => {
          const newSet = new Set(prev);
          newSet.delete(flight.id);
          return newSet;
        });
      }, 1000);
    }
  };

  // Group flights by destination
  const groupedFlights = React.useMemo(() => {
    const groups: Record<string, FlightResult[]> = {};
    
    flights.forEach(flight => {
      const locationName = flight.destinationAirport?.city_name || 
                          flight.destinationContext || 
                          flight.route.destination;
      
      if (!groups[locationName]) {
        groups[locationName] = [];
      }
      groups[locationName].push(flight);
    });

    // Convert to array and calculate stats
    return Object.entries(groups).map(([name, locationFlights]) => {
      const prices = locationFlights.map(f => f.price.total).filter(p => p > 0);
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const cheapestPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const currency = locationFlights[0]?.price.currency || 'USD';
      const destinationAirport = locationFlights[0]?.destinationAirport?.iata_code || 
                                locationFlights[0]?.route.destination || '';

      return {
        name,
        flights: locationFlights,
        avgPrice,
        cheapestPrice,
        currency,
        destinationAirport
      };
    });
  }, [flights]);

  // Sort flights within each location
  const getSortedFlightsForLocation = (locationName: string): FlightResult[] => {
    const group = groupedFlights.find(g => g.name === locationName);
    if (!group) return [];

    // Always use original flights first, then add expanded results as additional options
    const originalFlights = group.flights;
    const expandedFlights = locationFlightResults[locationName] || [];
    
    // Combine original flights with expanded flights, avoiding duplicates
    const allFlights = [...originalFlights];
    const existingFingerprints = new Set(
      originalFlights.map(f => `${f.route.origin}-${f.route.destination}-${f.dates?.departure?.slice(0,10)}-${f.price?.total}`)
    );
    
    // Add expanded flights that aren't duplicates
    expandedFlights.forEach(expandedFlight => {
      const fingerprint = `${expandedFlight.route.origin}-${expandedFlight.route.destination}-${expandedFlight.dates?.departure?.slice(0,10)}-${expandedFlight.price?.total}`;
      if (!existingFingerprints.has(fingerprint)) {
        allFlights.push(expandedFlight);
      }
    });
    
    const sortBy = locationSortBy[locationName] || 'price';
    const sorted = [...allFlights];


    switch (sortBy) {
      case 'price':
        return sorted.sort((a, b) => a.price.total - b.price.total);
      case 'duration':
        return sorted.sort((a, b) => {
          const durationA = parseDuration(a.duration?.outbound || a.duration?.total || 'PT0H0M');
          const durationB = parseDuration(b.duration?.outbound || b.duration?.total || 'PT0H0M');
          return durationA - durationB;
        });
      case 'date':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.dates?.departure || 0);
          const dateB = new Date(b.dates?.departure || 0);
          return dateA.getTime() - dateB.getTime();
        });
      default:
        return sorted;
    }
  };

  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+H)?(\d+M)?/);
    if (match) {
      const hours = match[1] ? parseInt(match[1].replace('H', '')) : 0;
      const minutes = match[2] ? parseInt(match[2].replace('M', '')) : 0;
      return hours * 60 + minutes;
    }
    return 0;
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDuration = (duration: string) => {
    const match = duration.match(/PT(\d+H)?(\d+M)?/);
    if (match) {
      const hours = match[1] ? match[1].replace('H', 'h ') : '';
      const minutes = match[2] ? match[2].replace('M', 'm') : '';
      return `${hours}${minutes}`.trim();
    }
    return duration;
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch {
      return dateString;
    }
  };

  if (groupedFlights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <MapPin className="h-12 w-12 mx-auto mb-4" />
        <p>No flight destinations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedFlights.map((group) => {
        const isExpanded = expandedLocations.has(group.name);
        const sortedFlights = getSortedFlightsForLocation(group.name);
        const posterFlight = sortedFlights[0]; // The cheapest flight (poster flight)

        return (
          <div key={group.name} className="border border-gray-600 rounded-lg overflow-hidden">
            {/* Location header with poster flight */}
            <div
              className="w-full p-4 bg-gray-700/50 hover:bg-gray-600/50 cursor-pointer flex items-center justify-between"
              onClick={() => onToggleLocation(group.name)}
            >
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-green-400" />
                <div className="text-left">
                  <h5 className="font-medium text-gray-200 capitalize text-lg">{group.name}</h5>
                  <p className="text-sm text-gray-400">
                    {group.flights.length} flight{group.flights.length !== 1 ? 's' : ''} • 
                    Cheapest: {formatPrice(group.cheapestPrice, group.currency)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isExpanded && (
                  <div className="flex items-center space-x-1">
                    <Button
                      variant={locationSortBy[group.name] === 'price' ? 'default' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocationSortBy(prev => ({ ...prev, [group.name]: 'price' }));
                      }}
                      className="text-xs h-6 px-2"
                    >
                      Price
                    </Button>
                    <Button
                      variant={locationSortBy[group.name] === 'duration' ? 'default' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocationSortBy(prev => ({ ...prev, [group.name]: 'duration' }));
                      }}
                      className="text-xs h-6 px-2"
                    >
                      Duration
                    </Button>
                    <Button
                      variant={locationSortBy[group.name] === 'date' ? 'default' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocationSortBy(prev => ({ ...prev, [group.name]: 'date' }));
                      }}
                      className="text-xs h-6 px-2"
                    >
                      Date
                    </Button>
                  </div>
                )}
                {isExpanded && (
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onLoadMoreFlights(group.name, group.destinationAirport); 
                    }}
                    disabled={loadingMoreFlights.has(group.name)}
                    className={`text-sm underline transition-colors ${
                      loadingMoreFlights.has(group.name)
                        ? 'text-gray-500 cursor-not-allowed'
                        : 'text-blue-400 hover:text-blue-300'
                    }`}
                  >
                    {loadingMoreFlights.has(group.name) ? (
                      <span className="flex items-center gap-1">
                        <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full"></div>
                        Loading...
                      </span>
                    ) : (
                      'Show 8 more'
                    )}
                  </button>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded flights */}
            {isExpanded && (
              <div className="p-4 bg-gray-800/30 space-y-3">
                {sortedFlights.map((flight, index) => {
                  const isAdded = addedFlightIds.has(flight.id);
                  const airlineName = flight.offer?.owner?.name || 
                                    flight.airlines?.[0] || 
                                    flight.airline?.name || 
                                    'Unknown Airline';
                  const isRoundTrip = flight.dates?.return && flight.duration?.return;
                  const isFlightExpandedState = isFlightExpanded(flight.id);
                  
                  // Find the actual index in the main search results array
                  const actualIndex = flights.findIndex(f => f.id === flight.id);

                  return (
                    <div key={flight.id} className="space-y-2">
                      {/* Main flight card */}
                      <Card className="bg-gray-700/50 border-gray-600">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center space-x-4">
                                <div className="text-center">
                                  <div className="text-lg font-semibold text-gray-200">
                                    {formatPrice(flight.price.total, flight.price.currency)}
                                  </div>
                                  <div className="text-xs text-gray-400">per person</div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <Plane className="h-4 w-4 text-blue-400" />
                                    <span className="font-medium text-gray-200">{airlineName}</span>
                                    {isRoundTrip && (
                                      <Badge variant="outline" className="text-xs ml-2">
                                        Round Trip
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-400">
                                    {flight.route.origin} → {flight.route.destination}
                                    {isRoundTrip && (
                                      <span className="ml-2">→ {flight.route.origin}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-3 w-3" />
                                      <span>
                                        {isRoundTrip
                                          ? `${formatDuration(flight.duration.outbound)} + ${formatDuration(flight.duration.return)}`
                                          : formatDuration(flight.duration?.outbound || flight.duration?.total || 'PT0H0M')
                                        }
                                      </span>
                                    </div>
                                    <div>
                                      {flight.dates?.departure ? formatDate(flight.dates.departure) : 'N/A'}
                                      {isRoundTrip && (
                                        <span className="ml-2">- {formatDate(flight.dates.return)}</span>
                                      )}
                                    </div>
                                    {flight.connections > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        {flight.connections} stop{flight.connections > 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="ml-4 flex items-center space-x-2">
                              {isRoundTrip && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleFlightExpansion(flight.id)}
                                  className="text-gray-400 hover:text-gray-200"
                                >
                                  {isFlightExpandedState ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                onClick={(e) => {
                                  handleAddToTrip(flight, e);
                                }}
                                disabled={isAdded || addingToTimeline.has(flight.id)}
                                variant={isAdded ? "secondary" : "default"}
                                size="sm"
                                className="min-w-[100px]"
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Added
                                  </>
                                ) : addingToTimeline.has(flight.id) ? (
                                  <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Adding...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add to Trip
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Expanded legs for round-trip flights */}
                      {isRoundTrip && isFlightExpandedState && (
                        <div className="ml-4 space-y-2">
                          {/* Outbound leg with detailed routing */}
                          <Card className="bg-gray-600/30 border-gray-500">
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Plane className="h-3 w-3 text-blue-400" />
                                  <span className="text-sm font-medium text-gray-200">Outbound</span>
                                  <Badge variant="outline" className="text-xs">
                                    {flight.route.origin} → {flight.route.destination}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {formatDate(flight.dates.departure)} • {formatDuration(flight.duration.outbound)}
                                </div>
                                
                                {/* Detailed routing for outbound */}
                                {flight.routing?.outbound && flight.routing.outbound.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                    {flight.routing.outbound.map((segment, segmentIndex) => (
                                      <div key={segmentIndex} className="flex items-center space-x-2 text-xs text-gray-300">
                                        <div className="flex items-center space-x-1">
                                          <span className="font-mono">{segment.origin}</span>
                                          <span className="text-gray-500">→</span>
                                          <span className="font-mono">{segment.destination}</span>
                                        </div>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-400">{segment.carrier}</span>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-400">
                                          {segment.departureTime ? formatTime(segment.departureTime) : ''} - 
                                          {segment.arrivalTime ? formatTime(segment.arrivalTime) : ''}
                                        </span>
                                        {segment.duration && (
                                          <>
                                            <span className="text-gray-500">•</span>
                                            <span className="text-gray-400">{formatDuration(segment.duration)}</span>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-xs text-gray-500">
                                    No detailed routing available (routing: {JSON.stringify(flight.routing)})
                                  </div>
                                )}
                                
                                {/* Leg editing controls */}
                                <div className="mt-3">
                                  <LegEditModal
                                    flight={flight}
                                    legType="outbound"
                                    flightIndex={actualIndex}
                                    onReplaceLeg={(data) => {
                                      console.log('🔍 Modal calling onReplaceLeg with flight index:', data.flightIndex);
                                      console.log('🔍 Modal flight data:', data.flight);
                                      console.log('🔍 Original flight from search results:', flight);
                                      handleReplaceLeg(data);
                                    }}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30"
                                    >
                                      <Edit className="mr-1 h-3 w-3" />
                                      Edit This Leg
                                    </Button>
                                  </LegEditModal>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Return leg with detailed routing */}
                          <Card className="bg-gray-600/30 border-gray-500">
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Plane className="h-3 w-3 text-green-400" />
                                  <span className="text-sm font-medium text-gray-200">Return</span>
                                  <Badge variant="outline" className="text-xs">
                                    {flight.route.destination} → {flight.route.origin}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {formatDate(flight.dates.return)} • {formatDuration(flight.duration.return)}
                                </div>
                                
                                {/* Detailed routing for return */}
                                {flight.routing?.return && flight.routing.return.length > 0 ? (
                                  <div className="mt-2 space-y-1">
                                    {flight.routing.return.map((segment, segmentIndex) => (
                                      <div key={segmentIndex} className="flex items-center space-x-2 text-xs text-gray-300">
                                        <div className="flex items-center space-x-1">
                                          <span className="font-mono">{segment.origin}</span>
                                          <span className="text-gray-500">→</span>
                                          <span className="font-mono">{segment.destination}</span>
                                        </div>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-400">{segment.carrier}</span>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-400">
                                          {segment.departureTime ? formatTime(segment.departureTime) : ''} - 
                                          {segment.arrivalTime ? formatTime(segment.arrivalTime) : ''}
                                        </span>
                                        {segment.duration && (
                                          <>
                                            <span className="text-gray-500">•</span>
                                            <span className="text-gray-400">{formatDuration(segment.duration)}</span>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-xs text-gray-500">
                                    No detailed routing available for return
                                  </div>
                                )}
                                
                                {/* Leg editing controls */}
                                <div className="mt-3">
                                  <LegEditModal
                                    flight={flight}
                                    legType="return"
                                    flightIndex={actualIndex}
                                    onReplaceLeg={(data) => {
                                      console.log('🔍 Modal calling onReplaceLeg with flight index:', data.flightIndex);
                                      console.log('🔍 Modal flight data:', data.flight);
                                      console.log('🔍 Original flight from search results:', flight);
                                      handleReplaceLeg(data);
                                    }}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30"
                                    >
                                      <Edit className="mr-1 h-3 w-3" />
                                      Edit This Leg
                                    </Button>
                                  </LegEditModal>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
