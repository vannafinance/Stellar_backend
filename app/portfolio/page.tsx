"use client";

import { PortfolioSection } from "@/components/portfolio/portfolio-section";
import { AccountStatsGhost } from "@/components/earn/account-stats-ghost";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { Button } from "@/components/ui/button";
import { DepositModal } from "@/components/portfolio/deposit-modal";
import { WithdrawModal } from "@/components/portfolio/withdraw-modal";
import { useWallet } from "@/hooks/use-wallet";
import { useTheme } from "@/contexts/theme-context";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";

export default function PortfolioPage() {
  const { isDark } = useTheme();
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("lender");
  const { address, balance, depositedBalances, refreshBalances } = useWallet();

  const tabs = [
    { id: "lender", label: "Lender" },
    { id: "trader", label: "Trader" },
  ];

  // Calculate total deposited value
  const totalDepositedValue = useMemo(() => {
    const xlmValue = parseFloat(depositedBalances.XLM || '0');
    const usdcValue = parseFloat(depositedBalances.USDC || '0');
    return xlmValue + usdcValue;
  }, [depositedBalances]);

  // Portfolio account stats items with real data
  const accountStatsItems = useMemo(() => {
    if (!address) {
      return [
        { id: "1", name: "Total Assets", amount: "Connect Wallet" },
        { id: "2", name: "Net P&L", amount: "Connect Wallet" },
        { id: "3", name: "Total Volume", amount: "Connect Wallet" },
      ];
    }

    return [
      { id: "1", name: "Total Assets", amount: `$${totalDepositedValue.toFixed(2)}` },
      { id: "2", name: "Wallet Balance", amount: `${balance} XLM` },
      { id: "3", name: "XLM Deposited", amount: `${depositedBalances.XLM} XLM` },
      { id: "4", name: "USDC Deposited", amount: `${depositedBalances.USDC} USDC` },
    ];
  }, [address, balance, depositedBalances, totalDepositedValue]);

  return (
    <>
      <div className="py-5 sm:py-10 lg:py-[80px] px-4 sm:px-8 lg:px-[40px] w-full h-fit">
        <div className="flex flex-col gap-5 sm:gap-[40px] w-full h-fit">
          {/* Header section */}
          <motion.div
            className="flex flex-col gap-4 sm:gap-[20px] w-full h-fit"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col sm:flex-row justify-between w-full gap-3 sm:items-center">
              <div className="flex items-center gap-3">
                <div className="w-1 h-[24px] sm:hidden rounded-full bg-[#703AE6]" />
                <h1 className={`text-[22px] sm:text-[24px] font-bold ${isDark ? "text-white" : "text-black"}`}>
                  Portfolio
                </h1>
              </div>
              <div className="grid grid-cols-4 sm:flex gap-2 sm:gap-[8px] sm:justify-end">
                <Button
                  text="Deposit"
                  size="small"
                  type="solid"
                  disabled={false}
                  onClick={() => setShowDepositModal(true)}
                />
                <Button
                  text="Withdraw"
                  size="small"
                  type="ghost"
                  disabled={false}
                  onClick={() => setShowWithdrawModal(true)}
                />
                <Button
                  text="Refresh"
                  size="small"
                  type="ghost"
                  disabled={false}
                  onClick={() => refreshBalances()}
                />
                <Button text="History" size="small" type="ghost" disabled={false} />
              </div>
            </div>

            <PortfolioSection />
          </motion.div>

          {/* Tabs section */}
          <motion.div
            className="w-full h-fit flex flex-col gap-5 sm:gap-[24px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <AnimatedTabs
              type="underline"
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabClassName="w-auto sm:w-[120px] h-[38px] sm:h-[40px] text-[13px] sm:text-[16px]"
              containerClassName="w-full"
            />
            {activeTab === "lender" && (
              <div className="w-full h-fit">
                <AccountStatsGhost
                  items={accountStatsItems}
                  type="background"
                  gridCols="grid-cols-2"
                  gridRows="grid-rows-3"
                />
              </div>
            )}
            {activeTab === "trader" && (
              <div className={`text-center py-12 text-[14px] ${isDark ? "text-[#919191]" : "text-[#5C5B5B]"}`}>
                Coming soon
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
      <WithdrawModal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} />
    </>
  );
}
