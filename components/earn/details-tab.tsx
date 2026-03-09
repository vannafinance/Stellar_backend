'use client';

import { useMemo } from "react";

// Static export for use in other pages (e.g. farm detail page)
export const items = [
  {
    heading: "Available Liquidity",
    mainInfo: "—",
    subInfo: "—",
    tooltip: "Total assets available for borrowing",
  },
  {
    heading: "Supply APY",
    mainInfo: "—",
    subInfo: "—",
    tooltip: "Annual percentage yield for suppliers",
  },
  {
    heading: "Borrow APY",
    mainInfo: "—",
    tooltip: "Annual percentage yield for borrowers",
  },
  {
    heading: "Utilization Rate",
    mainInfo: "—",
    tooltip: "Ratio of borrowed assets to supplied assets",
  },
  {
    heading: "Liquidation Penalty",
    mainInfo: "Dynamic Range",
    subInfo: "0–15%",
    tooltip: "Penalty applied during liquidation events",
  },
  {
    heading: "Oracle Price",
    mainInfo: "—",
    tooltip: "Current oracle price of the asset",
  },
  {
    heading: "Exchange Rate",
    mainInfo: "—",
    subInfo: "—",
    tooltip: "Exchange rate between vToken and underlying asset",
  },
];
import { StatsCard } from "../ui/stats-card";
import { getPercentage } from "@/lib/utils/helper";
import { formatValue } from "@/lib/utils/format-value";
import { useTheme } from "@/contexts/theme-context";
import { usePoolData } from "@/hooks/use-earn";
import { STELLAR_POOLS } from "@/lib/constants/earn";
import { useSelectedPoolStore } from "@/store/selected-pool-store";
import { CONTRACT_ADDRESSES } from "@/lib/stellar-utils";

const abbrev = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-8)}`;

// Build contract address list from the real CONTRACT_ADDRESSES constants
const getAddresses = (selectedAsset: string) => {
  const pool = STELLAR_POOLS[selectedAsset as keyof typeof STELLAR_POOLS];

  const lendingKey = `LENDING_PROTOCOL_${selectedAsset}` as keyof typeof CONTRACT_ADDRESSES;
  const vTokenKey  = `V${selectedAsset}_TOKEN`           as keyof typeof CONTRACT_ADDRESSES;

  const lendingAddr = (CONTRACT_ADDRESSES[lendingKey] as string) || pool?.lendingProtocol || "";
  const vTokenAddr  = (CONTRACT_ADDRESSES[vTokenKey]  as string) || pool?.vToken          || "";

  return [
    {
      heading: `${selectedAsset} Lending Protocol`,
      address: lendingAddr ? abbrev(lendingAddr) : "N/A",
      fullAddress: lendingAddr,
      tooltip: `Main lending contract for ${selectedAsset}`,
    },
    {
      heading: `v${selectedAsset} Token`,
      address: vTokenAddr ? abbrev(vTokenAddr) : "N/A",
      fullAddress: vTokenAddr,
      tooltip: `Receipt token for ${selectedAsset} deposits`,
    },
    {
      heading: "Oracle Contract",
      address: abbrev(CONTRACT_ADDRESSES.ORACLE),
      fullAddress: CONTRACT_ADDRESSES.ORACLE,
      tooltip: "Price oracle for asset valuations",
    },
    {
      heading: "Rate Model Contract",
      address: abbrev(CONTRACT_ADDRESSES.RATE_MODEL),
      fullAddress: CONTRACT_ADDRESSES.RATE_MODEL,
      tooltip: "Interest rate calculation model",
    },
    {
      heading: "Risk Engine",
      address: abbrev(CONTRACT_ADDRESSES.RISK_ENGINE),
      fullAddress: CONTRACT_ADDRESSES.RISK_ENGINE,
      tooltip: "Risk management and liquidation parameters",
    },
    {
      heading: "Registry Contract",
      address: abbrev(CONTRACT_ADDRESSES.REGISTRY),
      fullAddress: CONTRACT_ADDRESSES.REGISTRY,
      tooltip: "Protocol registry for all contracts",
    },
  ];
};

export const Details = () => {
  const { isDark } = useTheme();
  const selectedAsset = useSelectedPoolStore((state) => state.selectedAsset);
  const { pools, isLoading, refresh } = usePoolData();

  // Get selected pool data
  const selectedPool = pools[selectedAsset as keyof typeof pools];
  const addresses = getAddresses(selectedAsset);

  // Calculate stats
  const totalSupplied = useMemo(() => {
    const supply = parseFloat(selectedPool?.totalSupply || '0');
    const price = selectedAsset === 'XLM' ? 0.1 : 1;
    return {
      inToken: supply,
      inUsd: supply * price,
    };
  }, [selectedPool, selectedAsset]);

  const totalBorrowed = useMemo(() => {
    const borrowed = parseFloat(selectedPool?.totalBorrowed || '0');
    const price = selectedAsset === 'XLM' ? 0.1 : 1;
    return {
      inToken: borrowed,
      inUsd: borrowed * price,
    };
  }, [selectedPool, selectedAsset]);

  // Max value for pie chart percentage calculation
  const maxToken = Math.max(totalSupplied.inToken, 100000);

  // Stats items from pool data
  const items = useMemo(() => [
    {
      heading: "Available Liquidity",
      mainInfo: `${formatValue(parseFloat(selectedPool?.availableLiquidity || '0'), {
        type: "number",
        useLargeFormat: true,
      })} ${selectedAsset}`,
      subInfo: `$${formatValue(parseFloat(selectedPool?.availableLiquidity || '0') * (selectedAsset === 'XLM' ? 0.1 : 1), {
        type: "number",
        useLargeFormat: true,
      })}`,
      tooltip: `Total ${selectedAsset} available for borrowing`,
    },
    {
      heading: "Supply APY",
      mainInfo: `${selectedPool?.supplyAPY || '0'}%`,
      subInfo: "Annualized return",
      tooltip: "Annual percentage yield for suppliers",
    },
    {
      heading: "Borrow APY",
      mainInfo: `${selectedPool?.borrowAPY || '0'}%`,
      tooltip: "Annual percentage yield for borrowers",
    },
    {
      heading: "Utilization Rate",
      mainInfo: `${selectedPool?.utilizationRate || '0'}%`,
      tooltip: "Ratio of borrowed assets to supplied assets",
    },
    {
      heading: "Liquidation Penalty",
      mainInfo: "Dynamic Range",
      subInfo: "0–15%",
      tooltip: "Penalty applied during liquidation events",
    },
    {
      heading: "Oracle Price",
      mainInfo: selectedAsset === 'XLM' ? "$0.10" : "$1.00",
      tooltip: `Current oracle price of ${selectedAsset}`,
    },
    {
      heading: "Exchange Rate",
      mainInfo: selectedPool?.exchangeRate || '1.0000',
      subInfo: `1 v${selectedAsset} = ${selectedPool?.exchangeRate || '1.0000'} ${selectedAsset}`,
      tooltip: `Exchange rate between v${selectedAsset} and ${selectedAsset}`,
    },
    {
      heading: "vToken Supply",
      mainInfo: `${formatValue(parseFloat(selectedPool?.vTokenSupply || '0'), {
        type: "number",
        useLargeFormat: true,
      })} v${selectedAsset}`,
      tooltip: `Total v${selectedAsset} tokens minted`,
    },
  ], [selectedPool, selectedAsset]);

  return (
    <section className={`w-full h-fit flex flex-col gap-[16px] rounded-[20px] border-[1px] ${
      isDark ? "bg-[#111111] border-[#333333]" : "bg-[#F4F4F4] border-gray-200"
    }`} aria-label="Pool Details">
      <div className="w-full h-fit rounded-[20px] pt-[24px] px-[24px] flex flex-col gap-[16px]">
        {/* Asset Selector */}
        <div className="flex justify-between items-center">
          <h2 className={`w-fit h-fit text-[20px] font-semibold ${
            isDark ? "text-white" : ""
          }`}>Pool Statistics</h2>
          <div className="flex gap-2">
            {/* Show only current pool button */}
            <button
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-[#703AE6] text-white`}
            >
              {selectedAsset}
            </button>
            <button
              onClick={refresh}
              disabled={isLoading}
              className={`px-3 py-2 rounded-lg text-sm transition-all ${
                isDark
                  ? "bg-[#222222] text-gray-300 hover:bg-[#333333]"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              } ${isLoading ? 'animate-spin' : ''}`}
            >
              ↻
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-[#703AE6] border-t-transparent rounded-full mx-auto"></div>
          </div>
        )}

        {/* Supply/Borrow Overview */}
        <article className={`w-full h-fit flex items-center rounded-[16px] gap-[12px] ${
          isDark ? "bg-[#222222]" : "bg-[#FFFFFF]"
        }`} aria-label="Supply and Borrow Overview">
          <StatsCard
            percentage={getPercentage(totalSupplied.inToken, maxToken)}
            heading="Total Supplied"
            mainInfo={`${formatValue(totalSupplied.inToken, {
              type: "number",
              useLargeFormat: true,
            })} ${selectedAsset}`}
            subInfo={`$${formatValue(totalSupplied.inUsd, {
              type: "number",
              useLargeFormat: true,
            })} USD`}
            pie={true}
          />
          <StatsCard
            percentage={getPercentage(totalBorrowed.inToken, maxToken)}
            heading="Total Borrowed"
            mainInfo={`${formatValue(totalBorrowed.inToken, {
              type: "number",
              useLargeFormat: true,
            })} ${selectedAsset}`}
            subInfo={`$${formatValue(totalBorrowed.inUsd, {
              type: "number",
              useLargeFormat: true,
            })} USD`}
            pie={true}
          />
        </article>

        {/* Statistics Grid */}
        <article className="w-full h-full grid grid-cols-3 grid-rows-3 gap-x-[15px]" aria-label="Pool Statistics">
          {items.map((item, idx) => {
            return (
              <StatsCard
                key={idx}
                heading={item.heading}
                mainInfo={item.mainInfo}
                subInfo={item.subInfo}
                tooltip={item.tooltip}
              />
            );
          })}
        </article>

        {/* Contract Addresses */}
        <article className="w-full h-fit rounded-[20px] pb-[24px]" aria-label="Contract Addresses">
          <h3 className={`text-[20px] font-semibold w-full h-fit mb-4 ${
            isDark ? "text-white" : ""
          }`}>
            Contract Addresses
          </h3>
          <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-2">
            {addresses.map((item, idx) => {
              return (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
                    isDark ? "bg-[#1a1a1a]" : "bg-white"
                  }`}
                  onClick={() => {
                    if (item.fullAddress) {
                      window.open(`https://stellar.expert/explorer/testnet/contract/${item.fullAddress}`, '_blank');
                    }
                  }}
                  title={item.tooltip}
                >
                  <span className={`text-xs block mb-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    {item.heading}
                  </span>
                  <span className={`text-sm font-mono ${isDark ? "text-[#703AE6]" : "text-[#703AE6]"}`}>
                    {item.address}
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
};
