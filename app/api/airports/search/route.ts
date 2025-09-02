import { NextRequest, NextResponse } from 'next/server';
import { AirportData } from 'airport-data-js';

// Initialize airport database
const airportData = new AirportData();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        airports: [],
        message: 'Query must be at least 2 characters long' 
      });
    }

    const searchTerm = query.trim().toLowerCase();
    
    // Search airports by various criteria
    const results = await airportData.search({
      query: searchTerm,
      limit: 15, // Limit results for performance
      includeClosed: false, // Only active airports
      includeHeliports: false, // Focus on commercial airports
    });

    // Transform results to match Google Flights format
    const transformedAirports = results.map(airport => ({
      id: airport.iata || airport.icao || airport.id,
      code: airport.iata || airport.icao || '',
      name: airport.name,
      city: airport.city,
      state: airport.state || airport.region || '',
      country: airport.country,
      latitude: airport.latitude,
      longitude: airport.longitude,
      type: airport.type || 'airport',
      distance: null, // Will be calculated if coordinates provided
    }));

    // Group by city for better organization
    const groupedResults = groupAirportsByCity(transformedAirports);

    return NextResponse.json({
      airports: groupedResults,
      total: transformedAirports.length,
      query: searchTerm
    });

  } catch (error) {
    console.error('Airport search error:', error);
    return NextResponse.json(
      { error: 'Failed to search airports', airports: [] },
      { status: 500 }
    );
  }
}

// Group airports by city for better UX
function groupAirportsByCity(airports: any[]) {
  const cityGroups: { [key: string]: any } = {};
  
  airports.forEach(airport => {
    const cityKey = `${airport.city}-${airport.state}-${airport.country}`;
    
    if (!cityGroups[cityKey]) {
      cityGroups[cityKey] = {
        type: 'city',
        city: airport.city,
        state: airport.state,
        country: airport.country,
        airports: []
      };
    }
    
    cityGroups[cityKey].airports.push(airport);
  });

  // Convert to array and sort by city name
  return Object.values(cityGroups).sort((a, b) => 
    a.city.localeCompare(b.city)
  );
}
