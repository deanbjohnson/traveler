"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrip } from "@/app/server/actions/delete-trip";
import { Trash2 } from "lucide-react";

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={e => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this trip?")) {
          startTransition(async () => {
            await deleteTrip(tripId);
            router.refresh();
          });
        }
      }}
      disabled={isPending}
      className="absolute top-1 right-1 p-1 mr-2 bg-transparent rounded hover:bg-gray-200 transition-colors focus:outline-none"
      title="Delete trip"
      aria-label="Delete trip"
      style={{ zIndex: 10 }}
    >
      <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500 focus:text-red-500 transition-colors" />
      <span className="sr-only">Delete</span>
    </button>
  );
}
