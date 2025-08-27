import { NextResponse } from "next/server";
import { searchFlights } from "@/app/server/actions/flight-search";

function generateRandomDates(months: number, count: number = 8) {
  const now = new Date();
  const unique = new Set<string>();

  // Start from next month to avoid biasing to current month only
  const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + months, 0);

  while (unique.size < count) {
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    const iso = new Date(randomTime).toISOString().split('T')[0];
    unique.add(iso);
  }

  return Array.from(unique).sort(); // Sort chronologically
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
      maxResults = 8,
      directOnly = false,
    } = body || {};

    if (!origin || !destination) {
      return NextResponse.json(
        { success: false, error: "origin and destination are required" },
        { status: 400 }
      );
    }

    // Generate up to 8 unique random dates across the requested months
    const desiredCount = Math.min(8, Number(maxResults) || 8);
    const searchDates = generateRandomDates(months, desiredCount);
    console.log(`[FIND-FLIGHTS] Searching dates:`, searchDates);
    
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
          // fetch a handful; we'll choose the cheapest per date below
          maxResults: 6,
        });
        
        if (searchResult.success && Array.isArray(searchResult.data?.offers) && searchResult.data.offers.length > 0) {
          const cheapest = [...searchResult.data.offers].sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))[0];
          return { date: searchDate, offer: cheapest };
        }
        return { date: searchDate, offer: null };
      } catch (error) {
        console.error(`Error searching date ${searchDate}:`, error);
        return { date: searchDate, offer: null };
      }
    });
    
    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);
    
    // Keep 1 cheapest per date (drop nulls)
    const perDate = results.filter(r => r && r.offer) as Array<{ date: string; offer: any }>;
    const finalOffers = perDate
      .sort((a, b) => parseFloat(a.offer.total_amount) - parseFloat(b.offer.total_amount))
      .slice(0, desiredCount)
      .map(r => ({ ...r.offer }));
    
    return NextResponse.json({
      success: true,
      results: finalOffers,
      searchedDates: searchDates,
      selectedCount: finalOffers.length,
      strategy: "one-cheapest-per-unique-date"
    });
  } catch (error) {
    console.error("/api/find-flights error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}


