import { tool } from "ai";
import { z } from "zod";
import { searchFlights, DuffelOffer } from "@/app/server/actions/flight-search";
import {
  flexibleFlightSearch,
  FlexibleSearchParams,
} from "@/app/server/actions/flexible-flight-search";

// Helper to clean and sanitize Duffel offers for timeline
function cleanDuffelOffer(offer: any) {
  // Debug: Log what we're receiving
  console.log('[CLEAN-DUFFEL-OFFER] Raw offer structure:', {
    id: offer.id,
    hasSlices: !!offer.slices,
    slicesCount: offer.slices?.length || 0,
    firstSliceKeys: offer.slices?.[0] ? Object.keys(offer.slices[0]) : [],
    hasSegments: !!offer.slices?.[0]?.segments,
    segmentsCount: offer.slices?.[0]?.segments?.length || 0,
    firstSegmentKeys: offer.slices?.[0]?.segments?.[0] ? Object.keys(offer.slices[0].segments[0]) : [],
    // Look for departure/arrival times in various locations
    sliceDeparture: offer.slices?.[0]?.departure_datetime,
    sliceArrival: offer.slices?.[0]?.arrival_datetime,
    segmentDeparture: offer.slices?.[0]?.segments?.[0]?.departing_at,
    segmentArrival: offer.slices?.[0]?.segments?.[0]?.arriving_at,
    segmentDepartureDatetime: offer.slices?.[0]?.segments?.[0]?.departure_datetime,
    segmentArrivalDatetime: offer.slices?.[0]?.segments?.[0]?.arrival_datetime
  });
  
  return {
    id: offer.id,
    price: {
      amount: offer.total_amount,
      currency: offer.total_currency,
    },
    airline: {
      name: offer.owner?.name || "Unknown Airline",
      code: offer.owner?.iata_code || "XX",
    },
    route: {
      from: {
        code: offer.slices[0]?.origin?.iata_code || "XXX",
        name: offer.slices[0]?.origin?.name || "Unknown Airport",
        city: offer.slices[0]?.origin?.city_name,
      },
      to: {
        code: offer.slices[0]?.destination?.iata_code || "XXX",
        name: offer.slices[0]?.destination?.name || "Unknown Airport",
        city: offer.slices[0]?.destination?.city_name,
      },
    },
    timing: {
      departure: offer.slices?.[0]?.segments?.[0]?.departing_at || 
                 offer.slices?.[0]?.segments?.[0]?.departure_datetime ||
                 offer.slices?.[0]?.departure_datetime ||
                 offer.slices?.[0]?.origin?.departure_datetime ||
                 offer.departure_datetime ||
                 offer.origin?.departure_datetime ||
                 "",
      arrival: offer.slices?.[0]?.segments?.[0]?.arriving_at || 
               offer.slices?.[0]?.segments?.[0]?.arrival_datetime ||
               offer.slices?.[0]?.arrival_datetime ||
               offer.slices?.[0]?.destination?.arrival_datetime ||
               offer.arrival_datetime ||
               offer.destination?.arrival_datetime ||
               "",
      duration: offer.slices?.[0]?.duration || offer.duration || "PT0H0M",
    },
    segments: offer.slices[0]?.segments?.map((seg: any) => ({
      from: seg.origin?.iata_code,
      to: seg.destination?.iata_code,
      airline: seg.operating_carrier?.name,
      departure: seg.departure_datetime,
      arrival: seg.arrival_datetime,
    })) || [],
    timelineData: {
      id: offer.id,
      total_amount: offer.total_amount,
      total_currency: offer.total_currency,
      slices: offer.slices.map((slice: any) => ({
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
        departure_datetime: slice.segments?.[0]?.departing_at || slice.departure_datetime,
        arrival_datetime: slice.segments?.[0]?.arriving_at || slice.arrival_datetime,
        duration: slice.duration,
      })),
      owner: {
        name: offer.owner?.name,
        iata_code: offer.owner?.iata_code,
      },
    },
  };
}

export const findFlightUnifiedTool = tool({
  description: `
    Intelligent flight search that automatically handles any type of request - from very specific to very general.
    
    Examples it can handle:
    - Specific: "Find flights from JFK to LAX on December 25th"
    - General: "I want to go somewhere warm in Asia for a week next month"
    - Mixed: "Find cheap flights from New York to anywhere in Europe in March"
    - Complex: "Show me the best round-trip options from anywhere in California to Tokyo area, departing sometime in the next 2 months for a 10-day trip"
    
    The tool automatically determines whether to use specific or flexible search based on the parameters provided.
  `,
  parameters: z.object({
    from: z.union([
      z
        .string()
        .min(3)
        .max(3)
        .describe("Specific 3-letter airport code (e.g., 'JFK', 'LAX')"),
      z
        .enum([
          "asia",
          "europe",
          "north-america",
          "south-america",
          "oceania",
          "africa",
          "middle-east",
          "new-york",
          "london",
          "tokyo",
          "dubai",
          "singapore",
          "los-angeles",
          "san-francisco",
          "paris",
          "amsterdam",
          "anywhere",
        ])
        .describe("Region, metro area, or 'anywhere'"),
      z
        .array(z.string())
        .describe("Multiple airports, regions, or metro areas"),
    ]).describe(`
      Origin - can be:
      - Specific airport: "JFK", "LAX", "LHR"
      - Metro area: "new-york", "london", "tokyo"
      - Region: "asia", "europe", "north-america"
      - Special: "anywhere"
      - Multiple: ["JFK", "LGA"] or ["asia", "europe"]
    `),

    to: z
      .union([
        z.string().min(3).max(3).describe("Specific 3-letter airport code"),
        z
          .enum([
            "asia",
            "europe",
            "north-america",
            "south-america",
            "oceania",
            "africa",
            "middle-east",
            "new-york",
            "london",
            "tokyo",
            "dubai",
            "singapore",
            "los-angeles",
            "san-francisco",
            "paris",
            "amsterdam",
            "anywhere",
          ])
          .describe("Region, metro area, or 'anywhere'"),
        z.array(z.string()).describe("Multiple destinations"),
      ])
      .describe("Destination - same format as origin"),

    departure: z.union([
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Specific date (YYYY-MM-DD)"),
      z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .describe("Month (YYYY-MM) for flexible search"),
      z
        .object({
          start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .describe("Date range for flexible search"),
      z
        .enum([
          "next-month",
          "next-2-months",
          "next-3-months",
          "flexible",
          "anytime",
        ])
        .describe("Relative time periods"),
    ]).describe(`
      Departure timing - can be:
      - Specific date: "2024-12-25"
      - Month: "2024-12" (searches whole month)
      - Date range: {"start": "2024-12-01", "end": "2024-12-31"}
      - Relative: "next-month", "next-2-months", "flexible", "anytime"
    `),

    return: z
      .union([
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Specific return date"),
        z
          .number()
          .int()
          .min(1)
          .max(30)
          .describe("Trip duration in days (for round-trip)"),
        z.enum(["open-jaw", "one-way"]).describe("Special return types"),
      ])
      .optional().describe(`
      Return specification:
      - Specific date: "2024-12-30" 
      - Duration: 7 (for 7-day trip)
      - "one-way" for one-way flights
      - Omit for round-trip with flexible return
    `),

    passengers: z
      .number()
      .int()
      .min(1)
      .max(9)
      .optional()
      .default(1)
      .describe("Number of passengers"),

    cabinClass: z
      .enum(["economy", "premium_economy", "business", "first"])
      .optional()
      .default("economy"),

    preferences: z
      .object({
        maxPrice: z.number().optional().describe("Maximum acceptable price"),
        maxConnections: z
          .number()
          .int()
          .min(0)
          .max(3)
          .optional()
          .describe("Maximum stops/connections"),
        preferredAirlines: z
          .array(z.string())
          .optional()
          .describe("Preferred airline codes"),
        timePreference: z
          .enum(["morning", "afternoon", "evening", "red-eye", "any"])
          .optional()
          .default("any"),
        sortBy: z
          .enum(["cheapest", "fastest", "best-value", "shortest-duration"])
          .optional()
          .default("best-value"),
      })
      .optional()
      .describe("Optional search preferences"),

    urgency: z.enum(["low", "medium", "high"]).optional().default("medium")
      .describe(`
      Search urgency affects result count and processing time:
      - low: comprehensive search, more results
      - medium: balanced search  
      - high: quick search, fewer results
    `),
  }),

  execute: async ({
    from,
    to,
    departure,
    return: returnSpec,
    passengers = 1,
    cabinClass = "economy",
    preferences = {},
    urgency = "medium",
  }) => {
    const searchStartTime = Date.now();
    const toolCallId = Math.random().toString(36).substring(7);

    console.log(
      `[FIND-FLIGHT-TOOL-${toolCallId}] === TOOL EXECUTION START ===`
    );
    console.log(
      `[FIND-FLIGHT-TOOL-${toolCallId}] Timestamp: ${new Date().toISOString()}`
    );
    console.log(`[FIND-FLIGHT-TOOL-${toolCallId}] Input parameters:`, {
      from,
      to,
      departure,
      return: returnSpec,
      passengers,
      cabinClass,
      preferences,
      urgency,
    });

    try {
      // Determine if this should be a specific or flexible search
      const isFlexibleSearch =
        // Check if from/to are regions/arrays
        typeof from !== "string" ||
        from.length !== 3 ||
        !from.match(/^[A-Z]{3}$/) ||
        typeof to !== "string" ||
        to.length !== 3 ||
        !to.match(/^[A-Z]{3}$/) ||
        // Check if departure is flexible (not a specific date)
        typeof departure !== "string" ||
        !departure.match(/^\d{4}-\d{2}-\d{2}$/) ||
        // Check if return is a duration rather than specific date
        (returnSpec && typeof returnSpec === "number") ||
        // If we have specific dates but need airport flexibility, use flexible search
        (typeof departure === "string" && departure.match(/^\d{4}-\d{2}-\d{2}$/) && 
         typeof returnSpec === "string" && returnSpec.match(/^\d{4}-\d{2}-\d{2}$/) &&
         (from.length !== 3 || !from.match(/^[A-Z]{3}$/) || to.length !== 3 || !to.match(/^[A-Z]{3}$/)));

      console.log(
        `[FIND-FLIGHT-TOOL-${toolCallId}] Search type determination:`,
        {
          isFlexibleSearch,
          fromType: typeof from,
          fromLength: typeof from === "string" ? from.length : "N/A",
          fromMatches3Letter:
            typeof from === "string" ? from.match(/^[A-Z]{3}$/) : false,
          toType: typeof to,
          toLength: typeof to === "string" ? to.length : "N/A",
          toMatches3Letter:
            typeof to === "string" ? to.match(/^[A-Z]{3}$/) : false,
          departureType: typeof departure,
          departureMatchesDate:
            typeof departure === "string"
              ? departure.match(/^\d{4}-\d{2}-\d{2}$/)
              : false,
          returnSpecType: typeof returnSpec,
          returnIsNumber: typeof returnSpec === "number",
        }
      );

      if (isFlexibleSearch) {
        console.log(`[FIND-FLIGHT-TOOL-${toolCallId}] Using FLEXIBLE search`);

        // Use flexible search
        const flexibleParams = {
          from,
          to,
          dateWindow: (() => {
            if (typeof departure === "string") {
              if (departure.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // For specific dates, we need to handle both departure and return
                if (typeof returnSpec === "string" && returnSpec.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  // Both dates are specific, create a date range
                  return {
                    start: departure,
                    end: returnSpec
                  };
                } else {
                  // Only departure date is specific
                  return { exactDate: departure };
                }
              } else if (departure.match(/^\d{4}-\d{2}$/)) {
                return { month: departure };
              } else if (departure === "next-month") {
                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1);
                return { month: nextMonth.toISOString().slice(0, 7) };
              } else if (departure === "next-2-months") {
                const start = new Date();
                const end = new Date();
                end.setMonth(end.getMonth() + 2);
                return {
                  start: start.toISOString().slice(0, 10),
                  end: end.toISOString().slice(0, 10),
                };
              } else if (departure === "flexible" || departure === "anytime") {
                return { flexible: true };
              }
            } else if (typeof departure === "object" && "start" in departure) {
              return departure;
            }
            return undefined;
          })(),
          // For round-trips with specific return dates, calculate trip duration
          tripDuration: (() => {
            if (typeof returnSpec === "string" && returnSpec.match(/^\d{4}-\d{2}-\d{2}$/) && typeof departure === "string") {
              // Calculate days between departure and return
              const depDate = new Date(departure);
              const retDate = new Date(returnSpec);
              const diffTime = retDate.getTime() - depDate.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays;
            }
            return typeof returnSpec === "number" ? returnSpec : undefined;
          })(),
          tripType: returnSpec === "one-way" ? "one-way" : "round-trip",
          passengers,
          cabinClass,
          maxResults: urgency === "high" ? 10 : urgency === "medium" ? 20 : 30,
          priceSort:
            preferences.sortBy === "cheapest"
              ? "cheapest"
              : preferences.sortBy === "fastest"
              ? "fastest"
              : "best",
          maxConnections: preferences.maxConnections,
        };

        const result = await flexibleFlightSearch(
          flexibleParams as FlexibleSearchParams
        );

        console.log(
          `[FIND-FLIGHT-TOOL-${toolCallId}] Flexible search completed:`,
          {
            success: result.success,
            resultsCount: result.success ? result.results.length : 0,
            error: result.error,
          }
        );

        if (result.success) {
          const successResponse = {
            success: true,
            searchType: "flexible",
            searchId: result.searchId,
            results: result.results, // No timelineData for flexible
            metadata: result.metadata,
            message: `Found ${result.results.length} flexible flight options using intelligent search. ${result.metadata.priceRange ? `Price range: ${result.metadata.priceRange.currency} ${result.metadata.priceRange.min.toLocaleString()} - ${result.metadata.priceRange.max.toLocaleString()}.` : ""}`,
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };

          console.log(
            `[FIND-FLIGHT-TOOL-${toolCallId}] === TOOL SUCCESS (FLEXIBLE) ===`
          );
          return successResponse;
        } else {
          const errorResponse = {
            success: false,
            searchType: "flexible",
            error: result.error,
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };

          console.log(
            `[FIND-FLIGHT-TOOL-${toolCallId}] === TOOL FAILURE (FLEXIBLE) ===`
          );
          return errorResponse;
        }
      } else {
        console.log(`[FIND-FLIGHT-TOOL-${toolCallId}] Using SPECIFIC search`);

        // Use specific search
        const specificParams = {
          from: from as string,
          to: to as string,
          date: departure as string,
          passengers,
          cabinClass,
          returnDate: typeof returnSpec === "string" && returnSpec !== "one-way" ? returnSpec : undefined,
        };

        console.log(
          `[FIND-FLIGHT-TOOL-${toolCallId}] Specific search params:`,
          specificParams
        );

        const result = await searchFlights(specificParams);

        // Debug: Log the first raw offer to see what data structure we're getting
        if (result.success && result.data?.offers?.[0]) {
          const firstOffer = result.data.offers[0];
          console.log(`[FIND-FLIGHT-TOOL-${toolCallId}] First raw offer structure:`, {
            hasSlices: !!firstOffer.slices,
            slicesCount: firstOffer.slices?.length || 0,
            firstSliceKeys: firstOffer.slices?.[0] ? Object.keys(firstOffer.slices[0]) : [],
            hasDepartureDatetime: !!firstOffer.slices?.[0]?.departure_datetime,
            hasArrivalDatetime: !!firstOffer.slices?.[0]?.arrival_datetime,
            hasDuration: !!firstOffer.slices?.[0]?.duration,
            departureDatetime: firstOffer.slices?.[0]?.departure_datetime,
            arrivalDatetime: firstOffer.slices?.[0]?.arrival_datetime,
            duration: firstOffer.slices?.[0]?.duration,
            // Add more detailed debugging
            firstSliceFull: firstOffer.slices?.[0] ? JSON.stringify(firstOffer.slices[0], null, 2) : 'No slices',
            hasSegments: !!firstOffer.slices?.[0]?.segments,
            segmentsCount: firstOffer.slices?.[0]?.segments?.length || 0,
            firstSegmentKeys: firstOffer.slices?.[0]?.segments?.[0] ? Object.keys(firstOffer.slices[0].segments[0]) : [],
            firstSegmentFull: firstOffer.slices?.[0]?.segments?.[0] ? JSON.stringify(firstOffer.slices[0].segments[0], null, 2) : 'No segments',
            // Add complete offer structure for deep inspection
            completeOfferKeys: Object.keys(firstOffer),
            completeOfferStructure: JSON.stringify(firstOffer, null, 2)
          });
        }

        console.log(
          `[FIND-FLIGHT-TOOL-${toolCallId}] Specific search completed:`,
          {
            success: result.success,
            offersCount:
              result.success && result.data
                ? result.data.offers?.length || 0
                : 0,
            error: result.error,
          }
        );

        if (result.success && result.data) {
          const offers = result.data.offers || [];

          // Apply preferences filtering
          let filteredOffers: DuffelOffer[] = offers;

          if (preferences.maxPrice) {
            filteredOffers = filteredOffers.filter(
              (offer) => parseFloat(offer.total_amount) <= preferences.maxPrice!
            );
          }

          if (preferences.maxConnections !== undefined) {
            filteredOffers = filteredOffers.filter((offer) =>
              offer.slices.every(
                (slice) =>
                  slice.segments.length - 1 <= preferences.maxConnections!
              )
            );
          }

          // Sort based on preference
          if (preferences.sortBy === "cheapest") {
            filteredOffers.sort(
              (a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount)
            );
          } else if (preferences.sortBy === "fastest") {
            // Note: Duration parsing for ISO 8601 format (PT2H30M) is complex
            // For now, we'll sort by departure time as a proxy for speed
            filteredOffers.sort((a, b) => {
              const aFirstSlice = a.slices[0];
              const bFirstSlice = b.slices[0];
              if (aFirstSlice && bFirstSlice) {
                return (
                  new Date(aFirstSlice.departure_datetime).getTime() -
                  new Date(bFirstSlice.departure_datetime).getTime()
                );
              }
              return 0;
            });
          }

          const limitedOffers = filteredOffers.slice(
            0,
            urgency === "high" ? 5 : urgency === "medium" ? 10 : 15
          );

          console.log(`[FIND-FLIGHT-TOOL-${toolCallId}] Offers processing:`, {
            originalOffers: offers.length,
            afterFiltering: filteredOffers.length,
            displayed: limitedOffers.length,
            filtersApplied: {
              maxPrice: preferences.maxPrice,
              maxConnections: preferences.maxConnections,
              sortBy: preferences.sortBy,
            },
          });

          // CRITICAL: Clean all offers for timeline compatibility
          console.log(`[FIND-FLIGHT-TOOL-${toolCallId}] About to clean offers. First offer before cleaning:`, {
            id: limitedOffers[0]?.id,
            hasSlices: !!limitedOffers[0]?.slices,
            firstSliceKeys: limitedOffers[0]?.slices?.[0] ? Object.keys(limitedOffers[0].slices[0]) : [],
            firstSliceSegments: limitedOffers[0]?.slices?.[0]?.segments?.length || 0
          });
          
          const cleanedOffers = limitedOffers.map(cleanDuffelOffer);
          
          console.log(`[FIND-FLIGHT-TOOL-${toolCallId}] First offer after cleaning:`, {
            id: cleanedOffers[0]?.id,
            timing: cleanedOffers[0]?.timing,
            hasDeparture: !!cleanedOffers[0]?.timing?.departure,
            hasArrival: !!cleanedOffers[0]?.timing?.arrival,
            departure: cleanedOffers[0]?.timing?.departure,
            arrival: cleanedOffers[0]?.timing?.arrival
          });
          const successResponse = {
            success: true,
            searchType: "specific",
            searchId: result.data.id,
            numberOfOffers: filteredOffers.length,
            offers: cleanedOffers, // timelineData included
            metadata: {
              totalOffersAvailable: offers.length,
              offersAfterFiltering: filteredOffers.length,
              offersDisplayed: cleanedOffers.length,
              hasMoreOffers: filteredOffers.length > cleanedOffers.length,
              searchPerformedAt: new Date().toISOString(),
              tripType: returnSpec === "one-way" || !specificParams.returnDate ? "one-way" : "round-trip",
              filtersApplied: {
                maxPrice: preferences.maxPrice,
                maxConnections: preferences.maxConnections,
                sortBy: preferences.sortBy,
              },
            },
            message: `Found ${filteredOffers.length} flight${filteredOffers.length === 1 ? "" : "s"} for your ${returnSpec === "one-way" || !specificParams.returnDate ? "one-way" : "round-trip"} search from ${from} to ${to}.${filteredOffers.length > limitedOffers.length ? ` Showing top ${limitedOffers.length} results.` : ""}`,
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };

          console.log(
            `[FIND-FLIGHT-TOOL-${toolCallId}] === TOOL SUCCESS (SPECIFIC) ===`
          );
          return successResponse;
        } else {
          const errorResponse = {
            success: false,
            searchType: "specific",
            error: result.error || "Flight search failed",
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };

          console.log(
            `[FIND-FLIGHT-TOOL-${toolCallId}] === TOOL FAILURE (SPECIFIC) ===`
          );
          return errorResponse;
        }
      }
    } catch (error) {
      const searchDuration = Date.now() - searchStartTime;

      console.error(`[FIND-FLIGHT-TOOL-${toolCallId}] === TOOL EXCEPTION ===`);
      console.error(
        `[FIND-FLIGHT-TOOL-${toolCallId}] Exception type:`,
        error?.constructor?.name
      );
      console.error(
        `[FIND-FLIGHT-TOOL-${toolCallId}] Exception message:`,
        error instanceof Error ? error.message : String(error)
      );
      console.error(
        `[FIND-FLIGHT-TOOL-${toolCallId}] Exception stack:`,
        error instanceof Error ? error.stack : "No stack trace available"
      );
      console.error(
        `[FIND-FLIGHT-TOOL-${toolCallId}] Tool duration before error: ${searchDuration}ms`
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        searchDurationMs: searchDuration,
        timestamp: new Date().toISOString(),
      };
    }
  },
});