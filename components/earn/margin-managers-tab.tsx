'use client';

import { useMemo } from "react";
import { Table } from "./table";
import { useTheme } from "@/contexts/theme-context";
import { usePoolData } from "@/hooks/use-earn";
import { STELLAR_POOLS } from "@/lib/constants/earn";

const tableHeadings = [
  { label: "Pool Manager", id: "pool-manager" },
  { label: "Total Liquidity", id: "total-liquidity" },
  { label: "Utilization", id: "utilization" },
  { label: "Status", id: "status" },
];

export const MarginManagersTab = () => {
  const { isDark } = useTheme();
  const { pools, isLoading } = usePoolData();

  // Format pool manager data
  const tableBody = useMemo(() => {
    return {
      rows: Object.entries(STELLAR_POOLS).map(([asset, config]) => {
        const pool = pools[asset as keyof typeof pools];
        const supply = parseFloat(pool?.totalSupply || '0');
        const utilization = parseFloat(pool?.utilizationRate || '0');
        const price = asset === 'XLM' ? 0.1 : 1;

        return {
          cell: [
            {
              title: `${asset} Lending Pool`,
              description: `${config.lendingProtocol.slice(0, 8)}...${config.lendingProtocol.slice(-4)}`,
            },
            {
              title: `${supply.toLocaleString()} ${asset}`,
              description: `$${(supply * price).toLocaleString()}`,
            },
            {
              percentage: Math.min(utilization, 100),
              value: `${utilization.toFixed(2)}%`,
            },
            {
              title: "Active",
              badge: "green",
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
      aria-label="Pool Managers Overview"
    >
      {/* Info Header */}
      <div className={`mb-4 p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
          Lending Pool Managers
        </h3>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Each lending pool is managed by a separate smart contract on Stellar Soroban.
          Pool managers handle deposits, withdrawals, borrows, and interest calculations.
        </p>
      </div>

      {/* Managers Table */}
      <article aria-label="Pool Managers List">
        <Table
          heading={{}}
          tableHeadings={tableHeadings}
          tableBody={tableBody}
          showProgressBar={true}
          tableBodyBackground={isDark ? "bg-[#1a1a1a]" : "bg-white"}
        />
      </article>

      {/* Contract Links */}
      <div className={`mt-4 p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
        <h4 className={`text-md font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
          Contract Addresses
        </h4>
        <div className="space-y-2">
          {Object.entries(STELLAR_POOLS).map(([asset, config]) => (
            <div 
              key={asset}
              className={`flex justify-between items-center p-3 rounded-lg ${
                isDark ? "bg-[#222222]" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <img 
                  src={`/icons/${asset.toLowerCase()}.svg`} 
                  alt={asset} 
                  className="w-5 h-5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/icons/usdc.svg';
                  }}
                />
                <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                  {asset} Pool
                </span>
              </div>
              <div className="flex gap-4">
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${config.lendingProtocol}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#703AE6] hover:underline"
                >
                  Lending Contract ↗
                </a>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${config.vToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#703AE6] hover:underline"
                >
                  vToken Contract ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Protocol Stats */}
      <div className={`mt-4 grid grid-cols-3 gap-4`}>
        <div className={`p-4 rounded-xl text-center ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Active Pools
          </span>
          <p className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            3
          </p>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Network
          </span>
          <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            Soroban Testnet
          </p>
        </div>
        <div className={`p-4 rounded-xl text-center ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Protocol Status
          </span>
          <p className="text-lg font-bold text-green-500">
            Operational
          </p>
        </div>
      </div>
    </section>
  );
};