'use client';

import { useMemo } from "react";
import { Table } from "./table";
import { useTheme } from "@/contexts/theme-context";
import { usePoolData } from "@/hooks/use-earn";
import { STELLAR_POOLS } from "@/lib/constants/earn";

const tableHeadings = [
  { label: "Asset", id: "assets" },
  { label: "Supply Cap Usage", id: "supply-cap" },
  { label: "Borrow Cap Usage", id: "borrow-cap" },
];

export const CollateralLimitsTab = () => {
  const { isDark } = useTheme();
  const { pools } = usePoolData();

  // Format collateral limits data
  const tableBody = useMemo(() => {
    // Define caps (in production these would come from the contracts)
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
        
        const supplyUsage = (supply / supplyCap) * 100;
        const borrowUsage = (borrowed / borrowCap) * 100;

        return {
          cell: [
            {
              icon: `/icons/${asset.toLowerCase()}.svg`,
              title: asset,
              description: `v${asset} Pool`,
            },
            {
              percentage: Math.min(supplyUsage, 100),
              value: `${supply.toLocaleString()} of ${(supplyCap / 1000).toFixed(0)}K`,
            },
            {
              percentage: Math.min(borrowUsage, 100),
              value: `${borrowed.toLocaleString()} of ${(borrowCap / 1000).toFixed(0)}K`,
            },
          ],
        };
      }),
    };
  }, [pools]);

  return (
    <section 
      className={`w-full h-fit rounded-[20px] border-[1px] p-[24px] ${
        isDark ? "bg-[#111111] border-[#333333]" : "bg-[#F7F7F7] border-gray-200"
      }`}
      aria-label="Collateral Limits Overview"
    >
      {/* Info Banner */}
      <div className={`mb-4 p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
          Collateral & Supply Limits
        </h3>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Supply and borrow caps help manage protocol risk by limiting exposure to individual assets.
          When caps are reached, no additional supply or borrows are allowed for that asset.
        </p>
      </div>

      {/* Limits Table */}
      <article aria-label="Asset Limits Usage">
        <Table
          heading={{}}
          tableHeadings={tableHeadings}
          tableBody={tableBody}
          showProgressBar={true}
          tableBodyBackground={isDark ? "bg-[#1a1a1a]" : "bg-white"}
        />
      </article>

      {/* Risk Parameters */}
      <div className={`mt-4 p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
        <h4 className={`text-md font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
          Risk Parameters
        </h4>
        <div className="grid grid-cols-3 gap-4">
          {Object.keys(STELLAR_POOLS).map((asset) => (
            <div 
              key={asset}
              className={`p-3 rounded-lg ${isDark ? "bg-[#222222]" : "bg-gray-50"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <img 
                  src={`/icons/${asset.toLowerCase()}.svg`} 
                  alt={asset} 
                  className="w-5 h-5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/icons/usdc.svg';
                  }}
                />
                <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {asset}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                    Collateral Factor
                  </span>
                  <span className={isDark ? "text-white" : "text-gray-900"}>
                    {asset === 'XLM' ? '75%' : '80%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                    Liquidation Threshold
                  </span>
                  <span className={isDark ? "text-white" : "text-gray-900"}>
                    {asset === 'XLM' ? '80%' : '85%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-gray-500" : "text-gray-400"}>
                    Liquidation Penalty
                  </span>
                  <span className={isDark ? "text-white" : "text-gray-900"}>
                    5%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};