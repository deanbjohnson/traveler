import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./client";

export async function getInternalUserId(clerkUserId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found for Clerk ID: ${clerkUserId}`);
  }

  return user.id;
}

export async function ensureUserExists(clerkUserId: string) {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existingUser) {
      return existingUser;
    }

    const clerkUser = await currentUser();

    if (!clerkUser) {
      throw new Error(`No Clerk user found for ID: ${clerkUserId}`);
    }

    return await upsertUserByClerkId(
      clerkUserId,
      clerkUser.primaryEmailAddress?.emailAddress || "",
      clerkUser.fullName || undefined
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message?.toLowerCase().includes("exceeded the compute time quota") ||
      message?.toLowerCase().includes("prisma") ||
      message?.toLowerCase().includes("database")
    ) {
      console.warn("DB degraded mode: skipping ensureUserExists due to error:", message);
      return null as unknown as ReturnType<typeof ensureUserExists>;
    }
    console.error("Error ensuring user exists:", error);
    return null as unknown as ReturnType<typeof ensureUserExists>;
  }
}

export async function getUser(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      preferences: true,
      trips: {
        include: {
          bookings: true,
        },
      },
    },
  });
}

export async function getUserByClerkId(clerkUserId: string) {
  return await prisma.user.findUnique({
    where: { clerkUserId },
    include: {
      preferences: true,
      trips: {
        include: {
          bookings: true,
        },
      },
    },
  });
}

export async function createUser(email: string, name?: string) {
  return await prisma.user.create({
    data: {
      email,
      name,
    },
  });
}

export async function upsertUser(email: string, name?: string) {
  return await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
  });
}

export async function upsertUserByClerkId(
  clerkUserId: string,
  email: string,
  name?: string
) {
  return await prisma.user.upsert({
    where: { clerkUserId },
    update: { email, name },
    create: { clerkUserId, email, name },
  });
}

export async function updateUserPreferences(
  clerkUserId: string,
  preferences: {
    preferredAirline?: string;
    seatPreference?: string;
    mealPreference?: string;
    budgetRange?: string;
  }
) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.userPreferences.upsert({
    where: { userId: internalUserId },
    update: preferences,
    create: {
      userId: internalUserId,
      ...preferences,
    },
  });
}
