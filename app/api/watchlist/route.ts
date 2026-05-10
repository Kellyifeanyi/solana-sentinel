import { generateWatchlist } from "@/lib/watchlist/generate";

export async function GET() {
  return Response.json(await generateWatchlist(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
