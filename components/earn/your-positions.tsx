'use client';

import { useState, useMemo, memo } from "react";
import { Chart } from "./chart";
import { Table } from "./table";
import { useTheme } from "@/contexts/theme-context";
import { usePoolData, useUserPositions, useEarnTransactions } from "@/hooks/use-earn";
import { useSelectedPoolStore } from "@/store/selected-pool-store";
import { iconPaths } from "@/lib/constants";
import { depositData } from "@/lib/constants/earn";
import { getEarnHistoryByAsset } from "@/lib/earn-history";

const tabs = [
  { id: "current-positions", label: "Current Position" },
  { id: "positions-history", label: "Position History" },
];

const toInternalAsset = (value: string) => {
  if (value === "AqUSDC" || value === "AQUARIUS_USDC") return "AQUARIUS_USDC";
  if (value === "SoUSDC" || value === "SOROSWAP_USDC") return "SOROSWAP_USDC";
  if (value === "BLUSDC") return "USDC";
  return value.toUpperCase();
};

const toDisplayAsset = (value: string) => {
  if (value === "AQUARIUS_USDC") return "AqUSDC";
  if (value === "SOROSWAP_USDC") return "SoUSDC";
  if (value === "USDC") return "BLUSDC";
  return value;
};

type EarnTxLike = {
  asset?: string;
  type?: string;
  amount?: string | number;
  timestamp?: string | number;
  hash?: string;
};

// Scale a template series so its last point equals liveEndValue; empty array when value=0.
// Dates are remapped to a rolling 365-day window ending today so time filters always find data.
const scaleSeries = (
  template: Array<{ date: string; amount: number }>,
  liveEndValue: number
): Array<{ date: string; amount: number }> => {
  if (liveEndValue <= 0 || template.length === 0) return [];
  const lastTemplate = template[template.length - 1].amount;
  if (lastTemplate === 0) return [];
  const scale = liveEndValue / lastTemplate;
  const now = new Date();
  const n = template.length;
  return template.map((p, i) => {
    const daysAgo = Math.round((n - 1 - i) * 365 / Math.max(n - 1, 1));
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return { date: d.toISOString().split('T')[0], amount: parseFloat((p.amount * scale).toFixed(2)) };
  });
};

// USD price lookup
const TOKEN_PRICES: Record<string, number> = {
  XLM: 0.1, USDC: 1.0, AQUARIUS_USDC: 1.0, SOROSWAP_USDC: 1.0,
};

export const YourPositions = memo(function YourPositions() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<string>("current-positions");

  const selectedAsset = useSelectedPoolStore((state) => state.selectedAsset);
  const assetKey = toInternalAsset(selectedAsset);
  const asset = toDisplayAsset(assetKey);

  const { pools } = usePoolData();
  const { positions } = useUserPositions();
  const { transactions } = useEarnTransactions();

  const supplyAPY = useMemo(() => {
    const pool = pools[assetKey as keyof typeof pools];
    return parseFloat(pool?.supplyAPY || '0');
  }, [pools, assetKey]);

  const userPosition = positions[assetKey as keyof typeof positions];
  const deposited = parseFloat(userPosition?.deposited || '0');
  const hasPosition = deposited > 0;

  const price = TOKEN_PRICES[assetKey] ?? 1;
  const vTokenBalance = parseFloat(userPosition?.vTokenBalance || '0');

  // Generate scaled chart data for the user's current deposit
  const mySupplyChartData = useMemo(
    () => scaleSeries(depositData, deposited * price),
    [deposited, price]
  );

  const positionTableHeadings = [
    { label: "Pool", id: "pool" },
    { label: "Vault Shares", id: "shares" },
    { label: `${asset} Deposited`, id: "deposited" },
    { label: "USD Value", id: "usd-value" },
    { label: "APY", id: "apy" },
  ];

  const positionTableBody = hasPosition
    ? {
        rows: [
          {
            cell: [
              {
                icon: iconPaths[asset] || "/icons/stellar.svg",
                title: asset,
                tags: ["Vanna", "Vault"],
              },
              { title: `${vTokenBalance.toFixed(4)} v${asset}` },
              { title: `${deposited.toFixed(4)} ${asset}` },
              { title: `$${(deposited * price).toFixed(2)}` },
              { title: `${supplyAPY.toFixed(2)}%` },
            ],
          },
        ],
      }
    : { rows: [] };

  const historyTableHeadings = [
    { label: "Date", id: "date" },
    { label: "Type", id: "type" },
    { label: "Amount", id: "amount" },
    { label: "Status", id: "status" },
    { label: "Tx Hash", id: "txHash" },
  ];

  const mergedHistory = useMemo(() => {
    const normalize = (value: string) => toInternalAsset(value);

    const onchain = (transactions ?? [])
      .filter((tx: EarnTxLike) => normalize(tx.asset || "") === normalize(assetKey))
      .map((tx: EarnTxLike) => ({
        timestamp: Number(tx.timestamp ?? 0),
        type: tx.type === "withdraw" ? "withdraw" : "supply",
        amount: String(tx.amount ?? "0"),
        hash: String(tx.hash ?? ""),
        status: "success",
      }));

    const onchainHashes = new Set(onchain.map((tx) => tx.hash).filter(Boolean));
    const local = getEarnHistoryByAsset(assetKey)
      .filter((tx) => !tx.hash || !onchainHashes.has(tx.hash))
      .map((tx) => ({
        timestamp: tx.timestamp,
        type: tx.type,
        amount: tx.amount,
        hash: tx.hash,
        status: tx.status,
      }));

    return [...onchain, ...local].sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, assetKey]);

  const historyTableBody = useMemo(() => {
    if (mergedHistory.length === 0) return { rows: [] };
    return {
      rows: mergedHistory.map((tx) => ({
        cell: [
          {
            title: tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : "—",
            description: tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : "",
          },
          {
            title: tx.type === "supply" ? "Supply" : "Withdraw",
            badge: tx.type === "supply" ? "green" : "orange",
          },
          {
            icon: iconPaths[asset] || "/icons/stellar.svg",
            title: `${tx.amount} ${asset}`,
            description: `$${((parseFloat(tx.amount) || 0) * price).toFixed(2)}`,
          },
          { title: "Success", badge: "green" },
          tx.hash
            ? {
                title: `${tx.hash.slice(0, 8)}...${tx.hash.slice(-4)}`,
                clickable: "link",
                link: `https://stellar.expert/explorer/testnet/tx/${tx.hash}`,
              }
            : { title: "—" },
        ],
      })),
    };
  }, [mergedHistory, asset, price]);

  const hasAnyHistory = mergedHistory.length > 0;

  return (
    <section
      className={`w-full h-full flex flex-col gap-[16px] rounded-[16px] border-[1px] p-[16px] ${
        isDark ? "bg-[#111111]" : "bg-[#F7F7F7]"
      }`}
      aria-label="Your Positions Overview"
    >
      {/* Supply chart — shows user's deposit value over time */}
      <figure className="w-full">
        <Chart
          type="my-supply"
          currencyTab={true}
          height={320}
          containerWidth="w-full"
          customData={mySupplyChartData}
        />
      </figure>

      {/* Position table or empty state */}
      <article aria-label="My Position">
        {!hasPosition && !hasAnyHistory ? (
          <div className={`w-full rounded-2xl border p-6 flex flex-col items-center justify-center gap-4 text-center ${
            isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-[#EEEEEE]"
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              isDark ? "bg-[#2A2A2A]" : "bg-[#F4F0FD]"
            }`}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#703AE6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="#703AE6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="#703AE6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <p className={`text-[15px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>
                No active position
              </p>
              <p className={`text-[13px] font-medium ${isDark ? "text-[#777777]" : "text-[#A7A7A7]"}`}>
                Supply liquidity to start earning {asset} yield
              </p>
            </div>
            <div className={`w-full rounded-xl p-4 flex items-center justify-between ${
              isDark ? "bg-[#222222]" : "bg-[#F7F4FE]"
            }`}>
              <div className="flex flex-col gap-0.5 text-left">
                <span className={`text-[11px] font-medium ${isDark ? "text-[#777777]" : "text-[#A7A7A7]"}`}>Current Supply APY</span>
                <span className="text-[20px] font-bold text-[#703AE6]">
                  {supplyAPY.toFixed(2)}%
                </span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                isDark ? "bg-[#2A2A2A]" : "bg-white"
              }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#703AE6" strokeWidth="1.8"/>
                  <path d="M12 6v6l4 2" stroke="#703AE6" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className={`text-[12px] font-semibold ${isDark ? "text-[#A7A7A7]" : "text-[#555555]"}`}>
                  Earn daily rewards
                </span>
              </div>
            </div>
          </div>
        ) : (
          <Table
            filterDropdownPosition="right"
            heading={{
              heading: "My Position",
              tabsItems: tabs,
              tabType: "solid",
            }}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tableHeadings={activeTab === "current-positions" ? positionTableHeadings : historyTableHeadings}
            tableBody={activeTab === "current-positions" ? positionTableBody : historyTableBody}
            tableBodyBackground={isDark ? "bg-[#111111]" : "bg-white"}
            filters={{ customizeDropdown: true }}
          />
        )}
      </article>
    </section>
  );
});
