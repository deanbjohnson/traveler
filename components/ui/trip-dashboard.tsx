"use client";
import { useState, useEffect } from "react";
import { RenameTripButton } from "@/components/ui/rename-trip-button";
import { DeleteTripButton } from "@/components/ui/delete-trip-button";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import Link from "next/link";

function formatDate(date: string) {
  return format(new Date(date), "MMM d");
}

function formatDateRange(startDate: string, endDate: string) {
  const start = format(new Date(startDate), "MMM d");
  const end = format(new Date(endDate), "MMM d");
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();
  
  if (startYear === endYear) {
    return `${start} - ${end}, ${startYear}`;
  } else {
    return `${start}, ${startYear} - ${end}, ${endYear}`;
  }
}

function formatBookingCount(count: number) {
  return `${count} booking${count === 1 ? '' : 's'}`;
}

function getTripTitle(trip: Trip, customTitle?: string) {
  if (customTitle && customTitle.trim() !== "") return customTitle;
  if (trip.destination && trip.destination.trim() !== "") {
    return `Trip to ${trip.destination}`;
  }
  return "My New Trip";
}

type Trip = {
  id: string;
  title: string;
  status: string;
  destination?: string;
  description?: string;
  startDate: string;
  endDate: string;
  bookings?: { id: string }[];
};

export function TripDashboard({ trips }: { trips: Trip[] }) {
  const [titles, setTitles] = useState(() =>
    Object.fromEntries(trips.map((trip: Trip) => [trip.id, trip.title]))
  );
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

  // Sync titles state with trips prop after refresh
  useEffect(() => {
    setTitles(Object.fromEntries(trips.map((trip: Trip) => [trip.id, trip.title])));
  }, [trips]);

  const handleTitleChange = (tripId: string, newTitle: string) => {
    setTitles(prev => ({ ...prev, [tripId]: newTitle }));
  };

  const handleStartEdit = (tripId: string) => {
    setEditingTripId(tripId);
  };

  const handleFinishEdit = async (tripId: string, newTitle: string) => {
    if (newTitle !== titles[tripId]) {
      handleTitleChange(tripId, newTitle.trim());
      // Call the rename function
      const { renameTrip } = await import("@/app/actions/rename-trip");
      await renameTrip(tripId, newTitle.trim());
      // Refresh the page to get updated data
      window.location.reload();
    }
    setEditingTripId(null);
  };

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mt-8">
      {trips.map((trip: Trip) => (
        <div
          key={trip.id}
          className="group rounded-2xl border border-gray-800 bg-gradient-to-br from-[#23243a] to-[#18192b] text-card-foreground shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 relative max-w-sm"
        >
          {/* Delete button at top right */}
          <div className="absolute top-2 right-3 z-10">
            <DeleteTripButton tripId={trip.id} />
          </div>

          {/* Edit button at top left */}
          <div className="absolute top-2 left-3 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartEdit(trip.id);
              }}
              className="p-1 bg-transparent rounded hover:bg-gray-200 transition-colors focus:outline-none"
              title="Rename trip"
              aria-label="Rename trip"
            >
              <svg className="h-4 w-4 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>

          {/* Conditionally wrap in Link only when not editing */}
          {editingTripId === trip.id ? (
            <div className="p-8 pt-8">
              {/* Title area - editable */}
              <div className="mb-3">
                <input
                  value={titles[trip.id] ?? ""}
                  onChange={(e) => handleTitleChange(trip.id, e.target.value)}
                  onBlur={(e) => handleFinishEdit(trip.id, (e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleFinishEdit(trip.id, (e.target as HTMLInputElement).value);
                    }
                    if (e.key === "Escape") {
                      setEditingTripId(null);
                      setTitles(prev => ({ ...prev, [trip.id]: trip.title }));
                    }
                  }}
                  className="text-lg font-semibold transition-colors group-hover:text-primary bg-transparent border-none focus:ring-0 focus:outline-none w-full line-clamp-2 leading-tight"
                  autoFocus
                />
              </div>

              {/* Status badge */}
              <div className="mb-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  {trip.status.toLowerCase()}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 mb-6">
                {trip.description || "Plan your perfect adventure"}
              </p>

              {/* Divider */}
              <div className="border-t border-gray-700 mb-6"></div>

              {/* Dates and bookings */}
              <div className="flex items-start justify-between text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">{formatBookingCount(trip.bookings?.length || 0)}</span>
                </div>
              </div>
            </div>
          ) : (
          <Link href={`/discover/${trip.id}`} className="block">
            <div className="p-8 pt-8">
              {/* Title area - display only */}
              <div className="mb-3">
                <div className="text-lg font-semibold transition-colors group-hover:text-primary line-clamp-2 leading-tight">
                  {getTripTitle(trip, titles[trip.id])}
                </div>
              </div>

              {/* Status badge */}
              <div className="mb-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                  {trip.status.toLowerCase()}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-400 mb-6">
                {trip.description || "Plan your perfect adventure"}
              </p>

              {/* Divider */}
              <div className="border-t border-gray-700 mb-6"></div>

              {/* Dates and bookings */}
              <div className="flex items-start justify-between text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">{formatBookingCount(trip.bookings?.length || 0)}</span>
                </div>
              </div>
            </div>
          </Link>
          )}
        </div>
      ))}
    </div>
  );
}
