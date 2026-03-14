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

// No more hardcoded region coordinates - system is now purely Cohere-driven

export interface FlexibleSearchParams {
  // Origin must be specific 3-letter IATA airport code(s)
  from: string | string[];
  // Destination must be specific 3-letter IATA airport code(s)
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
  routing: {
    outbound: FlightSegment[];
    return?: FlightSegment[];
  };
  offer: unknown; // Raw Duffel offer
  score: number; // Composite score for ranking
}

export interface FlightSegment {
  origin: string;
  destination: string;
  originName?: string;
  destinationName?: string;
  carrier: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
}

interface Airport {
  iata_code: string;
  name: string;
  city_name: string;
  latitude: number;
  longitude: number;
}

// Simplified airport handling - only accept specific airport codes
function normalizeAirportCodes(codes: string | string[]): string[] {
  if (Array.isArray(codes)) {
    return codes.map(code => code.toUpperCase().trim()).filter(code => code.length === 3);
  }
  return [codes.toUpperCase().trim()].filter(code => code.length === 3);
}

/**
 * Generate random dates within a range (ChatGPT-style "surprise me" approach)
 * @param startDate - beginning of the window
 * @param endDate - end of the window
 * @param count - how many random dates to generate
 */
function getRandomDatesInRange(startDate: Date, endDate: Date, count: number = 1): Date[] {
  const results: Date[] = [];

  for (let i = 0; i < count; i++) {
    const start = startDate.getTime();
    const end = endDate.getTime();

    // random timestamp between start and end
    const randomTime = start + Math.random() * (end - start);
    results.push(new Date(randomTime));
  }

  // Optional: sort them chronologically
  return results.sort((a, b) => a.getTime() - b.getTime());
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
    
    // Calculate the number of months in the range for "surprise me" count
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    
    // Generate random dates across the entire range (ChatGPT's "surprise me" approach)
    const count = Math.min(totalMonths, 8); // Limit to 8 dates max for performance
    const randomDates = getRandomDatesInRange(start, end, count);
    
    // Deduplicate dates to prevent duplicate searches
    const uniqueDates = Array.from(new Set(randomDates.map((date) => format(date, "yyyy-MM-dd"))));
    
    return uniqueDates;
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
  // Add timestamp and random component to ensure unique search IDs and prevent caching issues
  const searchId = `flex_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}_${Math.random().toString(36).substr(2, 5)}`;

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

    // Normalize airport codes - only accept specific 3-letter codes
    const origins = normalizeAirportCodes(params.from);
    const destinations = normalizeAirportCodes(params.to);
    
    // Validate that we have valid airport codes
    if (origins.length === 0 || destinations.length === 0) {
      throw new Error("Invalid airport codes provided. Please use 3-letter IATA codes (e.g., 'JFK', 'LAX')");
    }

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
            } else {
              // Default to 7 days later for round-trip if no duration specified
              returnDate = format(
                addDays(new Date(date), 7),
                "yyyy-MM-dd"
              );
            }
          }

          searchCombinations.push({
            from: origin === "anywhere" ? "JFK" : origin,
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

            return offers.slice(0, 1).map((offer: DuffelOffer) => {
              // Debug: Log the actual offer structure and segments
              console.log('🔍 Duffel offer structure:', {
                offerId: offer.id,
                offerKeys: Object.keys(offer),
                slices: offer.slices?.map(slice => ({
                  origin: slice.origin?.iata_code,
                  destination: slice.destination?.iata_code,
                  segmentCount: slice.segments?.length || 0,
                  segments: slice.segments?.map(seg => ({
                    origin: seg.origin?.iata_code,
                    destination: seg.destination?.iata_code,
                    carrier: seg.marketing_carrier?.iata_code
                  }))
                }))
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
                routing: extractDetailedRouting(offer.slices || []),
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
  // For round-trip flights, show the maximum stops from any single slice
  // This gives users a better sense of the worst-case connection scenario
  if (slices.length === 0) return 0;
  
  const maxStopsPerSlice = Math.max(...slices.map(slice => {
    const segments = slice.segments?.length || 1;
    return Math.max(0, segments - 1);
  }));
  
  return maxStopsPerSlice;
}

function extractDetailedRouting(slices: DuffelSlice[]): { outbound: FlightSegment[]; return?: FlightSegment[] } {
  if (!slices.length) return { outbound: [] };
  
  const outbound = slices[0]?.segments?.map(segment => ({
    origin: segment.origin?.iata_code || '',
    destination: segment.destination?.iata_code || '',
    originName: segment.origin?.name,
    destinationName: segment.destination?.name,
    carrier: segment.marketing_carrier?.iata_code || segment.operating_carrier?.iata_code || '',
    departureTime: segment.departing_at || segment.departure_datetime || '',
    arrivalTime: segment.arriving_at || segment.arrival_datetime || '',
    duration: segment.duration || '0:00'
  })) || [];
  
  const returnRouting = slices[1]?.segments?.map(segment => ({
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
