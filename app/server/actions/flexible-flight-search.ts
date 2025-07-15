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
  duration?: string;
  segments?: DuffelSegment[];
}

interface DuffelOffer {
  total_amount?: string;
  total_currency?: string;
  slices?: DuffelSlice[];
}

// Regional coordinate centers and search radii (in meters)
const REGION_COORDINATES = {
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
      "JFK",
      "LAX",
      "LHR",
      "CDG",
      "FRA",
      "DXB",
      "SIN",
      "HKG",
      "NRT",
      "SYD",
    ];
  }

  const airports = await getAirportsInArea(from);
  const codes = airports.map((airport) => airport.iata_code);

  // Limit to top 10 airports for performance
  return codes.slice(0, 10);
}

async function expandDestinations(to: string | string[]): Promise<string[]> {
  if (Array.isArray(to)) {
    const allAirports = await Promise.all(to.map(expandDestinations));
    return allAirports.flat();
  }

  const airports = await getAirportsInArea(to);
  const codes = airports.map((airport) => airport.iata_code);

  // Limit to top 10 airports for performance
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
    const maxCombinations = 40; // Reasonable limit

    let combinationCount = 0;
    for (const origin of origins) {
      for (const destination of destinations) {
        for (const date of dates) {
          if (combinationCount >= maxCombinations) break;

          const returnDate =
            params.tripType === "round-trip" && params.tripDuration
              ? format(
                  addDays(new Date(date), params.tripDuration),
                  "yyyy-MM-dd"
                )
              : undefined;

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

    console.log(`🚀 Executing ${searchCombinations.length} flight searches`);

    // Execute searches in batches
    const batchSize = 8;
    const results: FlightOption[] = [];
    let successfulSearches = 0;

    for (let i = 0; i < searchCombinations.length; i += batchSize) {
      const batch = searchCombinations.slice(i, i + batchSize);

      const batchPromises = batch.map(async (searchParams) => {
        try {
          const result = await searchFlights(searchParams);
          if (result.success && result.data?.offers) {
            successfulSearches++;
            const offers = result.data.offers as DuffelOffer[];

            return offers.slice(0, 2).map((offer: DuffelOffer) => {
              const option: FlightOption = {
                searchId: result.data!.id,
                route: {
                  origin: searchParams.from,
                  destination: searchParams.to,
                },
                dates: {
                  departure: searchParams.date,
                  return: searchParams.returnDate,
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
        await new Promise((resolve) => setTimeout(resolve, 150));
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
