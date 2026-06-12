import { useQuery } from "@tanstack/react-query";

export interface Ga4Totals {
  views: number;
  users: number;
  sessions: number;
  avgSessionDuration: number; // seconds
}

export interface Ga4Report {
  configured: boolean;
  days?: number;
  totals?: Ga4Totals;
  byDay?: { date: string; views: number }[];
  error?: string;
}

/**
 * Fetches real Google Analytics 4 metrics from the Netlify function
 * (`/.netlify/functions/ga4-report`). Returns `{ configured: false }` when GA4
 * isn't set up yet (no env vars), so the UI can show a "connect GA" notice
 * instead of inventing numbers. In local `vite dev` the function isn't served,
 * so the fetch fails and we surface it as "not configured".
 */
export function useGa4(days: number) {
  return useQuery<Ga4Report>({
    queryKey: ["ga4-report", days],
    queryFn: async () => {
      const res = await fetch(`/.netlify/functions/ga4-report?days=${days}`);
      if (!res.ok && res.status !== 502) {
        // 404 in local dev, etc. — treat as not configured rather than erroring.
        return { configured: false };
      }
      return res.json();
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}
