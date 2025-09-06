import { FlightResult, FlightSearchParams, FlightSegment } from './types';

// Helper function to extract detailed routing from Duffel slices
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

export const convertOffersToFlightResults = (offers: any[], searchParams: FlightSearchParams): FlightResult[] => {
  console.log('🔧 Converting offers to FlightResult format. First offer structure:', JSON.stringify(offers[0], null, 2));
  
  return offers.map((offer: any, index: number) => {
    // Handle new API format (route, timing, airline properties)
    if (offer.route && offer.timing && offer.airline) {
      console.log(`🔧 Converting offer ${index} using new API format`);
      return {
        id: offer.id || `flight-${index}`,
        searchId: `search-${Date.now()}`,
        route: {
          origin: offer.route.from?.code || offer.route.from || searchParams.origin,
          destination: offer.route.to?.code || offer.route.to || searchParams.destination
        },
        dates: {
          departure: offer.timing.departure || searchParams.departureDate?.toISOString(),
          return: offer.timing.arrival || searchParams.returnDate?.toISOString()
        },
        price: {
          total: parseFloat(offer.price?.amount || offer.price?.total || '0') || 0,
          currency: offer.price?.currency || 'USD'
        },
        duration: {
          outbound: offer.timing.duration || '',
          return: '',
          total: offer.timing.duration || ''
        },
        airlines: [offer.airline?.name || 'Unknown Airline'],
        connections: (offer.segments?.length || 1) - 1,
        offer: offer,
        score: 0,
        destinationContext: 'specific-flight-search',
        destinationAirport: {
          iata_code: offer.route.to?.code || offer.route.to || searchParams.destination,
          city_name: offer.route.to?.city || offer.route.to || searchParams.destination,
          country_name: 'Unknown'
        },
        stops: (offer.segments?.length || 1) - 1,
        cabinClass: searchParams.cabinClass
      };
    }
    
    // Handle actual Duffel API format (slices property) - This is what the server is actually returning
    else if ((offer.slices && Array.isArray(offer.slices)) || (offer.timelineData?.slices && Array.isArray(offer.timelineData.slices))) {
      console.log(`🔧 Converting offer ${index} using actual Duffel API format`);
      const slices = offer.slices || offer.timelineData.slices;
      const firstSlice = slices[0];
      const secondSlice = slices[1];
      const firstSegment = firstSlice?.segments?.[0];
      const secondSegment = secondSlice?.segments?.[0];
      
      return {
        id: offer.id || `flight-${index}`,
        searchId: `search-${Date.now()}`,
        route: {
          origin: firstSlice?.origin?.iata_code || searchParams.origin,
          destination: firstSlice?.destination?.iata_code || searchParams.destination
        },
        dates: {
          departure: firstSegment?.departing_at || searchParams.departureDate?.toISOString(),
          return: secondSegment?.departing_at || searchParams.returnDate?.toISOString()
        },
        price: {
          total: parseFloat(offer.total_amount || '0') || 0,
          currency: offer.total_currency || 'USD'
        },
        duration: {
          outbound: firstSlice?.duration || '',
          return: secondSlice?.duration || '',
          total: ''
        },
        airlines: [firstSegment?.operating_carrier?.name || firstSegment?.marketing_carrier?.name || 'Unknown Airline'],
        connections: (firstSlice?.segments?.length || 1) - 1,
        routing: extractDetailedRouting(slices),
        offer: offer,
        score: 0,
        destinationContext: 'specific-flight-search',
        destinationAirport: {
          iata_code: firstSlice?.destination?.iata_code || searchParams.destination,
          city_name: firstSlice?.destination?.city_name || searchParams.destination,
          country_name: firstSlice?.destination?.iata_country_code || 'Unknown'
        },
        stops: (firstSlice?.segments?.length || 1) - 1,
        cabinClass: searchParams.cabinClass
      };
    }
    
    // Fallback for unknown format
    else {
      console.log(`🔧 Converting offer ${index} using fallback format`);
      return {
        id: offer.id || `flight-${index}`,
        searchId: `search-${Date.now()}`,
        route: {
          origin: searchParams.origin,
          destination: searchParams.destination
        },
        dates: {
          departure: searchParams.departureDate?.toISOString(),
          return: searchParams.returnDate?.toISOString()
        },
        price: {
          total: parseFloat(offer.price?.amount || offer.price?.total || offer.total_amount || '0') || 0,
          currency: offer.price?.currency || offer.total_currency || 'USD'
        },
        duration: {
          outbound: offer.duration || offer.timing?.duration || '',
          return: '',
          total: offer.duration || offer.timing?.duration || ''
        },
        airlines: [offer.airline?.name || offer.owner?.name || 'Unknown Airline'],
        connections: 0,
        offer: offer,
        score: 0,
        destinationContext: 'specific-flight-search',
        destinationAirport: {
          iata_code: searchParams.destination,
          city_name: searchParams.destination,
          country_name: 'Unknown'
        },
        stops: 0,
        cabinClass: searchParams.cabinClass
      };
    }
  });
};
