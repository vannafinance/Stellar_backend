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
import { PERCENTAGE_COLORS } from "@/lib/constants/margin";

const SUPPORTED_TOKENS = ["XLM", "USDC", "EURC"] as const;
type TokenSymbol = (typeof SUPPORTED_TOKENS)[number];

const PERCENTAGE_OPTIONS = [25, 50, 75, 100] as const;

export const RemoveLiquidity = () => {
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
  const [selectedPercentage, setSelectedPercentage] = useState<number>(0);
  const [blendBalance, setBlendBalance] = useState<string>("0");
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
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

  // Load margin account
  useEffect(() => {
    if (!userAddress) {
      setMarginAccountAddress(null);
      return;
    }
    const stored = MarginAccountService.getStoredMarginAccount(userAddress);
    setMarginAccountAddress(stored?.address ?? null);
  }, [userAddress]);

  // Fetch Blend balance when margin account or token changes
  useEffect(() => {
    if (!marginAccountAddress) {
      setBlendBalance("0");
      return;
    }
    setLoadingBalance(true);
    BlendService.getUserBlendBalance(marginAccountAddress, selectedToken)
      .then((info) => setBlendBalance(info.underlyingBalance))
      .catch(() => setBlendBalance("0"))
      .finally(() => setLoadingBalance(false));
  }, [marginAccountAddress, selectedToken]);

  const handleTokenSelect = (token: TokenSymbol) => {
    setSelectedToken(token);
    setValue("");
    setSelectedPercentage(0);
    setTxStatus("idle");
    setTxError("");
  };

  const handlePercentageSelect = (pct: number) => {
    setSelectedPercentage(pct);
    const balance = parseFloat(blendBalance);
    if (!isNaN(balance) && balance > 0) {
      setValue(((balance * pct) / 100).toFixed(7));
    }
  };

  const handleWithdraw = async () => {
    if (!userAddress || !marginAccountAddress) return;
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) return;

    setTxStatus("loading");
    setTxError("");
    setTxHash("");

    const result = await BlendService.withdrawFromBlendPool(
      userAddress,
      marginAccountAddress,
      selectedToken,
      amount
    );

    if (result.success) {
      setTxStatus("success");
      setTxHash(result.hash ?? "");
      setValue("");
      setSelectedPercentage(0);
      // Refresh balance after withdrawal
      BlendService.getUserBlendBalance(marginAccountAddress, selectedToken).then((info) =>
        setBlendBalance(info.underlyingBalance)
      );
    } else {
      setTxStatus("error");
      setTxError(result.error ?? "Withdrawal failed");
    }
  };

  const poolAsset = BLEND_POOL_ASSETS.find((a) => a.symbol === selectedToken);
  const iconPath = poolAsset?.iconPath ?? iconPaths[selectedToken] ?? "/icons/stellar.svg";

  const isInputValid = parseFloat(value) > 0 && !isNaN(parseFloat(value));
  const isOverBalance = parseFloat(value) > parseFloat(blendBalance);
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
    if (txStatus === "loading") return "Withdrawing...";
    if (!isInputValid) return "Enter Amount";
    if (isOverBalance) return "Insufficient Balance";
    return `Withdraw ${selectedToken}`;
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

      {/* Blend balance display */}
      <div className={`w-full h-fit rounded-[12px] p-[14px] flex justify-between items-center ${
        isDark ? "bg-[#1A1A1A]" : "bg-[#F7F7F7]"
      }`}>
        <span className={`text-[12px] font-medium ${
          isDark ? "text-[#919191]" : "text-[#76737B]"
        }`}>
          Your Blend Supply Balance
        </span>
        <div className="flex items-center gap-[6px]">
          <Image src={iconPath} alt={selectedToken} width={16} height={16} />
          <span className={`text-[13px] font-semibold ${
            isDark ? "text-white" : "text-[#111111]"
          }`}>
            {loadingBalance
              ? "Loading..."
              : `${parseFloat(blendBalance).toFixed(4)} ${selectedToken}`}
          </span>
        </div>
      </div>

      {/* Amount input with percentage selectors */}
      <div className={`w-full h-fit flex rounded-[16px] gap-[8px] p-[20px] ${
        isDark ? "bg-[#111111]" : "bg-[#FFFFFF]"
      }`}>
        <div className="w-full h-fit flex flex-col gap-[16px]">
          <div className="flex flex-col gap-[6px]">
            <input
              type="number"
              placeholder="0.00"
              className={`w-full h-fit text-[20px] font-semibold placeholder:text-[#CCCCCC] outline-none border-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                isDark ? "text-white" : "text-[#111111]"
              }`}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSelectedPercentage(0);
              }}
              min="0"
            />
            <div className={`text-[11px] font-medium ${
              isDark ? "text-[#919191]" : "text-[#76737B]"
            }`}>
              {isOverBalance ? (
                <span className="text-red-500">Exceeds balance</span>
              ) : (
                "$0.00"
              )}
            </div>
          </div>

          {/* Percentage buttons */}
          <div className="flex gap-[6px]">
            {PERCENTAGE_OPTIONS.map((pct) => {
              const selectedColor = PERCENTAGE_COLORS[pct] || "bg-[#703AE6]";
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentageSelect(pct)}
                  className={`flex-1 flex justify-center items-center cursor-pointer text-[12px] font-semibold h-[32px] rounded-[8px] transition-all ${
                    selectedPercentage === pct
                      ? `${selectedColor} text-white`
                      : isDark
                      ? "bg-[#222222] text-white"
                      : "bg-[#F4F4F4] text-[#111111]"
                  }`}
                  aria-pressed={selectedPercentage === pct}
                  aria-label={`Select ${pct}%`}
                >
                  {pct}%
                </button>
              );
            })}
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
              You will receive
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
            <span className="text-[12px] font-semibold text-[#703AE6]">
              Blend
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
            A margin account is required to withdraw from Blend. Please create one in the Margin section.
          </p>
        </div>
      )}

      {/* Transaction status */}
      {txStatus === "success" && (
        <div className={`w-full h-fit rounded-[12px] p-[12px] border border-green-500/30 ${
          isDark ? "bg-green-500/10" : "bg-green-50"
        }`}>
          <p className="text-[12px] font-medium text-green-600">
            Withdrawal successful!{" "}
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
        onClick={handleWithdraw}
      />
    </div>
  );
};
