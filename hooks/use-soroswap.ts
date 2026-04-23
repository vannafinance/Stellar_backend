'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SoroswapService,
  SoroswapPoolStats,
  SoroswapLpEvent,
  SOROSWAP_POOLS,
  SoroswapPoolConfig,
} from '@/lib/soroswap-utils';
import { useBlendStore } from '@/store/blend-store';

// ---------- All Soroswap pools stats ----------

export interface SoroswapPoolWithStats {
  pool: SoroswapPoolConfig;
  stats: SoroswapPoolStats | null;
  isLoading: boolean;
}

export const useAllSoroswapPoolStats = (): SoroswapPoolWithStats[] => {
  const [allStats, setAllStats] = useState<Record<string, SoroswapPoolStats | null>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init: Record<string, boolean> = {};
    SOROSWAP_POOLS.forEach((p) => { init[p.id] = true; });
    setLoadingKeys(init);

    Promise.allSettled(
      SOROSWAP_POOLS.map((p) =>
        SoroswapService.getPoolStats().then((s) => ({ id: p.id, stats: s }))
      )
    ).then((results) => {
      const statsMap: Record<string, SoroswapPoolStats | null> = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') statsMap[r.value.id] = r.value.stats;
      });
      setAllStats(statsMap);
      setLoadingKeys({});
    });

    const interval = setInterval(() => {
      SOROSWAP_POOLS.forEach((p) => {
        SoroswapService.getPoolStats().then((s) => {
          setAllStats((prev) => ({ ...prev, [p.id]: s }));
        }).catch(() => {});
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return SOROSWAP_POOLS.map((p) => ({
    pool: p,
    stats: allStats[p.id] ?? null,
    isLoading: loadingKeys[p.id] ?? false,
  }));
};

// ---------- Soroswap pool stats (single pool) ----------

export const useSoroswapPoolStats = () => {
  const [stats, setStats] = useState<SoroswapPoolStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    SoroswapService.getPoolStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { stats, isLoading, refresh: fetch };
};

// ---------- Soroswap LP position ----------

export const useSoroswapLpPosition = (marginAccountAddress: string | null) => {
  const refreshKey = useBlendStore((s) => s.refreshKey);
  const [lpBalance, setLpBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!marginAccountAddress) {
      setLpBalance('0');
      return;
    }
    setIsLoading(true);
    SoroswapService.getLpBalance(marginAccountAddress)
      .then(setLpBalance)
      .catch(() => setLpBalance('0'))
      .finally(() => setIsLoading(false));
  }, [marginAccountAddress, refreshKey]);

  return { lpBalance, isLoading };
};

// ---------- Soroswap LP events (position history + chart) ----------

export const useSoroswapEvents = (pairAddress?: string | null) => {
  const refreshKey = useBlendStore((s) => s.refreshKey);
  const [events, setEvents] = useState<SoroswapLpEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    SoroswapService.getSoroswapLpEvents(pairAddress ?? undefined)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setIsLoading(false));
  }, [pairAddress, refreshKey]);

  return { events, isLoading };
};

// ---------- Soroswap token balance in margin account ----------

export const useSoroswapTokenBalance = (
  marginAccountAddress: string | null,
  tokenSymbol: 'XLM' | 'USDC' | null
) => {
  const refreshKey = useBlendStore((s) => s.refreshKey);
  const [balance, setBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!marginAccountAddress || !tokenSymbol) {
      setBalance('0');
      return;
    }
    setIsLoading(true);
    SoroswapService.getMarginAccountTokenBalance(marginAccountAddress, tokenSymbol)
      .then(setBalance)
      .catch(() => setBalance('0'))
      .finally(() => setIsLoading(false));
  }, [marginAccountAddress, tokenSymbol, refreshKey]);

  return { balance, isLoading };
};
