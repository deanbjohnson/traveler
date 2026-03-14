/**
 * Database layer: Prisma client and helpers for users, trips, timeline, bookings, and search.
 * All functions that need a user use Clerk ID; internal DB user ID is resolved automatically.
 */
export { prisma } from "./client";
export {
  ensureUserExists,
  getUser,
  getUserByClerkId,
  createUser,
  upsertUser,
  upsertUserByClerkId,
  updateUserPreferences,
} from "./users";
export {
  createTrip,
  getUserTrips,
  getTripById,
  getUpcomingTrips,
  updateTripStatus,
  deleteTrip,
} from "./trips";
export {
  createBooking,
  getUserBookings,
  getBookingById,
  updateBookingStatus,
} from "./bookings";
export {
  createTimeline,
  getTimelineByTripId,
  createTimelineItem,
  updateTimelineItem,
  deleteTimelineItem,
  createTimelineAlternative,
  createTimelineLocation,
  updateTimelineMood,
  reorderTimelineItems,
  bulkCreateTimelineItems,
} from "./timeline";
export { logSearchQuery, getRecentSearches } from "./search";
