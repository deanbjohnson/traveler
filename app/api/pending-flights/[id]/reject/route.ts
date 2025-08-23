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

    // Update pending flight status to rejected
    await db.pendingFlight.update({
      where: { id: params.id },
      data: { status: 'REJECTED' }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Flight rejected successfully'
    });

  } catch (error) {
    console.error('Error rejecting flight:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
