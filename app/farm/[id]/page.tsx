"use client";

import { useParams } from "next/navigation";
import { useFarmStore } from "@/store/farm-store";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/theme-context";
import Image from "next/image";
import { useMemo, useState, useCallback } from "react";
import { iconPaths } from "@/lib/constants";
import { AccountStatsGhost } from "@/components/earn/account-stats-ghost";
import { Chart } from "@/components/earn/chart";
import { Table } from "@/components/earn/table";
import { transactionTableHeadings } from "@/components/earn/acitivity-tab";
import { Form } from "@/components/farm/form";
import { farmTableBody, singleAssetTableBody } from "@/lib/constants/farm";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { items } from "@/components/earn/details-tab";
import { StatsCard } from "@/components/ui/stats-card";
import {
  useBlendPoolStats,
  useUserBlendPositions,
  useBlendEvents,
  buildSupplyChartData,
} from "@/hooks/use-farm";
import { useMarginAccountInfoStore } from "@/store/margin-account-info-store";

const UI_TABS = [
  { id: "all-transactions", label: "All Transactions" },
  { id: "analytics", label: "Analytics" },
];

// Headings for current position table
const positionTableHeadings = [
  { label: "Asset", id: "asset" },
  { label: "Supplied (b-Tokens)", id: "b-tokens" },
  { label: "Underlying Value", id: "underlying" },
  { label: "Supply APY", id: "supply-apy" },
  { label: "b-Rate", id: "b-rate" },
];

export default function FarmDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { isDark } = useTheme();

  const [activeUiTab, setActiveUiTab] = useState<string>("all-transactions");
  const [activeTab, setActiveTab] = useState<string>("current-position");

  // Determine which token this page is for (xlm / usdc / eurc)
  const tokenSymbol = useMemo((): 'XLM' | 'USDC' | 'EURC' | null => {
    const upper = id?.toUpperCase();
    if (upper === 'XLM') return 'XLM';
    if (upper === 'USDC') return 'USDC';
    if (upper === 'EURC') return 'EURC';
    return null;
  }, [id]);

  // Real data hooks
  const { stats: poolStats, isLoading: statsLoading } = useBlendPoolStats();
  const { positions: userPositions, isLoading: posLoading } = useUserBlendPositions();
  const { events, isLoading: eventsLoading } = useBlendEvents(tokenSymbol ?? undefined);
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);

  // Pool stats for this token
  const reserveData = tokenSymbol ? poolStats[tokenSymbol] : null;

  // Stats strip items (real data)
  const statsItems = useMemo(() => [
    {
      id: "supplyApy",
      name: "Supply APY",
      amount: statsLoading ? "..." : reserveData ? `${reserveData.supplyAPY}%` : "N/A",
    },
    {
      id: "borrowApy",
      name: "Borrow APY",
      amount: statsLoading ? "..." : reserveData ? `${reserveData.borrowAPY}%` : "N/A",
    },
    {
      id: "utilization",
      name: "Utilization Rate",
      amount: statsLoading ? "..." : reserveData ? `${reserveData.utilizationRate}%` : "N/A",
    },
    {
      id: "totalSupply",
      name: "Total Pool Supply",
      amount: statsLoading ? "..." : reserveData
        ? `${parseFloat(reserveData.totalSupply).toLocaleString()} ${tokenSymbol}`
        : "N/A",
    },
  ], [reserveData, statsLoading, tokenSymbol]);

  // User position for this token
  const myPosition = tokenSymbol ? userPositions[tokenSymbol] : null;
  const myUnderlying = parseFloat(myPosition?.underlyingValue ?? '0');
  const myBTokens = parseFloat(myPosition?.bTokenBalance ?? '0');

  // Chart data: supply history from events + current value
  const chartLiveData = useMemo(() => {
    return buildSupplyChartData(events, myUnderlying);
  }, [events, myUnderlying]);

  // Chart heading
  const chartHeading = useMemo(() => {
    if (!tokenSymbol) return 'My Supply Position';
    const bRate = reserveData?.bRate ?? '—';
    return `1 b${tokenSymbol} = ${bRate} ${tokenSymbol}`;
  }, [tokenSymbol, reserveData]);

  // Current Position table
  const currentPositionBody = useMemo(() => {
    if (!tokenSymbol || myBTokens === 0) return { rows: [] };
    return {
      rows: [{
        cell: [
          { chain: tokenSymbol, title: tokenSymbol, tags: ['Blend', 'Supply'] },
          { title: `${myPosition?.bTokenBalance ?? '0'} b${tokenSymbol}` },
          { title: `${myPosition?.underlyingValue ?? '0'} ${tokenSymbol}` },
          { title: reserveData ? `${reserveData.supplyAPY}%` : '—' },
          { title: reserveData?.bRate ?? '—' },
        ],
      }],
    };
  }, [tokenSymbol, myPosition, myBTokens, reserveData]);

  // Position History table from blockchain events
  const positionHistoryBody = useMemo(() => {
    if (events.length === 0) return { rows: [] };
    return {
      rows: events.map((ev) => ({
        cell: [
          {
            title: ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() : '—',
            description: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '',
          },
          {
            title: ev.type === 'supply' ? 'Supply' : 'Withdraw',
            badge: ev.type === 'supply' ? 'green' : 'orange',
          },
          { title: `${ev.underlyingAmount} ${ev.tokenSymbol}` },
          { title: 'Success', badge: 'green' },
          ev.txHash
            ? {
                title: `${ev.txHash.slice(0, 8)}...${ev.txHash.slice(-4)}`,
                clickable: 'link',
                link: `https://stellar.expert/explorer/testnet/tx/${ev.txHash}`,
              }
            : { title: '—' },
        ],
      })),
    };
  }, [events]);

  // Table body based on active tab
  const tableBodyData = useMemo(() => {
    if (activeTab === 'position-history') return positionHistoryBody;
    return currentPositionBody;
  }, [activeTab, currentPositionBody, positionHistoryBody]);

  // Analytics stats cards
  const analyticsItems = useMemo(() => {
    if (!reserveData) return items;
    return [
      { heading: 'Supply APY', mainInfo: `${reserveData.supplyAPY}%`, subInfo: 'Annual yield on supplied assets', tooltip: 'Net APY after backstop fee' },
      { heading: 'Borrow APY', mainInfo: `${reserveData.borrowAPY}%`, subInfo: 'Annual cost to borrow', tooltip: 'Current variable borrow rate' },
      { heading: 'Utilization', mainInfo: `${reserveData.utilizationRate}%`, subInfo: 'Borrowed / Total Supply', tooltip: 'Pool utilization rate' },
      { heading: 'Total Supply', mainInfo: `${parseFloat(reserveData.totalSupply).toLocaleString()} ${tokenSymbol}`, subInfo: 'Total underlying supplied', tooltip: 'Sum of all deposits in the pool' },
      { heading: 'Total Borrow', mainInfo: `${parseFloat(reserveData.totalBorrow).toLocaleString()} ${tokenSymbol}`, subInfo: 'Total underlying borrowed', tooltip: 'Sum of all borrows from the pool' },
      { heading: 'b-Rate', mainInfo: reserveData.bRate, subInfo: `1 b${tokenSymbol} = ${reserveData.bRate} ${tokenSymbol}`, tooltip: 'b-token to underlying exchange rate' },
    ];
  }, [reserveData, tokenSymbol]);

  // Row and tab type from store / URL
  const selectedRow = useFarmStore((state) => state.selectedRow);
  const tabType = useFarmStore((state) => state.tabType);

  const findRowFromId = useCallback((searchId: string) => {
    for (const row of singleAssetTableBody.rows) {
      const firstCell = row.cell?.[0];
      if (firstCell?.title) {
        const rowId = firstCell.title.toLowerCase().replace(/\s+/g, "-");
        if (rowId === searchId.toLowerCase()) return { row, tabType: "single" as const };
      }
    }
    for (const row of farmTableBody.rows) {
      const firstCell = row.cell?.[0];
      if ((firstCell as any).titles?.length > 0) {
        const rowId = (firstCell as any).titles.join("-").toLowerCase().replace(/\s+/g, "-");
        if (rowId === searchId.toLowerCase()) return { row, tabType: "multi" as const };
      } else if (firstCell?.title) {
        const rowId = firstCell.title.toLowerCase().replace(/\s+/g, "-");
        if (rowId === searchId.toLowerCase()) return { row, tabType: "multi" as const };
      }
    }
    return null;
  }, []);

  const rowData = useMemo(() => {
    if (selectedRow && tabType) return { row: selectedRow, tabType };
    if (id) return findRowFromId(id);
    return null;
  }, [selectedRow, tabType, id, findRowFromId]);

  const farmData = useMemo(() => {
    if (!rowData?.row?.cell?.length) {
      return { title: tokenSymbol ?? id, titles: null, chain: tokenSymbol ?? 'XLM', tags: tokenSymbol ? ['Blend', 'Supply'] : [] };
    }
    const firstCell = rowData.row.cell[0];
    const titles = (firstCell as any).titles || null;
    const title = titles ? titles.join(' / ') : firstCell.title || id;
    const chain = (firstCell as any).chain || 'XLM';
    const tags = (firstCell as any).tags || [];
    return { title, titles, chain, tags };
  }, [rowData, id, tokenSymbol]);

  const iconPath = useMemo(() => {
    if (farmData.titles?.length > 0) return iconPaths[farmData.titles[0].toUpperCase()] || '/icons/eth-icon.png';
    const assetName = farmData.title?.split(' / ')[0]?.toUpperCase() || farmData.chain.toUpperCase();
    return iconPaths[assetName] || iconPaths[farmData.chain.toUpperCase()] || '/icons/eth-icon.png';
  }, [farmData]);

  const isMultiAsset = rowData?.tabType === 'multi' && farmData.titles && farmData.titles.length > 1;

  return (
    <main className="flex flex-col gap-[40px] pt-[40px] px-[40px] pb-[80px]">
      {/* Header */}
      <header className="w-full h-fit">
        <div className="w-full h-fit flex flex-col gap-[20px]">
          <nav aria-label="Breadcrumb">
            <button
              type="button"
              onClick={() => router.push("/farm")}
              className={`w-fit h-fit flex gap-[12px] items-center cursor-pointer text-[16px] font-medium hover:text-[#703AE6] transition-colors ${isDark ? "text-white" : "text-[#5A5555]"}`}
            >
              <svg width="9" height="16" viewBox="0 0 9 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L1 8L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to pools
            </button>
          </nav>
          <div className="w-full h-fit flex gap-[16px] items-center">
            <Image src={iconPath} alt={`${farmData.title}-icon`} width={36} height={36} />
            <div className="w-fit h-fit flex gap-[8px] items-center">
              <h1 className={`text-[24px] font-bold ${isDark ? "text-white" : "text-[#181822]"}`}>
                {farmData.title}
              </h1>
              <div className="flex gap-[8px]">
                {farmData.tags.slice(0, 2).map((tag: string | number, i: number) => (
                  <span key={i} className="text-[12px] font-semibold text-center rounded-[4px] py-[2px] px-[6px] bg-[#703AE6] text-white">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Pool stats strip */}
      {!isMultiAsset && (
        <section className="w-full h-fit">
          <AccountStatsGhost items={statsItems} />
        </section>
      )}

      {/* Main content */}
      <section className="w-full h-fit flex gap-[20px]">
        <div className="w-full h-fit flex flex-col gap-[10px]">
          <AnimatedTabs containerClassName="w-full h-fit" tabClassName="w-full h-fit" type="solid" tabs={UI_TABS} activeTab={activeUiTab} onTabChange={setActiveUiTab} />

          {activeUiTab === "all-transactions" ? (
            <div className={`w-full h-fit flex flex-col gap-[24px] rounded-[20px] border-[1px] p-[24px] ${isDark ? "bg-[#111111]" : "bg-[#F7F7F7]"}`}>
              {/* Supply chart */}
              <Chart
                type="farm"
                heading={chartHeading}
                uptrend={myUnderlying > 0 ? `${myUnderlying.toFixed(4)} ${tokenSymbol} supplied` : undefined}
                liveData={chartLiveData.length > 0 ? chartLiveData : undefined}
              />

              {/* My position + history table */}
              <Table
                filterDropdownPosition="right"
                tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
                heading={{
                  heading: "My Position",
                  tabsItems: [
                    { id: "current-position", label: "Current Position" },
                    { id: "position-history", label: "Position History" }
                  ],
                  tabType: "solid"
                }}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                filters={{ filters: ["All"], customizeDropdown: true }}
                tableHeadings={activeTab === 'current-position' ? positionTableHeadings : transactionTableHeadings}
                tableBody={tableBodyData}
              />

              {/* No position hint */}
              {!posLoading && !eventsLoading && myBTokens === 0 && activeTab === 'current-position' && marginAccountAddress && (
                <p className={`text-center text-sm py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  No active position in this pool. Use the form on the right to supply {tokenSymbol}.
                </p>
              )}
              {!marginAccountAddress && (
                <p className={`text-center text-sm py-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Connect a wallet and create a margin account to see your position.
                </p>
              )}
            </div>
          ) : (
            <div className={`w-full h-fit flex flex-col gap-[24px] rounded-[20px] border-[1px] p-[24px] ${isDark ? "bg-[#111111]" : "bg-[#F7F7F7]"}`}>
              <h2 className={`text-[20px] font-semibold ${isDark ? "text-white" : ""}`}>Statistics</h2>
              <article className="w-full h-full grid grid-cols-3 gap-x-[15px] gap-y-[15px]" aria-label="Pool Statistics">
                {analyticsItems.map((item, idx) => (
                  <StatsCard key={idx} heading={item.heading} mainInfo={item.mainInfo} subInfo={item.subInfo} tooltip={item.tooltip} />
                ))}
              </article>
            </div>
          )}
        </div>

        {/* Deposit / Withdraw form */}
        <div className="w-[480px] h-fit flex flex-col gap-[20px]">
          <Form />
        </div>
      </section>
    </main>
  );
}
