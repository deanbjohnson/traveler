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

  // Popular airports data (like Google Flights)
  const popularAirports = {
    'New York': [
      { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', distance: '12 mi' },
      { code: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', distance: '8 mi' },
      { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', distance: '8 mi' },
    ],
    'San Francisco': [
      { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', distance: '12 mi' },
      { code: 'OAK', name: 'Oakland International Airport', city: 'Oakland', state: 'CA', distance: '8 mi' },
      { code: 'SJC', name: 'San Jose International Airport', city: 'San Jose', state: 'CA', distance: '15 mi' },
    ],
    'Los Angeles': [
      { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', distance: '16 mi' },
      { code: 'BUR', name: 'Bob Hope Airport', city: 'Burbank', state: 'CA', distance: '12 mi' },
      { code: 'ONT', name: 'Ontario International Airport', city: 'Ontario', state: 'CA', distance: '35 mi' },
    ],
    'Chicago': [
      { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', state: 'IL', distance: '12 mi' },
      { code: 'MDW', name: 'Midway International Airport', city: 'Chicago', state: 'IL', distance: '8 mi' },
    ],
    'Miami': [
      { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', distance: '8 mi' },
      { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', state: 'FL', distance: '25 mi' },
    ],
    'London': [
      { code: 'LHR', name: 'Heathrow Airport', city: 'London', state: 'UK', distance: '14 mi' },
      { code: 'LGW', name: 'Gatwick Airport', city: 'London', state: 'UK', distance: '25 mi' },
      { code: 'STN', name: 'Stansted Airport', city: 'London', state: 'UK', distance: '30 mi' },
    ],
    'Tokyo': [
      { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', state: 'JP', distance: '40 mi' },
      { code: 'HND', name: 'Haneda Airport', city: 'Tokyo', state: 'JP', distance: '9 mi' },
    ],
    'Paris': [
      { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', state: 'FR', distance: '14 mi' },
      { code: 'ORY', name: 'Orly Airport', city: 'Paris', state: 'FR', distance: '8 mi' },
    ],
  };

  // Filter airports based on search input
  const getFilteredAirports = (search: string) => {
    if (!search) return [];
    
    const results: Array<{ type: 'city' | 'airport', data: any }> = [];
    
    Object.entries(popularAirports).forEach(([city, airports]) => {
      // Check if city matches search
      if (city.toLowerCase().includes(search.toLowerCase())) {
        results.push({
          type: 'city',
          data: { city, state: airports[0].state, airports }
        });
      }
      
      // Check if airport code or name matches search
      airports.forEach(airport => {
        if (airport.code.toLowerCase().includes(search.toLowerCase()) ||
            airport.name.toLowerCase().includes(search.toLowerCase())) {
          results.push({
            type: 'airport',
            data: airport
          });
        }
      });
    });
    
    return results.slice(0, 8); // Limit results
  };

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
            <div className="absolute z-50 mt-1 w-full bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
              {getFilteredAirports(originSearch).length > 0 ? (
                <div className="p-2 space-y-1">
                  {getFilteredAirports(originSearch).map((result, index) => (
                    <div key={index}>
                      {result.type === 'city' ? (
                        <div 
                          className="p-2 hover:bg-accent rounded cursor-pointer border-l-4 border-blue-500 pl-3"
                          onClick={() => selectCity(result.data, true)}
                        >
                          <div className="font-medium text-blue-600">{result.data.city}</div>
                          <div className="text-xs text-muted-foreground">
                            {result.data.state} • {result.data.airports.length} airports
                          </div>
                          {result.data.airports.map((airport: any, airportIndex: number) => (
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
                                <span className="text-xs text-muted-foreground">{airport.distance}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">{airport.name}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => selectAirport(result.data, true)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{result.data.code}</div>
                              <div className="text-xs text-muted-foreground">{result.data.name}</div>
                            </div>
                            <span className="text-xs text-muted-foreground">{result.data.distance}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No airports found
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
            <div className="absolute z-50 mt-1 w-full bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="p-2">
                <div className="text-xs text-muted-foreground mb-2">Popular airports</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">San Francisco</span>
                      <span className="text-xs text-muted-foreground">(City in California)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">SFO</span>
                      <span className="text-xs text-muted-foreground">San Francisco International Airport</span>
                    </div>
                    <span className="text-xs text-muted-foreground">12 mi to destination</span>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">OAK</span>
                      <span className="text-xs text-muted-foreground">Oakland International Airport</span>
                    </div>
                    <span className="text-xs text-muted-foreground">8 mi to destination</span>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">SJC</span>
                      <span className="text-xs text-muted-foreground">San Jose International Airport</span>
                    </div>
                    <span className="text-xs text-muted-foreground">15 mi to destination</span>
                  </div>
                </div>
              </div>
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
