'use client';

import { useMemo } from "react";
import { Table } from "./table";
import { useTheme } from "@/contexts/theme-context";
import { useEarnPoolStore } from "@/store/earn-pool-store";
import { usePoolData } from "@/hooks/use-earn";

// Stellar table headings for user distribution
const tableHeadings = [
  {
    label: "User Id",
    id: "user-id",
  },
  {
    label: "Supplied Assets",
    id: "supplied-assets",
  },
  {
    label: "Supply (%)",
    id: "supply-percent",
  },
];

// Transaction table headings
export const transactionTableHeadings = [
  {
    label: "Date",
    id: "date",
  },
  {
    label: "Type",
    id: "type",
  },
  {
    label: "Amount",
    id: "amount",
  },
  {
    label: "Status",
    id: "status",
  },
  {
    label: "Tx Hash",
    id: "txHash",
  },
];

export const ActivityTab = () => {
  const { isDark } = useTheme();
  const recentTransactions = useEarnPoolStore((state) => state.recentTransactions);
  const { pools } = usePoolData();

  // Format transactions for table
  const transactionTableBody = useMemo(() => {
    if (recentTransactions.length === 0) {
      return {
        rows: [
          {
            cell: [
              { title: "-", description: "No transactions yet" },
              { title: "-" },
              { title: "-" },
              { title: "-" },
              { title: "-" },
            ],
          },
        ],
      };
    }

    return {
      rows: recentTransactions.map((tx) => ({
        cell: [
          {
            title: new Date(tx.timestamp).toLocaleDateString(),
            description: new Date(tx.timestamp).toLocaleTimeString(),
          },
          {
            title: tx.type === 'supply' ? 'Pool Deposit' : 'Pool Withdraw',
            badge: tx.type === 'supply' ? 'green' : 'orange',
          },
          {
            icon: `/icons/${tx.asset.toLowerCase()}.svg`,
            title: `${tx.amount} ${tx.asset}`,
            description: `$${(parseFloat(tx.amount) * (tx.asset === 'XLM' ? 0.1 : 1)).toFixed(2)}`,
          },
          {
            title: tx.status,
            badge: tx.status === 'success' ? 'green' : tx.status === 'pending' ? 'yellow' : 'red',
          },
          {
            title: `${tx.hash.slice(0, 8)}...${tx.hash.slice(-4)}`,
            clickable: "link",
            link: `https://stellar.expert/explorer/testnet/tx/${tx.hash}`,
          },
        ],
      })),
    };
  }, [recentTransactions]);

  // Sample user distribution data (would come from indexer in production)
  const userDistributionBody = useMemo(() => {
    // Show placeholder data - in production this would come from an indexer
    const totalXLM = parseFloat(pools.XLM?.totalSupply || '0');
    const totalUSDC = parseFloat(pools.USDC?.totalSupply || '0');
    const totalEURC = parseFloat(pools.EURC?.totalSupply || '0');

    return {
      rows: [
        {
          cell: [
            {
              icon: "/icons/user.png",
              title: "Protocol Pool",
              clickable: "address",
            },
            {
              icon: "/icons/xlm.svg",
              title: `${totalXLM.toLocaleString()} XLM`,
              description: `$${(totalXLM * 0.1).toLocaleString()}`,
            },
            {
              percentage: 100,
            },
          ],
        },
        {
          cell: [
            {
              icon: "/icons/user.png",
              title: "USDC Pool",
              clickable: "address",
            },
            {
              icon: "/icons/usdc.svg",
              title: `${totalUSDC.toLocaleString()} USDC`,
              description: `$${totalUSDC.toLocaleString()}`,
            },
            {
              percentage: 100,
            },
          ],
        },
        {
          cell: [
            {
              icon: "/icons/user.png",
              title: "EURC Pool",
              clickable: "address",
            },
            {
              icon: "/icons/eurc.svg",
              title: `${totalEURC.toLocaleString()} EURC`,
              description: `$${totalEURC.toLocaleString()}`,
            },
            {
              percentage: 100,
            },
          ],
        },
      ],
    };
  }, [pools]);

  return (
    <section
      className={`w-full h-fit rounded-[20px] border-[1px] p-[24px] flex flex-col gap-[24px] ${
        isDark ? "bg-[#111111] border-[#333333]" : "bg-[#F7F7F7] border-gray-200"
      }`}
      aria-label="Activity Overview"
    >
      {/* Pool Distribution */}
      <article aria-label="Pool Distribution">
        <Table
          showPieChart={true}
          tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
          heading={{ heading: "Pool Distribution" }}
          tableHeadings={tableHeadings}
          tableBody={userDistributionBody}
        />
      </article>

      {/* Recent Transactions */}
      <article aria-label="Recent Transactions">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
            Recent Transactions
          </h3>
          <span className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {recentTransactions.length} transactions
          </span>
        </div>
        <Table
          filterDropdownPosition="right"
          tableBodyBackground={isDark ? "bg-[#222222]" : "bg-white"}
          heading={{ heading: "" }}
          filters={{ filters: ["All", "Deposits", "Withdrawals"], customizeDropdown: true }}
          tableHeadings={transactionTableHeadings}
          tableBody={transactionTableBody}
        />
      </article>

      {/* Stellar Explorer Link */}
      <div className={`text-center py-4 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-gray-100"}`}>
        <a
          href="https://stellar.expert/explorer/testnet"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#703AE6] hover:underline text-sm font-medium"
        >
          View all transactions on Stellar Expert →
        </a>
      </div>
    </section>
  );
};