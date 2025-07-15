import { tool } from "ai";
import { z } from "zod";
import { bookFlight } from "@/app/server/actions/flight-booking";

export const bookFlightTool = tool({
  description:
    "Book a flight using a selected offer from previous search results. Requires passenger details and payment information to complete the booking. Returns booking confirmation with reference number.",
  parameters: z.object({
    offer_id: z
      .string()
      .min(1, "Offer ID is required")
      .describe(
        "The ID of the flight offer to book (from previous search results)"
      ),
    passengers: z
      .array(
        z.object({
          id: z
            .string()
            .min(1, "Passenger ID is required")
            .describe("The passenger ID from the original offer request"),
          given_name: z
            .string()
            .min(1, "Given name is required")
            .max(50, "Given name too long")
            .describe("Passenger's first/given name"),
          family_name: z
            .string()
            .min(1, "Family name is required")
            .max(50, "Family name too long")
            .describe("Passenger's last/family name"),
          email: z
            .string()
            .email("Invalid email format")
            .describe("Passenger's email address"),
          phone_number: z
            .string()
            .min(10, "Phone number too short")
            .max(20, "Phone number too long")
            .describe(
              "Passenger's phone number (include country code, e.g., +1234567890)"
            ),
          born_on: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
            .describe("Passenger's date of birth in YYYY-MM-DD format"),
          title: z
            .enum(["mr", "mrs", "ms", "miss", "dr"])
            .optional()
            .describe("Passenger's title"),
          gender: z
            .enum(["m", "f"])
            .optional()
            .describe("Passenger's gender (m for male, f for female)"),
          infant_passenger_id: z
            .string()
            .optional()
            .describe(
              "For adults: ID of infant passenger they are responsible for"
            ),
        })
      )
      .min(1, "At least one passenger is required")
      .max(9, "Maximum 9 passengers allowed")
      .describe("Array of passenger details for booking"),
    payment: z
      .object({
        type: z
          .enum(["balance", "arc_bsp_cash"])
          .describe(
            "Payment type (balance for managed content, arc_bsp_cash for IATA agents)"
          ),
        currency: z
          .string()
          .length(3, "Currency must be a 3-letter ISO code")
          .describe("Payment currency (ISO 4217 code, e.g., USD, EUR, GBP)"),
        amount: z
          .string()
          .regex(/^\d+\.\d{2}$/, "Amount must be in format XX.XX")
          .describe("Payment amount in decimal format (e.g., '123.45')"),
      })
      .optional()
      .describe(
        "Payment details (required for instant bookings, omit for hold bookings)"
      ),
    type: z
      .enum(["instant", "hold"])
      .optional()
      .default("instant")
      .describe(
        "Booking type: 'instant' for immediate payment, 'hold' to pay later"
      ),
    metadata: z
      .record(z.string(), z.string())
      .optional()
      .describe("Optional metadata for the booking (key-value pairs)"),
  }),
  execute: async ({
    offer_id,
    passengers,
    payment,
    type = "instant",
    metadata,
  }) => {
    const bookingStartTime = Date.now();

    try {
      // Additional validation for booking logic
      if (type === "instant" && !payment) {
        return {
          success: false,
          error:
            "Payment details are required for instant bookings. Either provide payment details or use type 'hold'.",
          bookingDetails: {
            offer_id,
            passengers: passengers.length,
            type,
            hasPayment: !!payment,
          },
          timestamp: new Date().toISOString(),
        };
      }

      // Validate passenger ages for infants
      const today = new Date();
      for (const passenger of passengers) {
        const birthDate = new Date(passenger.born_on);
        const ageInYears = Math.floor(
          (today.getTime() - birthDate.getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        );

        // Check for infant passengers (under 2 years)
        if (ageInYears < 2) {
          const responsibleAdult = passengers.find(
            (p) => p.infant_passenger_id === passenger.id
          );
          if (!responsibleAdult) {
            return {
              success: false,
              error: `Infant passenger ${passenger.given_name} ${passenger.family_name} must have a responsible adult assigned.`,
              bookingDetails: {
                offer_id,
                passengers: passengers.length,
                type,
                hasPayment: !!payment,
              },
              timestamp: new Date().toISOString(),
            };
          }
        }
      }

      // Validate payment amount matches offer if provided
      if (payment && payment.type === "balance") {
        // Note: In a real implementation, you'd verify the amount matches the offer total
        // For now, we'll trust the provided amount
      }

      const result = await bookFlight({
        offer_id,
        passengers,
        payment,
        type,
        metadata,
      });

      const bookingDuration = Date.now() - bookingStartTime;

      if (result.success && result.data) {
        return {
          success: true,
          booking_id: result.data.id,
          booking_reference: result.data.booking_reference,
          bookingDetails: {
            offer_id,
            passengers: passengers.length,
            type,
            hasPayment: !!payment,
            bookingDurationMs: bookingDuration,
            total_amount: result.data.total_amount,
            total_currency: result.data.total_currency,
            airline: result.data.owner.name,
            airline_code: result.data.owner.iata_code,
          },
          payment_status: {
            awaiting_payment: result.data.payment_status.awaiting_payment,
            paid_at: result.data.payment_status.paid_at,
            payment_required_by: result.data.payment_status.payment_required_by,
          },
          passengers: result.data.passengers,
          slices: result.data.slices,
          documents: result.data.documents,
          metadata: {
            booking_completed_at: new Date().toISOString(),
            processing_duration_ms: bookingDuration,
          },
          message: `Successfully booked flight! Booking reference: ${
            result.data.booking_reference
          }. ${
            result.data.payment_status.awaiting_payment
              ? `Payment required by ${result.data.payment_status.payment_required_by}.`
              : "Payment completed."
          }`,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to book flight. Please try again.",
          bookingDetails: {
            offer_id,
            passengers: passengers.length,
            type,
            hasPayment: !!payment,
            bookingDurationMs: bookingDuration,
          },
          suggestions: [
            "Verify that the offer is still available and hasn't expired",
            "Check that all passenger details are correct and complete",
            "Ensure payment details are valid (if provided)",
            "Try booking again or search for alternative flights",
          ],
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const bookingDuration = Date.now() - bookingStartTime;

      return {
        success: false,
        error:
          error instanceof Error
            ? `Flight booking failed: ${error.message}`
            : "An unexpected error occurred during booking",
        bookingDetails: {
          offer_id,
          passengers: passengers.length,
          type,
          hasPayment: !!payment,
          bookingDurationMs: bookingDuration,
        },
        troubleshooting: {
          commonIssues: [
            "Offer has expired or is no longer available",
            "Invalid passenger information",
            "Payment processing issues",
            "Network connectivity problems",
            "API rate limiting",
          ],
          recommendations: [
            "Verify the offer is still valid by searching again",
            "Double-check all passenger details",
            "Ensure payment information is correct",
            "Check your internet connection",
            "Wait a moment and try again",
            "Contact support if the issue persists",
          ],
        },
        timestamp: new Date().toISOString(),
      };
    }
  },
});
