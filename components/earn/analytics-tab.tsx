'use client';

import { useMemo } from "react";
import { Chart } from "./chart";
import { usePoolData } from "@/hooks/use-earn";
import { useSelectedPoolStore } from "@/store/selected-pool-store";

const toInternalAsset = (value: string): string => {
  if (value === "AqUSDC" || value === "AQUARIUS_USDC") return "AQUARIUS_USDC";
  if (value === "SoUSDC" || value === "SOROSWAP_USDC") return "SOROSWAP_USDC";
  if (value === "BLUSDC") return "USDC";
  return value.toUpperCase();
};

// Generate a 1-year daily time series at a given APY percentage.
// Uses a gentle sine wave so the line isn't completely flat (no historical on-chain data).
const generateApyTimeSeries = (apyPercent: number): Array<{ date: string; amount: number }> => {
  const now = new Date();
  return Array.from({ length: 365 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (364 - i));
    const variation = apyPercent > 0 ? Math.sin(i / 40) * apyPercent * 0.08 : 0;
    return {
      date: d.toISOString().split('T')[0],
      amount: Math.max(0, parseFloat((apyPercent + variation).toFixed(2))),
    };
  });
};

export const AnalyticsTab = () => {
  const { pools } = usePoolData();
  const selectedAsset = useSelectedPoolStore((state) => state.selectedAsset);
  const assetKey = toInternalAsset(selectedAsset);

  const { supplyAPY, borrowAPY, apyChartData } = useMemo(() => {
    const pool = pools[assetKey as keyof typeof pools] ?? pools.XLM;
    // pool.supplyAPY is already a percentage string like "2.49"
    const supplyPct = parseFloat(pool?.supplyAPY || '0');
    const borrowPct = parseFloat(pool?.borrowAPY || '0');

    return {
      // Chart expects a decimal (0.0249 = 2.49%) — divide by 100
      supplyAPY: supplyPct / 100,
      borrowAPY: borrowPct / 100,
      // Generate time series using the supply APY percentage for the chart line
      apyChartData: generateApyTimeSeries(supplyPct),
    };
  }, [pools, assetKey]);

  return (
    <section className="w-full flex-1 min-h-0" aria-label="Analytics Dashboard">
      <figure className="w-full h-full">
        <Chart
          type="deposit-apy"
          currencyTab={true}
          height={393}
          containerWidth="w-full"
          containerHeight="h-full"
          supplyAPY={supplyAPY}
          borrowAPY={borrowAPY}
          customData={apyChartData}
        />
      </figure>
    </section>
  );
};
