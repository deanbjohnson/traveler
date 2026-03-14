"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { renameTrip } from "@/app/actions/rename-trip";
import { Pencil } from "lucide-react";

export function RenameTripButton({ tripId, currentTitle, onOptimisticTitle }: { tripId: string, currentTitle: string, onOptimisticTitle?: (newTitle: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(currentTitle);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    if (newTitle !== currentTitle && newTitle.trim() !== "") {
      if (onOptimisticTitle) onOptimisticTitle(newTitle.trim());
      startTransition(async () => {
        await renameTrip(tripId, newTitle.trim());
        router.refresh();
      });
    }
    setIsEditing(false);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={newTitle}
        onChange={e => setNewTitle(e.target.value)}
        onBlur={handleRename}
        onKeyDown={e => {
          if (e.key === "Enter") handleRename();
          if (e.key === "Escape") {
            setIsEditing(false);
            setNewTitle(currentTitle);
          }
        }}
        className="text-sm bg-transparent border border-gray-600 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 min-w-0"
        disabled={isPending}
        style={{ minWidth: "80px", maxWidth: "120px" }}
      />
    );
  }

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className="p-1 bg-transparent rounded hover:bg-gray-200 transition-colors focus:outline-none"
      title="Rename trip"
      aria-label="Rename trip"
    >
      <Pencil className="h-4 w-4 text-gray-400 hover:text-blue-500 focus:text-blue-500 transition-colors" />
      <span className="sr-only">Rename</span>
    </button>
  );
}
