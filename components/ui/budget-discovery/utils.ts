import { FlightResult } from './types';

export const parseDurationToMinutes = (duration: string): number => {
  // Parse ISO 8601 duration format (e.g., "PT2H30M")
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return hours * 60 + minutes;
};

export const formatDuration = (duration: string) => {
  const minutes = parseDurationToMinutes(duration);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const formatPrice = (price: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(price);
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const serializeMessages = (messages: any[]) => {
  return messages.map(msg => ({
    ...msg,
    createdAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : undefined,
  }));
};

export const deserializeMessages = (messages: any[]) => {
  return messages.map(msg => ({
    ...msg,
    createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
  }));
};

export const getFlightFingerprint = (flight: FlightResult) => {
  const origin = flight.route?.origin || '';
  const destination = flight.route?.destination || '';
  const dep = flight.dates?.departure ? new Date(flight.dates.departure).toISOString().slice(0,10) : '';
  const airline = flight.offer?.owner?.iata_code || flight.airlines?.[0] || '';
  return `${origin}-${destination}-${dep}-${airline}`.toUpperCase();
};

export const compressFlightData = (flights: FlightResult[]) => {
  return flights.map(flight => ({
    id: flight.id,
    searchId: flight.searchId,
    route: flight.route,
    dates: flight.dates,
    price: flight.price,
    duration: flight.duration,
    airlines: flight.airlines,
    connections: flight.connections,
    destinationContext: flight.destinationContext,
    destinationAirport: flight.destinationAirport,
    // Only keep essential offer data, remove large objects
    offer: {
      id: flight.offer?.id,
      total_amount: flight.offer?.total_amount,
      total_currency: flight.offer?.total_currency,
      owner: flight.offer?.owner,
      // Keep minimal slice data for timeline compatibility
      slices: flight.offer?.slices?.map((slice: any) => ({
        origin: slice.origin,
        destination: slice.destination,
        departure_datetime: slice.departure_datetime,
        arrival_datetime: slice.arrival_datetime,
        duration: slice.duration,
      })) || [],
    },
    score: flight.score,
  }));
};
