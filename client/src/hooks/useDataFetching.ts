import { useState, useEffect, useCallback, useRef } from 'react';

// Simple query client for data fetching and caching
interface QueryOptions {
  staleTime?: number; // Time in ms before data is considered stale
  cacheTime?: number; // Time in ms to keep data in cache after unused
  retry?: number | boolean;
  refetchOnFocus?: boolean;
  refetchInterval?: number;
}

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed: number;
}

class SimpleQueryClient {
  private cache = new Map<string, CacheEntry<any>>();
  private ongoing = new Map<string, Promise<any>>();
  private cleanup: NodeJS.Timeout;

  constructor() {
    // Cleanup stale cache entries every 5 minutes
    this.cleanup = setInterval(() => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.lastAccessed > fiveMinutes) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
    return entry;
  }

  set<T>(key: string, data: T): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      lastAccessed: now
    });
  }

  invalidate(keyPattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }

  async fetchWithDeduplication<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // If there's an ongoing request for this key, return it
    if (this.ongoing.has(key)) {
      return this.ongoing.get(key)!;
    }

    // Start new request
    const promise = fetcher()
      .then(data => {
        this.set(key, data);
        return data;
      })
      .finally(() => {
        this.ongoing.delete(key);
      });

    this.ongoing.set(key, promise);
    return promise;
  }

  destroy(): void {
    clearInterval(this.cleanup);
    this.cache.clear();
    this.ongoing.clear();
  }
}

const queryClient = new SimpleQueryClient();

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: QueryOptions = {}
): QueryState<T> & { refetch: () => Promise<void>; invalidate: () => void } {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    retry = 3,
    refetchOnFocus = false,
    refetchInterval
  } = options;

  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
    lastFetched: null
  });

  const retryCount = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const executeQuery = useCallback(async (isRetry = false) => {
    try {
      if (!isRetry) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      const data = await queryClient.fetchWithDeduplication(key, fetcher);
      
      setState({
        data,
        loading: false,
        error: null,
        lastFetched: Date.now()
      });
      
      retryCount.current = 0;
    } catch (error: any) {
      const shouldRetry = typeof retry === 'number' ? retryCount.current < retry : retry;
      
      if (shouldRetry && !isRetry) {
        retryCount.current++;
        setTimeout(() => executeQuery(true), Math.pow(2, retryCount.current) * 1000);
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'An error occurred'
        }));
      }
    }
  }, [key, fetcher, retry]);

  const refetch = useCallback(async () => {
    queryClient.invalidate(key);
    await executeQuery();
  }, [key, executeQuery]);

  const invalidate = useCallback(() => {
    queryClient.invalidate(key);
  }, [key]);

  // Initial fetch and cache check
  useEffect(() => {
    const cached = queryClient.get<T>(key);
    const now = Date.now();
    
    // Use cached data if it's fresh
    if (cached && (now - cached.timestamp) < staleTime) {
      setState({
        data: cached.data,
        loading: false,
        error: null,
        lastFetched: cached.timestamp
      });
    } else {
      executeQuery();
    }
  }, [key, staleTime, executeQuery]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleFocus = () => {
      const now = Date.now();
      if (state.lastFetched && (now - state.lastFetched) > staleTime) {
        executeQuery();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnFocus, staleTime, state.lastFetched, executeQuery]);

  // Refetch on interval
  useEffect(() => {
    if (!refetchInterval) return;

    intervalRef.current = setInterval(() => {
      executeQuery();
    }, refetchInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refetchInterval, executeQuery]);

  return {
    ...state,
    refetch,
    invalidate
  };
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    invalidateKeys?: string[];
  } = {}
) {
  const [state, setState] = useState<{
    data: TData | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: false,
    error: null
  });

  const mutate = useCallback(async (variables: TVariables) => {
    try {
      setState({ data: null, loading: true, error: null });
      
      const data = await mutationFn(variables);
      
      setState({ data, loading: false, error: null });
      
      // Invalidate related queries
      if (options.invalidateKeys) {
        options.invalidateKeys.forEach(key => queryClient.invalidate(key));
      }
      
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
      
      return data;
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred';
      setState({ data: null, loading: false, error: errorMessage });
      
      if (options.onError) {
        options.onError(error, variables);
      }
      
      throw error;
    }
  }, [mutationFn, options]);

  return {
    ...state,
    mutate
  };
}

// Export query client for manual cache operations
export { queryClient };