'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BlendService,
  BlendReserveData,
  BlendUserPosition,
  BlendEvent,
} from '@/lib/blend-utils';
import {
  AquariusService,
  AquariusPoolStats,
  AquariusLpEvent,
  AQUARIUS_POOLS,
  AquariusPoolConfig,
} from '@/lib/aquarius-utils';
import { useMarginAccountInfoStore } from '@/store/margin-account-info-store';
import { useBlendStore } from '@/store/blend-store';

// ---------- Pool stats ----------

export interface FarmPoolStats {
  XLM: BlendReserveData | null;
  USDC: BlendReserveData | null;
}

const EMPTY_STATS: FarmPoolStats = { XLM: null, USDC: null };

export const useBlendPoolStats = () => {
  const [stats, setStats] = useState<FarmPoolStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await BlendService.getAllBlendReserveStats();
      setStats({
        XLM: data.XLM,
        USDC: data.USDC,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch pool stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetch]);

  return { stats, isLoading, error, refresh: fetch };
};

// ---------- User Blend positions ----------

export interface UserBlendPositions {
  XLM: BlendUserPosition;
  USDC: BlendUserPosition;
  totalValueXLM: string; // sum of underlying values (in XLM units for display)
}

const EMPTY_POSITION: BlendUserPosition = { bTokenBalance: '0', underlyingValue: '0', tokenSymbol: '' };
const EMPTY_USER: UserBlendPositions = {
  XLM: EMPTY_POSITION,
  USDC: EMPTY_POSITION,
  totalValueXLM: '0',
};

export const useUserBlendPositions = () => {
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);
  const refreshKey = useBlendStore((s) => s.refreshKey);
  const [positions, setPositions] = useState<UserBlendPositions>(EMPTY_USER);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!marginAccountAddress) {
      setPositions(EMPTY_USER);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await BlendService.getAllUserBlendPositions(marginAccountAddress);
      const xlmVal = parseFloat(data.XLM?.underlyingValue ?? '0');
      const usdcVal = parseFloat(data.USDC?.underlyingValue ?? '0');
      setPositions({
        XLM: data.XLM ?? { ...EMPTY_POSITION, tokenSymbol: 'XLM' },
        USDC: data.USDC ?? { ...EMPTY_POSITION, tokenSymbol: 'USDC' },
        totalValueXLM: (xlmVal + usdcVal).toFixed(4),
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch positions');
    } finally {
      setIsLoading(false);
    }
  }, [marginAccountAddress]);

  // Re-fetch whenever marginAccountAddress changes OR a transaction triggers a refresh
  useEffect(() => {
    fetch();
  }, [fetch, refreshKey]);

  return { positions, isLoading, error, refresh: fetch };
};

// ---------- Blend events / position history ----------

export const useBlendEvents = (tokenSymbol?: string) => {
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);
  const refreshKey = useBlendStore((s) => s.refreshKey);
  const [events, setEvents] = useState<BlendEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!marginAccountAddress) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const all = await BlendService.getBlendEvents(marginAccountAddress);
      const filtered = tokenSymbol
        ? all.filter((e) => e.tokenSymbol === tokenSymbol)
        : all;
      setEvents(filtered);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [marginAccountAddress, tokenSymbol]);

  // Re-fetch whenever marginAccountAddress/token changes OR a transaction triggers a refresh
  useEffect(() => {
    fetch();
  }, [fetch, refreshKey]);

  return { events, isLoading, error, refresh: fetch };
};

// ---------- All Aquarius pools stats ----------

export interface AquariusPoolWithStats {
  pool: AquariusPoolConfig;
  stats: AquariusPoolStats | null;
  isLoading: boolean;
}

export const useAllAquariusPoolStats = (): AquariusPoolWithStats[] => {
  const [allStats, setAllStats] = useState<Record<string, AquariusPoolStats | null>>({});
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init: Record<string, boolean> = {};
    AQUARIUS_POOLS.forEach((p) => { init[p.id] = true; });
    setLoadingKeys(init);

    Promise.allSettled(
      AQUARIUS_POOLS.map((p) =>
        AquariusService.getAquariusPoolStats(p.poolAddress).then((s) => ({ id: p.id, stats: s }))
      )
    ).then((results) => {
      const statsMap: Record<string, AquariusPoolStats | null> = {};
      results.forEach((r) => {
        if (r.status === 'fulfilled') statsMap[r.value.id] = r.value.stats;
      });
      setAllStats(statsMap);
      setLoadingKeys({});
    });

    const interval = setInterval(() => {
      AQUARIUS_POOLS.forEach((p) => {
        AquariusService.getAquariusPoolStats(p.poolAddress).then((s) => {
          setAllStats((prev) => ({ ...prev, [p.id]: s }));
        }).catch(() => {});
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return AQUARIUS_POOLS.map((p) => ({
    pool: p,
    stats: allStats[p.id] ?? null,
    isLoading: loadingKeys[p.id] ?? false,
  }));
};

// ---------- Aquarius pool stats (single) ----------

export const useAquariusPoolStats = (poolAddress: string | null) => {
  const [stats, setStats] = useState<AquariusPoolStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!poolAddress) return;
    setIsLoading(true);
    AquariusService.getAquariusPoolStats(poolAddress)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setIsLoading(false));
    const interval = setInterval(() => {
      AquariusService.getAquariusPoolStats(poolAddress).then(setStats).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [poolAddress]);

  return { stats, isLoading };
};

// ---------- Aquarius LP position ----------

export const useAquariusLpPosition = (
  marginAccountAddress: string | null,
  poolAddress: string | null
) => {
  const refreshKey = useBlendStore((s) => s.refreshKey);
  const [lpBalance, setLpBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!marginAccountAddress || !poolAddress) {
      setLpBalance('0');
      return;
    }
    setIsLoading(true);
    AquariusService.getUserLpBalance(marginAccountAddress, poolAddress)
      .then(setLpBalance)
      .catch(() => setLpBalance('0'))
      .finally(() => setIsLoading(false));
  }, [marginAccountAddress, poolAddress, refreshKey]);

  return { lpBalance, isLoading };
};

// ---------- Aquarius LP events ----------

export const useAquariusEvents = (poolAddress: string | null) => {
  const refreshKey = useBlendStore((s) => s.refreshKey);
  const [events, setEvents] = useState<AquariusLpEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!poolAddress) {
      setEvents([]);
      return;
    }
    setIsLoading(true);
    AquariusService.getAquariusEvents(poolAddress)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setIsLoading(false));
  }, [poolAddress, refreshKey]);

  return { events, isLoading };
};

// ---------- Aquarius LP chart helper ----------
// Builds cumulative LP balance chart from deposit/withdraw events.
export const buildLpChartData = (
  events: AquariusLpEvent[],
  currentLpBalance: number
): Array<{ date: string; amount: number }> => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (events.length === 0) {
    if (currentLpBalance <= 0) return [];
    const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return [
      { date: past.toISOString().split('T')[0], amount: currentLpBalance },
      { date: todayStr, amount: currentLpBalance },
    ];
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let running = 0;
  const points: Array<{ date: string; amount: number }> = [];

  const firstTs = sorted[0].timestamp;
  if (firstTs) {
    const startDate = new Date(firstTs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    points.push({ date: startDate, amount: 0 });
  }

  for (const ev of sorted) {
    const delta = parseFloat(ev.shareAmount);
    running += ev.type === 'deposit' ? delta : -delta;
    running = Math.max(0, running);
    const date = ev.timestamp
      ? new Date(ev.timestamp).toISOString().split('T')[0]
      : todayStr;
    points.push({ date, amount: parseFloat(running.toFixed(7)) });
  }

  if (currentLpBalance > 0) {
    points.push({ date: todayStr, amount: parseFloat(currentLpBalance.toFixed(7)) });
  }

  return points;
};

// ---------- Chart data helper ----------
// Builds chart-compatible data from events: shows cumulative underlying supply over time.
export const buildSupplyChartData = (
  events: BlendEvent[],
  currentValue: number
): Array<{ date: string; amount: number }> => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (events.length === 0) {
    if (currentValue <= 0) return [];
    // No history: show a flat line from 90 days ago to today
    const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return [
      { date: past.toISOString().split('T')[0], amount: currentValue },
      { date: todayStr, amount: currentValue },
    ];
  }

  // Sort ascending by time
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  let running = 0;
  const points: Array<{ date: string; amount: number }> = [];

  // Add a zero start point before the first event
  const firstTs = sorted[0].timestamp;
  if (firstTs) {
    const startDate = new Date(firstTs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    points.push({ date: startDate, amount: 0 });
  }

  for (const ev of sorted) {
    const delta = parseFloat(ev.underlyingAmount);
    running += ev.type === 'supply' ? delta : -delta;
    running = Math.max(0, running);
    const date = ev.timestamp
      ? new Date(ev.timestamp).toISOString().split('T')[0]
      : todayStr;
    points.push({ date, amount: parseFloat(running.toFixed(4)) });
  }

  // Add live current value as the latest point (captures interest accrued since last event)
  if (currentValue > 0) {
    points.push({ date: todayStr, amount: parseFloat(currentValue.toFixed(4)) });
  }

  return points;
};
