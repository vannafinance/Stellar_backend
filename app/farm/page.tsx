"use client";

import { Table } from "@/components/earn/table";
import { AccountStats } from "@/components/margin/account-stats";
import { Carousel } from "@/components/ui/carousel";
import { useTheme } from "@/contexts/theme-context";
import {
  FARM_STATS_ITEMS,
  MARGIN_ACCOUNT_STATS_ITEMS,
  farmTableHeadings,
  singleAssetTableHeadings,
} from "@/lib/constants/farm";
import { useUserStore } from "@/store/user";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFarmStore } from "@/store/farm-store";
import { useBlendPoolStats, useUserBlendPositions, useAllAquariusPoolStats } from "@/hooks/use-farm";
import { useAllSoroswapPoolStats } from "@/hooks/use-soroswap";
import { useMarginAccountInfoStore, refreshBorrowedBalances } from "@/store/margin-account-info-store";
import { useEffect } from "react";

export default function FarmPage() {
  const [activeFilterTab, setActiveFilterTab] = useState<string>("lending-single-assets");
  const [activePositionFilterTab, setActivePositionFilterTab] = useState<string>("current-position");
  const [activeTab, setActiveTab] = useState<string>("vaults");
  const userAddress = useUserStore((state) => state.address);
  const { isDark } = useTheme();

  // Real Blend data
  const { stats: poolStats, isLoading: statsLoading } = useBlendPoolStats();
  const { positions: userPositions } = useUserBlendPositions();
  const aquariusPools = useAllAquariusPoolStats();
  const soroswapPools = useAllSoroswapPoolStats();
  const totalCollateralValue = useMarginAccountInfoStore((s) => s.totalCollateralValue);
  const totalBorrowedValue = useMarginAccountInfoStore((s) => s.totalBorrowedValue);
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);

  useEffect(() => {
    if (!marginAccountAddress) return;
    refreshBorrowedBalances(marginAccountAddress);
  }, [marginAccountAddress]);

  // Build real single-asset table rows from live pool data
  const singleAssetTableBody = useMemo(() => {
    const assets = ['XLM', 'USDC'] as const;
    const rows = assets.map((symbol) => {
      const s = poolStats[symbol];
      const loading = statsLoading;
      const fmt = (v: string | undefined, suffix = '') =>
        loading ? '...' : v ? `${v}${suffix}` : '—';

      return {
        cell: [
          { chain: symbol, title: symbol, tags: ['Blend', 'Supply'] },
          { title: 'Blend' },
          { title: s ? fmt(s.totalSupply, ` ${symbol}`) : '—' },
          { title: s ? fmt(s.totalSupply, ` ${symbol}`) : '—' },
          { title: s ? fmt(s.supplyAPY, '%') : '—' },
          { title: s ? fmt(s.borrowAPY, '%') : '—' },
          { title: s ? fmt(s.utilizationRate, '%') : '—' },
          { title: s ? fmt(s.bRate) : '—' },
        ],
      };
    });
    return { rows };
  }, [poolStats, statsLoading]);

  // Build positions table from user's Blend holdings
  const positionsTableBody = useMemo(() => {
    const assets = ['XLM', 'USDC'] as const;
    const rows = assets
      .filter((sym) => parseFloat(userPositions[sym]?.underlyingValue ?? '0') > 0)
      .map((sym) => {
        const pos = userPositions[sym];
        return {
          cell: [
            { chain: sym, title: sym, tags: ['Blend', 'Supply'] },
            { title: 'Blend' },
            { title: pos.underlyingValue ? `${pos.underlyingValue} ${sym}` : '0' },
            { title: pos.bTokenBalance ? `${pos.bTokenBalance} b${sym}` : '0' },
            { title: poolStats[sym]?.supplyAPY ? `${poolStats[sym]!.supplyAPY}%` : '—' },
            { title: '—' },
            { title: '—' },
            { title: poolStats[sym]?.bRate ?? '—' },
          ],
        };
      });

    if (rows.length === 0) {
      return { rows: [] };
    }
    return { rows };
  }, [userPositions, poolStats]);

  // Build LP/Multiple Assets table from live Aquarius + Soroswap pool data
  const lpTableBody = useMemo(() => {
    const aqRows = aquariusPools.map(({ pool, stats, isLoading }) => {
      const [tokenA, tokenB] = pool.tokens;
      const loading = isLoading;
      const tvl = stats
        ? `${parseFloat(stats.reserveA).toFixed(2)} ${tokenA} + ${parseFloat(stats.reserveB).toFixed(2)} ${tokenB}`
        : loading ? '...' : '—';
      const fee = stats ? stats.feeFraction : loading ? '...' : '—';
      const shares = stats ? `${parseFloat(stats.totalShares).toFixed(2)} LP` : loading ? '...' : '—';
      return {
        id: pool.id,
        cell: [
          { chain: tokenA, titles: [tokenA, tokenB], tags: ['Aquarius', pool.feeFraction / 100 + '%', 'Testnet'] },
          { title: 'Aquarius' },
          { title: tvl },
          { title: shares },
          { title: fee },
          { title: '—' },
          { title: '—' },
          { title: '—' },
          { title: '—' },
        ],
      };
    });

    const ssRows = soroswapPools.map(({ pool, stats, isLoading }) => {
      const [tokenA, tokenB] = pool.tokens;
      const loading = isLoading;
      const tvl = stats
        ? `${parseFloat(stats.reserveXLM).toFixed(2)} ${tokenA} + ${parseFloat(stats.reserveUSDC).toFixed(2)} ${tokenB}`
        : loading ? '...' : '—';
      const shares = stats ? `${parseFloat(stats.totalShares).toFixed(2)} LP` : loading ? '...' : '—';
      return {
        id: pool.id,
        cell: [
          { chain: tokenA, titles: [tokenA, tokenB], tags: ['Soroswap', pool.feeFraction / 100 + '%', 'Testnet'] },
          { title: 'Soroswap' },
          { title: tvl },
          { title: shares },
          { title: loading ? '...' : stats ? `${pool.feeFraction / 100}%` : '—' },
          { title: '—' },
          { title: '—' },
          { title: '—' },
          { title: '—' },
        ],
      };
    });

    return { rows: [...ssRows, ...aqRows] };
  }, [aquariusPools, soroswapPools]);

  // Live farm stats values
  const farmStatsValues = useMemo(() => {
    const totalDeposit = parseFloat(userPositions.totalValueXLM ?? '0');
    return {
      depositTVL: totalDeposit > 0 ? `${totalDeposit.toFixed(4)} XLM` : '—',
      earnings: '—',
    };
  }, [userPositions]);

  const marginStatsValues = useMemo(() => ({
    totalCollateral: totalCollateralValue != null ? `$${parseFloat(String(totalCollateralValue)).toFixed(2)}` : '—',
    availableCollateral: null,
    borrowedAssets: totalBorrowedValue != null ? `$${parseFloat(String(totalBorrowedValue)).toFixed(2)}` : '—',
    crossAccountLeverage: null,
    healthFactor: null,
    pnl: null,
    crossMarginRatio: null,
  }), [totalCollateralValue, totalBorrowedValue]);

  // Get filter tab type options based on active tab
  const filterTabTypeOptions = useMemo(() => {
    if (activeTab === "positions") {
      return [
        { id: "current-position", label: "Current Position" },
        { id: "position-history", label: "Position History" }
      ];
    }
    return [
      { id: "lp-multiple-assets", label: "LP/Multiple Assets" },
      { id: "lending-single-assets", label: "Lending/Single Assets" }
    ];
  }, [activeTab]);

  const currentActiveFilterTab = useMemo(() => {
    if (activeTab === "positions") return activePositionFilterTab;
    return activeFilterTab;
  }, [activeTab, activeFilterTab, activePositionFilterTab]);

  const handleFilterTabChange = useCallback((tabId: string) => {
    if (activeTab === "positions") {
      setActivePositionFilterTab(tabId);
    } else {
      setActiveFilterTab(tabId);
    }
  }, [activeTab]);

  const router = useRouter();
  const setFarmData = useFarmStore((state) => state.set);

  const handleRowClick = useCallback((row: any, rowIndex: number) => {
    const tabType = activeFilterTab === "lending-single-assets" ? "single" : "multi";
    const rowId = row.id ||
      row.cell?.[0]?.title?.toLowerCase().replace(/\s+/g, "-") ||
      row.cell?.[0]?.titles?.join("-").toLowerCase().replace(/\s+/g, "-") ||
      `row-${rowIndex}`;
    setFarmData({ selectedRow: row, tabType });
    router.push(`/farm/${rowId}`);
  }, [activeFilterTab, router, setFarmData]);

  const tableData = useMemo(() => {
    if (activeTab === "positions") {
      return {
        headings: singleAssetTableHeadings,
        body: positionsTableBody,
      };
    }
    if (activeFilterTab === "lending-single-assets") {
      return { headings: singleAssetTableHeadings, body: singleAssetTableBody };
    }
    return { headings: farmTableHeadings, body: lpTableBody };
  }, [activeTab, activeFilterTab, singleAssetTableBody, positionsTableBody, lpTableBody]);

  const farmCarouselItems = [
    {
      icon: "",
      title: "Farm DeFi Yields",
      description:
        "Provide liquidity to LP pools and single-asset vaults. Earn trading fees, protocol rewards, and bonus APY — all in one place.",
    },
    {
      icon: "",
      title: "LP & Single Asset Strategies",
      description:
        "Choose from multi-asset LP positions or simple single-asset lending. Flexible strategies to match your risk appetite.",
    },
    {
      icon: "",
      title: "Powered by Vanna Protocol",
      description:
        "All farm strategies are built on audited, battle-tested smart contracts. Your capital is always in your control.",
    },
  ];

  return (
    <main className="w-full px-4 sm:px-10 lg:px-30 pb-8 lg:pb-0">
      {/* Carousel */}
      <section className="w-full pt-4 sm:pt-6 pb-4">
        <Carousel items={farmCarouselItems} autoplayInterval={5000} />
      </section>

      {/* Farm + Margin stats — only shown when wallet connected */}
      {userAddress && FARM_STATS_ITEMS.length > 0 && MARGIN_ACCOUNT_STATS_ITEMS.length > 0 && (
        <section className="w-full mb-6">
          <div className={`w-full p-5 border rounded-2xl flex flex-col gap-8 ${isDark ? "bg-[#222222]" : "bg-[#F7F7F7]"}`}>
            <div className="flex flex-col gap-2">
              <p className={`text-[16px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>Farm Stats</p>
              <AccountStats darkBackgroundColor="#111111" items={FARM_STATS_ITEMS} values={farmStatsValues} gridCols="grid-cols-2" backgroundColor="#FFFFFF" />
            </div>
            <div className="flex flex-col gap-2">
              <p className={`text-[16px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>Margin Account Stats</p>
              <AccountStats darkBackgroundColor="#111111" items={MARGIN_ACCOUNT_STATS_ITEMS} values={marginStatsValues} gridCols="grid-cols-3" backgroundColor="#FFFFFF" />
            </div>
          </div>
        </section>
      )}

      {/* Pool Table */}
      <section className="w-full pb-8">
      <Table
        filterDropdownPosition="left"
        heading={{
          tabsItems: [
            { label: "Vaults", id: "vaults" },
            { label: "Positions", id: "positions" }
          ],
          tabType: "underline"
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filters={{
          allChainDropdown: true,
          filters: activeTab === "positions"
            ? []
            : (activeFilterTab === "lending-single-assets"
              ? ["Protocol", "Vaults", "Curator"]
              : ["Protocol", "Vaults", "Curator", "Provider"]),
          supplyApyTab: activeTab === "positions" ? false : true,
          supplyApyLabel: activeFilterTab === "lending-single-assets" ? "Provider TVL" : "Vanna TVL",
          filterTabType: activeTab === "positions" ? "solid" : "ghost"
        }}
        filterTabTypeOptions={filterTabTypeOptions}
        activeFilterTab={currentActiveFilterTab}
        onFilterTabTypeChange={handleFilterTabChange}
        tableHeadings={tableData.headings}
        tableBody={tableData.body}
        onRowClick={activeTab === "vaults" ? handleRowClick : undefined}
      />
      </section>
    </main>
  );
}
