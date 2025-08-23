import { NextResponse } from "next/server";
import { flexibleFlightSearch } from "@/app/server/actions/flexible-flight-search";

function generateDateRanges(months: number) {
  const now = new Date();
  // Start from next month to avoid biasing to current month only
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const ranges: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < Math.max(1, Math.min(12, months)); i++) {
    const start = new Date(first.getFullYear(), first.getMonth() + i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    ranges.push({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }
  return ranges;
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

    const dateRanges = generateDateRanges(months);
    const start = dateRanges[0]?.start;
    const end = dateRanges[dateRanges.length - 1]?.end || start;

    const search = await flexibleFlightSearch({
      from: [origin],
      to: [destination],
      // Provide a single continuous window spanning the requested months
      dateWindow: start && end ? { start, end } : undefined,
      tripType,
      passengers,
      cabinClass,
      maxResults,
      priceSort: "cheapest",
      ...(directOnly ? { maxConnections: 0 } : {}),
    } as any);

    return NextResponse.json(search);
  } catch (error) {
    console.error("/api/find-flights error", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}


