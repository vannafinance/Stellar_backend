"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/theme-context";
import { useUserStore } from "@/store/user";
import { useFarmStore } from "@/store/farm-store";
import { Button } from "../ui/button";
import { BlendService, BLEND_POOL_ASSETS } from "@/lib/blend-utils";
import { AquariusService, AquariusPoolStats } from "@/lib/aquarius-utils";
import { SoroswapService, SoroswapPoolStats } from "@/lib/soroswap-utils";
import { CONTRACT_ADDRESSES } from "@/lib/stellar-utils";
import { MarginAccountService } from "@/lib/margin-utils";
import { iconPaths } from "@/lib/constants";
import { useMarginAccountInfoStore, refreshBorrowedBalances } from "@/store/margin-account-info-store";
import { useBlendPoolStats } from "@/hooks/use-farm";
import { useBlendStore } from "@/store/blend-store";

const SUPPORTED_TOKENS = ["XLM", "USDC"] as const;
type TokenSymbol = (typeof SUPPORTED_TOKENS)[number];

export const AddLiquidity = () => {
  const { isDark } = useTheme();
  const userAddress = useUserStore((state) => state.address);
  const selectedRow = useFarmStore((state) => state.selectedRow);
  const tabType = useFarmStore((state) => state.tabType);
  const isAquariusPool =
    tabType === "multi" &&
    ((selectedRow?.cell?.[1] as any)?.title?.toLowerCase?.() === "aquarius" ||
      (selectedRow?.cell?.[0] as any)?.tags?.includes?.("Aquarius"));

  const isSoroswapPool =
    tabType === "multi" &&
    ((selectedRow?.cell?.[1] as any)?.title?.toLowerCase?.() === "soroswap" ||
      (selectedRow?.cell?.[0] as any)?.tags?.includes?.("Soroswap"));

  const poolTokens =
    (selectedRow?.cell?.[0] as any)?.titles?.map((t: string) => t.toUpperCase()) ?? ["XLM", "USDC"];
  const tokenA = poolTokens[0] ?? "XLM";
  const tokenB = poolTokens[1] ?? "USDC";

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

  const triggerBlendRefresh = useBlendStore((s) => s.triggerRefresh);

  const [selectedToken, setSelectedToken] = useState<TokenSymbol>(getInitialToken);
  const [value, setValue] = useState<string>("");
  const [amountA, setAmountA] = useState<string>("");
  const [amountB, setAmountB] = useState<string>("");
  // Borrowed balances from margin account (amounts available to route into Blend)
  const borrowedBalances = useMarginAccountInfoStore((s) => s.borrowedBalances);
  const isLoadingBorrowedBalances = useMarginAccountInfoStore((s) => s.isLoadingBorrowedBalances);
  const { stats: poolStats } = useBlendPoolStats();
  const [txStatus, setTxStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [txError, setTxError] = useState<string>("");
  const [marginAccountAddress, setMarginAccountAddress] = useState<string | null>(null);
  const [blendConfigured, setBlendConfigured] = useState<boolean | null>(null);
  const [aquariusRegistryMissing, setAquariusRegistryMissing] = useState(false);
  const [aquariusPoolStats, setAquariusPoolStats] = useState<AquariusPoolStats | null>(null);
  const [soroswapPoolStats, setSoroswapPoolStats] = useState<SoroswapPoolStats | null>(null);
  // Current Blend supply balance for the selected token
  const [blendBalance, setBlendBalance] = useState<string>("0");
  const [loadingBlendBalance, setLoadingBlendBalance] = useState(false);
  const [marginXlmBalance, setMarginXlmBalance] = useState<string>("0");
  const [marginUsdcBalance, setMarginUsdcBalance] = useState<string>("0");
  const [loadingMarginBalances, setLoadingMarginBalances] = useState(false);

  const refreshDexMarginBalances = useCallback(
    async (retryCount = 1, retryDelayMs = 1200) => {
      if ((!isAquariusPool && !isSoroswapPool) || !marginAccountAddress) return;

      setLoadingMarginBalances(true);
      try {
        for (let attempt = 0; attempt < retryCount; attempt++) {
          const [xlm, usdc] = isSoroswapPool
            ? await Promise.all([
                SoroswapService.getMarginAccountTokenBalance(marginAccountAddress, "XLM"),
                SoroswapService.getMarginAccountTokenBalance(marginAccountAddress, "USDC"),
              ])
            : await Promise.all([
                AquariusService.getMarginAccountTokenBalance(marginAccountAddress, "XLM"),
                AquariusService.getMarginAccountTokenBalance(marginAccountAddress, "USDC"),
              ]);

          setMarginXlmBalance(xlm);
          setMarginUsdcBalance(usdc);

          if (attempt < retryCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          }
        }
      } finally {
        setLoadingMarginBalances(false);
      }
    },
    [isAquariusPool, isSoroswapPool, marginAccountAddress]
  );

  // Check protocol configuration (once on mount)
  useEffect(() => {
    if (!isAquariusPool && !isSoroswapPool) {
      BlendService.isBlendPoolConfigured()
        .then(setBlendConfigured)
        .catch(() => setBlendConfigured(false));
      return;
    }

    if (isAquariusPool) {
      // Always usable via hardcoded fallback — check Registry separately for info only
      AquariusService.isAquariusConfigured()
        .then((configured) => setAquariusRegistryMissing(!configured))
        .catch(() => setAquariusRegistryMissing(true));
      // Fetch pool stats for ratio calculation
      AquariusService.getAquariusPoolStats(CONTRACT_ADDRESSES.AQUARIUS_XLM_USDC_POOL)
        .then(setAquariusPoolStats)
        .catch(() => setAquariusPoolStats(null));
      setSoroswapPoolStats(null);
      return;
    }

    if (isSoroswapPool) {
      setAquariusRegistryMissing(false);
      SoroswapService.getPoolStats()
        .then(setSoroswapPoolStats)
        .catch(() => setSoroswapPoolStats(null));
      setAquariusPoolStats(null);
    }
  }, [isAquariusPool, isSoroswapPool]);

  // Auto-calculate tokenB when user types tokenA (and vice versa)
  const handleAmountAChange = (val: string) => {
    setAmountA(val);
    const parsed = parseFloat(val);
    // For Aquarius get_reserves() token order is [USDC, XLM] (sorted by address),
    // while this panel token order is [XLM, USDC]. Map reserves by symbol first.
    const xlmReserve = isSoroswapPool
      ? parseFloat(soroswapPoolStats?.reserveXLM ?? "0")
      : parseFloat(aquariusPoolStats?.reserveB ?? "0");
    const usdcReserve = isSoroswapPool
      ? parseFloat(soroswapPoolStats?.reserveUSDC ?? "0")
      : parseFloat(aquariusPoolStats?.reserveA ?? "0");
    const reserveA = tokenA === "XLM" ? xlmReserve : usdcReserve;
    const reserveB = tokenB === "USDC" ? usdcReserve : xlmReserve;

    if (!isNaN(parsed) && parsed > 0 && reserveA > 0 && reserveB > 0) {
      const rA = reserveA;
      const rB = reserveB;
      if (rA > 0) setAmountB((parsed * rB / rA).toFixed(7));
    } else if (val === '') {
      setAmountB('');
    }
  };

  const handleAmountBChange = (val: string) => {
    setAmountB(val);
    const parsed = parseFloat(val);
    const xlmReserve = isSoroswapPool
      ? parseFloat(soroswapPoolStats?.reserveXLM ?? "0")
      : parseFloat(aquariusPoolStats?.reserveB ?? "0");
    const usdcReserve = isSoroswapPool
      ? parseFloat(soroswapPoolStats?.reserveUSDC ?? "0")
      : parseFloat(aquariusPoolStats?.reserveA ?? "0");
    const reserveA = tokenA === "XLM" ? xlmReserve : usdcReserve;
    const reserveB = tokenB === "USDC" ? usdcReserve : xlmReserve;

    if (!isNaN(parsed) && parsed > 0 && reserveA > 0 && reserveB > 0) {
      const rA = reserveA;
      const rB = reserveB;
      if (rB > 0) setAmountA((parsed * rA / rB).toFixed(7));
    } else if (val === '') {
      setAmountA('');
    }
  };

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

  // Fetch actual margin account token balances for multi-asset pool display
  useEffect(() => {
    if ((!isAquariusPool && !isSoroswapPool) || !marginAccountAddress) {
      setMarginXlmBalance("0");
      setMarginUsdcBalance("0");
      return;
    }
    refreshDexMarginBalances();
  }, [isAquariusPool, isSoroswapPool, marginAccountAddress, txHash, refreshDexMarginBalances]);

  // Fetch current Blend supply balance for selected token
  useEffect(() => {
    if (!marginAccountAddress) {
      setBlendBalance("0");
      return;
    }
    setLoadingBlendBalance(true);
    BlendService.getUserBlendBalance(marginAccountAddress, selectedToken)
      .then((info) => setBlendBalance(info.underlyingBalance))
      .catch(() => setBlendBalance("0"))
      .finally(() => setLoadingBlendBalance(false));
  }, [marginAccountAddress, selectedToken]);


  const handleMaxClick = () => {
    setValue(availableToDeployStr);
  };

  const handleTokenSelect = (token: TokenSymbol) => {
    setSelectedToken(token);
    setValue("");
    setAmountA("");
    setAmountB("");
    setTxStatus("idle");
    setTxError("");
  };

  const handleAddLiquidity = async () => {
    if (!userAddress || !marginAccountAddress) return;

    const amtA = parseFloat(amountA);
    const amtB = parseFloat(amountB);
    if (isNaN(amtA) || isNaN(amtB) || amtA <= 0 || amtB <= 0) return;

    setTxStatus("loading");
    setTxError("");
    setTxHash("");

    const result = isSoroswapPool
      ? await SoroswapService.addLiquidity(
          userAddress,
          marginAccountAddress,
          amtA,
          amtB
        )
      : await AquariusService.addLiquidity(
          userAddress,
          marginAccountAddress,
          tokenA,
          tokenB,
          amtA,
          amtB
        );

    if (result.success) {
      setTxStatus("success");
      setTxHash(result.hash ?? "");
      // Optimistic UI update to reflect balances instantly; canonical values are re-fetched below.
      const nextXlm = Math.max(0, parseFloat(marginXlmBalance || "0") - amtA);
      const nextUsdc = Math.max(0, parseFloat(marginUsdcBalance || "0") - amtB);
      setMarginXlmBalance(nextXlm.toFixed(7));
      setMarginUsdcBalance(nextUsdc.toFixed(7));
      setAmountA("");
      setAmountB("");
      // Refresh canonical balances and pool stats; retries absorb RPC indexing delay.
      refreshDexMarginBalances(3, 1500);
      if (isSoroswapPool) {
        SoroswapService.getPoolStats().then(setSoroswapPoolStats).catch(() => {});
      } else {
        AquariusService.getAquariusPoolStats(CONTRACT_ADDRESSES.AQUARIUS_XLM_USDC_POOL)
          .then(setAquariusPoolStats)
          .catch(() => {});
      }

      // Keep store-level data in sync for other pages that derive margin info.
      refreshBorrowedBalances(marginAccountAddress);
      triggerBlendRefresh();
    } else {
      setTxStatus("error");
      const message = result.error ?? "Add liquidity failed";
      setTxError(message);
    }
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
      // Refresh Blend positions (positions table + events) after a short delay
      // to allow the RPC node to reflect the confirmed transaction state
      setTimeout(() => {
        triggerBlendRefresh();
        BlendService.getUserBlendBalance(marginAccountAddress, selectedToken)
          .then((info) => setBlendBalance(info.underlyingBalance))
          .catch(() => {});
      }, 3000);
    } else {
      setTxStatus("error");
      setTxError(result.error ?? "Deposit failed");
    }
  };

  const poolAsset = BLEND_POOL_ASSETS.find((a) => a.symbol === selectedToken);
  const iconPath = poolAsset?.iconPath ?? iconPaths[selectedToken] ?? "/icons/stellar.svg";

  const isInputValid = parseFloat(value) > 0 && !isNaN(parseFloat(value));
  const totalBorrowed = parseFloat(borrowedBalances[selectedToken]?.amount ?? "0");
  const blendDeployed = parseFloat(blendBalance);
  // Available to deploy = borrowed funds not yet sent to any protocol
  const availableToDeployNum = Math.max(0, totalBorrowed - blendDeployed);
  const availableToDeployStr = availableToDeployNum.toFixed(7);
  const isOverBalance = parseFloat(value) > availableToDeployNum;
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
    if (isOverBalance) return "Insufficient Available Balance";
    return `Deposit ${selectedToken}`;
  };

  if (isAquariusPool || isSoroswapPool) {
    const dexName = isSoroswapPool ? "Soroswap" : "Aquarius";
    const xlmReserve = isSoroswapPool
      ? parseFloat(soroswapPoolStats?.reserveXLM ?? "0")
      : parseFloat(aquariusPoolStats?.reserveB ?? "0");
    const usdcReserve = isSoroswapPool
      ? parseFloat(soroswapPoolStats?.reserveUSDC ?? "0")
      : parseFloat(aquariusPoolStats?.reserveA ?? "0");
    const reserveA = tokenA === "XLM" ? xlmReserve : usdcReserve;
    const reserveB = tokenB === "USDC" ? usdcReserve : xlmReserve;

    const availableA = tokenA === "XLM" ? marginXlmBalance : marginUsdcBalance;
    const availableB = tokenB === "USDC" ? marginUsdcBalance : marginXlmBalance;
    const isInputValid = parseFloat(amountA) > 0 && parseFloat(amountB) > 0;
    const isOverA = parseFloat(amountA) > parseFloat(availableA);
    const isOverB = parseFloat(amountB) > parseFloat(availableB);
    const isSubmitDisabled =
      !userAddress ||
      !marginAccountAddress ||
      !isInputValid ||
      isOverA ||
      isOverB ||
      txStatus === "loading";

    const buttonText = () => {
      if (!userAddress) return "Connect Wallet";
      if (!marginAccountAddress) return "Margin Account Required";
      if (txStatus === "loading") return "Adding Liquidity...";
      if (!isInputValid) return "Enter Amounts";
      if (isOverA || isOverB) return "Insufficient Balance";
      return `Add ${tokenA}/${tokenB} (${dexName})`;
    };

    return (
      <div className="w-full h-fit flex flex-col gap-[16px]">
        <div className={`w-full h-fit p-[20px] rounded-[16px] ${
          isDark ? "bg-[#111111]" : "bg-white"
        }`}>
          {(reserveA > 0 && reserveB > 0) && (
            <div className={`text-[11px] font-medium mb-[4px] ${isDark ? "text-[#919191]" : "text-[#76737B]"}`}>
              1 {tokenB} ≈ {(reserveA / reserveB).toFixed(4)} {tokenA}
              &nbsp;·&nbsp;
              1 {tokenA} ≈ {(reserveB / reserveA).toFixed(4)} {tokenB}
            </div>
          )}
          <div className="w-full flex flex-col gap-[12px]">
            {[tokenA, tokenB].map((token, idx) => (
              <div
                key={token}
                className={`w-full h-fit flex items-center gap-[12px] p-[12px] rounded-[12px] ${
                  isDark ? "bg-[#1A1A1A]" : "bg-[#F7F7F7]"
                }`}
              >
                <input
                  type="number"
                  placeholder="0.00"
                  value={idx === 0 ? amountA : amountB}
                  onChange={(e) => idx === 0 ? handleAmountAChange(e.target.value) : handleAmountBChange(e.target.value)}
                  min="0"
                  className={`w-full bg-transparent outline-none border-none text-[18px] font-semibold placeholder:text-[#CCCCCC] ${
                    isDark ? "text-white" : "text-black"
                  } [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                />
                <div className="flex flex-col items-end gap-[6px]">
                  <div className="flex items-center gap-[6px]">
                    <Image
                      src={iconPaths[token] ?? "/icons/stellar.svg"}
                      alt={token}
                      width={18}
                      height={18}
                    />
                    <span className={`text-[13px] font-semibold ${
                      isDark ? "text-white" : "text-[#111111]"
                    }`}>
                      {token}
                    </span>
                  </div>
                  <span className={`text-[11px] font-medium ${
                    isDark ? "text-[#919191]" : "text-[#5C5B5B]"
                  }`}>
                    {loadingMarginBalances
                      ? "Loading..."
                      : `Balance: ${parseFloat(idx === 0 ? availableA : availableB).toFixed(7)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isAquariusPool && aquariusRegistryMissing && (
          <div className={`w-full h-fit p-[12px] rounded-[12px] text-[12px] ${
            isDark ? "bg-[#1A1A1A] text-[#FFA07A]" : "bg-[#FFF8F0] text-[#C05000]"
          }`}>
            Registry not configured — using default Aquarius addresses. LP position tracking requires
            the admin to run <code>set_aquarius_router_address</code> and{" "}
            <code>set_aquarius_pool_index</code> on the Registry.
          </div>
        )}

        {isSoroswapPool && (
          <div className={`w-full h-fit p-[12px] rounded-[12px] text-[12px] ${
            isDark ? "bg-[#1A1A1A] text-[#8AB4FF]" : "bg-[#F1F7FF] text-[#1E4FA8]"
          }`}>
            LP positions are tracked on-chain from your margin account Soroswap LP token balance.
          </div>
        )}

        <Button
          text={buttonText()}
          size="large"
          type="solid"
          disabled={isSubmitDisabled}
          onClick={handleAddLiquidity}
        />

        {txStatus === "error" && txError && (
          <div className="text-red-500 text-[12px]">{txError}</div>
        )}
        {txStatus === "success" && txHash && (
          <div className="text-green-500 text-[12px]">Transaction submitted: {txHash}</div>
        )}
      </div>
    );
  }

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
            <div className="flex flex-col items-end gap-[4px]">
              <div className="flex items-center gap-[6px]">
                <span className={`text-[11px] font-medium ${
                  isDark ? "text-[#919191]" : "text-[#5C5B5B]"
                }`}>
                  {isLoadingBorrowedBalances
                    ? "Loading..."
                    : `Available: ${availableToDeployNum.toFixed(4)}`}
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
              <span className={`text-[11px] font-medium ${
                isDark ? "text-[#4CAF50]" : "text-[#2E7D32]"
              }`}>
                {loadingBlendBalance
                  ? "..."
                  : `In Blend Pool: ${parseFloat(blendBalance).toFixed(4)}`}
              </span>
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

      {/* Position tracking info */}
      {marginAccountAddress && (
        <div className={`w-full h-fit rounded-[12px] p-[12px] flex flex-col gap-[6px] ${
          isDark ? "bg-[#1A1A1A]" : "bg-[#F7F7F7]"
        }`}>
          <span className={`text-[11px] font-semibold ${isDark ? "text-[#CCCCCC]" : "text-[#444]"}`}>
            Position Tracking
          </span>
          <p className={`text-[11px] ${isDark ? "text-[#919191]" : "text-[#76737B]"}`}>
            Your Blend b-tokens are held by your margin account (not your wallet directly).
            Track your position in the <strong>Current Position</strong> table below.
          </p>
          {availableToDeployNum === 0 && blendDeployed > 0 && (
            <p className={`text-[11px] font-medium text-[#4CAF50]`}>
              All borrowed {selectedToken} is deployed into Blend ({blendDeployed.toFixed(4)} {selectedToken}).
            </p>
          )}
        </div>
      )}

      {/* Zero margin balance hint */}
      {userAddress && marginAccountAddress && !isLoadingBorrowedBalances && totalBorrowed === 0 && (
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
