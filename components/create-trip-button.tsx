"use client";

import { Button } from "@/components/ui/button";
import { createNewTrip } from "@/app/actions/create-trip";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface CreateTripButtonProps {
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg";
    children: React.ReactNode;
    className?: string;
}

export function CreateTripButton({
    variant = "default",
    size = "default",
    children,
    className
}: CreateTripButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleCreateTrip = async () => {
        try {
            setIsLoading(true);
            const result = await createNewTrip();
            
            if (result?.success && result.tripId) {
                // Navigate to the new trip page
                router.push(`/discover/${result.tripId}`);
            }
        } catch (error) {
            console.error("Error creating trip:", error);
            // You might want to show a toast notification here
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button
            onClick={handleCreateTrip}
            variant={variant}
            size={size}
            className={className}
            disabled={isLoading}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </Button>
    );
} 