'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchTokenPrices,
  getCachedTokenPrice,
  subscribePriceUpdates,
} from '@/lib/oracle-price';

const REFRESH_INTERVAL_MS = 30_000;

const buildPricesMap = (tokens: string[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const t of tokens) {
    const upper = (t || '').toUpperCase().trim();
    if (!upper) continue;
    out[upper] = getCachedTokenPrice(upper);
  }
  return out;
};

/**
 * Returns an always-up-to-date USD price map for the requested token symbols.
 * Reads from the shared oracle cache for the synchronous initial render and
 * refreshes from the on-chain Reflector oracle every 30s while mounted.
 */
export function useTokenPrices(tokens: string[]): Record<string, number> {
  const key = useMemo(() => {
    const unique = Array.from(new Set(tokens.map((t) => (t || '').toUpperCase().trim()).filter(Boolean)));
    unique.sort();
    return unique.join(',');
  }, [tokens]);

  const symbols = useMemo(() => (key ? key.split(',') : []), [key]);

  const [prices, setPrices] = useState<Record<string, number>>(() => buildPricesMap(symbols));

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    const refresh = () => {
      fetchTokenPrices(symbols).then((p) => {
        if (cancelled) return;
        setPrices((prev) => ({ ...prev, ...p }));
      });
    };
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const unsubscribe = subscribePriceUpdates(() => {
      if (!cancelled) setPrices(buildPricesMap(symbols));
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubscribe();
    };
  }, [symbols]);

  return prices;
}

/** Single-symbol convenience wrapper. */
export function useTokenPrice(token: string): number {
  const map = useTokenPrices([token]);
  const upper = (token || '').toUpperCase().trim();
  return map[upper] ?? getCachedTokenPrice(upper);
}
