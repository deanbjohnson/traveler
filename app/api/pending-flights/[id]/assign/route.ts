import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const resolvedParams = await params;

    // Find user by Clerk ID
    let user = await prisma.user.findFirst({
      where: { clerkUserId: userId }
    });

    if (!user) {
      // If no user found by Clerk ID, try to find by email from Clerk user
      const { currentUser } = await import('@clerk/nextjs/server');
      const clerkUser = await currentUser();
      if (clerkUser?.primaryEmailAddress?.emailAddress) {
        user = await prisma.user.findFirst({
          where: { email: clerkUser.primaryEmailAddress.emailAddress }
        });
        
        // If we found a user by email but they don't have a clerkUserId, link them
        if (user && !user.clerkUserId) {
          console.log('🔗 Linking email user to Clerk user:', user.email, '->', userId);
          user = await prisma.user.update({
            where: { id: user.id },
            data: { clerkUserId: userId }
          });
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the pending flight
    const pendingFlight = await prisma.pendingFlight.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: user.id
      }
    });

    if (!pendingFlight) {
      return NextResponse.json({ error: 'Pending flight not found' }, { status: 404 });
    }

    // Verify the trip belongs to the user
    const trip = await prisma.trip.findFirst({
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
      timeline = await prisma.timeline.create({
        data: {
          tripId: trip.id,
          title: `${trip.title} Timeline`,
          description: `Timeline for ${trip.title}`
        }
      });
    }

    // Parse flight data
    const flightData = pendingFlight.parsedData as any;
    
    console.log('🔄 Creating timeline item with flight data:', flightData);
    
    // Parse dates properly
    let startTime = new Date();
    let endTime: Date | undefined = undefined;
    
    if (flightData.departureDate) {
      try {
        // Handle different date formats
        let departureDate = flightData.departureDate;
        if (typeof departureDate === 'string') {
          // If it's just a date, add a default time
          if (departureDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            departureDate = `${departureDate}T10:00:00`;
          }
        }
        startTime = new Date(departureDate);
      } catch (error) {
        console.error('Error parsing departure date:', error);
        startTime = new Date();
      }
    }
    
    if (flightData.arrivalDate) {
      try {
        let arrivalDate = flightData.arrivalDate;
        if (typeof arrivalDate === 'string') {
          if (arrivalDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            arrivalDate = `${arrivalDate}T14:00:00`;
          }
        }
        endTime = new Date(arrivalDate);
      } catch (error) {
        console.error('Error parsing arrival date:', error);
      }
    }
    
    // Calculate duration if we have both times
    let duration: number | undefined = undefined;
    if (startTime && endTime) {
      duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    }
    
    // Get the next order number for this timeline
    const lastItem = await prisma.timelineItem.findFirst({
      where: { timelineId: timeline.id },
      orderBy: { order: 'desc' }
    });
    const nextOrder = (lastItem?.order || 0) + 1;
    
    // Create timeline item for the flight
    const timelineItem = await prisma.timelineItem.create({
      data: {
        timelineId: timeline.id,
        title: `${flightData.airline || 'Flight'} ${flightData.flightNumber || ''}`.trim(),
        description: `Flight from ${flightData.origin || 'Unknown'} to ${flightData.destination || 'Unknown'}`,
        type: 'FLIGHT',
        status: 'BOOKED',
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        order: nextOrder,
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
    
    console.log('✅ Timeline item created:', timelineItem.id);

    // Update pending flight status
    await prisma.pendingFlight.update({
      where: { id: resolvedParams.id },
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
