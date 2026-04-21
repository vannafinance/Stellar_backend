'use client';

import { useMemo } from "react";
import { Chart } from "./chart";
import { usePoolData } from "@/hooks/use-earn";

export const AnalyticsTab = () => {
  const { pools } = usePoolData();

  // Get supply/borrow APY from current pool data
  const { supplyAPY, borrowAPY } = useMemo(() => {
    // Use XLM pool as default for the chart
    const pool = pools.XLM;
    return {
      supplyAPY: parseFloat(pool?.supplyAPY || '0'),
      borrowAPY: parseFloat(pool?.borrowAPY || '0'),
    };
  }, [pools]);

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
        />
      </figure>
    </section>
  );
};
