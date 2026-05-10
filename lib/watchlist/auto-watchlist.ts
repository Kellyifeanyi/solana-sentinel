import { parseAddressList } from "@/lib/watchlist/filters";

export function configuredWatchlistAddresses() {
  return parseAddressList(process.env.SENTINEL_WATCHLIST);
}
