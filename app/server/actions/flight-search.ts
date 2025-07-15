"use server";

import { Duffel } from "@duffel/api";
import {
  CreateOfferRequestPassenger,
  CreateOfferRequestSlice,
} from "@duffel/api/types";
import { auth } from "@clerk/nextjs/server";

// Types for Duffel API responses
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
    departure_datetime: string;
    arrival_datetime: string;
  }>;
}

export interface DuffelOffer {
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

// Initialize Duffel client
const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN!,
});

// Check if Duffel token is configured
if (!process.env.DUFFEL_ACCESS_TOKEN) {
  console.error("❌ DUFFEL_ACCESS_TOKEN environment variable is not set");
}

type CabinClass = "economy" | "premium_economy" | "business" | "first";

export interface FlightSearchParams {
  from: string;
  to: string;
  date: string;
  passengers?: number;
  cabinClass?: CabinClass;
  returnDate?: string;
}

export interface FlightSearchResult {
  success: boolean;
  data?: {
    id: string;
    offers?: DuffelOffer[];
    slices: DuffelSlice[];
    passengers: Array<{
      id: string;
      type: string;
    }>;
    cabin_class: string;
  };
  error?: string;
}

// Helper function to validate airport codes
function validateAirportCode(code: string): boolean {
  // Airport codes should be 3 characters (IATA) or can be city codes
  return /^[A-Z]{3}$/.test(code.toUpperCase());
}

// Helper function to validate date format
function validateDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
}

export async function searchFlights(
  params: FlightSearchParams
): Promise<FlightSearchResult> {
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: "Unauthorized",
    };
  }
  console.log("🚀 Starting flight search with params:", params);

  try {
    const {
      from,
      to,
      date,
      passengers = 1,
      cabinClass = "economy",
      returnDate,
    } = params;

    // Validate inputs
    if (!from || !to || !date) {
      return {
        success: false,
        error: "Missing required parameters: from, to, and date are required",
      };
    }

    if (!validateAirportCode(from)) {
      return {
        success: false,
        error: `Invalid departure airport code: ${from}. Please use a valid 3-letter IATA code.`,
      };
    }

    if (!validateAirportCode(to)) {
      return {
        success: false,
        error: `Invalid arrival airport code: ${to}. Please use a valid 3-letter IATA code.`,
      };
    }

    if (!validateDate(date)) {
      return {
        success: false,
        error: `Invalid departure date: ${date}. Please use YYYY-MM-DD format.`,
      };
    }

    if (returnDate && !validateDate(returnDate)) {
      return {
        success: false,
        error: `Invalid return date: ${returnDate}. Please use YYYY-MM-DD format.`,
      };
    }

    if (passengers < 1 || passengers > 9) {
      return {
        success: false,
        error: "Number of passengers must be between 1 and 9",
      };
    }

    // Check if departure date is in the future
    const departureDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (departureDate < today) {
      return {
        success: false,
        error: "Departure date cannot be in the past",
      };
    }

    // Check if return date is after departure date
    if (returnDate) {
      const returnDateObj = new Date(returnDate);
      if (returnDateObj < departureDate) {
        return {
          success: false,
          error: "Return date cannot be before departure date",
        };
      }
    }

    // Build slices array (outbound + optional return)
    const slices = [
      {
        origin: from.toUpperCase(),
        destination: to.toUpperCase(),
        departure_date: date,
      },
    ];

    // Add return slice if return date is provided
    if (returnDate) {
      slices.push({
        origin: to.toUpperCase(),
        destination: from.toUpperCase(),
        departure_date: returnDate,
      });
    }

    // Build passengers array - for simplicity, assuming all are adults
    const passengersArray = Array(passengers).fill({
      type: "adult",
    });

    // Create offer request with timeout
    console.log("📡 Making Duffel API call...");

    const offerRequestResponse = (await Promise.race([
      duffel.offerRequests.create({
        slices: slices as unknown as CreateOfferRequestSlice[],
        passengers: passengersArray as unknown as CreateOfferRequestPassenger[],
        cabin_class: cabinClass as CabinClass,
        return_offers: true,
      }),
      // 30 second timeout
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Flight search timed out after 30 seconds")),
          30000
        )
      ),
    ])) as Awaited<ReturnType<typeof duffel.offerRequests.create>>;

    console.log("✅ Duffel API call completed successfully");

    return {
      success: true,
      data: {
        id: offerRequestResponse.data.id,
        offers: (offerRequestResponse.data.offers || []) as DuffelOffer[],
        slices: offerRequestResponse.data.slices as DuffelSlice[],
        passengers: offerRequestResponse.data.passengers as Array<{
          id: string;
          type: string;
        }>,
        cabin_class: offerRequestResponse.data.cabin_class as string,
      },
    };
  } catch (error) {
    console.error("Flight search error:", error);

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
          error: "Invalid request parameters. Please check your input values.",
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
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to search flights",
    };
  }
}
