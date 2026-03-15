"use client";

import { Table } from "@/components/earn/table";
import { AccountStats } from "@/components/margin/account-stats";
import { useTheme } from "@/contexts/theme-context";
import {
  FARM_STATS_ITEMS,
  MARGIN_ACCOUNT_STATS_ITEMS,
  farmTableBody,
  farmTableHeadings,
  singleAssetTableHeadings,
} from "@/lib/constants/farm";
import { useUserStore } from "@/store/user";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFarmStore } from "@/store/farm-store";
import { useBlendPoolStats, useUserBlendPositions } from "@/hooks/use-farm";
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
  const totalCollateralValue = useMarginAccountInfoStore((s) => s.totalCollateralValue);
  const totalBorrowedValue = useMarginAccountInfoStore((s) => s.totalBorrowedValue);
  const marginAccountAddress = useMarginAccountInfoStore((s) => s.marginAccountAddress);

  useEffect(() => {
    if (!marginAccountAddress) return;
    refreshBorrowedBalances(marginAccountAddress);
  }, [marginAccountAddress]);

  // Build real single-asset table rows from live pool data
  const singleAssetTableBody = useMemo(() => {
    const assets = ['XLM', 'USDC', 'EURC'] as const;
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
    const assets = ['XLM', 'USDC', 'EURC'] as const;
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
    const rowId = row.cell?.[0]?.title?.toLowerCase().replace(/\s+/g, "-") ||
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
    return { headings: farmTableHeadings, body: farmTableBody };
  }, [activeTab, activeFilterTab, singleAssetTableBody, positionsTableBody]);

  return (
    <div className="w-full h-fit px-[40px] pt-[40px] pb-[80px] flex flex-col gap-[40px]">
      {userAddress && FARM_STATS_ITEMS.length > 0 && MARGIN_ACCOUNT_STATS_ITEMS.length > 0 && (
        <div className={`w-full h-fit p-[24px] border-[1px] rounded-[20px] flex flex-col gap-[40px] ${isDark ? "bg-[#222222]" : "bg-[#F7F7F7]"}`}>
          <div className="w-full h-fit flex flex-col gap-[8px]">
            <div className={`w-full h-fit text-[20px] font-semibold ${isDark ? "text-[#FFFFFF]" : "text-[#111111]"}`}>
              Farm Stats
            </div>
            <AccountStats darkBackgroundColor="#111111" items={FARM_STATS_ITEMS} values={farmStatsValues} gridCols="grid-cols-2" backgroundColor="#FFFFFF" />
          </div>
          <div className="w-full h-fit flex flex-col gap-[8px]">
            <div className={`w-full h-fit text-[20px] font-semibold ${isDark ? "text-[#FFFFFF]" : "text-[#111111]"}`}>
              Margin Account Stats
            </div>
            <AccountStats darkBackgroundColor="#111111" items={MARGIN_ACCOUNT_STATS_ITEMS} values={marginStatsValues} gridCols="grid-cols-3" backgroundColor="#FFFFFF" />
          </div>
        </div>
      )}
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
    </div>
  );
}
