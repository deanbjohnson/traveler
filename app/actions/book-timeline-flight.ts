"use server";

import { auth } from "@clerk/nextjs/server";
import { bookFlight } from "./flight-booking";
import { getTimelineByTripId } from "@/lib/db";

export interface BookTimelineFlightParams {
  tripId: string;
  itemId: string;
  passengerDetails?: {
    given_name: string;
    family_name: string;
    email: string;
    phone_number: string;
    born_on: string;
    title?: string;
    gender?: string;
  };
}

export interface BookTimelineFlightResult {
  success: boolean;
  bookingId?: string;
  bookingReference?: string;
  error?: string;
  message?: string;
  offerAgeMinutes?: number;
}

export async function bookTimelineFlight({
  tripId,
  itemId,
  passengerDetails,
}: BookTimelineFlightParams): Promise<BookTimelineFlightResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    // Get the timeline and find the specific item
    const timeline = await getTimelineByTripId(tripId, userId);
    if (!timeline) {
      return {
        success: false,
        error: "Timeline not found",
      };
    }

    const timelineItem = timeline.items?.find(item => item.id === itemId);
    if (!timelineItem) {
      return {
        success: false,
        error: "Timeline item not found",
      };
    }

    if (timelineItem.type !== "FLIGHT") {
      return {
        success: false,
        error: "Item is not a flight",
      };
    }

    const flightData = timelineItem.flightData as any;
    if (!flightData || !flightData.id) {
      return {
        success: false,
        error: "Flight data not found",
      };
    }

    // Check if the offer might be expired (offers typically expire after 15-30 minutes)
    const offerCreatedAt = flightData.created_at ? new Date(flightData.created_at) : null;
    const now = new Date();
    const offerAgeMinutes = offerCreatedAt ? (now.getTime() - offerCreatedAt.getTime()) / (1000 * 60) : 0;
    
    if (offerAgeMinutes > 30) {
      return {
        success: false,
        error: "Flight offer has expired. Please search for flights again to get fresh offers.",
        offerAgeMinutes: Math.round(offerAgeMinutes),
      };
    }

    // Use default passenger details if not provided (for testing)
    const defaultPassenger = {
      id: "passenger_1",
      given_name: passengerDetails?.given_name || "John",
      family_name: passengerDetails?.family_name || "Doe",
      email: passengerDetails?.email || "john.doe@example.com",
      phone_number: passengerDetails?.phone_number || "+1234567890",
      born_on: passengerDetails?.born_on || "1990-01-01",
      title: (passengerDetails?.title as any) || "mr",
      gender: (passengerDetails?.gender as any) || "m",
    };

    // Book the flight using Duffel with instant booking
    const bookingResult = await bookFlight({
      offer_id: flightData.id,
      passengers: [defaultPassenger],
      type: "instant", // Use instant booking with payment
      payment: {
        type: "balance",
        currency: flightData.total_currency || "USD",
        amount: flightData.total_amount || "0.00",
      },
      metadata: {
        trip_id: tripId,
        timeline_item_id: itemId,
        booked_from: "timeline",
      },
    });

    if (bookingResult.success && bookingResult.data) {
      return {
        success: true,
        bookingId: bookingResult.data.id,
        bookingReference: bookingResult.data.booking_reference,
        message: `Successfully booked flight! Booking reference: ${bookingResult.data.booking_reference}`,
      };
    } else {
      return {
        success: false,
        error: bookingResult.error || "Booking failed",
      };
    }

  } catch (error) {
    console.error("Error booking timeline flight:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function bookAllTimelineFlights(
  tripId: string,
  passengerDetails?: BookTimelineFlightParams["passengerDetails"]
): Promise<{
  success: boolean;
  results: Array<{
    itemId: string;
    success: boolean;
    bookingId?: string;
    bookingReference?: string;
    error?: string;
  }>;
}> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        results: [],
      };
    }

    // Get the timeline
    const timeline = await getTimelineByTripId(tripId, userId);
    if (!timeline) {
      return {
        success: false,
        results: [],
      };
    }

    // Find all flight items
    const flightItems = timeline.items?.filter(item => item.type === "FLIGHT") || [];
    
    if (flightItems.length === 0) {
      return {
        success: true,
        results: [],
      };
    }

    // Book each flight
    const results = [];
    for (const item of flightItems) {
      const result = await bookTimelineFlight({
        tripId,
        itemId: item.id,
        passengerDetails,
      });

      results.push({
        itemId: item.id,
        success: result.success,
        bookingId: result.bookingId,
        bookingReference: result.bookingReference,
        error: result.error,
      });
    }

    const allSuccessful = results.every(r => r.success);
    
    return {
      success: allSuccessful,
      results,
    };

  } catch (error) {
    console.error("Error booking all timeline flights:", error);
    return {
      success: false,
      results: [],
    };
  }
} 