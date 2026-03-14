"use server";

import { auth } from "@clerk/nextjs/server";

export interface Guest {
  type: "adult" | "child";
  age?: number;
}

export interface StaySearchParams {
  location: string;
  check_in_date: string;
  check_out_date: string;
  guests: Guest[];
  rooms?: number;
  free_cancellation_only?: boolean;
  radius?: number;
}

export interface StaySearchResult {
  success: boolean;
  data?: {
    id?: string;
    results: unknown[];
    created_at: string;
  };
  error?: string;
}

// Simple city to coordinates mapping - in a real app, you'd use a geocoding service
const CITY_COORDINATES: Record<
  string,
  { latitude: number; longitude: number }
> = {
  london: { latitude: 51.5074, longitude: -0.1278 },
  "new york": { latitude: 40.7128, longitude: -74.006 },
  paris: { latitude: 48.8566, longitude: 2.3522 },
  tokyo: { latitude: 35.6762, longitude: 139.6503 },
  sydney: { latitude: -33.8688, longitude: 151.2093 },
  dubai: { latitude: 25.2048, longitude: 55.2708 },
  barcelona: { latitude: 41.3851, longitude: 2.1734 },
  rome: { latitude: 41.9028, longitude: 12.4964 },
  amsterdam: { latitude: 52.3676, longitude: 4.9041 },
  berlin: { latitude: 52.52, longitude: 13.405 },
  madrid: { latitude: 40.4168, longitude: -3.7038 },
  lisbon: { latitude: 38.7223, longitude: -9.1393 },
  vienna: { latitude: 48.2082, longitude: 16.3738 },
  prague: { latitude: 50.0755, longitude: 14.4378 },
  istanbul: { latitude: 41.0082, longitude: 28.9784 },
  singapore: { latitude: 1.3521, longitude: 103.8198 },
  "hong kong": { latitude: 22.3193, longitude: 114.1694 },
  mumbai: { latitude: 19.076, longitude: 72.8777 },
  delhi: { latitude: 28.7041, longitude: 77.1025 },
  bangkok: { latitude: 13.7563, longitude: 100.5018 },
};

// Helper function to get coordinates for a location
function getLocationCoordinates(
  location: string
): { latitude: number; longitude: number } | null {
  const normalizedLocation = location.toLowerCase().trim();
  return CITY_COORDINATES[normalizedLocation] || null;
}

// Helper function to validate date format
function validateDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
}

// Helper function to validate guests array
function validateGuests(guests: Guest[]): boolean {
  if (!Array.isArray(guests) || guests.length === 0) return false;

  return guests.every((guest) => {
    if (guest.type === "child") {
      return typeof guest.age === "number" && guest.age >= 0 && guest.age <= 17;
    }
    return guest.type === "adult";
  });
}

export async function searchStays(
  params: StaySearchParams
): Promise<StaySearchResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return {
        success: false,
        error: "User not authenticated. Please log in to search for stays.",
      };
    }

    const {
      location,
      check_in_date,
      check_out_date,
      guests,
      rooms = 1,
      free_cancellation_only = false,
      radius = 10,
    } = params;

    // Validate inputs
    if (!location || !check_in_date || !check_out_date || !guests) {
      return {
        success: false,
        error:
          "Missing required parameters: location, check_in_date, check_out_date, and guests are required",
      };
    }

    if (!validateDate(check_in_date)) {
      return {
        success: false,
        error: `Invalid check-in date: ${check_in_date}. Please use YYYY-MM-DD format.`,
      };
    }

    if (!validateDate(check_out_date)) {
      return {
        success: false,
        error: `Invalid check-out date: ${check_out_date}. Please use YYYY-MM-DD format.`,
      };
    }

    if (!validateGuests(guests)) {
      return {
        success: false,
        error: "Invalid guests array. Children must have age specified (0-17).",
      };
    }

    if (rooms < 1 || rooms > 10) {
      return {
        success: false,
        error: "Number of rooms must be between 1 and 10",
      };
    }

    // Check if check-in date is in the future
    const checkInDate = new Date(check_in_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      return {
        success: false,
        error: "Check-in date cannot be in the past",
      };
    }

    // Check if check-out date is after check-in date
    const checkOutDate = new Date(check_out_date);
    if (checkOutDate <= checkInDate) {
      return {
        success: false,
        error: "Check-out date must be after check-in date",
      };
    }

    // Check if stay is not too long (99 nights max as per API)
    const daysDifference = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDifference > 99) {
      return {
        success: false,
        error: "Stay duration cannot exceed 99 nights",
      };
    }

    // Get coordinates for the location
    const coordinates = getLocationCoordinates(location);
    if (!coordinates) {
      return {
        success: false,
        error: `Location "${location}" not found. Please try a major city name like "London", "New York", or "Paris".`,
      };
    }

    // Build the search request
    const searchRequest = {
      check_in_date,
      check_out_date,
      guests: guests.map((guest) => ({
        type: guest.type,
        ...(guest.type === "child" && { age: guest.age }),
      })),
      rooms,
      location: {
        geographic_coordinates: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
        radius,
      },
      free_cancellation_only,
      mobile: false,
    };

    // Make the API call to Duffel
    const response = await fetch("https://api.duffel.com/stays/search", {
      method: "POST",
      headers: {
        "Accept-Encoding": "gzip",
        Accept: "application/json",
        "Content-Type": "application/json",
        "Duffel-Version": "v2",
        Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ data: searchRequest }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Duffel API error:", response.status, errorText);

      if (response.status === 401) {
        return {
          success: false,
          error: "Authentication failed. Please check your Duffel API token.",
        };
      }
      if (response.status === 400) {
        return {
          success: false,
          error: "Invalid request parameters. Please check your input values.",
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        };
      }

      return {
        success: false,
        error: `API request failed with status ${response.status}`,
      };
    }

    const searchResponse = await response.json();

    return {
      success: true,
      data: {
        results: searchResponse.data.results || [],
        created_at: searchResponse.data.created_at,
      },
    };
  } catch (error) {
    console.error("Stay search error:", error);

    // Provide more specific error messages based on error type
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: "Failed to search stays",
    };
  }
}
