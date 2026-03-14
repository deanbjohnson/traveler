"use server";
import { prisma } from "@/lib/db"; // or wherever your Prisma client is
import { revalidatePath } from "next/cache";

export async function deleteTrip(tripId: string) {
  await prisma.trip.delete({ where: { id: tripId } });
  // Optionally, revalidate the trips page
  revalidatePath("/"); // or the relevant path
  return { success: true };
}
