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
import { singleAssetTableBody } from "@/lib/constants/farm";
import { AQUARIUS_POOLS } from "@/lib/aquarius-utils";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { items } from "@/components/earn/details-tab";
import { StatsCard } from "@/components/ui/stats-card";
import {
  useBlendPoolStats,
  useUserBlendPositions,
  useBlendEvents,
  buildSupplyChartData,
  useAquariusPoolStats,
  useAquariusLpPosition,
  useAquariusEvents,
  buildLpChartData,
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

  // Row type detection (multi-asset = Aquarius, single = Blend)
  const selectedRow = useFarmStore((state) => state.selectedRow);
  const tabType = useFarmStore((state) => state.tabType);

  // Detect Aquarius pool early so hooks can be called unconditionally
  const isAquariusEarly =
    tabType === 'multi' ||
    (id && !['xlm', 'usdc', 'eurc'].includes(id.toLowerCase()));

  // Match pool config from AQUARIUS_POOLS based on id (e.g. "xlm-usdc", "xlm-aqua", "xlm-usdt")
  const matchedPool = useMemo(() => {
    if (!isAquariusEarly) return null;
    return AQUARIUS_POOLS.find((p) =>
      p.tokens.join('-').toLowerCase() === id?.toLowerCase()
    ) ?? AQUARIUS_POOLS[0];
  }, [isAquariusEarly, id]);

  const aquariusPoolAddress = matchedPool?.poolAddress ?? null;

  // Real data hooks — Blend (single-asset)
  const { stats: poolStats, isLoading: statsLoading } = useBlendPoolStats();
  const { positions: userPositions, isLoading: posLoading } = useUserBlendPositions();
  const { events, isLoading: eventsLoading } = useBlendEvents(tokenSymbol ?? undefined);
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);

  // Real data hooks — Aquarius (multi-asset)
  const { stats: aqStats, isLoading: aqStatsLoading } = useAquariusPoolStats(aquariusPoolAddress);
  const { lpBalance } = useAquariusLpPosition(marginAccountAddress, aquariusPoolAddress);
  const { events: aqEvents } = useAquariusEvents(aquariusPoolAddress);

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

  // ── Aquarius computed values ──
  const myLpBalance = parseFloat(lpBalance ?? '0');

  const poolTokenA = matchedPool?.tokens[0] ?? 'TokenA';
  const poolTokenB = matchedPool?.tokens[1] ?? 'TokenB';

  // Aquarius stats strip
  const aquariusStatsItems = useMemo(() => [
    {
      id: "reserveA",
      name: `${poolTokenA} Reserve`,
      amount: aqStatsLoading ? "..." : aqStats ? `${parseFloat(aqStats.reserveA).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${poolTokenA}` : "N/A",
    },
    {
      id: "reserveB",
      name: `${poolTokenB} Reserve`,
      amount: aqStatsLoading ? "..." : aqStats ? `${parseFloat(aqStats.reserveB).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${poolTokenB}` : "N/A",
    },
    {
      id: "fee",
      name: "Fee Rate",
      amount: aqStatsLoading ? "..." : aqStats ? aqStats.feeFraction : "N/A",
    },
    {
      id: "totalShares",
      name: "Total LP Shares",
      amount: aqStatsLoading ? "..." : aqStats ? parseFloat(aqStats.totalShares).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "N/A",
    },
  ], [aqStats, aqStatsLoading, poolTokenA, poolTokenB]);

  // Aquarius LP chart data
  const aqChartData = useMemo(
    () => buildLpChartData(aqEvents, myLpBalance),
    [aqEvents, myLpBalance]
  );

  // Aquarius current position table
  const aquariusPositionHeadings = [
    { label: "Pool", id: "pool" },
    { label: "LP Shares", id: "lp-shares" },
    { label: `${poolTokenA} Deposited`, id: "token-a" },
    { label: `${poolTokenB} Deposited`, id: "token-b" },
    { label: "Fee Rate", id: "fee-rate" },
  ];

  const aquariusCurrentPositionBody = useMemo(() => {
    if (myLpBalance <= 0) return { rows: [] };
    // Estimate underlying assets proportional to LP share
    const totalSharesNum = parseFloat(aqStats?.totalShares ?? '0');
    const ratio = totalSharesNum > 0 ? myLpBalance / totalSharesNum : 0;
    const xlmShare = (parseFloat(aqStats?.reserveA ?? '0') * ratio).toFixed(4);
    const usdcShare = (parseFloat(aqStats?.reserveB ?? '0') * ratio).toFixed(4);
    return {
      rows: [{
        cell: [
          { chain: poolTokenA, title: `${poolTokenA} / ${poolTokenB}`, tags: ['Aquarius', 'LP'] },
          { title: `${myLpBalance.toFixed(4)} LP` },
          { title: `${xlmShare} ${poolTokenA}` },
          { title: `${usdcShare} ${poolTokenB}` },
          { title: aqStats?.feeFraction ?? '—' },
        ],
      }],
    };
  }, [myLpBalance, aqStats]);

  // Aquarius position history table
  const aquariusHistoryBody = useMemo(() => {
    if (aqEvents.length === 0) return { rows: [] };
    return {
      rows: aqEvents.map((ev) => ({
        cell: [
          {
            title: ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() : '—',
            description: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '',
          },
          {
            title: ev.type === 'deposit' ? 'Add Liquidity' : 'Remove Liquidity',
            badge: ev.type === 'deposit' ? 'green' : 'orange',
          },
          { title: `${ev.shareAmount} LP` },
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
  }, [aqEvents]);

  // Aquarius analytics cards
  const aquariusAnalyticsItems = useMemo(() => [
    { heading: `${poolTokenA} Reserve`, mainInfo: `${parseFloat(aqStats?.reserveA ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 })} ${poolTokenA}`, subInfo: `Current ${poolTokenA} reserve in pool`, tooltip: `Total ${poolTokenA} held by the Aquarius pool` },
    { heading: `${poolTokenB} Reserve`, mainInfo: `${parseFloat(aqStats?.reserveB ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 })} ${poolTokenB}`, subInfo: `Current ${poolTokenB} reserve in pool`, tooltip: `Total ${poolTokenB} held by the Aquarius pool` },
    { heading: 'Fee Rate', mainInfo: aqStats?.feeFraction ?? '—', subInfo: 'Swap fee per trade', tooltip: 'Fee split between LPs' },
    { heading: 'Total LP Shares', mainInfo: parseFloat(aqStats?.totalShares ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 }), subInfo: 'Total outstanding LP tokens', tooltip: 'Sum of all LP shares minted' },
    { heading: 'Your LP Balance', mainInfo: myLpBalance.toFixed(4), subInfo: 'Your margin account LP shares', tooltip: 'LP tokens held by your margin account' },
  ], [aqStats, myLpBalance, poolTokenA, poolTokenB]);

  const findRowFromId = useCallback((searchId: string) => {
    for (const row of singleAssetTableBody.rows) {
      const firstCell = row.cell?.[0];
      if (firstCell?.title) {
        const rowId = firstCell.title.toLowerCase().replace(/\s+/g, "-");
        if (rowId === searchId.toLowerCase()) return { row, tabType: "single" as const };
      }
    }
    // Match against AQUARIUS_POOLS by token pair id
    for (const pool of AQUARIUS_POOLS) {
      const poolId = pool.tokens.join("-").toLowerCase();
      if (poolId === searchId.toLowerCase()) {
        const row = {
          cell: [
            { chain: pool.tokens[0], titles: pool.tokens, tags: ['Aquarius', (pool.feeFraction / 100).toFixed(2) + '%', 'Testnet'] },
            { title: 'Aquarius' },
          ],
        };
        return { row, tabType: "multi" as const };
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
      <section className="w-full h-fit">
        <AccountStatsGhost items={isMultiAsset ? aquariusStatsItems : statsItems} />
      </section>

      {/* Main content */}
      <section className="w-full h-fit flex gap-[20px]">
        <div className="w-full h-fit flex flex-col gap-[10px]">
          <AnimatedTabs containerClassName="w-full h-fit" tabClassName="w-full h-fit" type="solid" tabs={UI_TABS} activeTab={activeUiTab} onTabChange={setActiveUiTab} />

          {activeUiTab === "all-transactions" ? (
            <div className={`w-full h-fit flex flex-col gap-[24px] rounded-[20px] border-[1px] p-[24px] ${isDark ? "bg-[#111111]" : "bg-[#F7F7F7]"}`}>
              {/* Chart */}
              {isMultiAsset ? (
                <Chart
                  type="farm"
                  heading="My LP Position"
                  uptrend={myLpBalance > 0 ? `${myLpBalance.toFixed(4)} LP shares` : undefined}
                  liveData={aqChartData.length > 0 ? aqChartData : undefined}
                />
              ) : (
                <Chart
                  type="farm"
                  heading={chartHeading}
                  uptrend={myUnderlying > 0 ? `${myUnderlying.toFixed(4)} ${tokenSymbol} supplied` : undefined}
                  liveData={chartLiveData.length > 0 ? chartLiveData : undefined}
                />
              )}

              {/* My position + history table */}
              {isMultiAsset ? (
                <Table
                  filterDropdownPosition="right"
                  tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
                  heading={{
                    heading: "My Position",
                    tabsItems: [
                      { id: "current-position", label: "Current Position" },
                      { id: "position-history", label: "Position History" },
                    ],
                    tabType: "solid",
                  }}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  filters={{ filters: ["All"], customizeDropdown: true }}
                  tableHeadings={
                    activeTab === "current-position"
                      ? aquariusPositionHeadings
                      : transactionTableHeadings
                  }
                  tableBody={
                    activeTab === "current-position"
                      ? aquariusCurrentPositionBody
                      : aquariusHistoryBody
                  }
                />
              ) : (
                <Table
                  filterDropdownPosition="right"
                  tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
                  heading={{
                    heading: "My Position",
                    tabsItems: [
                      { id: "current-position", label: "Current Position" },
                      { id: "position-history", label: "Position History" },
                    ],
                    tabType: "solid",
                  }}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  filters={{ filters: ["All"], customizeDropdown: true }}
                  tableHeadings={
                    activeTab === "current-position" ? positionTableHeadings : transactionTableHeadings
                  }
                  tableBody={tableBodyData}
                />
              )}

              {/* No position hints */}
              {isMultiAsset && myLpBalance <= 0 && activeTab === "current-position" && marginAccountAddress && (
                <p className={`text-center text-sm py-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  No active LP position. Use the form on the right to add liquidity to {poolTokenA}/{poolTokenB}.
                </p>
              )}
              {!isMultiAsset && !posLoading && !eventsLoading && myBTokens === 0 && activeTab === "current-position" && marginAccountAddress && (
                <p className={`text-center text-sm py-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  No active position in this pool. Use the form on the right to supply {tokenSymbol}.
                </p>
              )}
              {!marginAccountAddress && (
                <p className={`text-center text-sm py-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Connect a wallet and create a margin account to see your position.
                </p>
              )}
            </div>
          ) : (
            <div className={`w-full h-fit flex flex-col gap-[24px] rounded-[20px] border-[1px] p-[24px] ${isDark ? "bg-[#111111]" : "bg-[#F7F7F7]"}`}>
              <h2 className={`text-[20px] font-semibold ${isDark ? "text-white" : ""}`}>Statistics</h2>
              <article className="w-full h-full grid grid-cols-3 gap-x-[15px] gap-y-[15px]" aria-label="Pool Statistics">
                {(isMultiAsset ? aquariusAnalyticsItems : analyticsItems).map((item, idx) => (
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
