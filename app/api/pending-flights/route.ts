import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Looking for user with Clerk ID:', userId);

    // First try to find user by Clerk ID
    let user = await prisma.user.findFirst({
      where: { clerkUserId: userId }
    });

    if (user) {
      console.log('✅ Found user by Clerk ID:', user.email);
    } else {
      console.log('❌ No user found by Clerk ID, trying email...');
      // If no user found by Clerk ID, try to find by email from Clerk user
      const clerkUser = await currentUser();
      if (clerkUser?.primaryEmailAddress?.emailAddress) {
        console.log('🔍 Looking for user with email:', clerkUser.primaryEmailAddress.emailAddress);
        user = await prisma.user.findFirst({
          where: { email: clerkUser.primaryEmailAddress.emailAddress }
        });
        
        if (user) {
          console.log('✅ Found user by email:', user.email, 'clerkUserId:', user.clerkUserId);
          // If we found a user by email but they don't have a clerkUserId, link them
          if (!user.clerkUserId) {
            console.log('🔗 Linking email user to Clerk user:', user.email, '->', userId);
            user = await prisma.user.update({
              where: { id: user.id },
              data: { clerkUserId: userId }
            });
            console.log('✅ User linked successfully');
          }
        } else {
          console.log('❌ No user found by email either');
        }
      } else {
        console.log('❌ No email found in Clerk user');
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('🔍 Looking for pending flights for user ID:', user.id);
    
    // Get pending flights for the user
    const pendingFlights = await prisma.pendingFlight.findMany({
      where: { 
        userId: user.id,
        status: { in: ['PENDING_REVIEW', 'APPROVED'] }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTrip: {
          select: {
            id: true,
            title: true,
            destination: true
          }
        }
      }
    });

    console.log('📧 Found', pendingFlights.length, 'pending flights');

    return NextResponse.json({ 
      pendingFlights: pendingFlights.map((flight: any) => ({
        id: flight.id,
        emailSubject: flight.emailSubject,
        emailFrom: flight.emailFrom,
        emailDate: flight.emailDate.toISOString(),
        parsedData: flight.parsedData,
        status: flight.status,
        assignedTripId: flight.assignedTripId,
        assignedTrip: flight.assignedTrip
      }))
    });

  } catch (error) {
    console.error('Error fetching pending flights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
