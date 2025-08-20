import { getProgress } from "@/lib/progress";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");
  if (!tripId) {
    return new Response(JSON.stringify({ error: "tripId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const progress = getProgress(tripId);
  return new Response(JSON.stringify({ progress }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}


