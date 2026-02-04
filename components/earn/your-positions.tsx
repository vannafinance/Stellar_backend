'use client';

import { useState, useMemo } from "react";
import { Chart } from "./chart";
import { Table } from "./table";
import { useTheme } from "@/contexts/theme-context";
import { useUserPositions, usePoolData } from "@/hooks/use-earn";
import { useUserStore } from "@/store/user";
import { useEarnPoolStore } from "@/store/earn-pool-store";
import { STELLAR_POOLS } from "@/lib/constants/earn";

const tabs = [
  { id: "current-positions", label: "Current Positions" },
  { id: "positions-history", label: "Positions History" }
];

export const YourPositions = () => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<string>("current-positions");
  
  const userAddress = useUserStore((state) => state.address);
  const { positions, isLoading } = useUserPositions();
  const { pools } = usePoolData();
  const recentTransactions = useEarnPoolStore((state) => state.recentTransactions);

  // Calculate total supplied value
  const totalSupplied = useMemo(() => {
    let total = 0;
    Object.entries(positions).forEach(([asset, position]) => {
      const pool = pools[asset as keyof typeof pools];
      const exchangeRate = parseFloat(pool?.exchangeRate || '1');
      const vTokenBalance = parseFloat(position?.vTokenBalance || '0');
      // Estimate XLM at $0.10, USDC/EURC at $1
      const price = asset === 'XLM' ? 0.1 : 1;
      total += vTokenBalance * exchangeRate * price;
    });
    return total;
  }, [positions, pools]);

  // Format positions for current positions table
  const currentPositionsRows = useMemo(() => {
    if (!userAddress) return [];
    
    return Object.entries(STELLAR_POOLS).map(([asset, config]) => {
      const position = positions[asset as keyof typeof positions];
      const pool = pools[asset as keyof typeof pools];
      const vTokenBalance = parseFloat(position?.vTokenBalance || '0');
      const exchangeRate = parseFloat(pool?.exchangeRate || '1');
      const underlying = vTokenBalance * exchangeRate;
      const price = asset === 'XLM' ? 0.1 : 1;
      
      return {
        cell: [
          {
            icon: `/icons/${asset.toLowerCase()}.svg`,
            title: asset,
          },
          {
            title: `${vTokenBalance.toFixed(4)} v${asset}`,
          },
          {
            title: `${underlying.toFixed(4)} ${asset}`,
          },
          {
            title: `$${(underlying * price).toFixed(2)}`,
          },
          {
            title: `${pool?.supplyAPY || '0'}%`,
            tag: 'APY',
          },
        ],
      };
    }).filter(row => {
      const vTokenValue = row.cell[1].title as string;
      return parseFloat(vTokenValue) > 0;
    });
  }, [positions, pools, userAddress]);

  // Format transaction history
  const transactionHistoryRows = useMemo(() => {
    return recentTransactions.slice(0, 10).map((tx) => ({
      cell: [
        {
          title: new Date(tx.timestamp).toLocaleDateString(),
        },
        {
          title: tx.type.toUpperCase(),
          tag: tx.type === 'supply' ? 'Supply' : 'Withdraw',
        },
        {
          title: `${tx.amount} ${tx.asset}`,
        },
        {
          title: tx.status,
        },
        {
          title: tx.hash.slice(0, 8) + '...',
          clickable: `https://stellar.expert/explorer/testnet/tx/${tx.hash}`,
        },
      ],
    }));
  }, [recentTransactions]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const currentPositionsHeadings = [
    { label: "Asset", id: "asset" },
    { label: "vTokens", id: "vtokens" },
    { label: "Underlying", id: "underlying" },
    { label: "Value (USD)", id: "value" },
    { label: "APY", id: "apy" },
  ];

  const historyHeadings = [
    { label: "Date", id: "date" },
    { label: "Type", id: "type" },
    { label: "Amount", id: "amount" },
    { label: "Status", id: "status" },
    { label: "Tx Hash", id: "hash" },
  ];

  return (
    <section 
      className={`w-full h-full flex flex-col gap-[24px] rounded-[20px] border-[1px] p-[24px] ${
        isDark ? "bg-[#111111] border-[#333333]" : "bg-[#F7F7F7] border-gray-200"
      }`}
      aria-label="Your Positions Overview"
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Total Supplied
          </span>
          <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            ${totalSupplied.toFixed(2)}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Active Pools
          </span>
          <p className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {currentPositionsRows.length}
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
          <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Connected
          </span>
          <p className={`text-sm font-medium ${userAddress ? "text-green-500" : "text-red-500"}`}>
            {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : "Not Connected"}
          </p>
        </div>
      </div>

      {/* Chart */}
      <figure className="w-full flex-1 min-h-[300px]">
        <Chart 
          type="my-supply" 
          currencyTab={true} 
          height={300} 
          containerWidth="w-full" 
          containerHeight="h-full" 
        />
      </figure>
      
      {/* Positions Table */}
      <article aria-label="Your Transactions">
        {!userAddress ? (
          <div className={`text-center py-8 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
            <p className={`${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Connect your wallet to view positions
            </p>
          </div>
        ) : isLoading ? (
          <div className={`text-center py-8 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-white"}`}>
            <div className="animate-spin w-8 h-8 border-2 border-[#703AE6] border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className={`${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Loading positions...
            </p>
          </div>
        ) : (
          <Table
            filterDropdownPosition="right"
            heading={{
              heading: "Your Positions",
              tabsItems: tabs,
              tabType: "solid"
            }} 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
            tableHeadings={activeTab === "current-positions" ? currentPositionsHeadings : historyHeadings} 
            tableBody={{
              rows: activeTab === "current-positions" 
                ? currentPositionsRows 
                : transactionHistoryRows
            }} 
            tableBodyBackground={isDark ? "bg-[#1a1a1a]" : "bg-white"} 
            filters={{
              customizeDropdown: true,
              filters: ["All", "XLM", "USDC", "EURC"]
            }} 
          /> 
        )}
      </article>
    </section>
  );
};