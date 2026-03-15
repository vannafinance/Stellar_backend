"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useUserStore } from "@/store/user";
import { useFarmStore } from "@/store/farm-store";
import { Button } from "../ui/button";
import { BlendService, BLEND_POOL_ASSETS } from "@/lib/blend-utils";
import { MarginAccountService } from "@/lib/margin-utils";
import { iconPaths } from "@/lib/constants";
import { useMarginAccountInfoStore, refreshBorrowedBalances } from "@/store/margin-account-info-store";
import { useBlendPoolStats } from "@/hooks/use-farm";

const SUPPORTED_TOKENS = ["XLM", "USDC", "EURC"] as const;
type TokenSymbol = (typeof SUPPORTED_TOKENS)[number];

export const AddLiquidity = () => {
  const { isDark } = useTheme();
  const userAddress = useUserStore((state) => state.address);
  const selectedRow = useFarmStore((state) => state.selectedRow);
  const tabType = useFarmStore((state) => state.tabType);

  // Determine initial token from store (for single asset / lending rows)
  const getInitialToken = useCallback((): TokenSymbol => {
    if (tabType === "single" && selectedRow) {
      const firstCell = selectedRow.cell?.[0] as any;
      const title = (firstCell?.title as string | undefined)?.toUpperCase();
      if (title && SUPPORTED_TOKENS.includes(title as TokenSymbol)) {
        return title as TokenSymbol;
      }
    }
    return "XLM";
  }, [tabType, selectedRow]);

  const [selectedToken, setSelectedToken] = useState<TokenSymbol>(getInitialToken);
  const [value, setValue] = useState<string>("");
  // Borrowed balances from margin account (amounts available to route into Blend)
  const borrowedBalances = useMarginAccountInfoStore((s) => s.borrowedBalances);
  const isLoadingBorrowedBalances = useMarginAccountInfoStore((s) => s.isLoadingBorrowedBalances);
  const { stats: poolStats } = useBlendPoolStats();
  const [txStatus, setTxStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [txError, setTxError] = useState<string>("");
  const [marginAccountAddress, setMarginAccountAddress] = useState<string | null>(null);
  const [blendConfigured, setBlendConfigured] = useState<boolean | null>(null);

  // Check if Blend pool is configured in Registry (once on mount)
  useEffect(() => {
    BlendService.isBlendPoolConfigured()
      .then(setBlendConfigured)
      .catch(() => setBlendConfigured(false));
  }, []);

  // Load margin account address whenever wallet changes
  useEffect(() => {
    if (!userAddress) {
      setMarginAccountAddress(null);
      return;
    }
    const stored = MarginAccountService.getStoredMarginAccount(userAddress);
    setMarginAccountAddress(stored?.address ?? null);
  }, [userAddress]);

  // Refresh borrowed balances when margin account or token changes
  useEffect(() => {
    if (!marginAccountAddress) return;
    refreshBorrowedBalances(marginAccountAddress);
  }, [marginAccountAddress, selectedToken]);

  const handleMaxClick = () => {
    const available = borrowedBalances[selectedToken]?.amount ?? "0";
    setValue(available);
  };

  const handleTokenSelect = (token: TokenSymbol) => {
    setSelectedToken(token);
    setValue("");
    setTxStatus("idle");
    setTxError("");
  };

  const handleDeposit = async () => {
    if (!userAddress || !marginAccountAddress) return;
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) return;

    setTxStatus("loading");
    setTxError("");
    setTxHash("");

    // Deposit from margin account → Blend pool via AccountManager.execute
    const result = await BlendService.depositToBlendPool(
      userAddress,
      marginAccountAddress,
      selectedToken,
      amount
    );

    if (result.success) {
      setTxStatus("success");
      setTxHash(result.hash ?? "");
      setValue("");
      // Refresh borrowed balances after deposit
      refreshBorrowedBalances(marginAccountAddress);
    } else {
      setTxStatus("error");
      setTxError(result.error ?? "Deposit failed");
    }
  };

  const poolAsset = BLEND_POOL_ASSETS.find((a) => a.symbol === selectedToken);
  const iconPath = poolAsset?.iconPath ?? iconPaths[selectedToken] ?? "/icons/stellar.svg";

  const isInputValid = parseFloat(value) > 0 && !isNaN(parseFloat(value));
  const availableBorrowed = borrowedBalances[selectedToken]?.amount ?? "0";
  const isOverBalance = parseFloat(value) > parseFloat(availableBorrowed);
  const isSubmitDisabled =
    !userAddress ||
    !marginAccountAddress ||
    blendConfigured === false ||
    !isInputValid ||
    isOverBalance ||
    txStatus === "loading";

  const buttonText = () => {
    if (!userAddress) return "Connect Wallet";
    if (!marginAccountAddress) return "Margin Account Required";
    if (blendConfigured === false) return "Blend Pool Not Configured";
    if (txStatus === "loading") return "Depositing...";
    if (!isInputValid) return "Enter Amount";
    if (isOverBalance) return "Insufficient Borrowed Balance";
    return `Deposit ${selectedToken}`;
  };

  return (
    <div className="w-full h-fit flex flex-col gap-[16px]">
      {/* Token selector tabs */}
      <div className={`w-full h-fit flex rounded-[12px] p-[4px] gap-[4px] ${
        isDark ? "bg-[#1A1A1A]" : "bg-[#F0F0F0]"
      }`}>
        {SUPPORTED_TOKENS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => handleTokenSelect(token)}
            className={`flex-1 flex items-center justify-center gap-[6px] py-[8px] rounded-[8px] text-[13px] font-semibold transition-all ${
              selectedToken === token
                ? "bg-[#703AE6] text-white"
                : isDark
                ? "text-[#919191] hover:text-white"
                : "text-[#76737B] hover:text-[#111111]"
            }`}
          >
            <Image
              src={iconPaths[token] ?? "/icons/stellar.svg"}
              alt={token}
              width={16}
              height={16}
            />
            {token}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className={`w-full h-fit p-[20px] rounded-[16px] ${
        isDark ? "bg-[#111111]" : "bg-white"
      }`}>
        <div className="w-full flex items-center gap-[12px]">
          <div className="w-full h-full flex flex-col gap-[8px]">
            <input
              type="number"
              placeholder="0.00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              min="0"
              className={`w-full h-fit bg-transparent outline-none border-none text-[20px] font-semibold placeholder:text-[#CCCCCC] ${
                isDark ? "text-white" : "text-black"
              } [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            />
            <div className={`text-[11px] font-medium ${
              isDark ? "text-[#919191]" : "text-[#76737B]"
            }`}>
              {isOverBalance ? (
                <span className="text-red-500">Exceeds borrowed balance</span>
              ) : (
                "$0.00"
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-[12px]">
            <div className="flex items-center gap-[6px]">
              <Image src={iconPath} alt={selectedToken} width={20} height={20} />
              <span className={`text-[14px] font-semibold ${
                isDark ? "text-white" : "text-[#111111]"
              }`}>
                {selectedToken}
              </span>
            </div>
            <div className="flex items-center gap-[6px]">
              <span className={`text-[11px] font-medium ${
                isDark ? "text-[#919191]" : "text-[#5C5B5B]"
              }`}>
                {isLoadingBorrowedBalances
                  ? "Loading..."
                  : `Borrowed: ${parseFloat(availableBorrowed).toFixed(4)}`}
              </span>
              {!isLoadingBorrowedBalances && (
                <button
                  type="button"
                  onClick={handleMaxClick}
                  className="text-[11px] font-semibold text-[#703AE6] underline cursor-pointer"
                >
                  Max
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info box */}
      {isInputValid && (
        <div className={`w-full h-fit rounded-[12px] p-[16px] flex flex-col gap-[10px] ${
          isDark ? "bg-[#1A1A1A]" : "bg-[#F7F7F7]"
        }`}>
          <div className="flex justify-between items-center">
            <span className={`text-[12px] font-medium ${
              isDark ? "text-[#919191]" : "text-[#76737B]"
            }`}>
              From
            </span>
            <span className={`text-[12px] font-semibold ${
              isDark ? "text-[#919191]" : "text-[#76737B]"
            }`}>
              Margin Borrow Balance
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-[12px] font-medium ${
              isDark ? "text-[#919191]" : "text-[#76737B]"
            }`}>
              You will supply
            </span>
            <span className={`text-[12px] font-semibold ${
              isDark ? "text-white" : "text-[#111111]"
            }`}>
              {parseFloat(value).toFixed(4)} {selectedToken}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-[12px] font-medium ${
              isDark ? "text-[#919191]" : "text-[#76737B]"
            }`}>
              Protocol
            </span>
            <span className={`text-[12px] font-semibold text-[#703AE6]`}>
              Blend
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-[12px] font-medium ${
              isDark ? "text-[#919191]" : "text-[#76737B]"
            }`}>
              Supply APY
            </span>
            <span className={`text-[12px] font-semibold ${
              isDark ? "text-white" : "text-[#111111]"
            }`}>
              {poolStats[selectedToken]?.supplyAPY ?? "—"}%
            </span>
          </div>
        </div>
      )}

      {/* Blend pool not configured warning */}
      {blendConfigured === false && (
        <div className={`w-full h-fit rounded-[12px] p-[12px] border border-orange-500/30 ${
          isDark ? "bg-orange-500/10" : "bg-orange-50"
        }`}>
          <p className="text-[12px] font-medium text-orange-600">
            Blend pool is not yet configured in the Registry. Please ask the admin to call <code>set_blend_pool_address</code>.
          </p>
        </div>
      )}

      {/* Margin account warning */}
      {userAddress && !marginAccountAddress && (
        <div className={`w-full h-fit rounded-[12px] p-[12px] border border-yellow-500/30 ${
          isDark ? "bg-yellow-500/10" : "bg-yellow-50"
        }`}>
          <p className="text-[12px] font-medium text-yellow-600">
            A margin account is required to supply to Blend. Please create one in the Margin section.
          </p>
        </div>
      )}

      {/* Zero margin balance hint */}
      {userAddress && marginAccountAddress && !isLoadingBorrowedBalances && parseFloat(availableBorrowed) === 0 && (
        <div className={`w-full h-fit rounded-[12px] p-[12px] border border-blue-500/30 ${
          isDark ? "bg-blue-500/10" : "bg-blue-50"
        }`}>
          <p className="text-[12px] font-medium text-blue-600">
            No borrowed {selectedToken} available in your margin account. Borrow {selectedToken} first from the Margin section.
          </p>
        </div>
      )}

      {/* Transaction status */}
      {txStatus === "success" && (
        <div className={`w-full h-fit rounded-[12px] p-[12px] border border-green-500/30 ${
          isDark ? "bg-green-500/10" : "bg-green-50"
        }`}>
          <p className="text-[12px] font-medium text-green-600">
            Deposit successful!{" "}
            {txHash && (
              <span className="break-all text-[11px] opacity-70">{txHash}</span>
            )}
          </p>
        </div>
      )}
      {txStatus === "error" && (
        <div className={`w-full h-fit rounded-[12px] p-[12px] border border-red-500/30 ${
          isDark ? "bg-red-500/10" : "bg-red-50"
        }`}>
          <p className="text-[12px] font-medium text-red-600">{txError}</p>
        </div>
      )}

      <Button
        disabled={isSubmitDisabled}
        type="gradient"
        size="large"
        text={buttonText()}
        onClick={handleDeposit}
      />
    </div>
  );
};
