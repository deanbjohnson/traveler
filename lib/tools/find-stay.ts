import { tool } from "ai";
import { z } from "zod";
import { searchStays } from "@/app/server/actions/stay-search";

export const findStayTool = tool({
  description:
    "Find accommodation/hotels for the user using real hotel data from Duffel API. Search by location coordinates with radius or by specific destination city name. Automatically validates inputs and provides helpful error messages for invalid requests.",
  parameters: z.object({
    location: z
      .string()
      .min(2, "Location must be at least 2 characters")
      .describe(
        "The destination city or area name (e.g., 'London', 'New York', 'Paris')"
      ),
    check_in_date: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Check-in date must be in YYYY-MM-DD format"
      )
      .describe("The check-in date in YYYY-MM-DD format"),
    check_out_date: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Check-out date must be in YYYY-MM-DD format"
      )
      .describe("The check-out date in YYYY-MM-DD format"),
    guests: z
      .array(
        z.object({
          type: z.enum(["adult", "child"]).describe("Guest type"),
          age: z
            .number()
            .min(0)
            .max(17)
            .optional()
            .describe("Age for children (0-17)"),
        })
      )
      .min(1, "At least one guest is required")
      .describe(
        "Array of guests with type and age (age only required for children)"
      ),
    rooms: z
      .number()
      .min(1, "At least 1 room is required")
      .max(10, "Maximum 10 rooms allowed")
      .default(1)
      .describe("Number of rooms required"),
    free_cancellation_only: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to only show rates with free cancellation"),
    radius: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Search radius in kilometers from the location center"),
  }),
  execute: async ({
    location,
    check_in_date,
    check_out_date,
    guests,
    rooms = 1,
    free_cancellation_only = false,
    radius = 10,
  }) => {
    const searchStartTime = Date.now();

    try {
      // Additional validation for date logic
      const checkInDate = new Date(check_in_date);
      const checkOutDate = new Date(check_out_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (checkInDate < today) {
        return {
          success: false,
          error:
            "Check-in date cannot be in the past. Please select a future date.",
          searchDetails: {
            location,
            check_in_date,
            check_out_date,
            guests,
            rooms,
            free_cancellation_only,
            radius,
          },
          timestamp: new Date().toISOString(),
        };
      }

      if (checkOutDate <= checkInDate) {
        return {
          success: false,
          error:
            "Check-out date must be after check-in date. Please adjust your dates.",
          searchDetails: {
            location,
            check_in_date,
            check_out_date,
            guests,
            rooms,
            free_cancellation_only,
            radius,
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Validate guests array
      const hasValidGuests = guests.every((guest) => {
        if (guest.type === "child") {
          return (
            typeof guest.age === "number" && guest.age >= 0 && guest.age <= 17
          );
        }
        return guest.type === "adult";
      });

      if (!hasValidGuests) {
        return {
          success: false,
          error:
            "Invalid guest information. Children must have age specified (0-17).",
          searchDetails: {
            location,
            check_in_date,
            check_out_date,
            guests,
            rooms,
            free_cancellation_only,
            radius,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const result = await searchStays({
        location,
        check_in_date,
        check_out_date,
        guests,
        rooms,
        free_cancellation_only,
        radius,
      });

      const searchDuration = Date.now() - searchStartTime;

      if (result.success && result.data) {
        const accommodations = result.data.results || [];
        const limitedResults = accommodations.slice(0, 5); // Return first 5 results for better performance

        return {
          success: true,
          numberOfResults: accommodations.length,
          searchDetails: {
            location,
            check_in_date,
            check_out_date,
            guests,
            rooms,
            free_cancellation_only,
            radius,
            searchDurationMs: searchDuration,
          },
          accommodations: limitedResults,
          metadata: {
            totalResultsAvailable: accommodations.length,
            resultsDisplayed: limitedResults.length,
            hasMoreResults: accommodations.length > 5,
            searchPerformedAt: new Date().toISOString(),
            nights: Math.ceil(
              (checkOutDate.getTime() - checkInDate.getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          },
          message:
            accommodations.length > 0
              ? `Found ${accommodations.length} accommodation${
                  accommodations.length === 1 ? "" : "s"
                } in ${location} for your stay from ${check_in_date} to ${check_out_date}.${
                  accommodations.length > 5 ? " Showing first 5 results." : ""
                }`
              : `No accommodations found in ${location} for your dates ${check_in_date} to ${check_out_date}. Try adjusting your dates, location, or search radius.`,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error:
            result.error ||
            "Failed to search accommodations. Please try again.",
          searchDetails: {
            location,
            check_in_date,
            check_out_date,
            guests,
            rooms,
            free_cancellation_only,
            radius,
            searchDurationMs: searchDuration,
          },
          suggestions: [
            "Verify that the location name is spelled correctly",
            "Check that your dates are in the correct format (YYYY-MM-DD)",
            "Ensure your check-in date is in the future",
            "Try expanding your search radius",
            "Consider adjusting your travel dates if no results are found",
          ],
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const searchDuration = Date.now() - searchStartTime;

      return {
        success: false,
        error:
          error instanceof Error
            ? `Accommodation search failed: ${error.message}`
            : "An unexpected error occurred while searching for accommodations",
        searchDetails: {
          location,
          check_in_date,
          check_out_date,
          guests,
          rooms,
          free_cancellation_only,
          radius,
          searchDurationMs: searchDuration,
        },
        timestamp: new Date().toISOString(),
      };
    }
  },
});
