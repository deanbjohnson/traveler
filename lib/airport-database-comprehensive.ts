// Comprehensive airport database built from OpenFlights data
// 6,064+ airports worldwide with proper city grouping and aliases

import generatedData from './airport-database-generated.json';

export interface Airport {
  code: string; // IATA
  name: string;
  city: string;
  country: string;
  state?: string;
  latitude: number;
  longitude: number;
  type: 'airport' | 'heliport' | 'seaplane_base';
  icao?: string;
  altitude?: number;
}

export interface CityGroup {
  type: 'city';
  city: string;
  country: string;
  state?: string;
  airports: Airport[];
  code?: string; // IATA "city code" like NYC, TYO
}

export interface CountryGroup {
  type: 'country';
  country: string;
  airports: Airport[];
}

export interface RegionGroup {
  type: 'region';
  region: string;
  airports: Airport[];
}

export type SearchResult = CityGroup | CountryGroup | RegionGroup;

// Major city codes and their aliases for smart search
const CITY_ALIASES: Record<string, { city: string; country: string; aliases: string[] }> = {
  'NYC': { city: 'New York', country: 'United States', aliases: ['nyc', 'new york city', 'new york area', 'manhattan', 'brooklyn', 'queens', 'jfk', 'lga', 'ewr'] },
  'LON': { city: 'London', country: 'United Kingdom', aliases: ['london', 'lhr', 'lgw', 'lcy', 'stn', 'gatwick', 'heathrow', 'stansted', 'city'] },
  'TYO': { city: 'Tokyo', country: 'Japan', aliases: ['tokyo', 'nrt', 'hnd', 'narita', 'haneda'] },
  'WAS': { city: 'Washington', country: 'United States', aliases: ['washington', 'dc', 'd.c.', 'washington dc', 'dulles', 'reagan', 'iad', 'dca'] },
  'CHI': { city: 'Chicago', country: 'United States', aliases: ['chicago', 'ord', 'mdw', 'ohare', "o'hare", 'midway'] },
  'LAX': { city: 'Los Angeles', country: 'United States', aliases: ['los angeles', 'lax', 'bur', 'burbank', 'ont', 'ontario'] },
  'SFO': { city: 'San Francisco', country: 'United States', aliases: ['san francisco', 'sfo', 'oak', 'oakland', 'sjc', 'san jose'] },
  'MIA': { city: 'Miami', country: 'United States', aliases: ['miami', 'mia', 'fll', 'fort lauderdale', 'pbi', 'west palm beach'] },
  'BOS': { city: 'Boston', country: 'United States', aliases: ['boston', 'bos', 'logan', 'mht', 'manchester'] },
  'PAR': { city: 'Paris', country: 'France', aliases: ['paris', 'cdg', 'ory', 'charles de gaulle', 'orly'] },
  'MAD': { city: 'Madrid', country: 'Spain', aliases: ['madrid', 'mad', 'barajas'] },
  'BCN': { city: 'Barcelona', country: 'Spain', aliases: ['barcelona', 'bcn', 'el prat'] },
  'AMS': { city: 'Amsterdam', country: 'Netherlands', aliases: ['amsterdam', 'ams', 'schiphol'] },
  'FRA': { city: 'Frankfurt', country: 'Germany', aliases: ['frankfurt', 'fra', 'frankfurt am main'] },
  'MUC': { city: 'Munich', country: 'Germany', aliases: ['munich', 'muc', 'münchen'] },
  'BER': { city: 'Berlin', country: 'Germany', aliases: ['berlin', 'ber', 'brandenburg'] },
  'ROM': { city: 'Rome', country: 'Italy', aliases: ['rome', 'rom', 'fiumicino', 'ciampino'] },
  'MIL': { city: 'Milan', country: 'Italy', aliases: ['milan', 'mil', 'malpensa', 'linate'] },
  'ZRH': { city: 'Zurich', country: 'Switzerland', aliases: ['zurich', 'zrh', 'zürich'] },
  'VIE': { city: 'Vienna', country: 'Austria', aliases: ['vienna', 'vie', 'wien'] },
  'CPH': { city: 'Copenhagen', country: 'Denmark', aliases: ['copenhagen', 'cph', 'københavn'] },
  'STO': { city: 'Stockholm', country: 'Sweden', aliases: ['stockholm', 'sto', 'arn', 'arlanda'] },
  'OSL': { city: 'Oslo', country: 'Norway', aliases: ['oslo', 'osl', 'gardermoen'] },
  'HEL': { city: 'Helsinki', country: 'Finland', aliases: ['helsinki', 'hel', 'vantaa'] },
  'DUB': { city: 'Dublin', country: 'Ireland', aliases: ['dublin', 'dub'] },
  'LIS': { city: 'Lisbon', country: 'Portugal', aliases: ['lisbon', 'lis', 'lisboa'] },
  'ATH': { city: 'Athens', country: 'Greece', aliases: ['athens', 'ath', 'eleftherios venizelos'] },
  'IST': { city: 'Istanbul', country: 'Turkey', aliases: ['istanbul', 'ist', 'ataturk', 'sabiha gokcen'] },
  'DXB': { city: 'Dubai', country: 'United Arab Emirates', aliases: ['dubai', 'dxb'] },
  'DOH': { city: 'Doha', country: 'Qatar', aliases: ['doha', 'doh', 'hamad'] },
  'BKK': { city: 'Bangkok', country: 'Thailand', aliases: ['bangkok', 'bkk', 'suvarnabhumi'] },
  'SIN': { city: 'Singapore', country: 'Singapore', aliases: ['singapore', 'sin', 'changi'] },
  'KUL': { city: 'Kuala Lumpur', country: 'Malaysia', aliases: ['kuala lumpur', 'kul'] },
  'HKG': { city: 'Hong Kong', country: 'Hong Kong', aliases: ['hong kong', 'hkg'] },
  'ICN': { city: 'Seoul', country: 'South Korea', aliases: ['seoul', 'icn', 'incheon'] },
  'PEK': { city: 'Beijing', country: 'China', aliases: ['beijing', 'pek', 'capital'] },
  'PVG': { city: 'Shanghai', country: 'China', aliases: ['shanghai', 'pvg', 'pudong'] },
  'SYD': { city: 'Sydney', country: 'Australia', aliases: ['sydney', 'syd'] },
  'MEL': { city: 'Melbourne', country: 'Australia', aliases: ['melbourne', 'mel'] },
  'BNE': { city: 'Brisbane', country: 'Australia', aliases: ['brisbane', 'bne'] },
  'YYZ': { city: 'Toronto', country: 'Canada', aliases: ['toronto', 'yyz', 'pearson'] },
  'YVR': { city: 'Vancouver', country: 'Canada', aliases: ['vancouver', 'yvr'] },
  'YUL': { city: 'Montreal', country: 'Canada', aliases: ['montreal', 'yul', 'trudeau'] },
  'GRU': { city: 'São Paulo', country: 'Brazil', aliases: ['são paulo', 'sao paulo', 'gru', 'guarulhos'] },
  'GIG': { city: 'Rio de Janeiro', country: 'Brazil', aliases: ['rio de janeiro', 'gig', 'galeao'] },
  'MEX': { city: 'Mexico City', country: 'Mexico', aliases: ['mexico city', 'mex', 'benito juarez'] },
  'BOG': { city: 'Bogotá', country: 'Colombia', aliases: ['bogotá', 'bogota', 'bog', 'el dorado'] },
  'LIM': { city: 'Lima', country: 'Peru', aliases: ['lima', 'lim', 'jorge chavez'] },
  'SCL': { city: 'Santiago', country: 'Chile', aliases: ['santiago', 'scl', 'arturo merino benitez'] },
  'EZE': { city: 'Buenos Aires', country: 'Argentina', aliases: ['buenos aires', 'eze', 'ezeiza'] },
  'JNB': { city: 'Johannesburg', country: 'South Africa', aliases: ['johannesburg', 'jnb', 'tambo'] },
  'CAI': { city: 'Cairo', country: 'Egypt', aliases: ['cairo', 'cai'] },
  'NBO': { city: 'Nairobi', country: 'Kenya', aliases: ['nairobi', 'nbo', 'jomo kenyatta'] },
  'BOM': { city: 'Mumbai', country: 'India', aliases: ['mumbai', 'bom', 'chhatrapati shivaji'] },
  'DEL': { city: 'Delhi', country: 'India', aliases: ['delhi', 'del', 'indira gandhi'] },
  'BLR': { city: 'Bangalore', country: 'India', aliases: ['bangalore', 'blr', 'bengaluru'] },
  'MAA': { city: 'Chennai', country: 'India', aliases: ['chennai', 'maa', 'madras'] },
  'CCU': { city: 'Kolkata', country: 'India', aliases: ['kolkata', 'ccu', 'calcutta'] },
  // Add more major cities as needed
};

// Import the generated data
const airports: Airport[] = generatedData.airports;
const cityGroups: CityGroup[] = generatedData.cityGroups;
const countryGroups: CountryGroup[] = generatedData.countryGroups;
const regionGroups: RegionGroup[] = generatedData.regionGroups;

// Normalize strings for better matching
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]/g, ""); // Keep only alphanumeric
}

// Smart search function with alias resolution and fuzzy matching
export function searchAirports(
  query: string,
  userLat?: number,
  userLon?: number
): SearchResult[] {
  if (!query || query.length < 2) return [];
  
  const normQuery = normalize(query);
  
  // 1. Alias resolution - check if query matches any city aliases
  const aliasMatch = Object.entries(CITY_ALIASES).find(([code, info]) =>
    info.aliases.some(alias => normalize(alias) === normQuery)
  );
  
  if (aliasMatch) {
    const [code] = aliasMatch;
    const matchingCity = cityGroups.find(c => c.code?.toLowerCase() === code.toLowerCase());
    if (matchingCity) {
      return [matchingCity];
    }
  }
  
  // 2. Direct code match (IATA airport codes)
  const directCodeMatch = airports.find(a => a.code.toLowerCase() === query.toLowerCase());
  if (directCodeMatch) {
    const city = cityGroups.find(c => 
      c.airports.some(a => a.code === directCodeMatch.code)
    );
    if (city) return [city];
  }
  
  // 3. Fuzzy search over cities, countries, and regions
  const results: SearchResult[] = [];
  
  // Search cities
  for (const city of cityGroups) {
    const cityMatch = normalize(city.city).includes(normQuery) ||
                     city.country.toLowerCase().includes(normQuery) ||
                     city.airports.some(a => 
                       normalize(a.name).includes(normQuery) ||
                       a.code.toLowerCase().includes(normQuery)
                     );
    
    if (cityMatch) {
      results.push(city);
    }
  }
  
  // Search countries
  for (const country of countryGroups) {
    if (normalize(country.country).includes(normQuery)) {
      results.push(country);
    }
  }
  
  // Search regions
  for (const region of regionGroups) {
    if (normalize(region.region).includes(normQuery)) {
      results.push(region);
    }
  }
  
  // 4. Rank results by relevance
  return results.sort((a, b) => {
    // Exact matches first
    const aExact = (a.type === 'city' && normalize(a.city) === normQuery) ||
                   (a.type === 'country' && normalize(a.country) === normQuery) ||
                   (a.type === 'region' && normalize(a.region) === normQuery);
    
    const bExact = (b.type === 'city' && normalize(b.city) === normQuery) ||
                   (b.type === 'country' && normalize(b.country) === normQuery) ||
                   (b.type === 'region' && normalize(b.region) === normQuery);
    
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    // Then by popularity (number of airports)
    const aPop = a.airports.length;
    const bPop = b.airports.length;
    if (aPop !== bPop) return bPop - aPop;
    
    // Then by distance if user location is known
    if (userLat && userLon) {
      const dist = (ap: Airport) =>
        Math.sqrt(Math.pow(ap.latitude - userLat, 2) + Math.pow(ap.longitude - userLon, 2));
      
      const aDist = Math.min(...a.airports.map(dist));
      const bDist = Math.min(...b.airports.map(dist));
      
      if (aDist !== bDist) return aDist - bDist;
    }
    
    // Finally by alphabetical order
    const aName = a.type === 'city' ? a.city : a.type === 'country' ? a.country : a.region;
    const bName = b.type === 'city' ? b.city : b.type === 'country' ? b.country : b.region;
    
    return aName.localeCompare(bName);
  });
}

// Get airports for a specific city
export function getAirportsForCity(cityName: string, countryName?: string): Airport[] {
  if (countryName) {
    return airports.filter(airport => 
      airport.city.toLowerCase() === cityName.toLowerCase() &&
      airport.country.toLowerCase() === countryName.toLowerCase()
    );
  }
  
  return airports.filter(airport => 
    airport.city.toLowerCase() === cityName.toLowerCase()
  );
}

// Get all cities
export function getAllCities(): string[] {
  const cities = new Set(airports.map(airport => airport.city));
  return Array.from(cities).sort();
}

// Get all countries
export function getAllCountries(): string[] {
  const countries = new Set(airports.map(airport => airport.country));
  return Array.from(countries).sort();
}

// Get all regions
export function getAllRegions(): string[] {
  return regionGroups.map(r => r.region).sort();
}

// Export the raw data for advanced use cases
export { airports, cityGroups, countryGroups, regionGroups };
