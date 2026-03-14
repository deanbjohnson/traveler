import type { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { getInternalUserId } from "./users";

export async function createBooking(data: {
  clerkUserId: string;
  tripId?: string;
  type: "FLIGHT" | "HOTEL" | "RENTAL_CAR" | "ACTIVITY" | "OTHER";
  flightNumber?: string;
  airline?: string;
  departure?: Date;
  arrival?: Date;
  departureAirport?: string;
  arrivalAirport?: string;
  hotelName?: string;
  checkIn?: Date;
  checkOut?: Date;
  roomType?: string;
  totalAmount?: number;
  currency?: string;
  externalId?: string;
  bookingData?: Prisma.InputJsonValue;
}) {
  const internalUserId = await getInternalUserId(data.clerkUserId);

  return await prisma.booking.create({
    data: {
      userId: internalUserId,
      tripId: data.tripId,
      type: data.type,
      flightNumber: data.flightNumber,
      airline: data.airline,
      departure: data.departure,
      arrival: data.arrival,
      departureAirport: data.departureAirport,
      arrivalAirport: data.arrivalAirport,
      hotelName: data.hotelName,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      roomType: data.roomType,
      totalAmount: data.totalAmount,
      currency: data.currency,
      externalId: data.externalId,
      bookingData: data.bookingData,
    },
  });
}

export async function getUserBookings(clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.booking.findMany({
    where: { userId: internalUserId },
    include: {
      trip: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getBookingById(bookingId: string, clerkUserId: string) {
  const internalUserId = await getInternalUserId(clerkUserId);

  return await prisma.booking.findUnique({
    where: {
      id: bookingId,
      userId: internalUserId,
    },
    include: {
      trip: true,
    },
  });
}

export async function updateBookingStatus(
  bookingId: string,
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
) {
  return await prisma.booking.update({
    where: { id: bookingId },
    data: { status },
  });
}
