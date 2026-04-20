'use client';

import { useMemo } from "react";
import { Table } from "./table";
import { useTheme } from "@/contexts/theme-context";
import { usePoolData } from "@/hooks/use-earn";
import { STELLAR_POOLS } from "@/lib/constants/earn";

const tableHeadings = [
  { label: "Assets", id: "assets" },
  { label: "Limits Usage", id: "limits-usage" },
];

export const CollateralLimitsTab = () => {
  const { isDark } = useTheme();
  const { pools, isLoading } = usePoolData();

  const tableBody = useMemo(() => {
    const caps: Record<string, { supplyCap: number; borrowCap: number }> = {
      XLM: { supplyCap: 10000000, borrowCap: 5000000 },
      USDC: { supplyCap: 1000000, borrowCap: 500000 },
    };

    return {
      rows: Object.entries(STELLAR_POOLS).map(([asset, config]) => {
        const pool = pools[asset as keyof typeof pools];
        const supply = parseFloat(pool?.totalSupply || '0');
        const borrowed = parseFloat(pool?.totalBorrowed || '0');
        const supplyCap = caps[asset]?.supplyCap || 1000000;
        const borrowCap = caps[asset]?.borrowCap || 500000;

        const supplyUsage = Math.min((supply / supplyCap) * 100, 100);
        const borrowUsage = Math.min((borrowed / borrowCap) * 100, 100);

        return {
          cell: [
            {
              icon: `/icons/${asset.toLowerCase()}.svg`,
              title: asset,
              description: `v${asset} Pool`,
            },
            {
              percentage: supplyUsage,
              value: `${borrowed.toLocaleString()} of ${(supplyCap / 1000).toFixed(0)}K`,
            },
          ],
        };
      }),
    };
  }, [pools]);

  if (isLoading) {
    return (
      <section className="w-full h-fit" aria-label="Collateral Limits Overview">
        <div className={`w-full h-[200px] border-[1px] rounded-[8px] flex items-center justify-center ${
          isDark ? "bg-[#222222]" : "bg-[#F7F7F7]"
        }`}>
          <p className={`text-[14px] font-medium ${
            isDark ? "text-[#919191]" : "text-[#76737B]"
          }`}>
            Loading collateral and limits...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full h-fit" aria-label="Collateral Limits Overview">
      <article aria-label="Asset Limits Usage">
        <Table
          heading={{}}
          tableHeadings={tableHeadings}
          tableBody={tableBody}
          showProgressBar={true}
        />
      </article>
    </section>
  );
};
