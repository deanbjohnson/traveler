import { prisma } from "./client";
import { getInternalUserId } from "./users";

export async function logSearchQuery(
  query: string,
  type: "FLIGHT" | "HOTEL" | "DESTINATION" | "ACTIVITY",
  results?: Record<string, unknown>,
  clerkUserId?: string
) {
  let internalUserId: string | undefined;

  if (clerkUserId) {
    try {
      internalUserId = await getInternalUserId(clerkUserId);
    } catch {
      console.warn(`User not found for search query logging: ${clerkUserId}`);
    }
  }

  return await prisma.searchQuery.create({
    data: {
      userId: internalUserId,
      query,
      type,
      results: results ? JSON.stringify(results) : undefined,
    },
  });
}

export async function getRecentSearches(clerkUserId?: string, limit = 10) {
  let internalUserId: string | undefined;

  if (clerkUserId) {
    try {
      internalUserId = await getInternalUserId(clerkUserId);
    } catch {
      return [];
    }
  }

  return await prisma.searchQuery.findMany({
    where: internalUserId ? { userId: internalUserId } : {},
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}
