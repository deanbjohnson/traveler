'use client';

import React, { useState } from 'react';
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
        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            From
          </label>
          <div className="relative">
            <Plane className="absolute left-3 top-3 h-4 w-4 text-muted-foreground rotate-45" />
            <Input
              placeholder="Airport or city"
              value={searchParams.origin}
              onChange={(e) => setSearchParams(prev => ({ ...prev, origin: e.target.value }))}
              className="pl-10 pr-10"
            />
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {/* Google Flights-style dropdown */}
          {searchParams.origin && (
            <div className="absolute z-50 mt-1 w-full bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="p-2">
                <div className="text-xs text-muted-foreground mb-2">Popular airports</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">New York</span>
                      <span className="text-xs text-muted-foreground">(City in New York State)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">JFK</span>
                      <span className="text-xs text-muted-foreground">John F. Kennedy International Airport</span>
                    </div>
                    <span className="text-xs text-muted-foreground">12 mi to destination</span>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">LGA</span>
                      <span className="text-xs text-muted-foreground">LaGuardia Airport</span>
                    </div>
                    <span className="text-xs text-muted-foreground">8 mi to destination</span>
                  </div>
                  <div className="flex items-center justify-between p-2 hover:bg-accent rounded cursor-pointer">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">EWR</span>
                      <span className="text-xs text-muted-foreground">Newark Liberty International Airport</span>
                    </div>
                    <span className="text-xs text-muted-foreground">8 mi to destination</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            To
          </label>
          <div className="relative">
            <Plane className="absolute left-3 top-3 h-4 w-4 text-muted-foreground -rotate-45" />
            <Input
              placeholder="Airport or city"
              value={searchParams.destination}
              onChange={(e) => setSearchParams(prev => ({ ...prev, destination: e.target.value }))}
              className="pl-10 pr-10"
            />
            <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          {/* Google Flights-style dropdown */}
          {searchParams.destination && (
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
