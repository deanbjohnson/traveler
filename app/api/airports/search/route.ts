import { NextRequest, NextResponse } from 'next/server';
import { searchByName, getAutocompleteSuggestions } from 'airport-data-js';

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
    
    // Search for airports and cities
    const nameResults = await searchByName(searchTerm);
    const autocompleteResults = await getAutocompleteSuggestions(searchTerm);
    
    // Combine and deduplicate results
    const allResults = [...nameResults, ...autocompleteResults];
    const uniqueResults = allResults.filter((airport, index, self) => 
      index === self.findIndex(a => a.iata === airport.iata)
    );
    
    // Search for cities by name (broader search)
    const cityResults = await searchByName(searchTerm + ' city');
    const cityAirports = cityResults.filter(airport => 
      airport.city && airport.city.toLowerCase().includes(searchTerm)
    );
    
    // Also search for airports in cities that match the search term
    const cityMatchAirports = uniqueResults.filter(airport => 
      airport.city && airport.city.toLowerCase().includes(searchTerm)
    );
    
    // Combine all results
    const allAirports = [...uniqueResults, ...cityAirports, ...cityMatchAirports];
    const finalResults = allAirports.filter((airport, index, self) => 
      index === self.findIndex(a => a.iata === airport.iata)
    );
    
    // Limit results for performance
    const results = finalResults.slice(0, 30);

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
    if (!airport.city) return; // Skip airports without city info
    
    const cityKey = `${airport.city}-${airport.state || ''}-${airport.country || ''}`;
    
    if (!cityGroups[cityKey]) {
      cityGroups[cityKey] = {
        type: 'city',
        city: airport.city,
        state: airport.state || '',
        country: airport.country || '',
        airports: []
      };
    }
    
    cityGroups[cityKey].airports.push(airport);
  });

  // Convert to array and sort by relevance
  return Object.values(cityGroups)
    .sort((a, b) => {
      // First, sort by exact city name matches
      const searchTerm = airports[0]?.city?.toLowerCase() || '';
      const aExactMatch = a.city.toLowerCase().includes(searchTerm);
      const bExactMatch = b.city.toLowerCase().includes(searchTerm);
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // Then by number of airports (more airports = more important city)
      if (a.airports.length !== b.airports.length) {
        return b.airports.length - a.airports.length;
      }
      
      // Finally by city name
      return a.city.localeCompare(b.city);
    })
    .slice(0, 12); // Show more cities for better coverage
}
