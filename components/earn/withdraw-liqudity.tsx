'use client';

import { useState, useMemo, useEffect } from "react";
import { Dropdown } from "../ui/dropdown";
import { DropdownOptions } from "@/lib/constants";
import { STELLAR_POOLS } from "@/lib/constants/earn";
import { DEPOSIT_PERCENTAGES, PERCENTAGE_COLORS } from "@/lib/constants/margin";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/store/user";
import { useTheme } from "@/contexts/theme-context";
import { useWithdrawLiquidity, usePoolData, useUserPositions } from "@/hooks/use-earn";
import { AssetType } from "@/lib/stellar-utils";
import { useSelectedPoolStore } from "@/store/selected-pool-store";

export const WithdrawLiquidity = () => {
  const { isDark } = useTheme();
  const selectedAsset = useSelectedPoolStore((state) => state.selectedAsset);
  const [selectedOption, setSelectedOption] = useState<string>(selectedAsset);
  const [value, setValue] = useState<string>("");
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  
  const userAddress = useUserStore((state) => state.address);
  
  const { withdraw, isLoading, message, clearMessage } = useWithdrawLiquidity();
  const { pools } = usePoolData();
  const { positions, refresh: refreshPositions, isLoading: isLoadingPositions } = useUserPositions();

  // Sync with selected pool store
  useEffect(() => {
    setSelectedOption(selectedAsset);
  }, [selectedAsset]);

  // Refresh positions when user connects or asset changes
  useEffect(() => {
    if (userAddress) {
      console.log('Refreshing positions for asset:', selectedOption);
      refreshPositions();
    }
  }, [userAddress, selectedOption, refreshPositions]);

  // Get pool stats and user position for selected asset
  const selectedPool = pools[selectedOption as keyof typeof pools];
  const selectedPoolConfig = STELLAR_POOLS[selectedOption as keyof typeof STELLAR_POOLS];
  const userPosition = positions[selectedOption as keyof typeof positions];

  // Log for debugging
  useEffect(() => {
    console.log('User position for', selectedOption, ':', userPosition);
    console.log('All positions:', positions);
  }, [selectedOption, userPosition, positions]);

  // Calculate available vToken balance
  const vTokenBalance = useMemo(() => {
    const balance = userPosition?.vTokenBalance || '0';
    console.log('Calculated vTokenBalance for', selectedOption, ':', balance);
    return balance;
  }, [userPosition, selectedOption]);

  // Show loading state while positions are being fetched
  if (isLoadingPositions && !userPosition) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className={`text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#703AE6] mx-auto mb-2"></div>
          <p>Loading positions...</p>
        </div>
      </div>
    );
  }

  // Calculate estimated underlying tokens to receive
  const estimatedTokens = useMemo(() => {
    const vTokenAmount = parseFloat(value) || 0;
    if (vTokenAmount <= 0) return '0';
    
    const exchangeRate = parseFloat(selectedPool?.exchangeRate || '1');
    return (vTokenAmount * exchangeRate).toFixed(7);
  }, [value, selectedPool]);

  // Handle percentage button click
  const handlePercentageClick = (percent: number) => {
    setSelectedPercentage(percent);
    const maxAmount = parseFloat(vTokenBalance) || 0;
    const calculatedAmount = (maxAmount * percent / 100).toFixed(7);
    setValue(calculatedAmount);
  };

  // Handle withdraw action
  const handleWithdraw = async () => {
    const numAmount = parseFloat(value);
    if (numAmount > 0 && userAddress) {
      const result = await withdraw(numAmount, selectedOption as AssetType);
      if (result.success) {
        setValue("");
        setSelectedPercentage(null);
        refreshPositions();
      }
    }
  };

  // Get button text
  const getButtonText = () => {
    if (!userAddress) return "Connect Wallet";
    if (isLoading) return "Processing...";
    if (!value || parseFloat(value) <= 0) return "Enter Amount";
    if (parseFloat(value) > parseFloat(vTokenBalance)) return "Insufficient Balance";
    return `Withdraw ${estimatedTokens} ${selectedOption}`;
  };

  const isButtonDisabled = 
    !userAddress || 
    isLoading || 
    !value || 
    parseFloat(value) <= 0 || 
    parseFloat(value) > parseFloat(vTokenBalance);

  return (
    <div className="flex flex-col gap-4">
      {/* Asset Selection & Amount Input */}
      <div className={`flex flex-col gap-4 w-full h-fit border rounded-[16px] p-4 ${
        isDark ? "bg-[#111111] border-[#333333]" : "bg-white border-gray-200"
      }`}>
        {/* Asset Selector */}
        <div className="flex justify-between items-center">
          <label className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Withdraw Asset
          </label>
          <div className="flex items-center gap-2">
            <Dropdown
              items={DropdownOptions}
              setSelectedOption={(option) => {
                const optionString = typeof option === 'string' ? option : option.toString();
                setSelectedOption(optionString);
                useSelectedPoolStore.getState().set({ selectedAsset: optionString as AssetType });
              }}
              selectedOption={selectedOption}
              classname="w-fit gap-[4px] items-center"
              dropdownClassname="w-full"
            />
            <span className={`text-sm font-medium ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              → v{selectedOption}
            </span>
          </div>
        </div>

        {/* vToken Amount Input */}
        <div className="flex flex-col gap-2">
          <div className={`p-3 rounded-xl ${isDark ? "bg-[#1a1a1a]" : "bg-gray-50"}`}>
            <div className="flex justify-between items-center mb-2">
              <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                Burn vTokens
              </span>
              <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Balance: {parseFloat(vTokenBalance).toFixed(4)} v{selectedOption}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <input
                type="number"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setSelectedPercentage(null);
                }}
                placeholder="0.00"
                step="0.0000001"
                min="0"
                className={`w-full text-xl font-bold outline-none bg-transparent ${
                  isDark ? "text-white placeholder-gray-600" : "text-gray-900 placeholder-gray-400"
                }`}
              />
              <span className={`text-sm font-semibold ${isDark ? "text-[#703AE6]" : "text-[#703AE6]"}`}>
                v{selectedOption}
              </span>
            </div>
          </div>
        </div>

        {/* Percentage Buttons */}
        <div className="flex gap-2">
          {DEPOSIT_PERCENTAGES.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => handlePercentageClick(percent)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                selectedPercentage === percent
                  ? `${PERCENTAGE_COLORS[percent]} text-white`
                  : isDark
                  ? "bg-[#222222] text-gray-300 hover:bg-[#333333]"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>

      {/* Pool Stats Card */}
      <div className={`rounded-[16px] p-4 ${
        isDark ? "bg-[#111111] border border-[#333333]" : "bg-gray-50 border border-gray-200"
      }`}>
        <h3 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
          Your Position
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Your vTokens</span>
            <span className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {parseFloat(vTokenBalance).toFixed(4)} v{selectedOption}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Exchange Rate</span>
            <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              1 v{selectedOption} = {selectedPool?.exchangeRate || '1.0000'} {selectedOption}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Pool Utilization</span>
            <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              {selectedPool?.utilizationRate || '0'}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>Available Liquidity</span>
            <span className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              {parseFloat(selectedPool?.availableLiquidity || '0').toLocaleString()} {selectedOption}
            </span>
          </div>
        </div>
      </div>

      {/* You Will Receive Card */}
      {value && parseFloat(value) > 0 && (
        <div className={`rounded-[16px] p-4 border-2 border-dashed ${
          isDark ? "bg-[#0D1117] border-green-500/30" : "bg-green-50 border-green-200"
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                You will receive
              </span>
              <span className={`text-xl font-bold text-green-500`}>
                {estimatedTokens} {selectedOption}
              </span>
            </div>
            <div className={`p-2 rounded-full ${isDark ? "bg-green-500/20" : "bg-green-100"}`}>
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className={`text-xs mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Burning v{selectedOption} tokens will return your deposited {selectedOption} plus accrued interest.
          </p>
        </div>
      )}

      {/* Message Display */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-start gap-3 ${
              message.type === 'success' 
                ? 'bg-green-500/10 border border-green-500/20 text-green-500' 
                : message.type === 'error' 
                ? 'bg-red-500/10 border border-red-500/20 text-red-500' 
                : 'bg-[#703AE6]/10 border border-[#703AE6]/20 text-[#703AE6]'
            }`}
          >
            {message.type === 'success' && (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {message.type === 'error' && (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {message.type === 'info' && (
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span className="text-sm">{message.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw Button */}
      <button
        onClick={handleWithdraw}
        disabled={isButtonDisabled}
        className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
          isButtonDisabled
            ? "bg-gray-500 cursor-not-allowed opacity-50"
            : "bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 cursor-pointer"
        }`}
      >
        {getButtonText()}
      </button>

      {/* Contract Info */}
      <div className={`text-xs text-center ${isDark ? "text-gray-600" : "text-gray-400"}`}>
        Contract: {selectedPoolConfig?.lendingProtocol.slice(0, 8)}...{selectedPoolConfig?.lendingProtocol.slice(-8)}
      </div>
    </div>
  );
};
