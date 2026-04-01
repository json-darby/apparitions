import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePollingEffectOptions {
    apiEndpoint: string;
    pollingIntervalMs: number;
    queryParams?: Record<string, string>;
    enabled?: boolean;
}

interface UsePollingEffectResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * A custom React hook designed to continuously poll a specified API endpoint.
 *
 * @param apiEndpoint The full or relative path to the API.
 * @param pollingIntervalMs The interval between requests in milliseconds.
 * @param queryParams Optional dictionary of parameters to append to the URL.
 * @param enabled Whether the polling is currently active.
 */
export function usePollingEffect<T>({
    apiEndpoint,
    pollingIntervalMs,
    queryParams = {},
    enabled = true,
}: UsePollingEffectOptions): UsePollingEffectResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    // Track mounted state to prevent state updates on unmounted components
    const isMounted = useRef(false);

    const fetchUrl = useCallback(() => {
        const url = new URL(apiEndpoint, window.location.origin);
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value) url.searchParams.append(key, value);
        });
        return url.toString();
    }, [apiEndpoint, JSON.stringify(queryParams)]);

    const fetchData = useCallback(async () => {
        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(fetchUrl());
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();

            if (isMounted.current) {
                setData(result);
            }
        } catch (err) {
            console.error(`[usePollingEffect] Error fetching ${apiEndpoint}:`, err);
            if (isMounted.current) {
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [fetchUrl, enabled, apiEndpoint]);

    /*
     * Reset data when query params change (for example, selecting a new city) 
     * ensuring that stale data is cleared immediately.
     */
    const prevFetchUrlRef = useRef(fetchUrl());
    useEffect(() => {
        const currentUrl = fetchUrl();
        if (currentUrl !== prevFetchUrlRef.current) {
            prevFetchUrlRef.current = currentUrl;
            setData(null);
            setError(null);
        }
    }, [fetchUrl]);

    useEffect(() => {
        isMounted.current = true;

        if (enabled) {
            // Fetch immediately on mount or when dependencies change
            fetchData();

            // Setup the polling interval
            const intervalId = setInterval(fetchData, pollingIntervalMs);

            return () => {
                clearInterval(intervalId);
                isMounted.current = false;
            };
        }

        return () => {
            isMounted.current = false;
        };
    }, [fetchData, pollingIntervalMs, enabled]);

    return { data, loading, error, refetch: fetchData };
}
