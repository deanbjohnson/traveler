"use server";

import { auth } from "@clerk/nextjs/server";
import { Duffel } from "@duffel/api";
import type {
  CreateOrder,
  DuffelPassengerGender,
  DuffelPassengerTitle,
  Order,
} from "@duffel/api/types";

// Initialize Duffel client
const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN!,
});

export interface PassengerDetails {
  id: string; // Passenger ID from the offer request
  given_name: string;
  family_name: string;
  email: string;
  phone_number: string;
  born_on: string; // YYYY-MM-DD format
  title?: DuffelPassengerTitle;
  gender?: DuffelPassengerGender;
  infant_passenger_id?: string; // For adults responsible for infants
}

export interface PaymentDetails {
  type: "balance" | "arc_bsp_cash";
  currency: string;
  amount: string;
}

export interface FlightBookingParams {
  offer_id: string;
  passengers: PassengerDetails[];
  payment?: PaymentDetails;
  type?: "instant" | "hold";
  metadata?: Record<string, string>;
}

export interface FlightBookingResult {
  success: boolean;
  data?: {
    id: string;
    booking_reference: string;
    total_amount: string;
    total_currency: string;
    payment_status: {
      awaiting_payment: boolean;
      paid_at?: string;
      payment_required_by?: string;
    };
    passengers: unknown[];
    slices: unknown[];
    documents?: unknown[];
    owner: {
      name: string;
      iata_code: string;
    };
    created_at: string;
  };
  error?: string;
}

export async function bookFlight(
  params: FlightBookingParams
): Promise<FlightBookingResult> {
  try {
    // Check authentication
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "User not authenticated. Please log in to book flights.",
      };
    }

    const {
      offer_id,
      passengers,
      payment,
      type = "instant",
      metadata,
    } = params;

    // Validate inputs
    if (!offer_id) {
      return {
        success: false,
        error: "Offer ID is required",
      };
    }

    if (!passengers || passengers.length === 0) {
      return {
        success: false,
        error: "At least one passenger is required",
      };
    }

    if (passengers.length > 9) {
      return {
        success: false,
        error: "Maximum 9 passengers allowed per booking",
      };
    }

    // Validate passenger details
    for (const passenger of passengers) {
      if (!passenger.given_name || !passenger.family_name) {
        return {
          success: false,
          error: "Passenger name (given_name and family_name) is required",
        };
      }

      if (!passenger.email) {
        return {
          success: false,
          error: "Passenger email is required",
        };
      }

      if (!passenger.phone_number) {
        return {
          success: false,
          error: "Passenger phone number is required",
        };
      }

      if (!passenger.born_on) {
        return {
          success: false,
          error: "Passenger date of birth is required",
        };
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(passenger.born_on)) {
        return {
          success: false,
          error: "Passenger date of birth must be in YYYY-MM-DD format",
        };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(passenger.email)) {
        return {
          success: false,
          error: "Invalid email format",
        };
      }
    }

    // For instant bookings, payment is required
    if (type === "instant" && !payment) {
      return {
        success: false,
        error: "Payment details are required for instant bookings",
      };
    }

    // First, get the latest offer to ensure it's still valid
    try {
      await duffel.offers.get(offer_id);
    } catch {
      return {
        success: false,
        error:
          "Failed to retrieve offer. The offer may have expired or is no longer available.",
      };
    }

    // Prepare the order creation payload
    const orderPayload: Record<string, unknown> = {
      selected_offers: [offer_id],
      passengers: passengers.map((passenger) => ({
        id: passenger.id,
        given_name: passenger.given_name,
        family_name: passenger.family_name,
        email: passenger.email,
        phone_number: passenger.phone_number,
        born_on: passenger.born_on,
        ...(passenger.title && { title: passenger.title }),
        ...(passenger.gender && { gender: passenger.gender }),
        ...(passenger.infant_passenger_id && {
          infant_passenger_id: passenger.infant_passenger_id,
        }),
      })),
      type,
      ...(metadata && { metadata }),
    };

    // Add payment details if provided (for instant bookings)
    if (payment && type === "instant") {
      orderPayload.payments = [payment];
    }

    // Create the order
    const orderResponse = await duffel.orders.create(
      orderPayload as unknown as CreateOrder
    );
    const order = orderResponse.data;

    return {
      success: true,
      data: {
        id: order.id,
        booking_reference: order.booking_reference,
        total_amount: order.total_amount,
        total_currency: order.total_currency,
        payment_status: {
          awaiting_payment: order.payment_status.awaiting_payment,
          paid_at: order.payment_status.paid_at || undefined,
          payment_required_by:
            order.payment_status.payment_required_by || undefined,
        },
        passengers: order.passengers,
        slices: order.slices,
        documents: order.documents || undefined,
        owner: {
          name: order.owner.name,
          iata_code: order.owner.iata_code || "",
        },
        created_at: order.created_at,
      },
    };
  } catch (error) {
    console.error("Flight booking error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        return {
          success: false,
          error: "Authentication failed. Please check your Duffel API token.",
        };
      }
      if (error.message.includes("400")) {
        return {
          success: false,
          error: "Invalid booking parameters. Please check your input values.",
        };
      }
      if (error.message.includes("409")) {
        return {
          success: false,
          error:
            "The offer is no longer available. Please search for new flights.",
        };
      }
      if (error.message.includes("422")) {
        return {
          success: false,
          error:
            "The booking could not be processed. Please check passenger details and try again.",
        };
      }
      if (error.message.includes("429")) {
        return {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        };
      }
      return {
        success: false,
        error: `Booking failed: ${error.message}`,
      };
    }

    return {
      success: false,
      error: "Failed to book flight. Please try again.",
    };
  }
}

export async function getOrder(order_id: string): Promise<Order> {
  const order = await duffel.orders.get(order_id);
  return order.data;
}
