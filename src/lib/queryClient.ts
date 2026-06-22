import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 5 minutes — no refetch on remount / focus within window.
      staleTime: 5 * 60 * 1000,
      // Keep cached data for 30 days so the app works offline across sessions.
      gcTime: 30 * 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      // Resolve immediately from cache when offline instead of suspending forever.
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

// Persist the React Query cache to localStorage so returning users see
// cached data instantly while a background revalidation runs.
// Bumping BUSTER invalidates any previously persisted cache shape.
const BUSTER = "v2";

if (typeof window !== "undefined") {
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "mr_rq_cache",
      throttleTime: 1000,
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days — keep data available offline
      buster: BUSTER,
      dehydrateOptions: {
        // Only persist successful queries scoped to our app's data fetches.
        shouldDehydrateQuery: (q) =>
          q.state.status === "success" &&
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "merarashan",
      },
    });
  } catch {
    // Private browsing or storage quota — fall through to in-memory only.
  }
}
