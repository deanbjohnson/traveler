import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Get trips for the user
    const trips = await prisma.trip.findMany({
      where: { userId: user.id },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        title: true,
        destination: true,
        startDate: true,
        endDate: true,
        status: true
      }
    });

    return NextResponse.json({ 
      trips: trips.map(trip => ({
        id: trip.id,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
        status: trip.status
      }))
    });

  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
