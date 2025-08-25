import { tool } from "ai";
import { z } from "zod";
import { searchFlights } from "@/app/server/actions/flight-search";
import { setProgress, resetProgress } from "@/lib/progress";
import { eachDayOfInterval, addMonths, startOfMonth, endOfMonth } from "date-fns";

// Helper to clean and sanitize Duffel offers for timeline
function cleanDuffelOffer(offer: any) {
  // If the incoming object is a wrapper (from flexibleFlightSearch), unwrap it
  const wrapped = offer && typeof offer === 'object' && offer.offer ? offer : null;
  const rawOffer = wrapped ? wrapped.offer : offer;

  // Handle undefined or null offers
  if (!rawOffer || typeof rawOffer !== 'object') {
    console.warn('cleanDuffelOffer: Invalid offer received:', offer);
    return null;
  }

  // Handle offers without slices
  if (!rawOffer.slices || !Array.isArray(rawOffer.slices) || rawOffer.slices.length === 0) {
    console.warn('cleanDuffelOffer: Offer has no slices:', offer);
    return null;
  }

  const firstSlice = rawOffer.slices[0];
  if (!firstSlice) {
    console.warn('cleanDuffelOffer: First slice is undefined:', offer);
    return null;
  }

  // Prefer wrapper price if present (already numeric), otherwise parse from raw offer
  const totalPrice = (wrapped?.price?.total ?? parseFloat(rawOffer.total_amount)) || 0;
  const currency = wrapped?.price?.currency ?? (rawOffer.total_currency ?? 'USD');

  return {
    id: rawOffer.id || 'unknown',
    price: {
      total: totalPrice,
      currency,
    },
    airline: {
      name: rawOffer.owner?.name || "Unknown Airline",
      code: rawOffer.owner?.iata_code || "XX",
    },
    route: {
      origin: firstSlice.origin?.iata_code || "XXX",
      destination: firstSlice.destination?.iata_code || "XXX",
    },
    timing: {
      duration: firstSlice.duration || "PT0H0M",
    },
    segments: firstSlice.segments?.map((seg: any) => ({
      from: seg.origin?.iata_code || "",
      to: seg.destination?.iata_code || "",
      airline: seg.operating_carrier?.name || seg.marketing_carrier?.name || "Unknown",
      departure: seg.departure_datetime,
      arrival: seg.arrival_datetime,
    })) || [],
    timelineData: {
      id: rawOffer.id,
      total_amount: rawOffer.total_amount,
      total_currency: rawOffer.total_currency,
      slices: rawOffer.slices.map((slice: any) => ({
        origin: {
          iata_code: slice.origin?.iata_code,
          name: slice.origin?.name,
          city_name: slice.origin?.city_name,
        },
        destination: {
          iata_code: slice.destination?.iata_code,
          name: slice.destination?.name,
          city_name: slice.destination?.city_name,
        },
        departure_datetime: slice.departure_datetime,
        arrival_datetime: slice.arrival_datetime,
        duration: slice.duration,
      })),
      owner: {
        name: rawOffer.owner?.name,
        iata_code: rawOffer.owner?.iata_code,
      },
    },
  };
}

// Helper function to generate date ranges for budget discovery
function generateBudgetDiscoveryDates(timeFrame: string) {
  const now = new Date();
  const startDate = addMonths(now, 1); // Start from next month to diversify
  
  let endDate: Date;
  switch (timeFrame) {
    case "3-months":
      endDate = addMonths(now, 3); // Search next 3 months
      break;
    case "6-months":
      endDate = addMonths(now, 5); // Search next 5 months (reduced from 7)
      break;
    case "12-months":
      endDate = addMonths(now, 9); // Search next 9 months (reduced from 13)
      break;
    default:
      endDate = addMonths(now, 5); // Default to 5 months
  }

  // Generate fewer date ranges to avoid timeout (reduced from monthly to quarterly)
  const monthsToCover = timeFrame === "12-months" ? 4 : timeFrame === "6-months" ? 3 : 2;
  const dates: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < monthsToCover; i++) {
    const monthStart = addMonths(startDate, i * 2); // Skip every other month
    const monthEnd = endOfMonth(addMonths(monthStart, 1)); // Cover 2 months at a time
    dates.push({
      start: monthStart.toISOString().split('T')[0],
      end: monthEnd.toISOString().split('T')[0],
    });
  }

  return dates;
}

// Helper function to parse ISO 8601 duration to minutes
function parseDurationToMinutes(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  return hours * 60 + minutes;
}

// Helper function to format duration for display
function formatDuration(duration: string): string {
  const minutes = parseDurationToMinutes(duration);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// Helper function to format price
function formatPrice(price: number, currency: string): string {
  return `${currency} ${price.toFixed(2)}`;
}

// Helper function to format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export const budgetDiscoveryTool = tool({
  description: `AI-Powered Budget Discovery Flight Search. The model should provide EXACTLY 5 concrete destinations (city + primary IATA airport) based on the user's query; this tool will then fetch the cheapest direct flight for each destination. DO NOT provide more than 5 destinations.`,
  parameters: z.object({
    from: z.string().describe("Origin airport code or 'anywhere' for flexible origin"),
    destinationSuggestion: z.string().describe("Natural language request that informed the AI's destination shortlist (for logging only)"),
    tripId: z.string().optional().describe("Injected by server to report grounded progress"),
    destinations: z
      .array(
        z.object({
          name: z.string().describe("City or area display name"),
          airport: z.string().length(3).describe("Primary IATA airport for that destination"),
          country: z.string().optional(),
          category: z.string().optional().describe("Optional descriptor like 'golf', 'beach' (free text from the model)")
        })
      )
      .min(1)
      .max(5)
      .describe("AI-proposed destination shortlist to search (EXACTLY 5 destinations)"),
    timeFrame: z.enum(["3-months", "6-months", "12-months"]).default("6-months").describe("Search timeframe"),
    tripType: z.enum(["round-trip", "one-way"]).default("round-trip").describe("Trip type"),
    tripDuration: z.number().optional().describe("Trip duration in days (for round-trip)"),
    maxBudget: z.number().optional().describe("Maximum budget per person"),
    passengers: z.number().default(1).describe("Number of passengers"),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).default("economy").describe("Cabin class"),
    preferences: z.record(z.any()).optional().describe("Additional preferences"),
  }),
  execute: async ({ 
    from, 
    destinationSuggestion, 
    tripId,
    destinations,
    timeFrame = "6-months", 
    tripType = "round-trip", 
    tripDuration, 
    maxBudget, 
    passengers = 1, 
    cabinClass = "economy", 
    preferences = {} 
  }: any) => {
    const toolCallId = Math.random().toString(36).substring(7);
    console.log(`[BUDGET-DISCOVERY-${toolCallId}] Starting AI-powered budget discovery search`);
    console.log(`[BUDGET-DISCOVERY-${toolCallId}] Query: ${destinationSuggestion} from ${from}`);
    console.log(`[BUDGET-DISCOVERY-${toolCallId}] Destinations provided by model:`, destinations.map((d: {name: string; airport: string}) => `${d.name} (${d.airport})`));

    const startTime = Date.now();
    const locationResults: Array<{
      destination: any;
      flight: any;
      price: number;
    }> = [];
    const destinationsSearched: string[] = [];
    const dateRangesSearched = generateBudgetDiscoveryDates(timeFrame);

    try {
      // Limit to 5 destinations to avoid timeout (reduced from 10)
      const plannedDestinations = Math.min(5, destinations.length);
      const limitedDestinations = destinations.slice(0, plannedDestinations);

      if (tripId) {
        resetProgress(tripId);
        setProgress(tripId, {
          current: 0,
          total: plannedDestinations,
          startedAt: Date.now(),
          message: `Starting search for ${plannedDestinations} destinations`,
        });
      }
      
      let idx = 0;
      for (const destination of limitedDestinations) {
        console.log(`[BUDGET-DISCOVERY-${toolCallId}] Searching flights to ${destination.name} (${destination.airport})`);
        if (tripId) {
          setProgress(tripId, {
            current: idx,
            total: plannedDestinations,
            message: `Searching ${destination.name} (${idx + 1}/${plannedDestinations})`,
          });
        }
        
        try {
          // Use a much simpler approach for budget discovery - just search 1 specific date
          const searchDate = new Date();
          searchDate.setDate(searchDate.getDate() + 30); // 1 month from now
          
          const searchResult = await searchFlights({
            from: from === "anywhere" ? "JFK" : from,
            to: destination.airport,
            date: searchDate.toISOString().split('T')[0],
            returnDate: tripType === "round-trip" ? new Date(searchDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
            passengers,
            cabinClass,
          });
          
          if (searchResult.success && searchResult.data?.offers && searchResult.data.offers.length > 0) {
            console.log(`[BUDGET-DISCOVERY-${toolCallId}] Found ${searchResult.data.offers.length} offers for ${destination.name}`);
            // Find the cheapest direct flight for this destination
            const directFlights = searchResult.data.offers.filter((offer: any) => {
              const isDirect = offer.slices && offer.slices.length === 1 && 
                              offer.slices[0].segments && offer.slices[0].segments.length === 1;
              if (!isDirect) {
                console.log(`[BUDGET-DISCOVERY-${toolCallId}] Skipping non-direct flight: ${offer.slices?.length} slices, ${offer.slices?.[0]?.segments?.length} segments`);
              }
              return isDirect;
            });
            
            if (directFlights.length > 0) {
              const cheapestFlight = directFlights[0]; // Already sorted by price
              
              // Add destination context to the flight
              const enhancedFlight = {
                ...cheapestFlight,
                destinationContext: destination.category || "AI",
                destinationAirport: {
                  iata_code: destination.airport,
                  city_name: destination.name,
                  country_name: destination.country || "",
                },
              };
              
              locationResults.push({
                destination,
                flight: enhancedFlight,
                price: parseFloat(enhancedFlight.total_amount),
              });
              
              destinationsSearched.push(destination.name);
              console.log(`[BUDGET-DISCOVERY-${toolCallId}] Found cheapest direct flight to ${destination.name}: $${enhancedFlight.total_amount}`);
            } else {
              console.log(`[BUDGET-DISCOVERY-${toolCallId}] No direct flights found to ${destination.name} - API returned:`, {
                success: searchResult.success,
                hasData: !!searchResult.data,
                offersCount: searchResult.data?.offers?.length || 0,
                error: searchResult.error
              });
            }
          }

          // Rate limiting delay (reduced from 3 seconds to 1 second)
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between calls
          idx += 1;
          if (tripId) {
            setProgress(tripId, {
              current: idx,
              total: plannedDestinations,
              message: `Completed ${idx}/${plannedDestinations}`,
            });
          }
          
        } catch (error) {
          console.error(`[BUDGET-DISCOVERY-${toolCallId}] Error searching ${destination.name}:`, error);
          // Continue with next destination instead of failing completely
        }
      }

      // Maintain original destination order, but each location shows its cheapest direct flight
      const sortedResults = locationResults
        .slice(0, 5) // Take exactly 5 locations in original order (reduced from 10)
        .map(item => item.flight);

      const searchDuration = Date.now() - startTime;
      if (tripId) {
        setProgress(tripId, {
          current: plannedDestinations,
          total: plannedDestinations,
          message: `Search complete in ${Math.round(searchDuration/1000)}s`,
          done: true,
        });
      }
      
      return {
        success: true,
        results: sortedResults,
        metadata: {
          plannedDestinations,
          totalSearches: destinations.length,
          successfulSearches: destinationsSearched.length,
          searchDurationMs: searchDuration,
          resultsCount: sortedResults.length,
          destinationsSearched,
          dateRangesSearched,
          searchParams: {
            from,
            destinationSuggestion,
            timeFrame,
            tripType,
            passengers,
            cabinClass,
            preferences,
          },
          aiSuggestedDestinations: destinations.map((d: {name: string}) => d.name),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results: [],
        metadata: {
          totalSearches: 0,
          successfulSearches: 0,
          searchDurationMs: Date.now() - startTime,
          resultsCount: 0,
          destinationsSearched: [],
          dateRangesSearched,
          searchParams: {
            from,
            destinationSuggestion,
            timeFrame,
            tripType,
            passengers,
            cabinClass,
            preferences,
          },
        },
      };
    }
  },
});
