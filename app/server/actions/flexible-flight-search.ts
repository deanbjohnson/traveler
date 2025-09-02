"use server";

import { auth } from "@clerk/nextjs/server";
import { searchFlights, FlightSearchParams } from "./flight-search";
import {
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";

// Types for Duffel API responses
interface DuffelPlace {
  type: string;
  iata_code: string;
  name: string;
  city_name: string;
  latitude: number;
  longitude: number;
}

interface DuffelPlacesResponse {
  data: DuffelPlace[];
}

interface DuffelSegment {
  marketing_carrier?: {
    iata_code: string;
  };
}

interface DuffelSlice {
  id: string;
  origin: {
    id: string;
    iata_code: string;
    name: string;
  };
  destination: {
    id: string;
    iata_code: string;
    name: string;
  };
  departure_datetime: string;
  arrival_datetime: string;
  duration: string;
  segments: Array<{
    id: string;
    aircraft: {
      name: string;
    };
    operating_carrier: {
      name: string;
      iata_code: string;
    };
    marketing_carrier: {
      name: string;
      iata_code: string;
    };
    duration: string;
    origin: {
      iata_code: string;
      name: string;
    };
    destination: {
      iata_code: string;
      name: string;
    };
    departing_at: string;
    arriving_at: string;
    departure_datetime?: string;
    arrival_datetime?: string;
  }>;
}

interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  tax_amount?: string;
  tax_currency?: string;
  slices: DuffelSlice[];
  passengers: Array<{
    id: string;
    type: string;
  }>;
  owner: {
    name: string;
    iata_code: string;
  };
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Regional coordinate centers and search radii (in meters)
const REGION_COORDINATES = {
  // Original regions
  asia: {
    // Center on Southeast Asia for broader coverage
    lat: 13.7563,
    lng: 100.5018, // Bangkok
    radius: 4000000, // 4000km radius to cover most of Asia
  },
  europe: {
    lat: 50.1109,
    lng: 8.6821, // Frankfurt
    radius: 2000000, // 2000km radius
  },
  "north-america": {
    lat: 39.8283,
    lng: -98.5795, // Geographic center of US
    radius: 3000000, // 3000km radius
  },
  "south-america": {
    lat: -14.235,
    lng: -51.9253, // Geographic center of Brazil
    radius: 3500000, // 3500km radius
  },
  oceania: {
    lat: -25.2744,
    lng: 133.7751, // Geographic center of Australia
    radius: 2500000, // 2500km radius
  },
  africa: {
    lat: -8.7832,
    lng: 34.5085, // Geographic center of Africa
    radius: 3000000, // 3000km radius
  },
  "middle-east": {
    lat: 26.0667,
    lng: 50.5577, // Bahrain (central to region)
    radius: 1500000, // 1500km radius
  },
  
  // Major metro areas
  "new-york": { lat: 40.7128, lng: -74.006, radius: 100000 },
  london: { lat: 51.5074, lng: -0.1278, radius: 100000 },
  tokyo: { lat: 35.6762, lng: 139.6503, radius: 100000 },
  dubai: { lat: 25.2048, lng: 55.2708, radius: 100000 },
  singapore: { lat: 1.3521, lng: 103.8198, radius: 50000 },
  
  // Europe - Expanded Coverage
  "scandinavia": { lat: 62.0, lng: 10.0, radius: 1000000 },
  "mediterranean": { lat: 37.0, lng: 15.0, radius: 1500000 },
  "balkans": { lat: 44.0, lng: 20.0, radius: 800000 },
  "baltic": { lat: 56.0, lng: 24.0, radius: 600000 },
  "iberia": { lat: 40.0, lng: -4.0, radius: 800000 },
  "alps": { lat: 46.0, lng: 8.0, radius: 600000 },
  "british-isles": { lat: 54.0, lng: -2.0, radius: 800000 },
  "eastern-europe": { lat: 50.0, lng: 20.0, radius: 1000000 },
  "central-europe": { lat: 48.0, lng: 10.0, radius: 800000 },
  "northern-europe": { lat: 58.0, lng: 8.0, radius: 800000 },
  
  // Asia - Massive Expansion
  "southeast-asia": { lat: 10.0, lng: 105.0, radius: 2000000 },
  "east-asia": { lat: 35.0, lng: 105.0, radius: 2500000 },
  "south-asia": { lat: 25.0, lng: 80.0, radius: 2000000 },
  "central-asia": { lat: 45.0, lng: 75.0, radius: 1500000 },
  "japan": { lat: 36.0, lng: 138.0, radius: 1000000 },
  "korea": { lat: 36.0, lng: 127.5, radius: 500000 },
  "china": { lat: 35.0, lng: 105.0, radius: 3000000 },
  "india": { lat: 23.0, lng: 78.0, radius: 2000000 },
  "thailand": { lat: 13.0, lng: 101.0, radius: 800000 },
  "vietnam": { lat: 16.0, lng: 106.0, radius: 600000 },
  "philippines": { lat: 12.0, lng: 122.0, radius: 800000 },
  "indonesia": { lat: -2.0, lng: 120.0, radius: 1500000 },
  "malaysia": { lat: 4.0, lng: 102.0, radius: 600000 },
  "taiwan": { lat: 23.5, lng: 121.0, radius: 400000 },
  "hong-kong": { lat: 22.3, lng: 114.2, radius: 200000 },
  "bangladesh": { lat: 24.0, lng: 90.0, radius: 400000 },
  "pakistan": { lat: 30.0, lng: 70.0, radius: 800000 },
  "sri-lanka": { lat: 7.0, lng: 81.0, radius: 300000 },
  "nepal": { lat: 28.0, lng: 84.0, radius: 300000 },
  "myanmar": { lat: 22.0, lng: 96.0, radius: 500000 },
  "cambodia": { lat: 12.0, lng: 105.0, radius: 300000 },
  "laos": { lat: 18.0, lng: 105.0, radius: 300000 },
  
  // Americas - Comprehensive Coverage
  "east-coast": { lat: 40.0, lng: -75.0, radius: 1000000 },
  "west-coast": { lat: 37.0, lng: -122.0, radius: 1000000 },
  "midwest": { lat: 42.0, lng: -87.0, radius: 800000 },
  "south": { lat: 32.0, lng: -90.0, radius: 800000 },
  "canada-east": { lat: 45.0, lng: -75.0, radius: 800000 },
  "canada-west": { lat: 49.0, lng: -123.0, radius: 800000 },
  "mexico": { lat: 23.0, lng: -102.0, radius: 1500000 },
  "caribbean": { lat: 18.0, lng: -66.0, radius: 1500000 },
  "central-america": { lat: 15.0, lng: -90.0, radius: 1000000 },
  "brazil": { lat: -15.0, lng: -47.0, radius: 2000000 },
  "argentina": { lat: -34.0, lng: -64.0, radius: 1500000 },
  "chile": { lat: -33.0, lng: -71.0, radius: 1000000 },
  "colombia": { lat: 4.0, lng: -74.0, radius: 800000 },
  "peru": { lat: -9.0, lng: -75.0, radius: 800000 },
  "ecuador": { lat: -2.0, lng: -78.0, radius: 400000 },
  "bolivia": { lat: -16.0, lng: -64.0, radius: 600000 },
  "paraguay": { lat: -23.0, lng: -58.0, radius: 400000 },
  "uruguay": { lat: -33.0, lng: -56.0, radius: 300000 },
  "venezuela": { lat: 7.0, lng: -66.0, radius: 600000 },
  "guyana": { lat: 5.0, lng: -59.0, radius: 300000 },
  "suriname": { lat: 4.0, lng: -56.0, radius: 200000 },
  "french-guiana": { lat: 4.0, lng: -53.0, radius: 200000 },
  
  // Africa - Full Coverage
  "north-africa": { lat: 30.0, lng: 10.0, radius: 1500000 },
  "west-africa": { lat: 8.0, lng: -5.0, radius: 1500000 },
  "east-africa": { lat: -1.0, lng: 38.0, radius: 1500000 },
  "south-africa": { lat: -30.0, lng: 25.0, radius: 1000000 },
  "central-africa": { lat: 0.0, lng: 20.0, radius: 1500000 },
  "egypt": { lat: 26.0, lng: 30.0, radius: 800000 },
  "morocco": { lat: 32.0, lng: -5.0, radius: 600000 },
  "kenya": { lat: -1.0, lng: 38.0, radius: 600000 },
  "nigeria": { lat: 9.0, lng: 8.0, radius: 800000 },
  "ethiopia": { lat: 9.0, lng: 40.0, radius: 600000 },
  "tanzania": { lat: -6.0, lng: 35.0, radius: 600000 },
  "uganda": { lat: 1.0, lng: 32.0, radius: 400000 },
  "ghana": { lat: 8.0, lng: -2.0, radius: 400000 },
  "senegal": { lat: 14.0, lng: -14.0, radius: 400000 },
  "cote-divoire": { lat: 8.0, lng: -5.0, radius: 400000 },
  "cameroon": { lat: 6.0, lng: 12.0, radius: 400000 },
  "democratic-republic-congo": { lat: -4.0, lng: 21.0, radius: 1000000 },
  "angola": { lat: -12.0, lng: 17.0, radius: 600000 },
  "zambia": { lat: -13.0, lng: 28.0, radius: 400000 },
  "zimbabwe": { lat: -19.0, lng: 29.0, radius: 400000 },
  "botswana": { lat: -22.0, lng: 24.0, radius: 400000 },
  "namibia": { lat: -22.0, lng: 17.0, radius: 400000 },
  "madagascar": { lat: -20.0, lng: 47.0, radius: 400000 },
  "mauritius": { lat: -20.0, lng: 57.0, radius: 200000 },
  "seychelles": { lat: -4.0, lng: 55.0, radius: 100000 },
  
  // Oceania - Expanded
  "australia-east": { lat: -33.0, lng: 151.0, radius: 1000000 },
  "australia-west": { lat: -31.0, lng: 115.0, radius: 800000 },
  "australia-north": { lat: -12.0, lng: 130.0, radius: 600000 },
  "new-zealand": { lat: -40.0, lng: 174.0, radius: 800000 },
  "pacific-islands": { lat: -17.0, lng: 178.0, radius: 2000000 },
  "fiji": { lat: -17.0, lng: 178.0, radius: 400000 },
  "papua-new-guinea": { lat: -6.0, lng: 145.0, radius: 600000 },
  "solomon-islands": { lat: -9.0, lng: 160.0, radius: 400000 },
  "vanuatu": { lat: -16.0, lng: 167.0, radius: 300000 },
  "new-caledonia": { lat: -21.0, lng: 165.0, radius: 200000 },
  
  // Middle East - Comprehensive
  "gulf": { lat: 25.0, lng: 55.0, radius: 1000000 },
  "levant": { lat: 33.0, lng: 35.0, radius: 800000 },
  "iran": { lat: 32.0, lng: 53.0, radius: 1000000 },
  "turkey": { lat: 39.0, lng: 35.0, radius: 800000 },
  "israel": { lat: 31.0, lng: 35.0, radius: 400000 },
  "jordan": { lat: 31.0, lng: 36.0, radius: 300000 },
  "lebanon": { lat: 33.8, lng: 35.8, radius: 200000 },
  "syria": { lat: 34.0, lng: 38.0, radius: 400000 },
  "iraq": { lat: 33.0, lng: 44.0, radius: 600000 },
  "kuwait": { lat: 29.0, lng: 47.0, radius: 200000 },
  "qatar": { lat: 25.0, lng: 51.0, radius: 200000 },
  "bahrain": { lat: 26.0, lng: 50.0, radius: 100000 },
  "oman": { lat: 21.0, lng: 57.0, radius: 400000 },
  "yemen": { lat: 15.0, lng: 48.0, radius: 400000 },
};

export interface FlexibleSearchParams {
  // Origin can be specific airport, region, city, or "anywhere"
  from: string | string[];
  // Destination can be specific airport, region, or city
  to: string | string[];
  // Date preferences
  dateWindow?:
    | {
        start: string;
        end: string;
      }
    | {
        month: string; // YYYY-MM format
      }
    | {
        flexible: boolean; // Next 3 months
      }
    | {
        exactDate: string; // Specific date (YYYY-MM-DD format)
      };
  // Trip parameters
  tripDuration?: number; // days
  tripType?: "one-way" | "round-trip";
  // Standard params
  passengers?: number;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  // Search preferences
  maxResults?: number;
  priceSort?: "cheapest" | "fastest" | "best";
  maxConnections?: number;
}

export interface FlexibleSearchResult {
  success: boolean;
  searchId: string;
  results: FlightOption[];
  metadata: {
    searchParams: FlexibleSearchParams;
    totalSearches: number;
    successfulSearches: number;
    searchDurationMs: number;
    resultsCount: number;
    priceRange?: { min: number; max: number; currency: string };
    airportsFound: { origin: number; destination: number };
  };
  error?: string;
}

export interface FlightOption {
  searchId: string;
  route: {
    origin: string;
    destination: string;
    originName?: string;
    destinationName?: string;
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
  offer: unknown; // Raw Duffel offer
  score: number; // Composite score for ranking
}

interface Airport {
  iata_code: string;
  name: string;
  city_name: string;
  latitude: number;
  longitude: number;
}

// Get airports using Duffel Places API
async function getAirportsInArea(location: string): Promise<Airport[]> {
  const normalized = location.toLowerCase().replace(/[\s-_]/g, "-");

  // Check if it's a known region/city
  const coordinates =
    REGION_COORDINATES[normalized as keyof typeof REGION_COORDINATES];

  if (coordinates) {
    try {
      const response = await fetch(
        `https://api.duffel.com/places/suggestions?lat=${coordinates.lat}&lng=${coordinates.lng}&rad=${coordinates.radius}`,
        {
          headers: {
            Accept: "application/json",
            "Duffel-Version": "v2",
            Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`,
            "Accept-Encoding": "gzip",
          },
        }
      );

      if (!response.ok) {
        console.error(`Places API error: ${response.status}`);
        return [];
      }

      const data: DuffelPlacesResponse = await response.json();
      return (data.data || [])
        .filter(
          (place: DuffelPlace) => place.type === "airport" && place.iata_code
        )
        .map((place: DuffelPlace) => ({
          iata_code: place.iata_code,
          name: place.name,
          city_name: place.city_name,
          latitude: place.latitude,
          longitude: place.longitude,
        }));
    } catch (error) {
      console.error(`Failed to fetch airports for ${location}:`, error);
      return [];
    }
  }

  // If not a region, assume it's an airport code
  return [
    {
      iata_code: location.toUpperCase(),
      name: location.toUpperCase(),
      city_name: location.toUpperCase(),
      latitude: 0,
      longitude: 0,
    },
  ];
}

// Expand origins using Duffel Places API
async function expandOrigins(from: string | string[]): Promise<string[]> {
  if (Array.isArray(from)) {
    const allAirports = await Promise.all(from.map(expandOrigins));
    return allAirports.flat();
  }

  if (from.toLowerCase() === "anywhere") {
    // For "anywhere", use major global hubs for performance
    return [
      "JFK", "LAX", "ORD", "ATL", "DFW", "SFO", "MIA", "BOS", "SEA", "DEN", "CLT", "PHX", "IAH", "MCO", "LAS",
      "LHR", "CDG", "FRA", "AMS", "MAD", "BCN", "MUC", "ZRH", "CPH", "ARN", "OSL", "HEL", "VIE", "WAW", "PRG",
      "DXB", "SIN", "HKG", "NRT", "ICN", "BKK", "KUL", "DEL", "BOM", "PEK", "PVG", "CAN", "CTU", "HGH", "XIY",
      "SYD", "MEL", "BNE", "PER", "AKL", "CHC", "YVR", "YYZ", "YUL", "YYC", "YOW", "YEG", "YQB", "YWG", "YHZ"
    ];
  }

  const airports = await getAirportsInArea(from);
  const codes = airports.map((airport) => airport.iata_code);

  // Reduced limit to prevent API overload
  return codes.slice(0, 10);
}

async function expandDestinations(to: string | string[]): Promise<string[]> {
  if (Array.isArray(to)) {
    const allAirports = await Promise.all(to.map(expandDestinations));
    return allAirports.flat();
  }

  const airports = await getAirportsInArea(to);
  const codes = airports.map((airport) => airport.iata_code);

  // Reduced limit to prevent API overload
  return codes.slice(0, 10);
}

function generateDateWindows(
  dateWindow: FlexibleSearchParams["dateWindow"]
): string[] {
  const today = new Date();

  if (!dateWindow) {
    // Default: next 30 days, sample every 3rd day
    const start = today;
    const end = addDays(today, 30);
    return eachDayOfInterval({ start, end })
      .filter((_, index) => index % 3 === 0)
      .map((date) => format(date, "yyyy-MM-dd"));
  }

  if ("start" in dateWindow && "end" in dateWindow) {
    const start = new Date(dateWindow.start);
    const end = new Date(dateWindow.end);
    return eachDayOfInterval({ start, end })
      .filter((_, index) => index % 2 === 0)
      .map((date) => format(date, "yyyy-MM-dd"));
  }

  if ("month" in dateWindow) {
    const [year, month] = dateWindow.month.split("-");
    const start = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end })
      .filter((_, index) => index % 3 === 0)
      .map((date) => format(date, "yyyy-MM-dd"));
  }

  if ("flexible" in dateWindow && dateWindow.flexible) {
    // Next 3 months, sample every 5th day
    const end = addDays(today, 90);
    return eachDayOfInterval({ start: today, end })
      .filter((_, index) => index % 5 === 0)
      .map((date) => format(date, "yyyy-MM-dd"));
  }

  if ("exactDate" in dateWindow && typeof dateWindow.exactDate === "string") {
    // Use the exact date provided - no window
    return [dateWindow.exactDate];
  }

  // Handle specific date strings (like "2025-10-01")
  if (typeof dateWindow === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateWindow)) {
    const targetDate = new Date(dateWindow);
    // Search around the target date (±3 days)
    const start = addDays(targetDate, -3);
    const end = addDays(targetDate, 3);
    return eachDayOfInterval({ start, end })
      .filter((_, index) => index % 1 === 0) // Every day for specific dates
      .map((date) => format(date, "yyyy-MM-dd"));
  }

  return [format(addDays(today, 7), "yyyy-MM-dd")];
}

function calculateScore(option: FlightOption): number {
  let score = 0;

  // Price score (lower price = higher score)
  const priceScore = Math.max(0, 100 - option.price.total / 20);
  score += priceScore * 0.5;

  // Duration score (shorter = higher score)
  const durationHours = parseDuration(option.duration.total);
  const durationScore = Math.max(0, 100 - durationHours * 2);
  score += durationScore * 0.3;

  // Connection score (fewer = higher score)
  const connectionScore = Math.max(0, 100 - option.connections * 25);
  score += connectionScore * 0.2;

  return Math.round(score);
}

function parseDuration(duration: string): number {
  const [hours, minutes] = duration.split(":").map(Number);
  return hours + (minutes || 0) / 60;
}

export async function flexibleFlightSearch(
  params: FlexibleSearchParams
): Promise<FlexibleSearchResult> {
  const searchStartTime = Date.now();
  const searchId = `flex_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  try {
    // Check authentication

    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        searchId,
        results: [],
        metadata: {
          searchParams: params,
          totalSearches: 0,
          successfulSearches: 0,
          searchDurationMs: Date.now() - searchStartTime,
          resultsCount: 0,
          airportsFound: { origin: 0, destination: 0 },
        },
        error: "User not authenticated. Please log in to continue.",
      };
    }

    console.log("🔍 Starting flexible flight search with params:", params);

    // Expand origins and destinations using Duffel Places API
    const [origins, destinations] = await Promise.all([
      expandOrigins(params.from),
      expandDestinations(params.to),
    ]);

    const dates = generateDateWindows(params.dateWindow);
    // Sample dates evenly across the full window to prevent clustering around early days
    const evenlySampleDates = (all: string[], budget: number): string[] => {
      if (budget >= all.length) return all;
      const picks: string[] = [];
      const step = (all.length - 1) / Math.max(1, budget - 1);
      for (let i = 0; i < budget; i++) {
        picks.push(all[Math.round(i * step)]);
      }
      return Array.from(new Set(picks));
    };

    console.log(
      `📍 Found ${origins.length} origin airports, ${destinations.length} destination airports`
    );
    console.log(`📅 Searching ${dates.length} date options`);
    console.log(
      `🔢 Total combinations: ${
        origins.length * destinations.length * dates.length
      }`
    );

    // Generate search combinations (limit for performance)
    const searchCombinations: FlightSearchParams[] = [];
    const maxCombinations = 20; // Reduced limit to prevent API overload

    let combinationCount = 0;
    for (const origin of origins) {
      for (const destination of destinations) {
        const perPair = Math.max(
          1,
          Math.floor(maxCombinations / Math.max(1, origins.length * destinations.length))
        );
        const sampledDates = evenlySampleDates(dates, perPair);
        for (const date of sampledDates) {
          if (combinationCount >= maxCombinations) break;

          // For specific dates, we need to handle both departure and return
          let returnDate: string | undefined;
          if (params.tripType === "round-trip") {
            if (params.tripDuration) {
              // Calculate return date based on trip duration
              returnDate = format(
                addDays(new Date(date), params.tripDuration),
                "yyyy-MM-dd"
              );
            }
            // For exact dates, returnDate will be undefined and handled separately
          }

          searchCombinations.push({
            from: origin,
            to: destination,
            date,
            returnDate,
            passengers: params.passengers || 1,
            cabinClass: params.cabinClass || "economy",
          });

          combinationCount++;
        }
        if (combinationCount >= maxCombinations) break;
      }
      if (combinationCount >= maxCombinations) break;
    }

    // If we have specific dates but no trip duration, we need to search for return flights separately
    if (params.tripType === "round-trip" && params.dateWindow && "exactDate" in params.dateWindow && !params.tripDuration) {
      console.log("🔍 Adding return flight searches for specific dates");
      
      // We need to find the return date from the original request
      // This should be passed from the calling function
      // For now, we'll skip this and just search departure flights
      console.log("⚠️ Return date not provided, only searching departure flights");
    }

    console.log(`🚀 Executing ${searchCombinations.length} flight searches`);

    // Execute searches in smaller batches with longer delays
    const batchSize = 4; // Reduced batch size
    const results: FlightOption[] = [];
    let successfulSearches = 0;

    for (let i = 0; i < searchCombinations.length; i += batchSize) {
      const batch = searchCombinations.slice(i, i + batchSize);

      const batchPromises = batch.map(async (searchParams) => {
        try {
          console.log("🚀 Starting flight search with params:", searchParams);
          const result = await searchFlights(searchParams);
          if (result.success && result.data?.offers) {
            successfulSearches++;
            const offers = result.data.offers as DuffelOffer[];

            return offers.slice(0, 2).map((offer: DuffelOffer) => {
              // Debug: Log the actual offer structure
              console.log('🔍 Duffel offer structure:', {
                offerId: offer.id,
                offerKeys: Object.keys(offer),
                slices: offer.slices,
                rawOffer: JSON.stringify(offer, null, 2).substring(0, 500) + '...'
              });
              
              const option: FlightOption = {
                searchId: result.data!.id,
                route: {
                  origin: searchParams.from,
                  destination: searchParams.to,
                },
                dates: {
                  departure: offer.slices?.[0]?.segments?.[0]?.departing_at || offer.slices?.[0]?.departure_datetime || searchParams.date,
                  return: offer.slices?.[1]?.segments?.[0]?.departing_at || offer.slices?.[1]?.departure_datetime || searchParams.returnDate,
                },
                price: {
                  total: offer.total_amount
                    ? parseFloat(offer.total_amount)
                    : 0,
                  currency: offer.total_currency || "USD",
                },
                duration: {
                  outbound: offer.slices?.[0]?.duration || "0:00",
                  return: offer.slices?.[1]?.duration,
                  total: calculateTotalDuration(offer.slices || []),
                },
                airlines: extractAirlines(offer.slices || []),
                connections: calculateConnections(offer.slices || []),
                offer,
                score: 0, // Will calculate after
              };

              option.score = calculateScore(option);
              return option;
            });
          }
          return [];
        } catch (error) {
          console.error(
            `Search failed for ${searchParams.from}-${searchParams.to}:`,
            error
          );
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());

      // Rate limiting delay
      if (i + batchSize < searchCombinations.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay to 2 seconds
      }
    }

    // Sort and filter results
    let sortedResults = [...results];

    if (params.priceSort === "cheapest") {
      sortedResults.sort((a, b) => a.price.total - b.price.total);
    } else if (params.priceSort === "fastest") {
      sortedResults.sort(
        (a, b) =>
          parseDuration(a.duration.total) - parseDuration(b.duration.total)
      );
    } else {
      sortedResults.sort((a, b) => b.score - a.score);
    }

    if (params.maxConnections !== undefined) {
      sortedResults = sortedResults.filter(
        (option) => option.connections <= (params.maxConnections || 0)
      );
    }

    const finalResults = sortedResults.slice(0, params.maxResults || 15);

    // Calculate price range
    const prices = finalResults.map((r) => r.price.total).filter((p) => p > 0);
    const priceRange =
      prices.length > 0
        ? {
            min: Math.min(...prices),
            max: Math.max(...prices),
            currency: finalResults[0]?.price.currency || "USD",
          }
        : undefined;

    const searchDuration = Date.now() - searchStartTime;

    console.log(
      `✅ Search completed: ${finalResults.length} results in ${searchDuration}ms`
    );

    return {
      success: true,
      searchId,
      results: finalResults,
      metadata: {
        searchParams: params,
        totalSearches: searchCombinations.length,
        successfulSearches,
        searchDurationMs: searchDuration,
        resultsCount: finalResults.length,
        priceRange,
        airportsFound: {
          origin: origins.length,
          destination: destinations.length,
        },
      },
    };
  } catch (error) {
    const searchDuration = Date.now() - searchStartTime;

    return {
      success: false,
      searchId,
      results: [],
      metadata: {
        searchParams: params,
        totalSearches: 0,
        successfulSearches: 0,
        searchDurationMs: searchDuration,
        resultsCount: 0,
        airportsFound: { origin: 0, destination: 0 },
      },
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Helper functions
function calculateTotalDuration(slices: DuffelSlice[]): string {
  if (!slices.length) return "0:00";

  const totalMinutes = slices.reduce((total, slice) => {
    const duration = slice.duration || "0:00";
    const [hours, minutes] = duration.split(":").map(Number);
    return total + hours * 60 + (minutes || 0);
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function extractAirlines(slices: DuffelSlice[]): string[] {
  const airlines = new Set<string>();
  slices.forEach((slice) => {
    slice.segments?.forEach((segment: DuffelSegment) => {
      if (segment.marketing_carrier?.iata_code) {
        airlines.add(segment.marketing_carrier.iata_code);
      }
    });
  });
  return Array.from(airlines);
}

function calculateConnections(slices: DuffelSlice[]): number {
  return slices.reduce((total, slice) => {
    const segments = slice.segments?.length || 1;
    return total + Math.max(0, segments - 1);
  }, 0);
}
