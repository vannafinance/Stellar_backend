"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useDeposit } from "@/hooks/use-wallet";
import { ASSET_TYPES, AssetType } from "@/lib/stellar-utils";
import { useUserStore } from "@/store/user";
import { useTheme } from "@/contexts/theme-context";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetType>(ASSET_TYPES.XLM);
  const { deposit, isLoading, message, clearMessage } = useDeposit();
  const balance = useUserStore((state) => state.balance);
  const { isDark } = useTheme();

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      const result = await deposit(numAmount, selectedAsset);
      if (result.success) {
        setAmount("");
        setTimeout(() => {
          onClose();
          clearMessage();
        }, 2000);
      }
    }
  };

  const handleClose = () => {
    setAmount("");
    clearMessage();
    onClose();
  };

  const setPercentage = (percent: number) => {
    const currentBalance = parseFloat(balance) || 0;
    setAmount((currentBalance * percent).toFixed(7));
  };

  const assetIcons: Record<string, string> = {
    XLM: "✦",
    USDC: "$",
    EURC: "€",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={handleClose}
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`${
                isDark ? "bg-[#1A1A1A] border-[#333333]" : "bg-white border-gray-200"
              } border rounded-[20px] p-6 w-full max-w-[420px] mx-4 shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#703AE6] to-[#FF007A] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                      Deposit Assets
                    </h2>
                    <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      Add funds to your portfolio
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isDark ? "hover:bg-[#333333] text-gray-400" : "hover:bg-gray-100 text-gray-500"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Asset Selection */}
              <div className="mb-5">
                <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Select Asset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(ASSET_TYPES).map((asset) => (
                    <button
                      key={asset}
                      onClick={() => setSelectedAsset(asset)}
                      className={`py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm flex flex-col items-center gap-1 ${
                        selectedAsset === asset
                          ? "border-[#703AE6] bg-[#703AE6]/10 text-[#703AE6]"
                          : isDark
                          ? "border-[#333333] bg-[#222222] text-gray-300 hover:border-[#444444]"
                          : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-lg">{assetIcons[asset]}</span>
                      <span>{asset}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-5">
                <label className={`block text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Amount
                </label>
                <div className={`relative rounded-xl border-2 transition-colors ${
                  isDark ? "border-[#333333] bg-[#222222]" : "border-gray-200 bg-gray-50"
                } focus-within:border-[#703AE6]`}>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.0000001"
                    min="0"
                    className={`w-full p-4 pr-16 bg-transparent text-lg font-semibold outline-none ${
                      isDark ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
                    }`}
                  />
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}>
                    <span className="text-sm font-medium">{selectedAsset}</span>
                  </div>
                </div>
                
                {/* Quick Amount Buttons */}
                {selectedAsset === ASSET_TYPES.XLM && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        Available: <span className="font-semibold">{balance} XLM</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {[0.25, 0.5, 0.75, 1].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => setPercentage(percent)}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                            isDark
                              ? "bg-[#333333] text-gray-300 hover:bg-[#444444] hover:text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                          }`}
                        >
                          {percent === 1 ? "MAX" : `${percent * 100}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Message Display */}
              <AnimatePresence>
                {message.text && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mb-5 p-4 rounded-xl flex items-center gap-3 ${
                      message.type === 'success' 
                        ? 'bg-green-500/10 border border-green-500/20 text-green-500' 
                        : message.type === 'error' 
                        ? 'bg-red-500/10 border border-red-500/20 text-red-500' 
                        : 'bg-[#703AE6]/10 border border-[#703AE6]/20 text-[#703AE6]'
                    }`}
                  >
                    {message.type === 'success' && (
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {message.type === 'error' && (
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {message.type === 'info' && (
                      <svg className="w-5 h-5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    <span className="text-sm font-medium">{message.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  text="Cancel"
                  size="medium"
                  type="ghost"
                  disabled={isLoading}
                  onClick={handleClose}
                />
                <Button
                  text={isLoading ? "Processing..." : "Deposit"}
                  size="medium"
                  type="solid"
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                  onClick={handleDeposit}
                />
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};