import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tripId } = await request.json();
    
    if (!tripId) {
      return NextResponse.json({ error: 'Trip ID is required' }, { status: 400 });
    }

    // Find user by Clerk ID
    const user = await db.user.findFirst({
      where: { clerkUserId: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the pending flight
    const pendingFlight = await db.pendingFlight.findFirst({
      where: { 
        id: params.id,
        userId: user.id
      }
    });

    if (!pendingFlight) {
      return NextResponse.json({ error: 'Pending flight not found' }, { status: 404 });
    }

    // Verify the trip belongs to the user
    const trip = await db.trip.findFirst({
      where: { 
        id: tripId,
        userId: user.id
      },
      include: { timeline: true }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Create timeline if it doesn't exist
    let timeline = trip.timeline;
    if (!timeline) {
      timeline = await db.timeline.create({
        data: {
          tripId: trip.id,
          title: `${trip.title} Timeline`,
          description: `Timeline for ${trip.title}`
        }
      });
    }

    // Parse flight data
    const flightData = pendingFlight.parsedData as any;
    
    // Create timeline item for the flight
    const timelineItem = await db.timelineItem.create({
      data: {
        timelineId: timeline.id,
        title: `${flightData.airline || 'Flight'} ${flightData.flightNumber || ''}`,
        description: `Flight from ${flightData.origin || 'Unknown'} to ${flightData.destination || 'Unknown'}`,
        type: 'FLIGHT',
        status: 'BOOKED',
        startTime: flightData.departureDate ? new Date(flightData.departureDate) : new Date(),
        endTime: flightData.arrivalDate ? new Date(flightData.arrivalDate) : undefined,
        order: 0,
        level: 0,
        flightData: {
          airline: flightData.airline,
          flightNumber: flightData.flightNumber,
          origin: flightData.origin,
          destination: flightData.destination,
          departureDate: flightData.departureDate,
          departureTime: flightData.departureTime,
          arrivalDate: flightData.arrivalDate,
          arrivalTime: flightData.arrivalTime,
          confirmationCode: flightData.confirmationCode,
          passengerName: flightData.passengerName,
          bookingReference: flightData.bookingReference,
          source: 'email_forward'
        }
      }
    });

    // Update pending flight status
    await db.pendingFlight.update({
      where: { id: params.id },
      data: { 
        status: 'PROCESSED',
        assignedTripId: tripId
      }
    });

    return NextResponse.json({ 
      success: true,
      timelineItemId: timelineItem.id,
      message: 'Flight successfully added to timeline'
    });

  } catch (error) {
    console.error('Error assigning flight to trip:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
