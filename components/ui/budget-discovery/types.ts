export interface FlightResult {
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
  routing?: {
    outbound: FlightSegment[];
    return?: FlightSegment[];
  };
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
  // New properties for compatibility with FlightResultsDisplay
  stops?: number;
  cabinClass?: string;
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

export interface TripDiscoverTabProps {
  tripId: string;
  timeline?: any;
}

export interface FlightSegment {
  origin: string;
  destination: string;
  originName?: string;
  destinationName?: string;
  carrier: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
}

export type ChatMode = 'trip-discover' | 'specific-flight';
export type ViewMode = 'list' | 'grouped';
export type SortBy = 'price' | 'duration' | 'date';
export type SortOrder = 'asc' | 'desc';
export type TripType = 'round-trip' | 'one-way';
export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
