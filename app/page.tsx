import Link from "next/link"
import { Button } from "@/components/ui/button"
import { auth } from "@clerk/nextjs/server"
import { getUserTrips, ensureUserExists } from "@/lib/db"
import { SignInButton } from "@clerk/nextjs"
import { format } from "date-fns"
import { CreateTripButton } from "@/components/create-trip-button"

export default async function Home() {
  const { userId } = await auth()

  // If not authenticated, show welcome message
  if (!userId) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="container">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Welcome to Travelers
          </h1>
          <p className="mt-4 text-muted-foreground">
            Your AI-powered travel companion. Discover new places
            and plan your next adventure.
          </p>
          <div className="mt-8">
            <SignInButton mode="modal">
              <Button size="lg">Get Started</Button>
            </SignInButton>
          </div>
        </div>
      </main>
    )
  }

  // Ensure user exists in database and get their trips
  await ensureUserExists(userId)
  const trips = await getUserTrips(userId)

  // If no trips, show empty state
  if (trips.length === 0) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="container max-w-2xl mt-8">
          <div className="bg-muted/50 rounded-lg p-8 border border-dashed border-muted-foreground/25">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">No trips yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first trip and let our AI assistant help you plan the perfect itinerary
            </p>
            <CreateTripButton size="lg">
              Create Your First Trip
            </CreateTripButton>
          </div>
        </div>
      </main>
    )
  }

  // Show list of trips
  return (
    <main className="flex-1 py-8">
      <div className="container max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Trips</h1>
            <p className="text-muted-foreground">
              Manage your travel plans and discover new destinations
            </p>
          </div>
          <CreateTripButton>
            Create New Trip
          </CreateTripButton>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/discover/${trip.id}`}>
              <div className="group cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {trip.title}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-md ${trip.status === 'PLANNED' ? 'bg-blue-100 text-blue-800' :
                        trip.status === 'BOOKED' ? 'bg-green-100 text-green-800' :
                          trip.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                            trip.status === 'COMPLETED' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                      }`}>
                      {trip.status.toLowerCase()}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">
                    {trip.destination}
                  </p>

                  {trip.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {trip.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {format(new Date(trip.startDate), 'MMM d')} - {format(new Date(trip.endDate), 'MMM d, yyyy')}
                    </span>
                    <span className="text-xs">
                      {trip.bookings.length} booking{trip.bookings.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
