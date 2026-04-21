'use client';

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { DEPOSIT_PERCENTAGES, PERCENTAGE_COLORS } from "@/lib/constants/margin";
import { iconPaths } from "@/lib/constants";
import { InfoCard } from "../margin/info-card";
import { Button } from "../ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/theme-context";
import { useUserStore } from "@/store/user";
import { useSupplyLiquidity, usePoolData } from "@/hooks/use-earn";
import { AssetType } from "@/lib/stellar-utils";
import { useSelectedPoolStore } from "@/store/selected-pool-store";
import { STELLAR_POOLS } from "@/lib/constants/earn";

const toInternalAsset = (value: string) => {
  if (value === 'BLUSDC' || value === 'USDC') return 'USDC';
  if (value === 'AqUSDC' || value === 'AquiresUSDC' || value === 'AQUARIUS_USDC') return 'AQUARIUS_USDC';
  if (value === 'SoUSDC' || value === 'SoroswapUSDC' || value === 'SOROSWAP_USDC') return 'SOROSWAP_USDC';
  return value;
};

const toDisplayAsset = (value: string) => {
  if (value === 'USDC') return 'BLUSDC';
  if (value === 'AQUARIUS_USDC' || value === 'AquiresUSDC') return 'AqUSDC';
  if (value === 'SOROSWAP_USDC' || value === 'SoroswapUSDC') return 'SoUSDC';
  return value;
};

export const SupplyLiquidityTab = () => {
  const { isDark } = useTheme();
  const selectedAsset = useSelectedPoolStore((state) => state.selectedAsset);
  const selectedOption = toDisplayAsset(selectedAsset);
  const normalizedAsset = toInternalAsset(selectedOption);

  const [amount, setAmount] = useState<string>("");
  const [selectedPercentage, setSelectedPercentage] = useState<number>(0);

  const userAddress = useUserStore((state) => state.address);
  const balance = useUserStore((state) => state.balance);
  const storeTokenBalances = useUserStore((state) => state.tokenBalances);

  const { supply, isLoading, message, clearMessage } = useSupplyLiquidity();
  const { pools } = usePoolData();

  const selectedPool = pools[normalizedAsset as keyof typeof pools];
  const selectedPoolConfig = STELLAR_POOLS[normalizedAsset as keyof typeof STELLAR_POOLS];

  // Calculate available balance
  const availableBalance = useMemo(() => {
    if (normalizedAsset === 'XLM') {
      const xlmBalance = parseFloat(balance) || 0;
      return Math.max(0, xlmBalance - 1);
    } else if (normalizedAsset === 'USDC') {
      return parseFloat(storeTokenBalances.BLEND_USDC || storeTokenBalances.USDC || '0');
    } else if (normalizedAsset === 'AQUARIUS_USDC') {
      return parseFloat(storeTokenBalances.AQUARIUS_USDC || '0');
    } else if (normalizedAsset === 'SOROSWAP_USDC') {
      return parseFloat(storeTokenBalances.SOROSWAP_USDC || '0');
    }
    return 0;
  }, [normalizedAsset, balance, storeTokenBalances]);

  const handlePercentageClick = (percent: number) => {
    setSelectedPercentage(percent);
    if (availableBalance > 0) {
      const calculatedAmount = (availableBalance * percent) / 100;
      setAmount(calculatedAmount.toFixed(7).replace(/\.?0+$/, ""));
    }
  };

  useEffect(() => {
    setAmount("");
    setSelectedPercentage(0);
  }, [selectedAsset]);

  const handleSupply = async () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0 && userAddress) {
      const result = await supply(numAmount, normalizedAsset as AssetType);
      if (result.success) {
        setAmount("");
        setSelectedPercentage(0);
      }
    }
  };

  // Calculate preview data for InfoCard
  const exchangeRate = parseFloat(selectedPool?.exchangeRate || '1');
  const supplyAPY = parseFloat(selectedPool?.supplyAPY || '0');
  const amountNum = parseFloat(amount) || 0;
  const sharesPreview = exchangeRate > 0 ? amountNum / exchangeRate : 0;
  const monthlyEarnings = (amountNum * supplyAPY) / 100 / 12;
  const yearlyEarnings = (amountNum * supplyAPY) / 100;

  const infoData = {
    youGetVToken: sharesPreview,
    tokenPerVToken: exchangeRate,
    currentAPY: supplyAPY,
    baseAPY: supplyAPY * 0.6,
    bonusAPY: supplyAPY * 0.1,
    rewardsAPY: supplyAPY * 0.3,
    projectedMonthlyFrom: monthlyEarnings,
    projectedMonthlyTo: monthlyEarnings * 1.1,
    projectedYearlyFrom: yearlyEarnings,
    projectedYearlyTo: yearlyEarnings * 1.1,
  };

  const infoPropsData = {
    data: infoData,
    expandableSections: [
      {
        title: "More Details",
        headingBold: false,
        defaultExpanded: false,
        items: [
          { id: "baseAPY", name: "Base APY (%)" },
          { id: "bonusAPY", name: "Bonus APY (%)" },
          { id: "rewardsAPY", name: "Rewards APY (%)" },
          { id: "youGetVToken", name: `You Get (v${selectedOption})` },
          { id: "tokenPerVToken", name: `${selectedOption} per v${selectedOption}` },
          { id: "currentAPY", name: "Current APY (%)" },
          { id: "projectedMonthlyFrom", name: "Projected Monthly Earnings (From)" },
          { id: "projectedMonthlyTo", name: "Projected Monthly Earnings (To)" },
          { id: "projectedYearlyFrom", name: "Projected Yearly Earnings (From)" },
          { id: "projectedYearlyTo", name: "Projected Yearly Earnings (To)" },
        ],
      },
    ],
    showExpandable: true,
  };

  const getButtonText = () => {
    if (!userAddress) return "Connect Wallet";
    if (isLoading) return "Supplying...";
    if (!amount || parseFloat(amount) <= 0) return "Enter Amount";
    if (parseFloat(amount) > availableBalance) return "Insufficient Balance";
    return "Supply Liquidity";
  };

  const isButtonDisabled =
    !userAddress || isLoading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance;

  return (
    <>
      {/* Input card */}
      <div className={`w-full rounded-2xl border flex flex-col ${
        isDark ? "bg-[#111111] border-[#2A2A2A]" : "bg-white border-[#EEEEEE]"
      }`}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-3">
          {/* Token pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0 ${
            isDark ? "bg-[#2A2A2A]" : "bg-[#F0F0F0]"
          }`}>
            <Image
              src={iconPaths[selectedOption] || iconPaths[normalizedAsset] || "/icons/stellar.svg"}
              alt={selectedOption}
              width={20}
              height={20}
              className="rounded-full w-5 h-5 flex-none"
            />
            <span className={`text-[14px] font-semibold ${isDark ? "text-white" : "text-[#111111]"}`}>
              {selectedOption}
            </span>
          </div>
          {/* Amount input */}
          <div className="flex-1 min-w-0">
            <label htmlFor="supply-amount" className="sr-only">Supply Amount</label>
            <input
              id="supply-amount"
              onChange={(e) => { setAmount(e.target.value); setSelectedPercentage(0); }}
              value={amount}
              type="number"
              step="any"
              min="0"
              placeholder="0"
              disabled={isLoading}
              className={`w-full text-right text-[28px] font-semibold bg-transparent outline-none placeholder:opacity-20 ${
                isDark ? "text-white placeholder:text-white" : "text-[#111111] placeholder:text-[#111111]"
              } ${isLoading ? "opacity-50" : ""}`}
            />
          </div>
        </div>

        {/* Balance / preview row + % pills */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-1">
            {DEPOSIT_PERCENTAGES.map((pct) => (
              <motion.button
                key={pct}
                type="button"
                disabled={isLoading || availableBalance <= 0}
                onClick={() => handlePercentageClick(pct)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
                transition={{ duration: 0.1 }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer border transition-all ${
                  selectedPercentage === pct
                    ? `${PERCENTAGE_COLORS[pct]} text-white border-transparent`
                    : isDark
                      ? "bg-[#2A2A2A] text-[#A7A7A7] border-[#333333] hover:text-white"
                      : "bg-[#F0F0F0] text-[#888888] hover:text-[#555555] border-[#E2E2E2]"
                } ${isLoading || availableBalance <= 0 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {pct}%
              </motion.button>
            ))}
          </div>
          <span className={`text-[11px] font-medium ${isDark ? "text-[#777777]" : "text-[#A7A7A7]"}`}>
            Balance: {userAddress ? `${availableBalance.toFixed(4)} ${selectedOption}` : `-- ${selectedOption}`}
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-[8px]" aria-label="Supply Details">
        <InfoCard
          data={infoPropsData.data}
          expandableSections={infoPropsData.expandableSections}
          showExpandable={infoPropsData.showExpandable}
        />
      </section>

      <Button
        text={getButtonText()}
        size="large"
        type="gradient"
        disabled={isButtonDisabled}
        onClick={handleSupply}
      />

      {/* Message Display */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                : message.type === 'error'
                ? 'bg-red-500/10 border border-red-500/20 text-red-500'
                : 'bg-[#703AE6]/10 border border-[#703AE6]/20 text-[#703AE6]'
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contract Info */}
      <div className={`text-xs text-center ${isDark ? "text-gray-600" : "text-gray-400"}`}>
        Contract: {selectedPoolConfig?.lendingProtocol.slice(0, 8)}...{selectedPoolConfig?.lendingProtocol.slice(-8)}
      </div>
    </>
  );
};
