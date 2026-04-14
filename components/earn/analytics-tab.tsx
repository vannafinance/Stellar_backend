'use client';

import { useMemo } from "react";
import { Chart } from "./chart";
import { useTheme } from "@/contexts/theme-context";
import { usePoolData } from "@/hooks/use-earn";
import { STELLAR_POOLS } from "@/lib/constants/earn";

export const AnalyticsTab = () => {
  const { isDark } = useTheme();
  const { pools, isLoading } = usePoolData();

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    let totalTVL = 0;
    let totalBorrowed = 0;
    let avgUtilization = 0;
    let poolCount = 0;

    Object.entries(pools).forEach(([asset, pool]) => {
      if (pool) {
        const supply = parseFloat(pool.totalSupply || '0');
        const borrowed = parseFloat(pool.totalBorrowed || '0');
        const price = asset === 'XLM' ? 0.1 : 1;
        
        totalTVL += supply * price;
        totalBorrowed += borrowed * price;
        avgUtilization += parseFloat(pool.utilizationRate || '0');
        poolCount++;
      }
    });

    return {
      totalTVL,
      totalBorrowed,
      avgUtilization: poolCount > 0 ? avgUtilization / poolCount : 0,
      availableLiquidity: totalTVL - totalBorrowed,
    };
  }, [pools]);

  return (
    <section 
      className={`w-full h-fit rounded-[20px] border-[1px] p-[24px] flex flex-col gap-[24px] ${
        isDark ? "bg-[#111111] border-[#333333]" : "bg-[#F7F7F7] border-gray-200"
      }`}
      aria-label="Analytics Dashboard"
    >
      {/* Aggregate Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Total Value Locked
          </span>
          <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            ${aggregateStats.totalTVL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Total Borrowed
          </span>
          <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            ${aggregateStats.totalBorrowed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Available Liquidity
          </span>
          <p className={`text-xl font-bold text-green-500`}>
            ${aggregateStats.availableLiquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Avg Utilization
          </span>
          <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {aggregateStats.avgUtilization.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Pool Comparison */}
      <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
          Pool Comparison
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(STELLAR_POOLS).map(([asset, config]) => {
            const pool = pools[asset as keyof typeof pools];
            const supply = parseFloat(pool?.totalSupply || '0');
            const utilization = parseFloat(pool?.utilizationRate || '0');
            const supplyAPY = parseFloat(pool?.supplyAPY || '0');
            
            return (
              <div 
                key={asset}
                className={`p-4 rounded-xl border ${
                  isDark ? "bg-[#222222] border-[#333333]" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <img 
                    src={`/icons/${asset.toLowerCase()}.svg`} 
                    alt={asset} 
                    className="w-8 h-8"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/icons/usdc.svg';
                    }}
                  />
                  <span className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {asset}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Total Supply
                    </span>
                    <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      {supply.toLocaleString()} {asset}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Supply APY
                    </span>
                    <span className="text-sm font-medium text-green-500">
                      {supplyAPY}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Utilization
                    </span>
                    <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                      {utilization}%
                    </span>
                  </div>
                </div>

                {/* Utilization Bar */}
                <div className="mt-3">
                  <div className={`w-full h-2 rounded-full ${isDark ? "bg-[#333333]" : "bg-gray-200"}`}>
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-[#703AE6] to-[#FF007A]"
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* APY Chart */}
      <figure className="w-full min-h-[350px]">
        <Chart
          type="deposit-apy"
          currencyTab={true}
          height={350}
          containerWidth="w-full"
          containerHeight="h-full"
        />
      </figure>

      {/* Protocol Info */}
      <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
          Protocol Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg ${isDark ? "bg-[#222222]" : "bg-gray-50"}`}>
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Network
            </span>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
              Stellar Soroban Testnet
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? "bg-[#222222]" : "bg-gray-50"}`}>
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Supported Assets
            </span>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
              XLM, USDC, AqUSDC, SoUSDC
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? "bg-[#222222]" : "bg-gray-50"}`}>
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Interest Rate Model
            </span>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
              Dynamic (Utilization-based)
            </p>
          </div>
          <div className={`p-3 rounded-lg ${isDark ? "bg-[#222222]" : "bg-gray-50"}`}>
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              Receipt Tokens
            </span>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
              vXLM, vUSDC, vAqUSDC, vSoUSDC
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};