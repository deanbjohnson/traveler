"use server";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function renameTrip(tripId: string, newTitle: string) {
  await prisma.trip.update({
    where: { id: tripId },
    data: { title: newTitle },
  });
  revalidatePath("/"); // or the relevant path
  return { success: true };
}
