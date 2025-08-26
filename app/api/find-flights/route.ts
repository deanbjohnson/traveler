import { NextResponse } from "next/server";
import { searchFlights } from "@/app/server/actions/flight-search";

function generateRandomDates(months: number, count: number = 5) {
  const now = new Date();
  const dates: string[] = [];
  
  // Start from next month to avoid biasing to current month only
  const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, 0);
  
  for (let i = 0; i < count; i++) {
    // Generate a random date within the range
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    const randomDate = new Date(randomTime);
    dates.push(randomDate.toISOString().split('T')[0]);
  }
  
  return dates.sort(); // Sort chronologically
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      origin,
      destination, // IATA code
      months = 6,
      passengers = 1,
      cabinClass = "economy",
      tripType = "round-trip",
      maxResults = 10,
      directOnly = false,
    } = body || {};

    if (!origin || !destination) {
      return NextResponse.json(
        { success: false, error: "origin and destination are required" },
        { status: 400 }
      );
    }

    // Generate 5 random dates across the requested months
    const searchDates = generateRandomDates(months, 5);
    const allResults: any[] = [];
    
    // Search each date in parallel for speed
    const searchPromises = searchDates.map(async (searchDate) => {
      try {
        const returnDate = tripType === "round-trip" 
          ? new Date(new Date(searchDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : undefined;
          
        const searchResult = await searchFlights({
          from: origin,
          to: destination,
          date: searchDate,
          returnDate,
          passengers,
          cabinClass,
          maxResults: Math.ceil(maxResults / 5), // Distribute results across dates
        });
        
        if (searchResult.success && searchResult.data?.offers) {
          return searchResult.data.offers;
        }
        return [];
      } catch (error) {
        console.error(`Error searching date ${searchDate}:`, error);
        return [];
      }
    });
    
    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);
    
    // Flatten and sort by price
    const allOffers = results.flat().sort((a, b) => 
      parseFloat(a.total_amount) - parseFloat(b.total_amount)
    );
    
    // Return top results
    const topResults = allOffers.slice(0, maxResults);
    
    return NextResponse.json({
      success: true,
      results: topResults,
      searchedDates: searchDates,
      totalOffersFound: allOffers.length
    });
  } catch (error) {
    console.error("/api/find-flights error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}


