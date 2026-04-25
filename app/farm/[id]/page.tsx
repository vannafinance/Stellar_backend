"use client";

import { useParams } from "next/navigation";
import { useFarmStore } from "@/store/farm-store";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/theme-context";
import Image from "next/image";
import { useMemo, useState, useCallback, useEffect, memo } from "react";
import { iconPaths } from "@/lib/constants";
import { AccountStatsGhost } from "@/components/earn/account-stats-ghost";
import { Chart } from "@/components/earn/chart";
import { Table } from "@/components/earn/table";
import { transactionTableHeadings } from "@/components/earn/acitivity-tab";
import { Form } from "@/components/farm/form";
import { singleAssetTableBody } from "@/lib/constants/farm";
import { AQUARIUS_POOLS } from "@/lib/aquarius-utils";
import { SOROSWAP_POOLS } from "@/lib/soroswap-utils";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { items } from "@/components/earn/details-tab";
import { StatsCard } from "@/components/ui/stats-card";
import { ChevronLeftIcon, SortIcon, CompassIcon, ShareIcon, MinusIcon, PlusIcon, WarningIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FarmStatsCard } from "@/components/farm/stats";
import { RangeSelector } from "@/components/farm/range-selector";
import { DepositTokensForm } from "@/components/farm/deposit-tokens-form";
import { farmStatsData, farmLiquidationStatsData } from "@/lib/constants/farm";
import { useUserStore } from "@/store/user";
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
import { useSoroswapPoolStats, useSoroswapLpPosition, useSoroswapEvents } from "@/hooks/use-soroswap";
import { useMarginAccountInfoStore } from "@/store/margin-account-info-store";
import { useBlendStore } from "@/store/blend-store";
import { buildFarmPoolKey, getFarmHistory } from "@/lib/farm-history";

const UI_TABS = [
  { id: "all-transactions", label: "All Transactions" },
  { id: "analytics", label: "Analytics" },
];

const positionTableHeadings = [
  { label: "Asset", id: "asset" },
  { label: "b-Tokens", id: "b-tokens" },
  { label: "Value", id: "underlying" },
  { label: "APY", id: "supply-apy" },
  { label: "b-Rate", id: "b-rate" },
];

const FarmHeaderStats = memo(function FarmHeaderStats({
  tokenSymbol,
  isSoroswapEarly,
  matchedSoroswapPool,
}: {
  tokenSymbol: 'XLM' | 'USDC' | null;
  isSoroswapEarly: boolean;
  matchedSoroswapPool: { tokens: string[] } | null;
}) {
  const { stats: poolStats, isLoading: statsLoading } = useBlendPoolStats();
  const { stats: ssStats, isLoading: ssStatsLoading } = useSoroswapPoolStats(isSoroswapEarly);

  const reserveData = tokenSymbol ? poolStats[tokenSymbol] : null;
  const ssTokenA = matchedSoroswapPool?.tokens[0] ?? 'XLM';
  const ssTokenB = matchedSoroswapPool?.tokens[1] ?? 'USDC';

  const items = useMemo(() => {
    if (isSoroswapEarly) {
      return [
        { id: "reserveXLM", name: `${ssTokenA} Reserve`, amount: ssStatsLoading ? "..." : ssStats ? `${parseFloat(ssStats.reserveXLM).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ssTokenA}` : "N/A" },
        { id: "reserveUSDC", name: `${ssTokenB} Reserve`, amount: ssStatsLoading ? "..." : ssStats ? `${parseFloat(ssStats.reserveUSDC).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ssTokenB}` : "N/A" },
        { id: "fee", name: "Fee Rate", amount: ssStats?.feeFraction ?? (ssStatsLoading ? "..." : "N/A") },
        { id: "totalShares", name: "Total LP Shares", amount: ssStatsLoading ? "..." : ssStats ? parseFloat(ssStats.totalShares).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "N/A" },
      ];
    }
    return [
      { id: "supplyApy", name: "Supply APY", amount: statsLoading ? "..." : reserveData ? `${reserveData.supplyAPY}%` : "N/A" },
      { id: "borrowApy", name: "Borrow APY", amount: statsLoading ? "..." : reserveData ? `${reserveData.borrowAPY}%` : "N/A" },
      { id: "utilization", name: "Utilization Rate", amount: statsLoading ? "..." : reserveData ? `${reserveData.utilizationRate}%` : "N/A" },
      { id: "totalSupply", name: "Total Pool Supply", amount: statsLoading ? "..." : reserveData ? `${parseFloat(reserveData.totalSupply).toLocaleString()} ${tokenSymbol}` : "N/A" },
    ];
  }, [isSoroswapEarly, ssStats, ssStatsLoading, ssTokenA, ssTokenB, reserveData, statsLoading, tokenSymbol]);

  return <AccountStatsGhost items={items} />;
});

export default function FarmDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { isDark } = useTheme();

  const [activeUiTab, setActiveUiTab] = useState<string>("all-transactions");
  const [activeTab, setActiveTab] = useState<string>("current-position");
  const [showAddLiquidity, setShowAddLiquidity] = useState(false);

  const userAddress = useUserStore((state) => state.address);

  // Determine which token this page is for (xlm / usdc)
  const tokenSymbol = useMemo((): 'XLM' | 'USDC' | null => {
    const upper = id?.toUpperCase();
    if (upper === 'XLM') return 'XLM';
    if (upper === 'USDC') return 'USDC';
    return null;
  }, [id]);

  // Row type detection (multi-asset = Aquarius/Soroswap, single = Blend)
  const selectedRow = useFarmStore((state) => state.selectedRow);
  const tabType = useFarmStore((state) => state.tabType);

  // Detect pool type early so hooks can be called unconditionally
  const isSoroswapEarly = id?.startsWith('soroswap-') ?? false;
  const isAquariusEarly = !isSoroswapEarly && (
    tabType === 'multi' ||
    (id != null && !['xlm', 'usdc'].includes(id.toLowerCase()))
  );

  // Match Aquarius pool config
  const matchedPool = useMemo(() => {
    if (!isAquariusEarly) return null;
    return AQUARIUS_POOLS.find((p) =>
      p.id === id?.toLowerCase() ||
      p.tokens.join('-').toLowerCase() === id?.toLowerCase()
    ) ?? AQUARIUS_POOLS[0];
  }, [isAquariusEarly, id]);

  const aquariusPoolAddress = matchedPool?.poolAddress ?? null;

  // Match Soroswap pool config
  const matchedSoroswapPool = useMemo(() => {
    if (!isSoroswapEarly) return null;
    return SOROSWAP_POOLS.find((p) => p.id === id) ?? SOROSWAP_POOLS[0];
  }, [isSoroswapEarly, id]);

  const isBlendPool = !isSoroswapEarly && !isAquariusEarly;

  // Real data hooks — Blend (single-asset)
  const { stats: poolStats, isLoading: statsLoading } = useBlendPoolStats(isBlendPool);
  const { positions: userPositions, isLoading: posLoading } = useUserBlendPositions();
  const { events, isLoading: eventsLoading } = useBlendEvents(tokenSymbol ?? undefined);
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);
  const refreshKey = useBlendStore((s) => s.refreshKey);

  // Real data hooks — Aquarius (multi-asset)
  const { stats: aqStats, isLoading: aqStatsLoading } = useAquariusPoolStats(aquariusPoolAddress);
  const { lpBalance } = useAquariusLpPosition(marginAccountAddress, aquariusPoolAddress);
  const { events: aqEvents } = useAquariusEvents(aquariusPoolAddress, marginAccountAddress);

  // Real data hooks — Soroswap (multi-asset)
  const { stats: ssStats, isLoading: ssStatsLoading } = useSoroswapPoolStats(isSoroswapEarly);
  const { lpBalance: ssLpBalanceRaw } = useSoroswapLpPosition(marginAccountAddress);
  const mySSLpBalance = parseFloat(ssLpBalanceRaw ?? '0');
  const { events: ssEvents } = useSoroswapEvents(ssStats?.pairAddress, marginAccountAddress);
  const ssTokenA = matchedSoroswapPool?.tokens[0] ?? 'XLM';
  const ssTokenB = matchedSoroswapPool?.tokens[1] ?? 'USDC';

  const blendLocalHistory = useMemo(
    () =>
      getFarmHistory({
        protocol: "blend",
        poolKey: buildFarmPoolKey(tokenSymbol ?? "XLM"),
        marginAccountAddress,
      }),
    [tokenSymbol, marginAccountAddress, refreshKey]
  );

  const aquariusLocalHistory = useMemo(
    () =>
      getFarmHistory({
        protocol: "aquarius",
        poolKey: buildFarmPoolKey(matchedPool?.tokens[0] ?? "XLM", matchedPool?.tokens[1] ?? "USDC"),
        marginAccountAddress,
      }),
    [matchedPool, marginAccountAddress, refreshKey]
  );

  const soroswapLocalHistory = useMemo(
    () =>
      getFarmHistory({
        protocol: "soroswap",
        poolKey: buildFarmPoolKey(ssTokenA, ssTokenB),
        marginAccountAddress,
      }),
    [ssTokenA, ssTokenB, marginAccountAddress, refreshKey]
  );

  const reserveData = tokenSymbol ? poolStats[tokenSymbol] : null;

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
  const mergedBlendHistory = useMemo(() => {
    const normalizedOnchain = events.map((ev) => ({
      timestamp: ev.timestamp ?? 0,
      action: ev.type === "supply" ? "add" : "remove",
      amountDisplay: `${ev.underlyingAmount} ${ev.tokenSymbol}`,
      txHash: ev.txHash ?? "",
    }));

    const onchainHashes = new Set(
      normalizedOnchain.map((item) => item.txHash).filter((hash) => Boolean(hash))
    );

    const normalizedLocal = blendLocalHistory
      .filter((item) => !item.txHash || !onchainHashes.has(item.txHash))
      .map((item) => ({
        timestamp: item.timestamp,
        action: item.action,
        amountDisplay: item.amountDisplay,
        txHash: item.txHash,
      }));

    return [...normalizedOnchain, ...normalizedLocal].sort((a, b) => b.timestamp - a.timestamp);
  }, [events, blendLocalHistory]);

  const positionHistoryBody = useMemo(() => {
    if (mergedBlendHistory.length === 0) return { rows: [] };
    return {
      rows: mergedBlendHistory.map((ev) => ({
        cell: [
          {
            title: ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() : '—',
            description: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '',
          },
          {
            title: ev.action === 'add' ? 'Supply' : 'Withdraw',
            badge: ev.action === 'add' ? 'green' : 'orange',
          },
          { title: ev.amountDisplay },
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
  }, [mergedBlendHistory]);

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

  const aquariusPositionHeadings = useMemo(() => [
    { label: "Pool", id: "pool" },
    { label: "LP Shares", id: "lp-shares" },
    { label: `${poolTokenA} Deposited`, id: "token-a" },
    { label: `${poolTokenB} Deposited`, id: "token-b" },
    { label: "Fee Rate", id: "fee-rate" },
  ], [poolTokenA, poolTokenB]);

  const aquariusCurrentPositionBody = useMemo(() => {
    if (myLpBalance <= 0) return { rows: [] };
    // Estimate underlying assets proportional to LP share
    const totalSharesNum = parseFloat(aqStats?.totalShares ?? '0');
    const ratio = totalSharesNum > 0 ? myLpBalance / totalSharesNum : 0;
    const xlmShare = (parseFloat(aqStats?.reserveA ?? '0') * ratio).toFixed(2);
    const usdcShare = (parseFloat(aqStats?.reserveB ?? '0') * ratio).toFixed(2);
    return {
      rows: [{
        cell: [
          { chain: poolTokenA, title: `${poolTokenA} / ${poolTokenB}`, tags: ['Aquarius', 'LP'] },
          { title: `${myLpBalance.toFixed(2)} LP` },
          { title: `${xlmShare} ${poolTokenA}` },
          { title: `${usdcShare} ${poolTokenB}` },
          { title: aqStats?.feeFraction ?? '—' },
        ],
      }],
    };
  }, [myLpBalance, aqStats]);

  // Aquarius position history table
  const mergedAquariusHistory = useMemo(() => {
    const normalizedOnchain = aqEvents.map((ev) => ({
      timestamp: ev.timestamp ?? 0,
      action: ev.type === "deposit" ? "add" : "remove",
      amountDisplay: `${ev.shareAmount} LP`,
      txHash: ev.txHash ?? "",
    }));

    const onchainHashes = new Set(
      normalizedOnchain.map((item) => item.txHash).filter((hash) => Boolean(hash))
    );

    const normalizedLocal = aquariusLocalHistory
      .filter((item) => !item.txHash || !onchainHashes.has(item.txHash))
      .map((item) => ({
        timestamp: item.timestamp,
        action: item.action,
        amountDisplay: item.amountDisplay,
        txHash: item.txHash,
      }));

    return [...normalizedOnchain, ...normalizedLocal].sort((a, b) => b.timestamp - a.timestamp);
  }, [aqEvents, aquariusLocalHistory]);

  const aquariusHistoryBody = useMemo(() => {
    if (mergedAquariusHistory.length === 0) return { rows: [] };
    return {
      rows: mergedAquariusHistory.map((ev) => ({
        cell: [
          {
            title: ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() : '—',
            description: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '',
          },
          {
            title: ev.action === 'add' ? 'Add Liquidity' : 'Remove Liquidity',
            badge: ev.action === 'add' ? 'green' : 'orange',
          },
          { title: ev.amountDisplay },
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
  }, [mergedAquariusHistory]);

  // Aquarius analytics cards
  const aquariusAnalyticsItems = useMemo(() => [
    { heading: `${poolTokenA} Reserve`, mainInfo: `${parseFloat(aqStats?.reserveA ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 })} ${poolTokenA}`, subInfo: `Current ${poolTokenA} reserve in pool`, tooltip: `Total ${poolTokenA} held by the Aquarius pool` },
    { heading: `${poolTokenB} Reserve`, mainInfo: `${parseFloat(aqStats?.reserveB ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 })} ${poolTokenB}`, subInfo: `Current ${poolTokenB} reserve in pool`, tooltip: `Total ${poolTokenB} held by the Aquarius pool` },
    { heading: 'Fee Rate', mainInfo: aqStats?.feeFraction ?? '—', subInfo: 'Swap fee per trade', tooltip: 'Fee split between LPs' },
    { heading: 'Total LP Shares', mainInfo: parseFloat(aqStats?.totalShares ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 }), subInfo: 'Total outstanding LP tokens', tooltip: 'Sum of all LP shares minted' },
    { heading: 'Your LP Balance', mainInfo: myLpBalance.toFixed(4), subInfo: 'Your margin account LP shares', tooltip: 'LP tokens held by your margin account' },
  ], [aqStats, myLpBalance, poolTokenA, poolTokenB]);

  // ── Soroswap computed values ──

  // Soroswap stats strip
  const soroswapStatsItems = useMemo(() => [
    {
      id: "reserveXLM",
      name: `${ssTokenA} Reserve`,
      amount: ssStatsLoading ? "..." : ssStats ? `${parseFloat(ssStats.reserveXLM).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ssTokenA}` : "N/A",
    },
    {
      id: "reserveUSDC",
      name: `${ssTokenB} Reserve`,
      amount: ssStatsLoading ? "..." : ssStats ? `${parseFloat(ssStats.reserveUSDC).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ssTokenB}` : "N/A",
    },
    {
      id: "fee",
      name: "Fee Rate",
      amount: ssStats?.feeFraction ?? (ssStatsLoading ? "..." : "N/A"),
    },
    {
      id: "totalShares",
      name: "Total LP Shares",
      amount: ssStatsLoading ? "..." : ssStats ? parseFloat(ssStats.totalShares).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "N/A",
    },
  ], [ssStats, ssStatsLoading, ssTokenA, ssTokenB]);

  // Soroswap LP chart data — built from on-chain events + current balance
  const ssChartData = useMemo(
    () => buildLpChartData(ssEvents, mySSLpBalance),
    [ssEvents, mySSLpBalance]
  );

  // Soroswap position history table
  const mergedSoroswapHistory = useMemo(() => {
    const normalizedOnchain = ssEvents.map((ev) => ({
      timestamp: ev.timestamp ?? 0,
      action: ev.type === "deposit" ? "add" : "remove",
      amountDisplay: `${ev.shareAmount} LP`,
      txHash: ev.txHash ?? "",
    }));

    const onchainHashes = new Set(
      normalizedOnchain.map((item) => item.txHash).filter((hash) => Boolean(hash))
    );

    const normalizedLocal = soroswapLocalHistory
      .filter((item) => !item.txHash || !onchainHashes.has(item.txHash))
      .map((item) => ({
        timestamp: item.timestamp,
        action: item.action,
        amountDisplay: item.amountDisplay,
        txHash: item.txHash,
      }));

    return [...normalizedOnchain, ...normalizedLocal].sort((a, b) => b.timestamp - a.timestamp);
  }, [ssEvents, soroswapLocalHistory]);

  const soroswapHistoryBody = useMemo(() => {
    if (mergedSoroswapHistory.length === 0) return { rows: [] };
    return {
      rows: mergedSoroswapHistory.map((ev) => ({
        cell: [
          {
            title: ev.timestamp ? new Date(ev.timestamp).toLocaleDateString() : '—',
            description: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '',
          },
          {
            title: ev.action === 'add' ? 'Add Liquidity' : 'Remove Liquidity',
            badge: ev.action === 'add' ? 'green' : 'orange',
          },
          { title: ev.amountDisplay },
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
  }, [mergedSoroswapHistory]);

  // Soroswap position table headings
  const soroswapPositionHeadings = useMemo(() => [
    { label: "Pool", id: "pool" },
    { label: "LP Shares", id: "lp-shares" },
    { label: `${ssTokenA} Deposited`, id: "token-a" },
    { label: `${ssTokenB} Deposited`, id: "token-b" },
    { label: "Fee Rate", id: "fee-rate" },
  ], [ssTokenA, ssTokenB]);

  // Soroswap current position
  const soroswapCurrentPositionBody = useMemo(() => {
    if (mySSLpBalance <= 0) return { rows: [] };
    const totalSharesNum = parseFloat(ssStats?.totalShares ?? '0');
    const ratio = totalSharesNum > 0 ? mySSLpBalance / totalSharesNum : 0;
    const xlmShare = (parseFloat(ssStats?.reserveXLM ?? '0') * ratio).toFixed(2);
    const usdcShare = (parseFloat(ssStats?.reserveUSDC ?? '0') * ratio).toFixed(2);
    return {
      rows: [{
        cell: [
          { chain: ssTokenA, title: `${ssTokenA} / ${ssTokenB}`, tags: ['Soroswap', 'LP'] },
          { title: `${mySSLpBalance.toFixed(2)} LP` },
          { title: `${xlmShare} ${ssTokenA}` },
          { title: `${usdcShare} ${ssTokenB}` },
          { title: ssStats?.feeFraction ?? '—' },
        ],
      }],
    };
  }, [mySSLpBalance, ssStats, ssTokenA, ssTokenB]);

  // Route "All Transactions" table to the correct data source for the current pool type.
  const detailTableHeadings = useMemo(() => {
    if (activeTab !== "current-position") return transactionTableHeadings;
    if (isSoroswapEarly) return soroswapPositionHeadings;
    if (isAquariusEarly) return aquariusPositionHeadings;
    return positionTableHeadings;
  }, [activeTab, isSoroswapEarly, isAquariusEarly, soroswapPositionHeadings, aquariusPositionHeadings]);

  const detailTableBody = useMemo(() => {
    if (activeTab === "current-position") {
      if (isSoroswapEarly) return soroswapCurrentPositionBody;
      if (isAquariusEarly) return aquariusCurrentPositionBody;
      return currentPositionBody;
    }

    if (isSoroswapEarly) return soroswapHistoryBody;
    if (isAquariusEarly) return aquariusHistoryBody;
    return positionHistoryBody;
  }, [
    activeTab,
    isSoroswapEarly,
    isAquariusEarly,
    soroswapCurrentPositionBody,
    aquariusCurrentPositionBody,
    currentPositionBody,
    soroswapHistoryBody,
    aquariusHistoryBody,
    positionHistoryBody,
  ]);

  const detailChart = useMemo(() => {
    if (isSoroswapEarly) {
      return {
        heading: "My LP Position",
        uptrend: mySSLpBalance > 0 ? `${mySSLpBalance.toFixed(4)} LP shares` : undefined,
        data: ssChartData,
      };
    }

    if (isAquariusEarly) {
      return {
        heading: "My LP Position",
        uptrend: myLpBalance > 0 ? `${myLpBalance.toFixed(4)} LP shares` : undefined,
        data: aqChartData,
      };
    }

    return {
      heading: chartHeading,
      uptrend: myUnderlying > 0 ? `${myUnderlying.toFixed(4)} ${tokenSymbol} supplied` : undefined,
      data: chartLiveData,
    };
  }, [
    isSoroswapEarly,
    isAquariusEarly,
    mySSLpBalance,
    myLpBalance,
    ssChartData,
    aqChartData,
    chartHeading,
    myUnderlying,
    tokenSymbol,
    chartLiveData,
  ]);

  // Soroswap analytics cards
  const soroswapAnalyticsItems = useMemo(() => [
    { heading: `${ssTokenA} Reserve`, mainInfo: `${parseFloat(ssStats?.reserveXLM ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ssTokenA}`, subInfo: `Current ${ssTokenA} reserve in pool`, tooltip: `Total ${ssTokenA} held by the Soroswap pool` },
    { heading: `${ssTokenB} Reserve`, mainInfo: `${parseFloat(ssStats?.reserveUSDC ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 })} ${ssTokenB}`, subInfo: `Current ${ssTokenB} reserve in pool`, tooltip: `Total ${ssTokenB} held by the Soroswap pool` },
    { heading: 'Fee Rate', mainInfo: ssStats?.feeFraction ?? '—', subInfo: 'Swap fee per trade', tooltip: 'Fee split between LPs' },
    { heading: 'Total LP Shares', mainInfo: parseFloat(ssStats?.totalShares ?? '0').toLocaleString(undefined, { maximumFractionDigits: 2 }), subInfo: 'Total outstanding LP tokens', tooltip: 'Sum of all LP shares minted' },
    { heading: 'Your LP Balance', mainInfo: mySSLpBalance.toFixed(4), subInfo: 'Your margin account LP shares', tooltip: 'LP tokens held by your margin account' },
  ], [ssStats, mySSLpBalance, ssTokenA, ssTokenB]);

  const findRowFromId = useCallback((searchId: string) => {
    for (const row of singleAssetTableBody.rows) {
      const firstCell = row.cell?.[0];
      if (firstCell?.title) {
        const rowId = firstCell.title.toLowerCase().replace(/\s+/g, "-");
        if (rowId === searchId.toLowerCase()) return { row, tabType: "single" as const };
      }
    }
    // Match against SOROSWAP_POOLS by pool id
    for (const pool of SOROSWAP_POOLS) {
      if (pool.id === searchId.toLowerCase()) {
        const row = {
          cell: [
            { chain: pool.tokens[0], titles: pool.tokens, tags: ['Soroswap', (pool.feeFraction / 100).toFixed(2) + '%', 'Testnet'] },
            { title: 'Soroswap' },
          ],
        };
        return { row, tabType: "multi" as const };
      }
    }
    // Match against AQUARIUS_POOLS by pool id or token pair
    for (const pool of AQUARIUS_POOLS) {
      const poolId = pool.tokens.join("-").toLowerCase();
      if (pool.id === searchId.toLowerCase() || poolId === searchId.toLowerCase()) {
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

  const isMultiAsset = false;

  // Range selector state for multi-asset add liquidity
  const [usdcRangeMin, setUsdcRangeMin] = useState(0.0001);
  const [usdcRangeMax, setUsdcRangeMax] = useState(0.0004);
  const [ethRangeMin, setEthRangeMin] = useState(0.0001);
  const [ethRangeMax, setEthRangeMax] = useState(0.0004);

  const usdcChartData = useMemo(() => {
    const data: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 50; i++) {
      const x = (i / 50) * 0.0005;
      const norm = (x - 0.00025) / 0.0001;
      const y = Math.max(10, Math.exp(-(norm * norm) / 2) * 100 + (Math.sin(i * 0.5) + 1) * 10);
      data.push({ x, y });
    }
    return data;
  }, []);

  const ethChartData = useMemo(() => {
    const data: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 50; i++) {
      const x = (i / 50) * 0.0005;
      const norm2 = (x - 0.0003) / 0.00012;
      const y = Math.max(10, Math.exp(-(norm2 * norm2) / 2) * 100 + (Math.cos(i * 0.4) + 1) * 10);
      data.push({ x, y });
    }
    return data;
  }, []);

  const handleUsdcRangeChange = useCallback((min: number, max: number) => { setUsdcRangeMin(min); setUsdcRangeMax(max); }, []);
  const handleEthRangeChange = useCallback((min: number, max: number) => { setEthRangeMin(min); setEthRangeMax(max); }, []);

  const minPrice = useMemo(() => ethRangeMin === 0 ? "0.0000" : (usdcRangeMin / ethRangeMin).toFixed(4), [usdcRangeMin, ethRangeMin]);
  const maxPrice = useMemo(() => ethRangeMax === 0 ? "0.0000" : (usdcRangeMax / ethRangeMax).toFixed(4), [usdcRangeMax, ethRangeMax]);
  const [minPriceInput, setMinPriceInput] = useState(minPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPrice);
  useEffect(() => { setMinPriceInput(minPrice); setMaxPriceInput(maxPrice); }, [minPrice, maxPrice]);
  const handlePriceInputChange = useCallback((value: string, setter: (val: string) => void) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    setter(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized);
  }, []);

  return (
    <main className="flex flex-col gap-5">
      {/* Header */}
      <header className="pt-4 sm:pt-5 px-4 sm:px-10 lg:px-30 w-full">
        <div className="w-full flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex flex-col gap-3">
            <nav aria-label="Breadcrumb">
              <button type="button" onClick={() => router.push("/farm")}
                className={`w-fit h-fit flex gap-2 items-center cursor-pointer text-[15px] font-medium hover:text-[#703AE6] transition-colors ${isDark ? "text-white" : "text-[#5A5555]"}`}
              >
                <ChevronLeftIcon />
                Back to pools
              </button>
            </nav>
            <div className="flex gap-2 items-center">
              {isMultiAsset ? (
                <div className="flex items-center -space-x-[12px] shrink-0">
                  {farmData.titles?.map((titleName: string, iconIdx: number) => {
                    const assetIconPath = iconPaths[titleName.toUpperCase()];
                    if (!assetIconPath) return null;
                    return (<Image key={iconIdx} src={assetIconPath} alt={titleName} width={24} height={24} className={`rounded-full w-6 h-6 sm:w-7 sm:h-7 ${isDark ? "border border-black" : "border border-white"}`} />);
                  })}
                </div>
              ) : (
                <Image src={iconPath} alt={`${farmData.title}-icon`} width={24} height={24} className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
              )}
              <h1 className={`text-[18px] sm:text-[20px] font-bold shrink-0 ${isDark ? "text-white" : "text-[#181822]"}`}>{farmData.title}</h1>
              <div className="flex gap-1 items-center shrink-0">
                {farmData.tags.slice(0, 2).map((tag: string | number, i: number) => (
                  <span key={i} className="text-[10px] sm:text-[12px] font-semibold text-center rounded px-1.5 py-0.5 bg-[#703AE6] text-white">{tag}</span>
                ))}
              </div>
              {isMultiAsset && (
                <div className="flex gap-1 items-center shrink-0">
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${isDark ? "bg-[#333]" : "bg-[#F4F4F4]"}`}><SortIcon fill={isDark ? "#FFFFFF" : "#111111"} /></div>
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${isDark ? "bg-[#333]" : "bg-[#F4F4F4]"}`}><CompassIcon fill={isDark ? "#FFFFFF" : "#111111"} /></div>
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center ${isDark ? "bg-[#333]" : "bg-[#F4F4F4]"}`}><ShareIcon fill={isDark ? "#FFFFFF" : "#111111"} /></div>
                </div>
              )}
            </div>
          </div>
          {isMultiAsset && !showAddLiquidity && (
            <div className="w-fit h-fit shrink-0">
              <Button type="solid" size="small" disabled={!userAddress} text="+ Add Liquidity" onClick={() => setShowAddLiquidity(true)} />
            </div>
          )}
        </div>
      </header>

      {!isMultiAsset && (
        <section className="px-4 sm:px-10 lg:px-30" aria-label="Pool Statistics">
          {isAquariusEarly ? (
            <AccountStatsGhost items={aquariusStatsItems} />
          ) : isSoroswapEarly ? (
            <AccountStatsGhost items={soroswapStatsItems} />
          ) : (
            <FarmHeaderStats tokenSymbol={tokenSymbol} isSoroswapEarly={isSoroswapEarly} matchedSoroswapPool={matchedSoroswapPool} />
          )}
        </section>
      )}

      {/* Main content */}
      <section className="px-4 sm:px-10 lg:px-30 pt-1 pb-24 xl:pb-16 w-full">
        <div className="flex flex-col xl:flex-row gap-4 w-full">

          {/* Article — left/main content */}
          <article className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Single asset: tabs + content */}
            {!isMultiAsset && (
              <>
                <nav className="w-full">
                  <AnimatedTabs tabs={UI_TABS} activeTab={activeUiTab} onTabChange={setActiveUiTab} type="border"
                    containerClassName={`w-full rounded-xl border p-1 ${isDark ? "bg-[#111111] border-[#333333]" : "bg-white border-[#E5E7EB]"}`}
                    tabClassName="!flex-1 !px-2 text-[12px]"
                  />
                </nav>
                {activeUiTab === "all-transactions" ? (
                  <div className={`w-full flex flex-col gap-6 rounded-2xl border p-4 sm:p-6 ${isDark ? "bg-[#111111] border-[#2A2A2A]" : "bg-[#F7F7F7] border-[#E8E8E8]"}`}>
                    <Chart
                      type="farm"
                      heading={detailChart.heading}
                      uptrend={detailChart.uptrend}
                      customData={detailChart.data.length > 0 ? detailChart.data : undefined}
                    />
                    <Table filterDropdownPosition="right" tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
                      heading={{ heading: "All Transactions", tabsItems: [{ id: "current-position", label: "Current Position" }, { id: "position-history", label: "Position History" }], tabType: "solid" }}
                      activeTab={activeTab} onTabChange={setActiveTab} filters={{ filters: ["All"], customizeDropdown: true }}
                      tableHeadings={detailTableHeadings}
                      tableBody={detailTableBody}
                    />
                  </div>
                ) : (
                  <div className={`w-full flex flex-col gap-6 rounded-2xl border p-4 sm:p-6 ${isDark ? "bg-[#111111] border-[#2A2A2A]" : "bg-[#F7F7F7] border-[#E8E8E8]"}`}>
                    <h2 className={`text-[21px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>Statistics</h2>
                    <article className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
                      {(isSoroswapEarly ? soroswapAnalyticsItems : isAquariusEarly ? aquariusAnalyticsItems : analyticsItems).map((item, idx) => (<StatsCard key={idx} heading={item.heading} mainInfo={item.mainInfo} subInfo={item.subInfo} tooltip={item.tooltip} />))}
                    </article>
                  </div>
                )}
              </>
            )}

            {/* Multi asset: no tabs, different layout for default vs add-liquidity */}
            {isMultiAsset && (
              <>
                {showAddLiquidity ? (
                  <div className="w-full flex flex-col gap-3">
                    <div className={`w-full rounded-2xl border p-4 sm:p-6 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-[#F7F7F7] border-[#E8E8E8]"}`}>
                      <RangeSelector
                        token1Name={farmData.titles?.[0] || "Token A"}
                        token2Name={farmData.titles?.[1] || "Token B"}
                        token1ChartData={usdcChartData} token2ChartData={ethChartData}
                        token1MinValue={usdcRangeMin} token1MaxValue={usdcRangeMax}
                        token2MinValue={ethRangeMin} token2MaxValue={ethRangeMax}
                        onToken1RangeChange={handleUsdcRangeChange} onToken2RangeChange={handleEthRangeChange}
                        height={250}
                        xAxisLabels={["0.0000", "0.0001", "0.0002", "0.0003", "0.0004", "0.0005"]}
                        showControls={true}
                      />
                    </div>
                    <div className={`w-full flex flex-col sm:flex-row rounded-2xl border p-4 sm:p-5 gap-3 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-[#F7F7F7] border-[#E8E8E8]"}`}>
                      {[{ label: "Max Price", value: maxPriceInput, setter: setMaxPriceInput, ariaKey: "Maximum" }, { label: "Min Price", value: minPriceInput, setter: setMinPriceInput, ariaKey: "Minimum" }].map(({ label, value, setter, ariaKey }) => (
                        <div key={label} className={`w-full flex flex-col gap-5 rounded-xl border p-4 sm:p-5 ${isDark ? "bg-[#111111] border-[#2A2A2A]" : "bg-white border-[#E8E8E8]"}`}>
                          <div>
                            <h3 className={`text-[15px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>{label}</h3>
                            <p className="text-[12px] text-[#A7A7A7]">{farmData.title.split(" / ")[0]} per {farmData.title.split(" / ")[1]}</p>
                          </div>
                          <div className="flex justify-between items-center">
                            <input type="text" value={value} onChange={(e) => handlePriceInputChange(e.target.value, setter)}
                              className={`w-full text-[24px] font-bold outline-none bg-transparent ${isDark ? "text-white" : "text-[#111827]"}`}
                              placeholder="0.0000" aria-label={`${ariaKey} price`} inputMode="decimal"
                            />
                            <div className="flex gap-1">
                              <button type="button" disabled={!userAddress} className={`w-6 h-6 rounded flex items-center justify-center disabled:opacity-50 ${isDark ? "bg-[#2A2A2A]" : "bg-[#F1EBFD]"}`}><MinusIcon /></button>
                              <button type="button" disabled={!userAddress} className={`w-6 h-6 rounded flex items-center justify-center disabled:opacity-50 ${isDark ? "bg-[#2A2A2A]" : "bg-[#F1EBFD]"}`}><PlusIcon /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={`w-full flex flex-col gap-6 rounded-2xl border p-4 sm:p-6 ${isDark ? "bg-[#111111] border-[#2A2A2A]" : "bg-[#F7F7F7] border-[#E8E8E8]"}`}>
                    {isSoroswapEarly ? (
                      <Chart type="farm" heading="My LP Position" uptrend={mySSLpBalance > 0 ? `${mySSLpBalance.toFixed(4)} LP shares` : undefined} customData={ssChartData.length > 0 ? ssChartData : undefined} />
                    ) : (
                      <Chart type="farm" heading="My LP Position" uptrend={myLpBalance > 0 ? `${myLpBalance.toFixed(4)} LP shares` : undefined} customData={aqChartData.length > 0 ? aqChartData : undefined} />
                    )}
                    <Table filterDropdownPosition="right" tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
                      heading={{ heading: "Your Transactions", tabsItems: [{ id: "current-position", label: "Current Position" }, { id: "position-history", label: "Position History" }], tabType: "solid" }}
                      activeTab={activeTab} onTabChange={setActiveTab} filters={{ filters: ["All"], customizeDropdown: true }}
                      tableHeadings={activeTab === "current-position" ? (isSoroswapEarly ? soroswapPositionHeadings : aquariusPositionHeadings) : transactionTableHeadings}
                      tableBody={activeTab === "current-position" ? (isSoroswapEarly ? soroswapCurrentPositionBody : aquariusCurrentPositionBody) : (isSoroswapEarly ? soroswapHistoryBody : aquariusHistoryBody)}
                    />
                    <Table filterDropdownPosition="right" tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
                      heading={{ heading: "All Transactions" }} filters={{ filters: ["All"] }}
                      tableHeadings={transactionTableHeadings}
                      tableBody={isSoroswapEarly ? soroswapHistoryBody : aquariusHistoryBody}
                    />
                  </div>
                )}
              </>
            )}
          </article>

          {/* Aside — right sticky panel */}
          <aside className="w-full xl:w-[420px] shrink-0 flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
            {!isMultiAsset && <Form />}

            {isMultiAsset && !showAddLiquidity && (
              <FarmStatsCard items={farmStatsData} />
            )}

            {isMultiAsset && showAddLiquidity && (
              <>
                {!userAddress && (
                  <div className={`w-full rounded-xl border p-4 flex items-center gap-3 ${isDark ? "bg-[#1A1A1A] border-[#595959] text-white" : "bg-[#FFF9E6] border-[#FFD700] text-[#111111]"}`} role="alert">
                    <WarningIcon />
                    <span className="text-[14px] font-medium">Connect your wallet to add liquidity</span>
                  </div>
                )}
                <DepositTokensForm assets={[farmData.title.split(" / ")[0] || "Token A", farmData.title.split(" / ")[1] || "Token B"]} />
                <FarmStatsCard items={farmLiquidationStatsData} />
              </>
            )}

            {/* How it works — single asset only */}
            {!isMultiAsset && (
              <div className={`w-full rounded-2xl border p-4 flex flex-col gap-3 ${isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-[#EEEEEE]"}`}>
                <p className={`text-[13px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>How it works</p>
                <div className="flex flex-col gap-3">
                  {[
                    { step: "1", title: "Choose a pool", desc: "Select a farm pool matching your strategy and risk appetite" },
                    { step: "2", title: "Deposit assets", desc: "Supply tokens to earn LP fees and farm rewards automatically" },
                    { step: "3", title: "Earn yield", desc: "Trading fees and protocol rewards accrue to your position" },
                    { step: "4", title: "Withdraw anytime", desc: "Redeem your LP position for underlying assets plus earned yield" },
                  ].map((item) => (
                    <div key={item.step} className="flex gap-3 items-start">
                      <div className="w-6 h-6 rounded-full bg-[#703AE6]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[11px] font-bold text-[#703AE6]">{item.step}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className={`text-[12px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>{item.title}</p>
                        <p className={`text-[11px] font-medium ${isDark ? "text-[#777777]" : "text-[#A7A7A7]"}`}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
