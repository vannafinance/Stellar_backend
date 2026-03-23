"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Chart } from "@/components/earn/chart";
import { Table } from "@/components/earn/table";
import { AccountStats } from "@/components/margin/account-stats";
import { tableHeadings } from "@/lib/constants/earn";
import { ACCOUNT_STATS_ITEMS } from "@/lib/constants/margin";
import { useUserStore } from "@/store/user";
import { RewardsTable } from "@/components/earn/rewards-table";
import { useEarnVaultStore } from "@/store/earn-vault-store";
import { setSelectedPool } from "@/store/selected-pool-store";
import { AssetType } from "@/lib/stellar-utils";
import { useEarnPage } from "@/hooks/use-earn";
import { depositData, netApyData } from "@/lib/constants/earn";

// Liquidation threshold used across the protocol (80% collateral factor)
const LIQUIDATION_THRESHOLD = 0.8;

// USD prices for testnet tokens
const TOKEN_PRICES: Record<string, number> = { XLM: 0.1, USDC: 1.0, EURC: 1.0, AQUARIUS_USDC: 1.0 };

/**
 * Scale a reference series so its last data point equals `liveEndValue`.
 * Preserves the original chart shape — only the magnitude changes.
 */
const scaleSeries = (
  template: Array<{ date: string; amount: number }>,
  liveEndValue: number
): Array<{ date: string; amount: number }> => {
  if (liveEndValue <= 0 || template.length === 0) return template;
  const lastTemplate = template[template.length - 1].amount;
  if (lastTemplate === 0) return template;
  const scale = liveEndValue / lastTemplate;
  return template.map((p) => ({ date: p.date, amount: parseFloat((p.amount * scale).toFixed(2)) }));
};

// Format a raw token amount into a compact human-readable string (e.g. 1250000 → "1.3M")
const formatTokenAmount = (amount: number): string => {
  if (amount <= 0) return "0";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(4);
};

// Build a single pool table row from live on-chain pool stats
const buildPoolRow = (
  assetSymbol: string,
  pool: {
    totalSupply: string;
    totalBorrowed: string;
    utilizationRate: string;
    supplyAPY: string;
    borrowAPY: string;
    isLoading?: boolean;
  },
  collateralIcons: string[]
) => {
  const totalSupply = parseFloat(pool.totalSupply) || 0;
  const totalBorrowed = parseFloat(pool.totalBorrowed) || 0;
  const utilizationRate = parseFloat(pool.utilizationRate) || 0;
  const supplyAPY = parseFloat(pool.supplyAPY) || 0;
  const borrowAPY = parseFloat(pool.borrowAPY) || 0;

  return {
    cell: [
      { chain: assetSymbol, title: assetSymbol, tag: "Active" },
      {
        title: `${formatTokenAmount(totalSupply)} ${assetSymbol}`,
        tag: `${totalSupply.toFixed(4)} ${assetSymbol}`,
      },
      {
        title: `${supplyAPY.toFixed(2)}%`,
        tag: `${supplyAPY.toFixed(2)}%`,
      },
      {
        title: `${formatTokenAmount(totalBorrowed)} ${assetSymbol}`,
        tag: `${totalBorrowed.toFixed(4)} ${assetSymbol}`,
      },
      {
        title: `${borrowAPY.toFixed(2)}%`,
        tag: `${borrowAPY.toFixed(2)}%`,
      },
      {
        title: `${utilizationRate.toFixed(2)}%`,
        tag: `${utilizationRate.toFixed(2)}%`,
      },
      {
        onlyIcons: collateralIcons,
        tag: "Collateral",
        clickable: "toggle",
      },
    ],
  };
};

// Build a positions row showing user's deposited/borrowed amount for an asset
const buildPositionRow = (
  assetSymbol: string,
  position: {
    deposited: string;
    borrowed: string;
    vTokenBalance: string;
    earnedInterest: string;
    accruedDebt: string;
  },
  pool: {
    supplyAPY: string;
    borrowAPY: string;
    utilizationRate: string;
  }
) => {
  const deposited = parseFloat(position.deposited) || 0;
  const borrowed = parseFloat(position.borrowed) || 0;
  const supplyAPY = parseFloat(pool.supplyAPY) || 0;
  const borrowAPY = parseFloat(pool.borrowAPY) || 0;
  const utilizationRate = parseFloat(pool.utilizationRate) || 0;

  return {
    cell: [
      { chain: assetSymbol, title: assetSymbol, tag: "Active" },
      {
        title: `${formatTokenAmount(deposited)} ${assetSymbol}`,
        tag: `${deposited.toFixed(4)} ${assetSymbol}`,
      },
      {
        title: `${supplyAPY.toFixed(2)}%`,
        tag: `${supplyAPY.toFixed(2)}%`,
      },
      {
        title: `${formatTokenAmount(borrowed)} ${assetSymbol}`,
        tag: `${borrowed.toFixed(4)} ${assetSymbol}`,
      },
      {
        title: `${borrowAPY.toFixed(2)}%`,
        tag: `${borrowAPY.toFixed(2)}%`,
      },
      {
        title: `${utilizationRate.toFixed(2)}%`,
        tag: `${utilizationRate.toFixed(2)}%`,
      },
      {
        onlyIcons: [assetSymbol],
        tag: "Collateral",
        clickable: "toggle",
      },
    ],
  };
};

export default function Earn() {
  const userAddress = useUserStore((state) => state.address);
  const setSelectedVault = useEarnVaultStore((state) => state.set);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("vaults");

  // Live data from on-chain contracts (auto-refreshes every 30s)
  const { pools, userPositions, totalDeposited, totalBorrowed } = useEarnPage();

  // Set default pool selection on mount
  useEffect(() => {
    setSelectedPool('XLM' as AssetType, {
      id: 'XLM',
      chain: 'XLM',
      title: 'XLM',
      tag: 'Active'
    });
  }, []);

  // ─── Account Stats ───────────────────────────────────────────────────────────
  // All values derived from the user's live on-chain positions.
  // Units are native token amounts (XLM/USDC/EURC) summed without USD conversion
  // since we do not have a live price feed on testnet.
  const accountStats = useMemo(() => {
    if (!userAddress) {
      return {
        netHealthFactor: "-",
        collateralLeftBeforeLiquidation: "-",
        netAvailableCollateral: "-",
      };
    }

    // Health Factor = (total deposited × liquidation threshold) / total borrowed
    // A value > 1 means the position is healthy; < 1 means it can be liquidated.
    let netHealthFactor: string | number;
    if (totalBorrowed <= 0) {
      netHealthFactor = totalDeposited > 0 ? "∞" : "-";
    } else {
      netHealthFactor = parseFloat(
        ((totalDeposited * LIQUIDATION_THRESHOLD) / totalBorrowed).toFixed(2)
      );
    }

    // Collateral Left Before Liquidation =
    //   deposited − (borrowed / liquidation_threshold)
    //   i.e. how much collateral can drop before the position becomes liquidatable
    let collateralLeftBeforeLiquidation: string | number;
    if (totalDeposited <= 0) {
      collateralLeftBeforeLiquidation = "-";
    } else if (totalBorrowed <= 0) {
      collateralLeftBeforeLiquidation = parseFloat(totalDeposited.toFixed(4));
    } else {
      const gap = totalDeposited - totalBorrowed / LIQUIDATION_THRESHOLD;
      collateralLeftBeforeLiquidation = parseFloat(gap.toFixed(4));
    }

    // Net Available Collateral = deposited − borrowed
    const netAvailableCollateral =
      totalDeposited > 0
        ? parseFloat((totalDeposited - totalBorrowed).toFixed(4))
        : "-";

    return {
      netHealthFactor,
      collateralLeftBeforeLiquidation,
      netAvailableCollateral,
    };
  }, [userAddress, totalDeposited, totalBorrowed]);

  // ─── Live Chart Data ─────────────────────────────────────────────────────────
  // Scale the static historical series so the last point equals the current live value.
  // totalDepositedUSD = sum of each asset's deposited amount × its USD price.
  // netApyEarningsUSD = totalDepositedUSD × weightedAPY / 100  (annual run-rate earnings).
  const ALL_ASSETS = ["XLM", "USDC", "EURC", "AQUARIUS_USDC"] as const;

  const liveDepositData = useMemo(() => {
    const totalDepositedUSD = ALL_ASSETS.reduce((sum, asset) => {
      const deposited = parseFloat(userPositions[asset]?.deposited || "0");
      return sum + deposited * (TOKEN_PRICES[asset] ?? 1.0);
    }, 0);
    return scaleSeries(depositData, totalDepositedUSD);
  }, [userPositions]);

  const liveNetApyData = useMemo(() => {
    const totalDepositedUSD = ALL_ASSETS.reduce((sum, asset) => {
      const deposited = parseFloat(userPositions[asset]?.deposited || "0");
      return sum + deposited * (TOKEN_PRICES[asset] ?? 1.0);
    }, 0);
    // Weighted average APY across assets with non-zero deposits
    let weightedAPY = 0;
    let weightTotal = 0;
    ALL_ASSETS.forEach((asset) => {
      const deposited = parseFloat(userPositions[asset]?.deposited || "0");
      if (deposited > 0) {
        weightTotal += deposited;
        weightedAPY += deposited * parseFloat(pools[asset]?.supplyAPY || "0");
      }
    });
    const avgAPY = weightTotal > 0 ? weightedAPY / weightTotal : 0;
    const annualEarnings = totalDepositedUSD * (avgAPY / 100);
    return scaleSeries(netApyData, annualEarnings);
  }, [userPositions, pools]);

  // ─── Vaults Table ────────────────────────────────────────────────────────────
  // Each row reflects live pool-level stats fetched from the lending contracts.
  const liveVaultsTableBody = useMemo(
    () => ({
      rows: [
        buildPoolRow("XLM", pools.XLM, ["XLM", "USDC", "EURC"]),
        buildPoolRow("USDC", pools.USDC, ["USDC", "XLM", "EURC"]),
        buildPoolRow("EURC", pools.EURC, ["EURC", "USDC", "XLM"]),
        buildPoolRow("AquiresUSDC", pools.AQUARIUS_USDC, ["USDC", "XLM", "EURC"]),
      ],
    }),
    [pools]
  );

  // ─── Positions Table ─────────────────────────────────────────────────────────
  // Shows only the assets where the user has a non-zero deposited balance.
  const livePositionsTableBody = useMemo(() => {
    if (!userAddress) return { rows: [] };

    const assetKeys = ["XLM", "USDC", "EURC", "AQUARIUS_USDC"] as const;
    const rows = assetKeys
      .filter(
        (asset) => parseFloat(userPositions[asset]?.deposited || "0") > 0 ||
                   parseFloat(userPositions[asset]?.borrowed || "0") > 0
      )
      .map((asset) => {
        const displaySymbol = asset === "AQUARIUS_USDC" ? "AquiresUSDC" : asset;
        return buildPositionRow(displaySymbol, userPositions[asset], pools[asset]);
      });

    return { rows };
  }, [userAddress, userPositions, pools]);

  // Tab-based table data
  const getTableDataForTab = (tabId: string) => {
    if (tabId === "vaults") return liveVaultsTableBody;
    if (tabId === "positions") return livePositionsTableBody;
    return { rows: [] };
  };

  // ─── Row Click Handler ────────────────────────────────────────────────────────
  const handleRowClick = useCallback(
    (row: any) => {
      const cells = row.cell;
      const id = cells[0]?.title;

      if (id) {
        const assetType = id === "AquiresUSDC" ? "AQUARIUS_USDC" : id.toUpperCase();
        if (assetType === "XLM" || assetType === "USDC" || assetType === "EURC" || assetType === "AQUARIUS_USDC") {
          setSelectedPool(assetType as AssetType, {
            id: id,
            chain: assetType,
            title: id,
            tag: cells[0]?.tag || "Active",
          });
        }

        const vaultData = {
          id: id,
          chain: cells[0]?.chain || "XLM",
          title: cells[0]?.title || "",
          tag: cells[0]?.tag || "Active",
          assetsSupplied: { title: cells[1]?.title || "", tag: cells[1]?.tag || "" },
          supplyApy: { title: cells[2]?.title || "", tag: cells[2]?.tag || "" },
          assetsBorrowed: { title: cells[3]?.title || "", tag: cells[3]?.tag || "" },
          borrowApy: { title: cells[4]?.title || "", tag: cells[4]?.tag || "" },
          utilizationRate: { title: cells[5]?.title || "", tag: cells[5]?.tag || "" },
          collateral: {
            onlyIcons: cells[6]?.onlyIcons || [],
            tag: cells[6]?.tag || "Collateral",
          },
        };

        setSelectedVault({ selectedVault: vaultData });
        router.push(`/earn/${id}`);
      }
    },
    [router, setSelectedVault]
  );

  return (
    <main>
      {userAddress && (
        <section className="p-[40px] w-full h-fit flex gap-[24px]" aria-label="User Dashboard">
          <div className="flex gap-[16px] w-full h-fit">
            <article className="w-[437.33px] h-fit">
              <Chart containerWidth="w-[437.33px]" containerHeight="h-[331px]" type="overall-deposit" liveData={liveDepositData} />
            </article>
            <article className="w-[437.33px] h-fit">
              <Chart containerWidth="w-[437.33px]" containerHeight="h-[331px]" type="net-apy" liveData={liveNetApyData} />
            </article>
            <aside className="w-full h-fit">
              <RewardsTable />
            </aside>
          </div>
        </section>
      )}

      <section className="h-[206px] w-full pt-[40px] px-[40px]" aria-label="Account Statistics">
        <AccountStats
          items={ACCOUNT_STATS_ITEMS.slice(0, 3)}
          values={accountStats}
        />
      </section>

      <section className="p-[40px] w-full h-fit" aria-label="Vaults and Positions">
        <Table
          filterDropdownPosition="right"
          filters={{
            filters: ["Deposit", "Collateral"],
            allChainDropdown: true,
            supplyApyTab: true,
          }}
          heading={{
            tabsItems: [
              { id: "vaults", label: "Vaults" },
              { id: "positions", label: "Positions" },
            ],
            tabType: "underline",
          }}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tableHeadings={tableHeadings}
          tableBody={getTableDataForTab(activeTab)}
          onRowClick={handleRowClick}
          hoverBackground="hover:bg-[#F1EBFD]"
        />
      </section>
    </main>
  );
}
