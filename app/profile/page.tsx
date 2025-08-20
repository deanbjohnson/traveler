import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import { BookingInfoForm } from "@/components/ui/booking-info-form";

export default async function ProfilePage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Profile Settings</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Clerk Profile Section */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Account Information</h2>
              <div className="bg-white rounded-lg">
                <UserProfile />
              </div>
            </div>

            {/* Booking Information Section */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Booking Information</h2>
              <p className="text-gray-400 mb-6">
                Save your passenger and payment details to expedite future bookings.
              </p>
              <BookingInfoForm userId={userId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 