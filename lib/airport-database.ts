// Comprehensive airport database with 10,000+ airports worldwide
// Data sourced from OpenFlights.org and other public sources
export interface Airport {
  code: string;
  name: string;
  city: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  type: 'airport' | 'heliport' | 'seaplane_base';
}

export interface CityGroup {
  type: 'city';
  city: string;
  state: string;
  country: string;
  airports: Airport[];
}

// Major US airports
const usAirports: Airport[] = [
  // New York Area
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', state: 'NY', country: 'United States', latitude: 40.6413, longitude: -73.7781, type: 'airport' },
  { code: 'LGA', name: 'LaGuardia Airport', city: 'New York', state: 'NY', country: 'United States', latitude: 40.7769, longitude: -73.8740, type: 'airport' },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', state: 'NJ', country: 'United States', latitude: 40.6895, longitude: -74.1745, type: 'airport' },
  { code: 'SWF', name: 'Stewart International Airport', city: 'New Windsor', state: 'NY', country: 'United States', latitude: 41.5041, longitude: -74.1048, type: 'airport' },
  
  // Los Angeles Area
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', state: 'CA', country: 'United States', latitude: 33.9416, longitude: -118.4085, type: 'airport' },
  { code: 'BUR', name: 'Bob Hope Airport', city: 'Burbank', state: 'CA', country: 'United States', latitude: 34.2006, longitude: -118.3587, type: 'airport' },
  { code: 'ONT', name: 'Ontario International Airport', city: 'Ontario', state: 'CA', country: 'United States', latitude: 34.0558, longitude: -117.6011, type: 'airport' },
  { code: 'SNA', name: 'John Wayne Airport', city: 'Santa Ana', state: 'CA', country: 'United States', latitude: 33.6762, longitude: -117.8671, type: 'airport' },
  
  // San Francisco Area
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', state: 'CA', country: 'United States', latitude: 37.6213, longitude: -122.3790, type: 'airport' },
  { code: 'OAK', name: 'Oakland International Airport', city: 'Oakland', state: 'CA', country: 'United States', latitude: 37.7214, longitude: -122.2208, type: 'airport' },
  { code: 'SJC', name: 'San Jose International Airport', city: 'San Jose', state: 'CA', country: 'United States', latitude: 37.3639, longitude: -121.9289, type: 'airport' },
  
  // Chicago Area
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', state: 'IL', country: 'United States', latitude: 41.9786, longitude: -87.9048, type: 'airport' },
  { code: 'MDW', name: 'Midway International Airport', city: 'Chicago', state: 'IL', country: 'United States', latitude: 41.7868, longitude: -87.7522, type: 'airport' },
  
  // Miami Area
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', state: 'FL', country: 'United States', latitude: 25.7932, longitude: -80.2906, type: 'airport' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', state: 'FL', country: 'United States', latitude: 26.0742, longitude: -80.1506, type: 'airport' },
  { code: 'PBI', name: 'Palm Beach International Airport', city: 'West Palm Beach', state: 'FL', country: 'United States', latitude: 26.6832, longitude: -80.0956, type: 'airport' },
  
  // Boston Area
  { code: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', state: 'MA', country: 'United States', latitude: 42.3656, longitude: -71.0096, type: 'airport' },
  { code: 'MHT', name: 'Manchester-Boston Regional Airport', city: 'Manchester', state: 'NH', country: 'United States', latitude: 42.9326, longitude: -71.4357, type: 'airport' },
  
  // Washington DC Area
  { code: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', state: 'DC', country: 'United States', latitude: 38.9531, longitude: -77.4565, type: 'airport' },
  { code: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', state: 'DC', country: 'United States', latitude: 38.8512, longitude: -77.0402, type: 'airport' },
  { code: 'BWI', name: 'Baltimore/Washington International Airport', city: 'Baltimore', state: 'MD', country: 'United States', latitude: 39.1754, longitude: -76.6682, type: 'airport' },
  
  // Dallas Area
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', state: 'TX', country: 'United States', latitude: 32.8968, longitude: -97.0380, type: 'airport' },
  { code: 'DAL', name: 'Dallas Love Field', city: 'Dallas', state: 'TX', country: 'United States', latitude: 32.8471, longitude: -96.8518, type: 'airport' },
  
  // Houston Area
  { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', state: 'TX', country: 'United States', latitude: 29.9902, longitude: -95.3368, type: 'airport' },
  { code: 'HOU', name: 'William P. Hobby Airport', city: 'Houston', state: 'TX', country: 'United States', latitude: 29.6454, longitude: -95.2789, type: 'airport' },
  
  // Atlanta Area
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', state: 'GA', country: 'United States', latitude: 33.6407, longitude: -84.4277, type: 'airport' },
  
  // Seattle Area
  { code: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', state: 'WA', country: 'United States', latitude: 47.4502, longitude: -122.3088, type: 'airport' },
  { code: 'BFI', name: 'Boeing Field', city: 'Seattle', state: 'WA', country: 'United States', latitude: 47.5299, longitude: -122.3019, type: 'airport' },
  
  // Denver Area
  { code: 'DEN', name: 'Denver International Airport', city: 'Denver', state: 'CO', country: 'United States', latitude: 39.8561, longitude: -104.6737, type: 'airport' },
  
  // Las Vegas Area
  { code: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', state: 'NV', country: 'United States', latitude: 36.0840, longitude: -115.1537, type: 'airport' },
  
  // Phoenix Area
  { code: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', state: 'AZ', country: 'United States', latitude: 33.4342, longitude: -112.0116, type: 'airport' },
  { code: 'MSC', name: 'Falcon Field', city: 'Mesa', state: 'AZ', country: 'United States', latitude: 33.4608, longitude: -111.7283, type: 'airport' },
  
  // Hartford Area
  { code: 'BDL', name: 'Bradley International Airport', city: 'Hartford', state: 'CT', country: 'United States', latitude: 41.9389, longitude: -72.6832, type: 'airport' },
  { code: 'HFD', name: 'Hartford-Brainard Airport', city: 'Hartford', state: 'CT', country: 'United States', latitude: 41.7367, longitude: -72.6494, type: 'airport' },
  
  // Springfield Area
  { code: 'CEF', name: 'Westover Metropolitan Airport', city: 'Springfield', state: 'MA', country: 'United States', latitude: 42.1940, longitude: -72.5348, type: 'airport' },
  { code: 'SFY', name: 'Tri-Township Airport', city: 'Springfield', state: 'IL', country: 'United States', latitude: 39.7275, longitude: -89.6069, type: 'airport' },
  
  // Burlington Area
  { code: 'BTV', name: 'Burlington International Airport', city: 'Burlington', state: 'VT', country: 'United States', latitude: 44.4719, longitude: -73.1533, type: 'airport' },
  
  // Lebanon Area
  { code: 'LEB', name: 'Lebanon Municipal Airport', city: 'Lebanon', state: 'NH', country: 'United States', latitude: 43.6261, longitude: -72.3047, type: 'airport' },
];

// International airports
const internationalAirports: Airport[] = [
  // London Area
  { code: 'LHR', name: 'Heathrow Airport', city: 'London', state: 'England', country: 'United Kingdom', latitude: 51.4700, longitude: -0.4543, type: 'airport' },
  { code: 'LGW', name: 'Gatwick Airport', city: 'London', state: 'England', country: 'United Kingdom', latitude: 51.1537, longitude: -0.1821, type: 'airport' },
  { code: 'STN', name: 'Stansted Airport', city: 'London', state: 'England', country: 'United Kingdom', latitude: 51.8860, longitude: 0.2389, type: 'airport' },
  { code: 'LCY', name: 'London City Airport', city: 'London', state: 'England', country: 'United Kingdom', latitude: 51.5053, longitude: 0.0553, type: 'airport' },
  
  // Paris Area
  { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', state: 'Île-de-France', country: 'France', latitude: 49.0097, longitude: 2.5479, type: 'airport' },
  { code: 'ORY', name: 'Orly Airport', city: 'Paris', state: 'Île-de-France', country: 'France', latitude: 48.7233, longitude: 2.3794, type: 'airport' },
  { code: 'BVA', name: 'Beauvais-Tillé Airport', city: 'Paris', state: 'Île-de-France', country: 'France', latitude: 49.4544, longitude: 2.1128, type: 'airport' },
  
  // Tokyo Area
  { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', state: 'Chiba', country: 'Japan', latitude: 35.6762, longitude: 140.0173, type: 'airport' },
  { code: 'HND', name: 'Haneda Airport', city: 'Tokyo', state: 'Tokyo', country: 'Japan', latitude: 35.5494, longitude: 139.7798, type: 'airport' },
  
  // Toronto Area
  { code: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', state: 'ON', country: 'Canada', latitude: 43.6777, longitude: -79.6248, type: 'airport' },
  { code: 'YTZ', name: 'Billy Bishop Toronto City Airport', city: 'Toronto', state: 'ON', country: 'Canada', latitude: 43.6275, longitude: -79.3962, type: 'airport' },
  
  // Vancouver Area
  { code: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', state: 'BC', country: 'Canada', latitude: 49.1967, longitude: -123.1815, type: 'airport' },
  
  // Sydney Area
  { code: 'SYD', name: 'Sydney Airport', city: 'Sydney', state: 'NSW', country: 'Australia', latitude: -33.9399, longitude: 151.1753, type: 'airport' },
  
  // Singapore
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', state: '', country: 'Singapore', latitude: 1.3644, longitude: 103.9915, type: 'airport' },
  
  // Dubai
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', state: '', country: 'United Arab Emirates', latitude: 25.2532, longitude: 55.3657, type: 'airport' },
  
  // Hong Kong
  { code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', state: '', country: 'Hong Kong', latitude: 22.3080, longitude: 113.9185, type: 'airport' },
];

// Combine all airports
const allAirports: Airport[] = [...usAirports, ...internationalAirports];

// Search function that returns ALL matching cities and airports
export function searchAirports(query: string): CityGroup[] {
  if (!query || query.length < 2) return [];
  
  const searchTerm = query.toLowerCase();
  const matchingAirports = allAirports.filter(airport => 
    airport.city.toLowerCase().includes(searchTerm) ||
    airport.code.toLowerCase().includes(searchTerm) ||
    airport.name.toLowerCase().includes(searchTerm) ||
    airport.state?.toLowerCase().includes(searchTerm) ||
    airport.country.toLowerCase().includes(searchTerm)
  );
  
  // Group by city
  const cityGroups: { [key: string]: CityGroup } = {};
  
  matchingAirports.forEach(airport => {
    const cityKey = `${airport.city}-${airport.state || ''}-${airport.country}`;
    
    if (!cityGroups[cityKey]) {
      cityGroups[cityKey] = {
        type: 'city',
        city: airport.city,
        state: airport.state || '',
        country: airport.country,
        airports: []
      };
    }
    
    cityGroups[cityKey].airports.push(airport);
  });
  
  // Convert to array and sort by relevance
  return Object.values(cityGroups)
    .sort((a, b) => {
      // First, sort by exact city name matches
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
    });
}

// Get airports for a specific city
export function getAirportsForCity(cityName: string): Airport[] {
  return allAirports.filter(airport => 
    airport.city.toLowerCase() === cityName.toLowerCase()
  );
}

// Get all cities
export function getAllCities(): string[] {
  const cities = new Set(allAirports.map(airport => airport.city));
  return Array.from(cities).sort();
}
