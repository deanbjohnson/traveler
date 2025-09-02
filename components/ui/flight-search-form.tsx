'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { CalendarIcon, Plane, Search, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FlightSearchFormProps {
  onSearch: (searchParams: FlightSearchParams) => void;
  isLoading?: boolean;
}

export interface FlightSearchParams {
  tripType: 'one-way' | 'round-trip' | 'multi-city';
  origin: string;
  destination: string;
  departureDate: Date | undefined;
  returnDate: Date | undefined;
  passengers: number;
  cabinClass: string;
  maxPrice?: number;
}

export function FlightSearchForm({ onSearch, isLoading = false }: FlightSearchFormProps) {
  const [searchParams, setSearchParams] = useState<FlightSearchParams>({
    tripType: 'round-trip',
    origin: '',
    destination: '',
    departureDate: undefined,
    returnDate: undefined,
    passengers: 1,
    cabinClass: 'economy',
  });

  // Airport picker state
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false);
  const [originSearch, setOriginSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  
  const originRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);

  // Real airport search state
  const [airportResults, setAirportResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search airports using our API
  const searchAirports = async (query: string) => {
    if (!query || query.length < 2) {
      setAirportResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/airports/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setAirportResults(data.airports || []);
      } else {
        console.error('Airport search failed:', response.statusText);
        setAirportResults([]);
      }
    } catch (error) {
      console.error('Airport search error:', error);
      setAirportResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (originSearch.length >= 2) {
        searchAirports(originSearch);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [originSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (destinationSearch.length >= 2) {
        searchAirports(destinationSearch);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [destinationSearch]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (originRef.current && !originRef.current.contains(event.target as Node)) {
        setShowOriginDropdown(false);
      }
      if (destinationRef.current && !destinationRef.current.contains(event.target as Node)) {
        setShowDestinationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle airport selection
  const selectAirport = (airport: any, isOrigin: boolean) => {
    if (isOrigin) {
      setSearchParams(prev => ({ ...prev, origin: airport.code }));
      setOriginSearch(airport.code);
      setShowOriginDropdown(false);
    } else {
      setSearchParams(prev => ({ ...prev, destination: airport.code }));
      setDestinationSearch(airport.code);
      setShowDestinationDropdown(false);
    }
  };

  // Handle city selection
  const selectCity = (cityData: any, isOrigin: boolean) => {
    if (isOrigin) {
      setSearchParams(prev => ({ ...prev, origin: cityData.city }));
      setOriginSearch(cityData.city);
      setShowDestinationDropdown(false);
    } else {
      setSearchParams(prev => ({ ...prev, destination: cityData.city }));
      setDestinationSearch(cityData.city);
      setShowDestinationDropdown(false);
    }
  };

  const handleSearch = () => {
    if (searchParams.origin && searchParams.destination && searchParams.departureDate) {
      if (searchParams.tripType === 'round-trip' && !searchParams.returnDate) {
        // For round trips, require return date
        return;
      }
      onSearch(searchParams);
    }
  };

  const isSearchDisabled = !searchParams.origin || 
                          !searchParams.destination || 
                          !searchParams.departureDate ||
                          (searchParams.tripType === 'round-trip' && !searchParams.returnDate);

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border">
      {/* Trip Type and Passengers Row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Trip Type
          </label>
          <Select
            value={searchParams.tripType}
            onValueChange={(value: 'one-way' | 'round-trip' | 'multi-city') =>
              setSearchParams(prev => ({ ...prev, tripType: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-way">One-way</SelectItem>
              <SelectItem value="round-trip">Round-trip</SelectItem>
              <SelectItem value="multi-city">Multi-city</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Passengers
          </label>
          <Select
            value={searchParams.passengers.toString()}
            onValueChange={(value) =>
              setSearchParams(prev => ({ ...prev, passengers: parseInt(value) }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <SelectItem key={num} value={num.toString()}>
                  {num} {num === 1 ? 'passenger' : 'passengers'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Cabin Class
          </label>
          <Select
            value={searchParams.cabinClass}
            onValueChange={(value) =>
              setSearchParams(prev => ({ ...prev, cabinClass: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">Economy</SelectItem>
              <SelectItem value="premium-economy">Premium Economy</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="first">First Class</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Origin and Destination Row */}
      <div className="flex gap-4">
        <div className="flex-1" ref={originRef}>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            From
          </label>
          <div className="relative">
            <Plane className="absolute left-3 top-3 h-4 w-4 text-muted-foreground rotate-45" />
            <Input
              placeholder="Airport or city"
              value={originSearch}
              onChange={(e) => {
                setOriginSearch(e.target.value);
                setSearchParams(prev => ({ ...prev, origin: e.target.value }));
                setShowOriginDropdown(true);
              }}
              onFocus={() => setShowOriginDropdown(true)}
              className="pl-10 pr-10"
            />
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          
          {/* Smart airport dropdown */}
          {showOriginDropdown && (
            <div className="absolute z-50 mt-1 left-0 right-0 bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
              {isSearching ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-2"></div>
                  Searching airports...
                </div>
              ) : airportResults.length > 0 ? (
                <div className="p-2 space-y-1">
                  {airportResults.map((result, index) => (
                    <div key={index}>
                      {result.type === 'city' ? (
                        <div 
                          className="p-2 hover:bg-accent rounded cursor-pointer border-l-4 border-blue-500 pl-3"
                          onClick={() => selectCity(result, true)}
                        >
                          <div className="font-medium text-blue-600">{result.city}</div>
                          <div className="text-xs text-muted-foreground">
                            {result.state} • {result.airports.length} airports
                          </div>
                          {result.airports.map((airport: any, airportIndex: number) => (
                            <div 
                              key={airportIndex}
                              className="ml-4 mt-1 p-1 hover:bg-accent/50 rounded cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAirport(airport, true);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{airport.code}</span>
                                <span className="text-xs text-muted-foreground">{airport.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => selectAirport(result, true)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{result.code}</div>
                              <div className="text-xs text-muted-foreground">{result.name}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : originSearch.length >= 2 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No airports found
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  Type to search airports...
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" ref={destinationRef}>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            To
          </label>
          <div className="relative">
            <Plane className="absolute left-3 top-3 h-4 w-4 text-muted-foreground -rotate-45" />
            <Input
              placeholder="Airport or city"
              value={destinationSearch}
              onChange={(e) => {
                setDestinationSearch(e.target.value);
                setSearchParams(prev => ({ ...prev, destination: e.target.value }));
                setShowDestinationDropdown(true);
              }}
              onFocus={() => setShowDestinationDropdown(true)}
              className="pl-10 pr-10"
            />
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {/* Smart airport dropdown */}
          {showDestinationDropdown && (
            <div className="absolute z-50 mt-1 left-0 right-0 bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
              {isSearching ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-2"></div>
                  Searching airports...
                </div>
              ) : airportResults.length > 0 ? (
                <div className="p-2 space-y-1">
                  {airportResults.map((result, index) => (
                    <div key={index}>
                      {result.type === 'city' ? (
                        <div 
                          className="p-2 hover:bg-accent rounded cursor-pointer border-l-4 border-blue-500 pl-3"
                          onClick={() => selectCity(result, false)}
                        >
                          <div className="font-medium text-blue-600">{result.city}</div>
                          <div className="text-xs text-muted-foreground">
                            {result.state} • {result.airports.length} airports
                          </div>
                          {result.airports.map((airport: any, airportIndex: number) => (
                            <div 
                              key={airportIndex}
                              className="ml-4 mt-1 p-1 hover:bg-accent/50 rounded cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAirport(airport, false);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{airport.code}</span>
                                <span className="text-xs text-muted-foreground">{airport.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => selectAirport(result, false)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{result.code}</div>
                              <div className="text-xs text-muted-foreground">{result.name}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : destinationSearch.length >= 2 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No airports found
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  Type to search airports...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Date Selection Row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Departure Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={searchParams.departureDate ? format(searchParams.departureDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : undefined;
                setSearchParams(prev => ({ ...prev, departureDate: date }));
              }}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {searchParams.tripType === 'round-trip' && (
          <div className="flex-1">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Return Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={searchParams.returnDate ? format(searchParams.returnDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  setSearchParams(prev => ({ ...prev, returnDate: date }));
                }}
                min={searchParams.departureDate ? 
                  new Date(searchParams.departureDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : 
                  new Date().toISOString().split('T')[0]
                }
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Price Filter Row */}
      <div className="flex-1">
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Max Price (optional)
        </label>
        <Input
          type="number"
          placeholder="No limit"
          value={searchParams.maxPrice || ''}
          onChange={(e) => setSearchParams(prev => ({ 
            ...prev, 
            maxPrice: e.target.value ? parseInt(e.target.value) : undefined 
          }))}
          className="w-full"
        />
      </div>

      {/* Search Button */}
      <Button 
        onClick={handleSearch} 
        disabled={isSearchDisabled || isLoading}
        className="w-full"
        size="lg"
      >
        <Search className="mr-2 h-4 w-4" />
        {isLoading ? 'Searching...' : 'Search Flights'}
      </Button>
    </div>
  );
}
