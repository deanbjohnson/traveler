import React from 'react';
import { FlightResultsDisplay } from '../flight-results-display';
import { FlightResult as BudgetDiscoveryFlightResult } from './types';

// Adapter to transform our FlightResult format to the display component's expected format
const adaptFlightResult = (flight: BudgetDiscoveryFlightResult) => {
  // Extract airline info
  const airlineName = flight.airlines?.[0] || flight.airline?.name || 'Unknown Airline';
  const airlineCode = flight.airline?.code || airlineName.substring(0, 2).toUpperCase();
  
  // Extract timing info
  const departureTime = flight.dates?.departure || flight.timing?.departure || '';
  const arrivalTime = flight.dates?.return || flight.timing?.arrival || '';
  
  // Extract route info
  const fromCode = flight.route?.origin || '';
  const toCode = flight.route?.destination || '';
  
  // Format duration
  const duration = flight.duration?.total || flight.duration?.outbound || flight.timing?.duration || '';
  
  return {
    id: flight.id,
    airline: {
      name: airlineName,
      code: airlineCode,
    },
    route: {
      from: fromCode,
      to: toCode,
      fromCode: fromCode,
      toCode: toCode,
    },
    timing: {
      departure: departureTime,
      arrival: arrivalTime,
      duration: duration,
    },
    price: {
      amount: flight.price?.total || 0,
      currency: flight.price?.currency || 'USD',
    },
    stops: flight.stops ?? flight.connections ?? 0,
    cabinClass: flight.cabinClass || 'economy',
    aircraft: flight.offer?.aircraft?.name,
    amenities: flight.offer?.amenities || [],
  };
};

interface FlightResultsAdapterProps {
  flights: BudgetDiscoveryFlightResult[];
  onAddToTrip: (flight: BudgetDiscoveryFlightResult) => void;
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

export function FlightResultsAdapter({ 
  flights, 
  onAddToTrip, 
  isLoading = false,
  searchParams 
}: FlightResultsAdapterProps) {
  // Transform flights to the format expected by FlightResultsDisplay
  const adaptedFlights = flights.map(adaptFlightResult);
  
  // Transform the onAddToTrip callback to work with original flight data
  const handleAddToTrip = (adaptedFlight: any) => {
    // Find the original flight by ID
    const originalFlight = flights.find(f => f.id === adaptedFlight.id);
    if (originalFlight) {
      onAddToTrip(originalFlight);
    }
  };

  return (
    <FlightResultsDisplay
      flights={adaptedFlights}
      onAddToTrip={handleAddToTrip}
      isLoading={isLoading}
      searchParams={searchParams}
    />
  );
}
