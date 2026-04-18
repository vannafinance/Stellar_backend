"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Image from "next/image";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useTheme } from "@/contexts/theme-context";
import { useUserStore } from "@/store/user";
import { useMarginStore } from "@/store/margin-account-state";
import { useMarginAccountInfoStore } from "@/store/margin-account-info-store";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import {
  useFetchAccountCheck,
  useFetchCollateralState,
  useFetchBorrowState,
} from "@/lib/utils/margin/marginFetchers";
import { repayTx, withdrawTx } from "@/lib/utils/margin/transactions";
import { iconPaths } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { TransactionModal } from "@/components/ui/transaction-modal";

/* ─── types ─── */
type AssetRow = { token: string; amount: number; usd: number };

/* ─── animation variants (mirrors one-click-strategy) ─── */
const expandCollapse: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: { opacity: 0, height: 0, transition: { duration: 0.3, ease: "easeInOut" } },
};

const metricVariant: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.3, delay: i * 0.05, ease: "easeOut" },
  }),
};

/* ─── asset badge helper (same style used in one-click-strategy) ─── */
const AssetBadge = ({ symbol, size = 20 }: { symbol: string; size?: number }) => {
  const icon = (iconPaths as Record<string, string>)[symbol];
  if (icon) {
    return <Image src={icon} alt={symbol} width={size} height={size} className="rounded-full" />;
  }
  const palette: Record<string, string> = {
    HYPE: "#703AE6", wstHYPE: "#3B82F6", kHYPE: "#F59E0B",
    PURSE: "#FF007A", USDe: "#10B981", wHYPE: "#703AE6",
  };
  const bg = palette[symbol] || "#595959";
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 border-2 border-white/20"
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: bg }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
};

const EXIT_PERCENTS = [25, 50, 75, 100] as const;

export const LitePositionCard = () => {
  const { isDark } = useTheme();
  const { chainId, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const userAddress = useUserStore((s) => s.address);
  const effectiveAddress = (userAddress || address) as `0x${string}` | undefined;

  const hasMarginAccount = useMarginAccountInfoStore((s) => s.hasMarginAccount);
  const { marginState, reloadMarginState } = useMarginStore();
  const { portfolioAddress } = usePortfolio();

  const fetchAccountCheck = useFetchAccountCheck(chainId, effectiveAddress, publicClient);
  const fetchCollateralState = useFetchCollateralState(chainId, publicClient);
  const fetchBorrowState = useFetchBorrowState(chainId, publicClient);

  useEffect(() => {
    useMarginStore.getState().setFetchers({ fetchAccountCheck, fetchCollateralState, fetchBorrowState });
  }, [fetchAccountCheck, fetchCollateralState, fetchBorrowState]);

  /* ─── exit state ─── */
  const [exitPct, setExitPct] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [txModal, setTxModal] = useState<{
    open: boolean;
    status: "pending" | "success" | "error";
    title: string;
    message: string;
    txHash?: string;
  }>({ open: false, status: "pending", title: "", message: "" });

  /* ─── parse positions from margin state ─── */
  const collateralRows = useMemo<AssetRow[]>(() => {
    const rows = (marginState?.collateral || []) as AssetRow[];
    return rows.filter((r) => r && r.token !== "USD" && r.amount > 0);
  }, [marginState?.collateral]);

  const borrowRows = useMemo<AssetRow[]>(() => {
    const rows = (marginState?.borrow || []) as AssetRow[];
    return rows.filter((r) => r && r.token !== "USD" && r.amount > 0);
  }, [marginState?.borrow]);

  const collateralUsd = marginState?.collateralUsd ?? 0;
  const borrowUsd = marginState?.borrowUsd ?? 0;
  const netValueUsd = collateralUsd - borrowUsd;
  const hf = marginState?.hf ?? 0;
  const leverage = marginState?.leverage ?? 1;

  const hasPosition = hasMarginAccount && (collateralUsd > 0 || borrowUsd > 0);

  /* ─── HF color (matches one-click-strategy convention) ─── */
  const hfColor = hf === Infinity || hf >= 1.5 ? "#10B981" : hf >= 1.2 ? "#F59E0B" : "#FC5457";
  const hfLabel = hf === Infinity ? "—" : hf >= 1.5 ? "Safe" : hf >= 1.2 ? "Caution" : "At Risk";

  /* ─── derived exit amounts ─── */
  const ratio = exitPct / 100;
  const repayPreview = useMemo(
    () => borrowRows.map((r) => ({ ...r, exitAmount: r.amount * ratio, exitUsd: r.usd * ratio })),
    [borrowRows, ratio]
  );
  const withdrawPreview = useMemo(
    () => collateralRows.map((r) => ({ ...r, exitAmount: r.amount * ratio, exitUsd: r.usd * ratio })),
    [collateralRows, ratio]
  );
  const totalRepayUsd = repayPreview.reduce((s, r) => s + r.exitUsd, 0);
  const totalWithdrawUsd = withdrawPreview.reduce((s, r) => s + r.exitUsd, 0);

  /* ─── execute exit ─── */
  const handleExit = useCallback(async () => {
    if (!walletClient || !publicClient || !chainId || !effectiveAddress) return;
    if (!hasPosition) return;

    const steps = repayPreview.length + withdrawPreview.length;
    if (steps === 0) return;

    setLoading(true);
    let stepIdx = 0;
    const nextMsg = (label: string) => `Step ${++stepIdx}/${steps}: ${label}`;

    setTxModal({
      open: true,
      status: "pending",
      title: exitPct === 100 ? "Closing Position" : `Exiting ${exitPct}%`,
      message: "Preparing…",
    });

    try {
      /* 1 — repay each borrowed asset, scaled by ratio */
      for (const row of repayPreview) {
        if (row.exitAmount <= 0) continue;
        setTxModal((p) => ({
          ...p,
          message: nextMsg(`Repaying ${row.exitAmount.toFixed(6)} ${row.token}…`),
        }));
        const amtStr = row.exitAmount.toFixed(row.token === "ETH" ? 8 : 6);
        await repayTx({
          walletClient,
          publicClient,
          chainId,
          fetchAccountCheck,
          asset: row.token,
          amount: amtStr,
          portfolioAddress: portfolioAddress ?? undefined,
        });
      }

      /* refresh so withdrawals see updated health factor */
      await reloadMarginState(true);

      /* 2 — withdraw each collateral asset, scaled by ratio */
      for (const row of withdrawPreview) {
        if (row.exitAmount <= 0) continue;
        setTxModal((p) => ({
          ...p,
          message: nextMsg(`Withdrawing ${row.exitAmount.toFixed(6)} ${row.token}…`),
        }));
        const amtStr = row.exitAmount.toFixed(row.token === "ETH" ? 8 : 6);
        await withdrawTx({
          walletClient,
          publicClient,
          chainId,
          fetchAccountCheck,
          asset: row.token,
          amount: amtStr,
          portfolioAddress: portfolioAddress ?? undefined,
        });
      }

      await reloadMarginState(true);

      setTxModal({
        open: true,
        status: "success",
        title: exitPct === 100 ? "Position Closed" : "Exit Complete",
        message:
          exitPct === 100
            ? `Repaid all debt and withdrew $${totalWithdrawUsd.toFixed(2)} to your wallet.`
            : `Repaid $${totalRepayUsd.toFixed(2)} and withdrew $${totalWithdrawUsd.toFixed(2)}.`,
      });

      setTimeout(() => window.dispatchEvent(new CustomEvent("vanna:position-update")), 2000);
    } catch (err: any) {
      const rejected =
        err?.code === 4001 ||
        err?.message?.includes("User rejected") ||
        err?.message?.includes("user rejected");
      setTxModal({
        open: true,
        status: "error",
        title: rejected ? "Cancelled" : "Exit Failed",
        message: rejected
          ? "Transaction cancelled"
          : err?.message || "Could not complete exit. Try a smaller percentage or use Pro mode for multi-asset positions.",
      });
    } finally {
      setLoading(false);
    }
  }, [
    walletClient, publicClient, chainId, effectiveAddress, hasPosition,
    repayPreview, withdrawPreview, exitPct, totalRepayUsd, totalWithdrawUsd,
    fetchAccountCheck, portfolioAddress, reloadMarginState,
  ]);

  /* ─── don't render if nothing to exit ─── */
  if (!hasPosition) return null;

  /* ─── theme helpers (exact tokens from one-click-strategy) ─── */
  const cardBg = isDark ? "bg-[#1A1A1A] border-[#2C2C2C]" : "bg-white border-[#E5E7EB]";
  const inputBg = isDark ? "bg-[#111111] border-[#2C2C2C]" : "bg-[#F7F7F7] border-[#E5E7EB]";
  const subtleCard = isDark ? "bg-[#151515] border-[#2C2C2C]" : "bg-[#FAFAFA] border-[#F4F4F4]";
  const headingText = isDark ? "text-white" : "text-[#111111]";
  const labelText = isDark ? "text-[#919191]" : "text-[#76737B]";
  const mutedText = isDark ? "text-[#595959]" : "text-[#A9A9A9]";

  const firstBorrowToken =
    (borrowRows[0]?.token as "ETH" | "USDC" | "USDT" | "DAI" | undefined) ?? "USDC";

  return (
    <div className="w-full h-fit flex flex-col">
      {/* ─── HEADER ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`w-full border rounded-t-xl p-4 sm:p-5 ${cardBg}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-gradient shrink-0" />
            <h3 className={`text-[13px] font-semibold leading-5 ${headingText}`}>
              Your Position
            </h3>
            <span className={`text-[10px] font-semibold uppercase tracking-[0.5px] px-2 py-0.5 rounded-full ${isDark ? "bg-[#2C2C2C] text-[#919191]" : "bg-[#F4F4F4] text-[#76737B]"}`}>
              Active
            </span>
          </div>

          {/* HF badge */}
          <div className="flex items-center gap-2">
            <div
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{ backgroundColor: hfColor }}
            />
            <span className="text-[11px] font-semibold" style={{ color: hfColor }}>
              {hfLabel}
            </span>
            <span className={`text-[11px] font-medium ${labelText}`}>
              HF {hf === Infinity ? "∞" : hf.toFixed(2)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── METRICS GRID ─── */}
      <div className={`w-full border border-t-0 p-4 sm:p-5 ${cardBg}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            {
              label: "Collateral",
              value: `$${collateralUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              tint: headingText,
            },
            {
              label: "Borrowed",
              value: `$${borrowUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              tint: headingText,
            },
            {
              label: "Net Value",
              value: `$${netValueUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              tint: "text-[#10B981]",
            },
            {
              label: "Leverage",
              value: `${leverage.toFixed(2)}x`,
              tint: headingText,
            },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={metricVariant}
              className={`rounded-lg border p-3 ${subtleCard}`}
            >
              <div className={`text-[10px] font-semibold uppercase tracking-[0.5px] ${labelText}`}>
                {m.label}
              </div>
              <div className={`text-[16px] sm:text-[18px] font-bold leading-6 mt-1 ${m.tint}`}>
                {m.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── PER-ASSET BREAKDOWN ─── */}
        {(collateralRows.length > 0 || borrowRows.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {/* Collateral list */}
            {collateralRows.length > 0 && (
              <div className={`rounded-lg border p-3 ${inputBg}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-[0.5px] mb-2 ${labelText}`}>
                  Deposited
                </div>
                <div className="flex flex-col gap-1.5">
                  {collateralRows.map((r) => (
                    <div key={`c-${r.token}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AssetBadge symbol={r.token} size={18} />
                        <span className={`text-[13px] font-semibold ${headingText}`}>
                          {r.amount.toFixed(r.token === "ETH" ? 6 : 2)} {r.token}
                        </span>
                      </div>
                      <span className={`text-[11px] ${mutedText}`}>
                        ${r.usd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Borrow list */}
            {borrowRows.length > 0 && (
              <div className={`rounded-lg border p-3 ${inputBg}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-[0.5px] mb-2 ${labelText}`}>
                  Borrowed
                </div>
                <div className="flex flex-col gap-1.5">
                  {borrowRows.map((r) => (
                    <div key={`b-${r.token}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AssetBadge symbol={r.token} size={18} />
                        <span className={`text-[13px] font-semibold ${headingText}`}>
                          {r.amount.toFixed(r.token === "ETH" ? 6 : 2)} {r.token}
                        </span>
                      </div>
                      <span className={`text-[11px] ${mutedText}`}>
                        ${r.usd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── EXIT PERCENT SELECTOR ─── */}
      <div className={`w-full border border-t-0 p-4 sm:p-5 ${cardBg}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-[0_2px_8px_rgba(112,58,230,0.3)]">
            1
          </div>
          <div className="flex flex-col">
            <h3 className={`text-[14px] font-semibold leading-5 ${headingText}`}>
              Choose Exit Amount
            </h3>
            <span className={`text-[11px] leading-4 ${mutedText}`}>
              How much of your position to close
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {EXIT_PERCENTS.map((p) => {
            const active = exitPct === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setExitPct(p)}
                className={`
                  rounded-[12px] border py-2.5 text-[13px] font-bold transition-all
                  ${active
                    ? "bg-gradient text-white border-transparent shadow-[0_2px_12px_rgba(112,58,230,0.35)]"
                    : isDark
                      ? "bg-[#111111] border-[#2C2C2C] text-[#919191] hover:border-[#703AE6]/40"
                      : "bg-[#F7F7F7] border-[#E5E7EB] text-[#76737B] hover:border-[#703AE6]/30"
                  }
                `}
              >
                {p}%
              </button>
            );
          })}
        </div>

        {/* fine-grained slider */}
        <div className="mt-4">
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={exitPct}
            onChange={(e) => setExitPct(Number(e.target.value))}
            className="w-full cursor-pointer accent-[#703AE6]"
          />
          <div className="flex justify-between text-[10px] font-medium mt-1">
            <span className={mutedText}>1%</span>
            <span className="text-[#703AE6] font-bold">{exitPct}%</span>
            <span className={mutedText}>100%</span>
          </div>
        </div>
      </div>

      {/* ─── EXIT PREVIEW ─── */}
      <AnimatePresence>
        <motion.div
          key="exit-preview"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={expandCollapse}
          className="overflow-hidden"
        >
          <div className={`w-full border border-t-0 p-4 sm:p-5 ${cardBg}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-full bg-gradient flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-[0_2px_8px_rgba(112,58,230,0.3)]">
                2
              </div>
              <div className="flex flex-col">
                <h3 className={`text-[14px] font-semibold leading-5 ${headingText}`}>
                  Review
                </h3>
                <span className={`text-[11px] leading-4 ${mutedText}`}>
                  What will happen when you confirm
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {repayPreview.map((r) => (
                <div
                  key={`rp-${r.token}`}
                  className={`flex items-center justify-between rounded-lg border p-3 ${subtleCard}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FC5457]" />
                    <span className={`text-[11px] font-semibold uppercase tracking-[0.5px] ${labelText}`}>
                      Repay
                    </span>
                    <AssetBadge symbol={r.token} size={16} />
                    <span className={`text-[13px] font-semibold ${headingText}`}>
                      {r.exitAmount.toFixed(r.token === "ETH" ? 6 : 2)} {r.token}
                    </span>
                  </div>
                  <span className={`text-[11px] font-medium ${labelText}`}>
                    ≈ ${r.exitUsd.toFixed(2)}
                  </span>
                </div>
              ))}
              {withdrawPreview.map((r) => (
                <div
                  key={`wd-${r.token}`}
                  className={`flex items-center justify-between rounded-lg border p-3 ${subtleCard}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <span className={`text-[11px] font-semibold uppercase tracking-[0.5px] ${labelText}`}>
                      Withdraw
                    </span>
                    <AssetBadge symbol={r.token} size={16} />
                    <span className={`text-[13px] font-semibold ${headingText}`}>
                      {r.exitAmount.toFixed(r.token === "ETH" ? 6 : 2)} {r.token}
                    </span>
                  </div>
                  <span className={`text-[11px] font-medium ${labelText}`}>
                    ≈ ${r.exitUsd.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ─── ACTION BUTTON ─── */}
      <div className={`w-full border border-t-0 rounded-b-xl p-4 sm:p-5 ${cardBg}`}>
        <Button
          text={
            loading
              ? "Processing…"
              : exitPct === 100
                ? "Close Position"
                : `Exit ${exitPct}% of Position`
          }
          size="large"
          type="gradient"
          onClick={handleExit}
          disabled={loading || !effectiveAddress || !hasPosition}
        />
      </div>

      <TransactionModal
        isOpen={txModal.open}
        status={txModal.status}
        title={txModal.title}
        message={txModal.message}
        txHash={txModal.txHash}
        tokenSymbol={firstBorrowToken}
        showFloatingTokens
        onClose={() => setTxModal((p) => ({ ...p, open: false }))}
        onRetry={handleExit}
      />
    </div>
  );
};
