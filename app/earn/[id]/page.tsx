"use client";

import { AccountStatsGhost } from "@/components/earn/account-stats-ghost";
import { Form } from "@/components/earn/form";
import { Details } from "@/components/earn/details-tab";
import { YourPositions } from "@/components/earn/your-positions";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import Image from "next/image";
import { useState, use, useMemo, useEffect } from "react";
import { ActivityTab } from "@/components/earn/acitivity-tab";
import { AnalyticsTab } from "@/components/earn/analytics-tab";
import { MarginManagersTab } from "@/components/earn/margin-managers-tab";
import { CollateralLimitsTab } from "@/components/earn/collateral-limits-tab";
import { useEarnVaultStore } from "@/store/earn-vault-store";
import { iconPaths } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/theme-context";
import { setSelectedPool } from "@/store/selected-pool-store";
import { AssetType } from "@/lib/stellar-utils";
import { usePoolData } from "@/hooks/use-earn";

// Approximate USD prices for testnet display (no live oracle)
const TOKEN_PRICES: Record<string, number> = { XLM: 0.1, USDC: 1.0, EURC: 1.0 };

const fmt = (n: number, decimals = 4) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(2)}K`
  : n.toFixed(decimals);

const tabs = [
  { id: "your-positions", label: "Your Positions" },
  { id: "details", label: "Details" },
  { id: "activity", label: "Activity" },
  { id: "collateral-limits", label: "Collateral and Limits" },
  { id: "analytics", label: "Analytics" },
  { id: "margin-managers", label: "Margin Managers" },
];

export default function EarnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isDark } = useTheme();
  const router = useRouter();
  const selectedVault = useEarnVaultStore((state) => state.selectedVault);
  const [activeTab, setActiveTab] = useState<string>("details");
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleBackToPools = () => {
    router.push("/earn");
  };

  // Set selected pool when page loads or id changes
  useEffect(() => {
    const assetType = id.toUpperCase();
    if (assetType === 'XLM' || assetType === 'USDC' || assetType === 'EURC') {
      setSelectedPool(assetType as AssetType, {
        id: id,
        chain: assetType,
        title: assetType,
        tag: "Active"
      });
    }
  }, [id]);

  // Get vault data - either from store or use id as fallback
  const vaultData = useMemo(() => {
    if (selectedVault && selectedVault.id === id) {
      return selectedVault;
    }
    // Fallback data if store is empty (e.g., direct URL access)
    // Default to Stellar XLM for the blockchain
    return {
      id: id,
      chain: id.toUpperCase() === 'USDC' ? 'USDC' : id.toUpperCase() === 'EURC' ? 'EURC' : 'XLM',
      title: id,
      tag: "Active",
    };
  }, [selectedVault, id]);

  // Get icon path for the asset
  const iconPath = useMemo(() => {
    // Try to get icon from iconPaths, fallback to xlm-icon for Stellar
    const assetName = vaultData.title.toUpperCase();
    return iconPaths[assetName] || "/icons/xlm-icon.png";
  }, [vaultData.title]);

  // Live pool data from on-chain contracts (auto-refreshes every 30s)
  const { pools } = usePoolData();

  // Build header stats entirely from live contract data — no string parsing
  const accountStatsItems = useMemo(() => {
    const asset = vaultData.title.toUpperCase();
    const pool = pools[asset as keyof typeof pools];
    const price = TOKEN_PRICES[asset] ?? 1;

    const totalSupply = parseFloat(pool?.totalSupply || '0');
    const availableLiquidity = parseFloat(pool?.availableLiquidity || '0');
    const utilizationRate = parseFloat(pool?.utilizationRate || '0');
    const supplyAPY = parseFloat(pool?.supplyAPY || '0');

    return [
      {
        id: "1",
        name: "Total Supply",
        // USD value with approximate price + raw token amount beneath
        amount: `$${fmt(totalSupply * price, 2)}`,
        amountInToken: `${fmt(totalSupply)} ${asset}`,
      },
      {
        id: "2",
        name: "Available Liquidity",
        amount: `$${fmt(availableLiquidity * price, 2)}`,
        amountInToken: `${fmt(availableLiquidity)} ${asset}`,
      },
      {
        id: "3",
        name: "Utilization Rate",
        // utilizationRate = totalBorrowed / totalSupply × 100
        amount: `${utilizationRate.toFixed(2)}%`,
      },
      {
        id: "4",
        name: "Supply APY",
        // supplyAPY = baseRate + utilizationRate × multiplier (from use-earn hook)
        amount: `${supplyAPY.toFixed(2)}%`,
      },
    ];
  }, [pools, vaultData.title]);

  return (
    <main className="flex flex-col gap-[40px]">
      <header className="pt-[40px] px-[80px] w-full h-fit">
        <div className="w-full h-fit flex flex-col gap-[20px]">
          <nav aria-label="Breadcrumb">
            <button
              type="button"
              onClick={handleBackToPools}
              className={`w-fit h-fit flex gap-[12px] items-center cursor-pointer text-[16px] font-medium hover:text-[#703AE6] transition-colors ${
                isDark ? "text-white" : "text-[#5A5555]"
              }`}
            >
              <svg
                width="9"
                height="16"
                viewBox="0 0 9 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 1L1 8L8 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to pools
            </button>
          </nav>
          <div className="w-full h-fit flex gap-[16px] items-center">
            <div className="flex gap-[16px]">
              <Image
                src={iconPath}
                alt={`${vaultData.title}-icon`}
                width={36}
                height={36}
              />
              <div className="w-fit h-fit flex gap-[8px] items-center">
                <h1 className={`w-fit h-fit text-[24px] font-bold ${
                  isDark ? "text-white" : "text-[#181822]"
                }`}>
                  {vaultData.title}
                </h1>
                <div className="w-fit h-fit flex gap-[8px] items-center">
                  <span className={`text-[12px] font-semibold text-center w-fit h-fit rounded-[4px] py-[2px] px-[6px] ${
                    isDark ? "bg-[#222222] text-white" : "bg-[#F4F4F4] text-[#0C0C0C]"
                  }`}>
                    {vaultData.tag}
                  </span>
                </div>
              </div>
            </div>
            <div className={`text-[16px] font-semibold w-fit h-[48px] rounded-[12px] py-[12px] pr-[16px] pl-[8px] flex gap-[4px] ${
              isDark ? "bg-[#222222] text-white" : "bg-[#F4F4F4]"
            }`}>
              Network:{" "}
              <Image
                src={iconPath}
                alt={`${vaultData.chain}-icon`}
                width={20}
                height={20}
              />
            </div>
          </div>
        </div>
      </header>
      
      <section className="px-[80px]" aria-label="Vault Statistics">
        <AccountStatsGhost items={accountStatsItems} />
      </section>

      <section className="px-[80px] pb-[80px] w-full h-fit" aria-label="Vault Details and Actions">
        <div className="flex gap-[20px] w-full h-fit">
          <article className="w-[700px] h-full flex flex-col gap-[24px]">
            <nav className="w-full h-[48px]" aria-label="Vault Information Tabs">
              <AnimatedTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                type="underline"
                tabClassName="w-[130px] h-[48px] text-[12px]"
                containerClassName="w-full"
              />
            </nav>
            {activeTab === "your-positions" && <YourPositions />}
            {activeTab === "details" && <Details />}
            {activeTab === "activity" && <ActivityTab />}
            {activeTab === "analytics" && <AnalyticsTab />}
            {activeTab === "margin-managers" && <MarginManagersTab />}
            {activeTab === "collateral-limits" && <CollateralLimitsTab />}
          </article>
          <aside aria-label="Transaction Form">
            <Form />
          </aside>
        </div>
      </section>
    </main>
  );
}
