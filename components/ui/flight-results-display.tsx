'use client';

import React from 'react';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Plane, Clock, MapPin, DollarSign, Users } from 'lucide-react';
import { format } from 'date-fns';

export interface FlightResult {
  id: string;
  airline: {
    name: string;
    code: string;
    logo?: string;
  };
  route: {
    from: string;
    to: string;
    fromCode: string;
    toCode: string;
  };
  timing: {
    departure: string;
    arrival: string;
    duration: string;
  };
  price: {
    amount: number;
    currency: string;
  };
  stops: number;
  cabinClass: string;
  aircraft?: string;
  amenities?: string[];
}

interface FlightResultsDisplayProps {
  flights: FlightResult[];
  onAddToTrip: (flight: FlightResult) => void;
  isLoading?: boolean;
  searchParams?: {
    origin: string;
    destination: string;
    departureDate: Date;
    returnDate?: Date;
    passengers: number;
    cabinClass: string;
  };
}

export function FlightResultsDisplay({ 
  flights, 
  onAddToTrip, 
  isLoading = false,
  searchParams 
}: FlightResultsDisplayProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                </div>
                <div className="h-8 bg-muted rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (flights.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Plane className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No flights found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search criteria or dates.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch {
      return dateString;
    }
  };

  const formatDuration = (duration: string) => {
    // Convert ISO 8601 duration (PT6H10M) to readable format
    const match = duration.match(/PT(\d+H)?(\d+M)?/);
    if (match) {
      const hours = match[1] ? match[1].replace('H', 'h ') : '';
      const minutes = match[2] ? match[2].replace('M', 'm') : '';
      return `${hours}${minutes}`.trim();
    }
    return duration;
  };

  return (
    <div className="space-y-4">
      {/* Search Summary */}
      {searchParams && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="font-medium">
                  {searchParams.origin} → {searchParams.destination}
                </span>
                <span className="text-muted-foreground">
                  {format(searchParams.departureDate, 'MMM d, yyyy')}
                  {searchParams.returnDate && ` - ${format(searchParams.returnDate, 'MMM d, yyyy')}`}
                </span>
                <span className="text-muted-foreground">
                  {searchParams.passengers} {searchParams.passengers === 1 ? 'passenger' : 'passengers'}
                </span>
                <Badge variant="secondary" className="capitalize">
                  {searchParams.cabinClass}
                </Badge>
              </div>
              <span className="text-muted-foreground">
                {flights.length} flight{flights.length === 1 ? '' : 's'} found
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flight Results */}
      <div className="space-y-3">
        {flights.map((flight) => (
          <Card key={flight.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {/* Left side - Flight details */}
                <div className="flex-1 space-y-3">
                  {/* Airline and route */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {flight.airline.logo ? (
                        <img 
                          src={flight.airline.logo} 
                          alt={flight.airline.name}
                          className="h-6 w-6"
                        />
                      ) : (
                        <div className="h-6 w-6 bg-primary rounded flex items-center justify-center">
                          <span className="text-primary-foreground text-xs font-bold">
                            {flight.airline.code}
                          </span>
                        </div>
                      )}
                      <span className="font-medium">{flight.airline.name}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {flight.cabinClass}
                    </Badge>
                  </div>

                  {/* Route and timing */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {formatTime(flight.timing.departure)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {flight.route.fromCode}
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-px bg-muted-foreground"></div>
                        <Clock className="h-3 w-3 text-muted-foreground my-1" />
                        <div className="text-xs text-muted-foreground">
                          {formatDuration(flight.timing.duration)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {formatTime(flight.timing.arrival)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {flight.route.toCode}
                        </div>
                      </div>
                    </div>

                    {/* Stops and details */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`}
                      </div>
                      {flight.aircraft && (
                        <span>{flight.aircraft}</span>
                      )}
                    </div>
                  </div>

                  {/* Amenities */}
                  {flight.amenities && flight.amenities.length > 0 && (
                    <div className="flex gap-2">
                      {flight.amenities.map((amenity, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right side - Price and action */}
                <div className="flex flex-col items-end gap-4 ml-6">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {flight.price.currency === 'USD' ? '$' : flight.price.currency}
                      {flight.price.amount}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      per passenger
                    </div>
                  </div>
                  <Button 
                    onClick={() => onAddToTrip(flight)}
                    className="min-w-[120px]"
                  >
                    <Plane className="mr-2 h-4 w-4" />
                    Add to Trip
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
