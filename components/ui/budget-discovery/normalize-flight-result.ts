import { FlightResult, FlightSegment } from './types';

/** Extract per-segment routing from Duffel slices. Handles both single-slice (one-way) and two-slice (round-trip) offers. */
function extractDetailedRouting(slices: any[]): { outbound: FlightSegment[]; return?: FlightSegment[] } {
  if (!slices.length) return { outbound: [] };
  
  const outbound = slices[0]?.segments?.map((segment: any) => ({
    origin: segment.origin?.iata_code || '',
    destination: segment.destination?.iata_code || '',
    originName: segment.origin?.name,
    destinationName: segment.destination?.name,
    carrier: segment.marketing_carrier?.iata_code || segment.operating_carrier?.iata_code || '',
    departureTime: segment.departing_at || segment.departure_datetime || '',
    arrivalTime: segment.arriving_at || segment.arrival_datetime || '',
    duration: segment.duration || '0:00'
  })) || [];
  
  const returnRouting = slices[1]?.segments?.map((segment: any) => ({
    origin: segment.origin?.iata_code || '',
    destination: segment.destination?.iata_code || '',
    originName: segment.origin?.name,
    destinationName: segment.destination?.name,
    carrier: segment.marketing_carrier?.iata_code || segment.operating_carrier?.iata_code || '',
    departureTime: segment.departing_at || segment.departure_datetime || '',
    arrivalTime: segment.arriving_at || segment.arrival_datetime || '',
    duration: segment.duration || '0:00'
  })) || [];
  
  return {
    outbound,
    return: returnRouting.length > 0 ? returnRouting : undefined
  };
}

const DEBUG = process.env.NODE_ENV === "development";

export const normalizeFlightResult = (raw: any): FlightResult => {
  const id: string = raw.id || raw.offer?.id || raw.searchId;
  
  if (!id) {
    if (DEBUG) console.error('No ID found in flight data:', raw);
    throw new Error('Flight data missing required ID field');
  }

  // Route can come from raw.route or from first slice (budget discovery vs findFlight formats)
  const route = raw.route || {
    origin: raw.slices?.[0]?.origin?.iata_code || raw.timelineData?.slices?.[0]?.origin?.iata_code || "",
    destination: raw.slices?.[0]?.destination?.iata_code || raw.timelineData?.slices?.[0]?.destination?.iata_code || "",
  };

  // Prioritize actual flight departure dates from the offer data
  // For budget discovery results, the raw object IS the Duffel offer
  // For findFlight results, the raw object has been cleaned and may not have full timing data
  const actualDepartureDate = raw.timelineData?.slices?.[0]?.segments?.[0]?.departing_at ||
                             raw.slices?.[0]?.segments?.[0]?.departing_at || 
                             raw.slices?.[0]?.departure_datetime || 
                             raw.offer?.slices?.[0]?.departure_datetime || 
                             raw.timelineData?.slices?.[0]?.departure_datetime || 
                             raw.dates?.departure ||
                             raw.timing?.departure || "";
  
  const actualReturnDate = raw.timelineData?.slices?.[1]?.segments?.[0]?.departing_at ||
                          raw.slices?.[1]?.segments?.[0]?.departing_at || 
                          raw.slices?.[1]?.departure_datetime || 
                          raw.offer?.slices?.[1]?.departure_datetime || 
                          raw.timelineData?.slices?.[1]?.departure_datetime || 
                          raw.dates?.return ||
                          raw.timing?.arrival || undefined;
  
  const dates = {
    departure: actualDepartureDate,
    return: actualReturnDate,
  };

  const price = {
    total: typeof raw.total === 'number' ? raw.total : 
           parseFloat(raw.price?.amount || raw.total_amount || raw.offer?.total_amount || raw.price?.total || 0),
    currency: raw.price?.currency || raw.currency || raw.total_currency || raw.offer?.total_currency || 'USD',
  };

  const duration = raw.duration || {
    outbound: raw.slices?.[0]?.duration || raw.timing?.duration || "PT0H0M",
    return: raw.slices?.[1]?.duration || undefined,
    total: raw.slices?.[0]?.duration || raw.timing?.duration || "PT0H0M",
  };

  const airlines: string[] = raw.airlines || (
    raw.owner?.iata_code ? [raw.owner.iata_code] : 
    raw.offer?.owner?.iata_code ? [raw.offer.owner.iata_code] : 
    raw.airline?.code ? [raw.airline.code] : []
  );

  // Calculate connections/stops from Duffel API format
  const connections: number = typeof raw.connections === 'number'
    ? raw.connections
    : (() => {
        // For Duffel API format, check segments within slices
        if (raw.slices && Array.isArray(raw.slices) && raw.slices.length > 0) {
          const firstSlice = raw.slices[0];
          if (firstSlice.segments && Array.isArray(firstSlice.segments)) {
            return Math.max(firstSlice.segments.length - 1, 0);
          }
        }
        // Fallback to old format
        return Array.isArray(raw.segments) ? Math.max(raw.segments.length - 1, 0) : 0;
      })();

  const offer = raw.offer || null;
  const score = typeof raw.score === 'number' ? raw.score : 0;

  // Extract detailed routing from slices
  const slices = raw.slices || raw.timelineData?.slices || [];
  const routing = extractDetailedRouting(slices);

  return {
    id,
    searchId: raw.searchId || '',
    route,
    dates,
    price,
    duration,
    airlines,
    connections,
    routing,
    offer,
    score,
    destinationContext: raw.destinationContext || 'Unknown',
    destinationAirport: raw.destinationAirport || {
      iata_code: route.destination || '',
      city_name: '',
      country_name: '',
    },
    // Legacy fields retained if present
    airline: raw.airline,
    timing: raw.timing,
    segments: raw.segments,
    timelineData: raw.timelineData,
    // Ensure stops property matches connections for consistency
    stops: connections,
    cabinClass: raw.cabinClass,
  } as FlightResult;
};
