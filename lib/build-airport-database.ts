import fs from 'fs';
import path from 'path';

// OpenFlights CSV format:
// 0: Airport ID, 1: Name, 2: City, 3: Country, 4: IATA, 5: ICAO, 
// 6: Latitude, 7: Longitude, 8: Altitude, 9: Timezone, 10: DST, 
// 11: Timezone, 12: Type, 13: Source

export interface RawAirport {
  id: number;
  name: string;
  city: string;
  country: string;
  iata: string;
  icao: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timezone: number;
  dst: string;
  timezoneName: string;
  type: string;
  source: string;
}

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

// Major city codes and their aliases
const CITY_CODES: Record<string, { city: string; country: string; aliases: string[] }> = {
  'NYC': { city: 'New York', country: 'United States', aliases: ['nyc', 'new york city', 'new york area', 'manhattan', 'brooklyn', 'queens'] },
  'LON': { city: 'London', country: 'United Kingdom', aliases: ['london', 'lhr', 'lgw', 'lcy', 'stn', 'gatwick', 'heathrow'] },
  'TYO': { city: 'Tokyo', country: 'Japan', aliases: ['tokyo', 'nrt', 'hnd', 'narita', 'haneda'] },
  'WAS': { city: 'Washington', country: 'United States', aliases: ['washington', 'dc', 'd.c.', 'washington dc', 'dulles', 'reagan'] },
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
  'BCN': { city: 'Barcelona', country: 'Spain', aliases: ['barcelona', 'bcn', 'el prat'] },
  'ATH': { city: 'Athens', country: 'Greece', aliases: ['athens', 'ath', 'eleftherios venizelos'] },
  'IST': { city: 'Istanbul', country: 'Turkey', aliases: ['istanbul', 'ist', 'ataturk', 'sabiha gokcen'] },
  'DXB': { city: 'Dubai', country: 'United Arab Emirates', aliases: ['dubai', 'dxb'] },
  'DOH': { city: 'Doha', country: 'Qatar', aliases: ['doha', 'doh', 'hamad'] },
  'BKK': { city: 'Bangkok', country: 'Thailand', aliases: ['bangkok', 'bkk', 'suvarnabhumi'] },
  'SIN': { city: 'Singapore', country: 'Singapore', aliases: ['singapore', 'sin', 'changi'] },
  'KUL': { city: 'Kuala Lumpur', country: 'Malaysia', aliases: ['kuala lumpur', 'kul'] },
  'HKG': { city: 'Hong Kong', country: 'Hong Kong', aliases: ['hong kong', 'hkg'] },
  'ICN': { city: 'Seoul', country: 'South Korea', aliases: ['seoul', 'icn', 'incheon'] },
  'NRT': { city: 'Tokyo', country: 'Japan', aliases: ['tokyo', 'nrt', 'narita'] },
  'HND': { city: 'Tokyo', country: 'Japan', aliases: ['tokyo', 'hnd', 'haneda'] },
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
};

// Region mappings
const REGIONS: Record<string, string[]> = {
  'North America': ['United States', 'Canada', 'Mexico'],
  'Europe': ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Netherlands', 'Switzerland', 'Austria', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Ireland', 'Portugal', 'Greece', 'Turkey'],
  'Asia': ['Japan', 'China', 'South Korea', 'Thailand', 'Singapore', 'Malaysia', 'Hong Kong', 'India', 'Indonesia', 'Philippines', 'Vietnam'],
  'Oceania': ['Australia', 'New Zealand', 'Fiji', 'Papua New Guinea'],
  'South America': ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Ecuador', 'Venezuela'],
  'Africa': ['South Africa', 'Egypt', 'Kenya', 'Nigeria', 'Morocco', 'Ethiopia'],
  'Middle East': ['United Arab Emirates', 'Qatar', 'Saudi Arabia', 'Israel', 'Jordan', 'Lebanon'],
};

function parseCSVLine(line: string): RawAirport | null {
  try {
    // Handle CSV with quoted fields that may contain commas
    const fields = line.match(/(".*?"|[^,]+)/g) || [];
    if (fields.length < 14) return null;
    
    const cleanField = (field: string) => field.replace(/^"|"$/g, '').trim();
    
    return {
      id: parseInt(cleanField(fields[0])) || 0,
      name: cleanField(fields[1]),
      city: cleanField(fields[2]),
      country: cleanField(fields[3]),
      iata: cleanField(fields[4]),
      icao: cleanField(fields[5]),
      latitude: parseFloat(cleanField(fields[6])) || 0,
      longitude: parseFloat(cleanField(fields[7])) || 0,
      altitude: parseInt(cleanField(fields[8])) || 0,
      timezone: parseInt(cleanField(fields[9])) || 0,
      dst: cleanField(fields[10]),
      timezoneName: cleanField(fields[11]),
      type: cleanField(fields[12]),
      source: cleanField(fields[13])
    };
  } catch (error) {
    console.error('Error parsing line:', line, error);
    return null;
  }
}

function buildAirportDatabase(): {
  airports: Airport[];
  cityGroups: CityGroup[];
  countryGroups: CountryGroup[];
  regionGroups: RegionGroup[];
} {
  console.log('Building airport database...');
  
  // Read and parse CSV
  const csvContent = fs.readFileSync(path.join(process.cwd(), 'airports.csv'), 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  console.log(`Processing ${lines.length} lines...`);
  
  const rawAirports: RawAirport[] = [];
  const airports: Airport[] = [];
  const cityMap: Map<string, Airport[]> = new Map();
  const countryMap: Map<string, Airport[]> = new Map();
  const regionMap: Map<string, Airport[]> = new Map();
  
  // Parse all lines
  for (const line of lines) {
    const raw = parseCSVLine(line);
    if (!raw || !raw.iata || raw.iata.length !== 3) continue; // Skip airports without IATA codes
    
    // Convert to our Airport format
    const airport: Airport = {
      code: raw.iata,
      name: raw.name,
      city: raw.city,
      country: raw.country,
      latitude: raw.latitude,
      longitude: raw.longitude,
      type: raw.type === 'heliport' ? 'heliport' : 
            raw.type === 'seaplane_base' ? 'seaplane_base' : 'airport',
      icao: raw.icao || undefined,
      altitude: raw.altitude || undefined
    };
    
    airports.push(airport);
    
    // Group by city
    const cityKey = `${raw.city}-${raw.country}`;
    if (!cityMap.has(cityKey)) {
      cityMap.set(cityKey, []);
    }
    cityMap.get(cityKey)!.push(airport);
    
    // Group by country
    if (!countryMap.has(raw.country)) {
      countryMap.set(raw.country, []);
    }
    countryMap.get(raw.country)!.push(airport);
  }
  
  console.log(`Processed ${airports.length} airports with IATA codes`);
  
  // Build city groups
  const cityGroups: CityGroup[] = [];
  for (const [cityKey, cityAirports] of cityMap) {
    if (cityAirports.length === 0) continue;
    
    const [city, country] = cityKey.split('-');
    const firstAirport = cityAirports[0];
    
    // Check if this city has a known city code
    let cityCode: string | undefined;
    for (const [code, info] of Object.entries(CITY_CODES)) {
      if (info.city.toLowerCase() === city.toLowerCase() && 
          info.country.toLowerCase() === country.toLowerCase()) {
        cityCode = code;
        break;
      }
    }
    
    cityGroups.push({
      type: 'city',
      city,
      country,
      airports: cityAirports,
      code: cityCode
    });
  }
  
  // Build country groups
  const countryGroups: CountryGroup[] = [];
  for (const [country, countryAirports] of countryMap) {
    if (countryAirports.length === 0) continue;
    
    countryGroups.push({
      type: 'country',
      country,
      airports: countryAirports
    });
  }
  
  // Build region groups
  for (const [region, countries] of Object.entries(REGIONS)) {
    const regionAirports: Airport[] = [];
    for (const country of countries) {
      const countryAirports = countryMap.get(country);
      if (countryAirports) {
        regionAirports.push(...countryAirports);
      }
    }
    
    if (regionAirports.length > 0) {
      regionMap.set(region, regionAirports);
    }
  }
  
  const regionGroups: RegionGroup[] = [];
  for (const [region, regionAirports] of regionMap) {
    regionGroups.push({
      type: 'region',
      region,
      airports: regionAirports
    });
  }
  
  console.log(`Built ${cityGroups.length} city groups`);
  console.log(`Built ${countryGroups.length} country groups`);
  console.log(`Built ${regionGroups.length} region groups`);
  
  return {
    airports,
    cityGroups,
    countryGroups,
    regionGroups
  };
}

// Build and export the database
const database = buildAirportDatabase();

// Write to JSON files for easy import
fs.writeFileSync(
  path.join(process.cwd(), 'lib', 'airport-database-generated.json'),
  JSON.stringify(database, null, 2)
);

console.log('✅ Airport database built successfully!');
console.log(`📊 Total airports: ${database.airports.length}`);
console.log(`🏙️  Total cities: ${database.cityGroups.length}`);
console.log(`🌍 Total countries: ${database.countryGroups.length}`);
console.log(`🌎 Total regions: ${database.regionGroups.length}`);

export default database;
