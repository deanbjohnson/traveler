import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchFlights } from '@/app/actions/flight-search';

// Cache for API responses
const apiCache = new Map<string, { data: any, timestamp: number }>();
const API_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

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
      date, 
      returnDate, 
      passengers = 1, 
      cabinClass = 'economy', 
      maxResults = 10,
      // Alternative parameter names for location expansion
      origin,
      destination,
      months
    } = body;

    // Handle both parameter formats
    const finalFrom = from || origin;
    const finalTo = to || destination;
    let finalDate = date;
    
    // If no date provided but months is provided, generate a date range
    if (!finalDate && months) {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setMonth(today.getMonth() + months);
      finalDate = futureDate.toISOString().split('T')[0];
    }

    // Generate cache key
    const cacheKey = `${finalFrom}-${finalTo}-${finalDate}-${returnDate || 'oneway'}-${passengers}-${cabinClass}-${maxResults}`;
    
    // Check cache first
    const cached = apiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < API_CACHE_DURATION) {
      console.log('🎯 Using cached API response for:', cacheKey);
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
        responseTime: Date.now() - startTime
      });
    }

    // Validate required parameters
    if (!finalFrom || !finalTo || !finalDate) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: from/to and date are required'
      }, { status: 400 });
    }

    console.log('🚀 Direct flight search API called with:', { 
      from: finalFrom, 
      to: finalTo, 
      date: finalDate, 
      returnDate, 
      passengers, 
      cabinClass, 
      maxResults 
    });

    // Call the flight search function
    const result = await searchFlights({
      from: finalFrom,
      to: finalTo,
      date: finalDate,
      returnDate,
      passengers,
      cabinClass,
    });

    if (result.success && result.data) {
      // Limit results for faster response
      const limitedOffers = result.data.offers?.slice(0, maxResults) || [];
      
      const responseData = {
        ...result.data,
        offers: limitedOffers
      };

      // Cache the response
      apiCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });

      console.log(`✅ Direct API search completed: ${limitedOffers.length} offers in ${Date.now() - startTime}ms`);

      return NextResponse.json({
        success: true,
        data: responseData,
        results: limitedOffers, // Add results array for location expansion compatibility
        cached: false,
        responseTime: Date.now() - startTime,
        offersCount: limitedOffers.length
      });
    } else {
      console.error('❌ Flight search failed:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error || 'Flight search failed',
        responseTime: Date.now() - startTime
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Direct flight search API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      responseTime: Date.now() - startTime
    }, { status: 500 });
  }
}

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of apiCache.entries()) {
    if (now - value.timestamp > API_CACHE_DURATION) {
      apiCache.delete(key);
    }
  }
}, API_CACHE_DURATION);