import { tool } from "ai";
import { z } from "zod";
import { searchFlights, DuffelOffer } from "@/app/server/actions/flight-search";
import {
  flexibleFlightSearch,
  FlexibleSearchParams,
} from "@/app/server/actions/flexible-flight-search";

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
        // Check if departure is flexible
        typeof departure !== "string" ||
        !departure.match(/^\d{4}-\d{2}-\d{2}$/) ||
        // Check if return is a duration rather than specific date
        (returnSpec && typeof returnSpec === "number");

      if (isFlexibleSearch) {
        // Use flexible search
        const flexibleParams = {
          from,
          to,
          dateWindow: (() => {
            if (typeof departure === "string") {
              if (departure.match(/^\d{4}-\d{2}$/)) {
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
          tripDuration: typeof returnSpec === "number" ? returnSpec : undefined,
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

        if (result.success) {
          return {
            success: true,
            searchType: "flexible",
            searchId: result.searchId,
            results: result.results,
            metadata: result.metadata,
            message: `Found ${
              result.results.length
            } flexible flight options using intelligent search. ${
              result.metadata.priceRange
                ? `Price range: ${
                    result.metadata.priceRange.currency
                  } ${result.metadata.priceRange.min.toLocaleString()} - ${result.metadata.priceRange.max.toLocaleString()}.`
                : ""
            }`,
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            success: false,
            searchType: "flexible",
            error: result.error,
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        // Use specific search
        const specificParams = {
          from: from as string,
          to: to as string,
          date: departure as string,
          passengers,
          cabinClass,
          returnDate: typeof returnSpec === "string" ? returnSpec : undefined,
        };

        const result = await searchFlights(specificParams);

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

          return {
            success: true,
            searchType: "specific",
            searchId: result.data.id,
            numberOfOffers: filteredOffers.length,
            offers: limitedOffers,
            metadata: {
              totalOffersAvailable: offers.length,
              offersAfterFiltering: filteredOffers.length,
              offersDisplayed: limitedOffers.length,
              hasMoreOffers: filteredOffers.length > limitedOffers.length,
              searchPerformedAt: new Date().toISOString(),
              tripType: specificParams.returnDate ? "round-trip" : "one-way",
              filtersApplied: {
                maxPrice: preferences.maxPrice,
                maxConnections: preferences.maxConnections,
                sortBy: preferences.sortBy,
              },
            },
            message: `Found ${filteredOffers.length} flight${
              filteredOffers.length === 1 ? "" : "s"
            } for your ${
              specificParams.returnDate ? "round-trip" : "one-way"
            } search from ${from} to ${to}.${
              filteredOffers.length > limitedOffers.length
                ? ` Showing top ${limitedOffers.length} results.`
                : ""
            }`,
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };
        } else {
          return {
            success: false,
            searchType: "specific",
            error: result.error || "Flight search failed",
            searchDurationMs: Date.now() - searchStartTime,
            timestamp: new Date().toISOString(),
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        searchDurationMs: Date.now() - searchStartTime,
        timestamp: new Date().toISOString(),
      };
    }
  },
});
