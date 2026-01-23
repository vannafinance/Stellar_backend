"use client";

import { AccountStatsGhost } from "@/components/earn/account-stats-ghost";
import { PortfolioSection } from "@/components/portfolio/portfolio-section";
import { Button } from "@/components/ui/button";
import { DepositModal } from "@/components/portfolio/deposit-modal";
import { WithdrawModal } from "@/components/portfolio/withdraw-modal";
import { useWallet } from "@/hooks/use-wallet";
import { useState, useMemo } from "react";

export default function PortfolioPage() {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { address, balance, depositedBalances, refreshBalances } = useWallet();

  // Calculate total deposited value
  const totalDepositedValue = useMemo(() => {
    const xlmValue = parseFloat(depositedBalances.XLM || '0');
    const usdcValue = parseFloat(depositedBalances.USDC || '0');
    const eurcValue = parseFloat(depositedBalances.EURC || '0');
    
    // For demo purposes, assume 1:1 USD value for simplicity
    // In a real app, you'd fetch current prices from an oracle
    return xlmValue + usdcValue + eurcValue;
  }, [depositedBalances]);

  // Portfolio account stats items with real data
  const accountStatsItems = useMemo(() => {
    if (!address) {
      return [
        {
          id: "1",
          name: "Total Assets",
          amount: "Connect Wallet",
        },
        {
          id: "2",
          name: "Net P&L",
          amount: "Connect Wallet",
        },
        {
          id: "3",
          name: "Total Volume",
          amount: "Connect Wallet",
        },
      ];
    }

    return [
      {
        id: "1",
        name: "Total Assets",
        amount: `$${totalDepositedValue.toFixed(2)}`,
      },
      {
        id: "2",
        name: "Wallet Balance",
        amount: `${balance} XLM`,
      },
      {
        id: "3",
        name: "XLM Deposited",
        amount: `${depositedBalances.XLM} XLM`,
      },
      {
        id: "4",
        name: "USDC Deposited", 
        amount: `${depositedBalances.USDC} USDC`,
      },
      {
        id: "5",
        name: "EURC Deposited",
        amount: `${depositedBalances.EURC} EURC`,
      },
    ];
  }, [address, balance, depositedBalances, totalDepositedValue]);

  if (!address) {
    return (
      <div className="py-[80px] px-[40px] w-full h-fit">
        <div className="flex flex-col gap-[40px] w-full h-fit">
          <div className="flex flex-col gap-[20px] w-full h-fit">
            <div className="flex justify-between w-full items-center">
              <div className="w-full text-[24px] font-bold text-black dark:text-white">Portfolio</div>
            </div>
            
            <div className="flex flex-col items-center justify-center py-[120px] px-[40px]">
              <div className="text-center">
                <div className="text-6xl mb-4">🔌</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Connect Your Wallet
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Connect your Freighter wallet to view your portfolio and start trading
                </p>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Need a wallet? Download{" "}
                  <a
                    href="https://freighter.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Freighter Wallet
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="py-[80px] px-[40px] w-full h-fit">
        <div className="flex flex-col gap-[40px] w-full h-fit">
          <div className="flex flex-col gap-[20px] w-full h-fit">
            <div className="flex justify-between w-full items-center">
              <div className="w-full text-[24px] font-bold text-black dark:text-white">Portfolio</div>
              <div className="w-full flex gap-[8px] justify-end">
                <Button
                  width="w-[79px]"
                  text="Deposit"
                  size="small"
                  type="solid"
                  disabled={false}
                  onClick={() => setShowDepositModal(true)}
                />
                <Button
                  width="w-[79px]"
                  text="Withdraw"
                  size="small"
                  type="solid"
                  disabled={false}
                  onClick={() => setShowWithdrawModal(true)}
                />
                <Button
                  width="w-[79px]"
                  text="Refresh"
                  size="small"
                  type="ghost"
                  disabled={false}
                  onClick={() => refreshBalances()}
                />
                <Button width="w-[79px]" text="History" size="small" type="ghost" disabled={false} />
              </div>
            </div>

            <PortfolioSection />
            <div className="w-full h-fit">
              <AccountStatsGhost
                items={accountStatsItems}
                type="background"
                gridCols="grid-cols-2"
                gridRows="grid-rows-3"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
      <WithdrawModal isOpen={showWithdrawModal} onClose={() => setShowWithdrawModal(false)} />
    </>
  );
}