import { NextRequest, NextResponse } from 'next/server';
import { searchAirports } from '@/lib/airport-database-comprehensive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ 
        airports: [],
        message: 'Query must be at least 2 characters long' 
      });
    }

    const searchTerm = query.trim().toLowerCase();
    
    // Search our comprehensive airport database
    const cityGroups = searchAirports(searchTerm);

    return NextResponse.json({
      airports: cityGroups,
      total: cityGroups.reduce((sum, group) => sum + group.airports.length, 0),
      query: searchTerm
    });

  } catch (error) {
    console.error('Airport search error:', error);
    return NextResponse.json(
      { error: 'Failed to search airports', airports: [] },
      { status: 500 }
    );
  }
}




