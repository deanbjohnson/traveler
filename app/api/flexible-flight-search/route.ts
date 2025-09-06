import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { flexibleFlightSearch } from '@/app/server/actions/flexible-flight-search';

// No caching for flexible flight search to ensure fresh random dates

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      from, 
      to, 
      months = 6,
      maxResults = 8,
      passengers = 1, 
      cabinClass = 'economy',
      tripType = 'round-trip',
      maxStops
    } = body;

    // Convert months to dateWindow format
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setMonth(today.getMonth() + months);
    
    const dateWindow = {
      start: today.toISOString().split('T')[0],
      end: futureDate.toISOString().split('T')[0]
    };

    // Disable caching for flexible flight search to ensure fresh random dates every time
    // This ensures we get truly random dates across months instead of cached results
    console.log('🚀 Generating fresh random dates for flexible search (no cache)');

    // Validate required parameters
    if (!from || !to) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: from and to are required'
      }, { status: 400 });
    }

    console.log('🚀 Flexible flight search API called with:', { 
      from, 
      to, 
      months,
      dateWindow,
      maxResults, 
      passengers, 
      cabinClass,
      tripType,
      maxStops
    });

    // Call the flexible flight search function
    const result = await flexibleFlightSearch({
      from,
      to,
      dateWindow,
      tripType: tripType as 'round-trip' | 'one-way',
      passengers,
      cabinClass: cabinClass as 'economy' | 'premium_economy' | 'business' | 'first',
      maxConnections: maxStops,
      maxResults
    });

    if (result.success && result.results) {
      console.log(`✅ Flexible search completed: ${result.results.length} results in ${Date.now() - startTime}ms`);

      return NextResponse.json({
        success: true,
        results: result.results,
        cached: false,
        responseTime: Date.now() - startTime,
        resultsCount: result.results.length
      });
    } else {
      console.error('❌ Flexible flight search failed:', result.error);
      console.error('❌ Full result object:', result);
      return NextResponse.json({
        success: false,
        error: result.error || 'Flexible flight search failed',
        responseTime: Date.now() - startTime
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Flexible flight search API error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}

// No cache cleanup needed since we disabled caching
