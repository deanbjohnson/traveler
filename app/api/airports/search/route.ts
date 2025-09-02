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
    
    // Also search for cities by name (broader search)
    const cityResults = await searchByName(searchTerm + ' city');
    const cityAirports = cityResults.filter(airport => 
      airport.city && airport.city.toLowerCase().includes(searchTerm)
    );
    
    // Add common city variations for better results
    const commonCities = getCommonCityVariations(searchTerm);
    const commonCityAirports = commonCities.flatMap(city => 
      airportsForCity(city)
    );
    
    // Combine all results
    const allAirports = [...uniqueResults, ...cityAirports, ...commonCityAirports];
    const finalResults = allAirports.filter((airport, index, self) => 
      index === self.findIndex(a => a.iata === airport.iata)
    );
    
    // Limit results for performance
    const results = finalResults.slice(0, 25);

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

// Helper function to get common city variations
function getCommonCityVariations(searchTerm: string): string[] {
  const variations: string[] = [];
  
  // Common abbreviations and variations
  if (searchTerm.includes('nyc') || searchTerm.includes('new york')) {
    variations.push('New York', 'NYC', 'Manhattan', 'Brooklyn', 'Queens');
  }
  if (searchTerm.includes('la') || searchTerm.includes('los angeles')) {
    variations.push('Los Angeles', 'LA', 'Hollywood', 'Beverly Hills');
  }
  if (searchTerm.includes('sf') || searchTerm.includes('san fran')) {
    variations.push('San Francisco', 'SF', 'Bay Area');
  }
  if (searchTerm.includes('chi') || searchTerm.includes('chicago')) {
    variations.push('Chicago', 'CHI', 'Windy City');
  }
  if (searchTerm.includes('mia') || searchTerm.includes('miami')) {
    variations.push('Miami', 'MIA', 'South Beach');
  }
  if (searchTerm.includes('london')) {
    variations.push('London', 'LON', 'Greater London');
  }
  if (searchTerm.includes('paris')) {
    variations.push('Paris', 'PAR', 'Île-de-France');
  }
  if (searchTerm.includes('tokyo')) {
    variations.push('Tokyo', 'TYO', 'Greater Tokyo');
  }
  
  return variations;
}

// Helper function to get airports for a specific city
function airportsForCity(cityName: string): any[] {
  // This would ideally come from the airport database
  // For now, return empty array to avoid errors
  return [];
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

  // Convert to array and sort by relevance (city name matches first)
  return Object.values(cityGroups)
    .sort((a, b) => {
      // Sort by number of airports (more airports = more important city)
      if (a.airports.length !== b.airports.length) {
        return b.airports.length - a.airports.length;
      }
      // Then by city name
      return a.city.localeCompare(b.city);
    })
    .slice(0, 8); // Limit to top 8 cities for better UX
}
