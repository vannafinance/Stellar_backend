'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BlendService,
  BlendReserveData,
  BlendUserPosition,
  BlendEvent,
} from '@/lib/blend-utils';
import { useMarginAccountInfoStore } from '@/store/margin-account-info-store';

// ---------- Pool stats ----------

export interface FarmPoolStats {
  XLM: BlendReserveData | null;
  USDC: BlendReserveData | null;
  EURC: BlendReserveData | null;
}

const EMPTY_STATS: FarmPoolStats = { XLM: null, USDC: null, EURC: null };

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
        EURC: data.EURC,
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
  EURC: BlendUserPosition;
  totalValueXLM: string; // sum of underlying values (in XLM units for display)
}

const EMPTY_POSITION: BlendUserPosition = { bTokenBalance: '0', underlyingValue: '0', tokenSymbol: '' };
const EMPTY_USER: UserBlendPositions = {
  XLM: EMPTY_POSITION,
  USDC: EMPTY_POSITION,
  EURC: EMPTY_POSITION,
  totalValueXLM: '0',
};

export const useUserBlendPositions = () => {
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);
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
      const eurcVal = parseFloat(data.EURC?.underlyingValue ?? '0');
      setPositions({
        XLM: data.XLM ?? { ...EMPTY_POSITION, tokenSymbol: 'XLM' },
        USDC: data.USDC ?? { ...EMPTY_POSITION, tokenSymbol: 'USDC' },
        EURC: data.EURC ?? { ...EMPTY_POSITION, tokenSymbol: 'EURC' },
        totalValueXLM: (xlmVal + usdcVal + eurcVal).toFixed(4),
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch positions');
    } finally {
      setIsLoading(false);
    }
  }, [marginAccountAddress]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { positions, isLoading, error, refresh: fetch };
};

// ---------- Blend events / position history ----------

export const useBlendEvents = (tokenSymbol?: string) => {
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);
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

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { events, isLoading, error, refresh: fetch };
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
