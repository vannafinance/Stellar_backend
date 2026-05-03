"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme-context";
import {
  FAUCET_TOKEN_META,
  type FaucetTokenId,
  type FaucetResult,
  runFaucet,
} from "@/lib/faucet-utils";
import toast from "react-hot-toast";

interface FaucetPopupProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string | null;
}

type Status = "idle" | "loading" | "success" | "error";

interface RowState {
  status: Status;
  message?: string;
  hash?: string;
}

const ALL_TOKENS: FaucetTokenId[] = ["XLM", "BLEND_USDC", "AQUARIUS_USDC", "SOROSWAP_USDC"];

const initialRows = (): Record<FaucetTokenId, RowState> => ({
  XLM: { status: "idle" },
  BLEND_USDC: { status: "idle" },
  AQUARIUS_USDC: { status: "idle" },
  SOROSWAP_USDC: { status: "idle" },
});

export const FaucetPopup = ({ isOpen, onClose, walletAddress }: FaucetPopupProps) => {
  const { isDark } = useTheme();
  const [rows, setRows] = useState<Record<FaucetTokenId, RowState>>(initialRows);
  const [isMintingAll, setIsMintingAll] = useState(false);

  const updateRow = (token: FaucetTokenId, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [token]: { ...prev[token], ...patch } }));
  };

  const applyResult = (token: FaucetTokenId, result: FaucetResult) => {
    if (result.ok) {
      const message = result.alreadyFunded ? "Already funded" : "Minted";
      updateRow(token, { status: "success", message, hash: result.hash });
    } else {
      updateRow(token, { status: "error", message: result.error || "Failed" });
    }
  };

  const mintOne = async (token: FaucetTokenId) => {
    if (!walletAddress) {
      toast.error("Connect your wallet first");
      return;
    }
    updateRow(token, { status: "loading", message: undefined });
    const result = await runFaucet(token, walletAddress);
    applyResult(token, result);
    if (!result.ok) toast.error(`${FAUCET_TOKEN_META[token].label}: ${result.error}`);
    else toast.success(`${FAUCET_TOKEN_META[token].label} minted`);
  };

  const mintAll = async () => {
    if (!walletAddress) {
      toast.error("Connect your wallet first");
      return;
    }
    setIsMintingAll(true);
    // XLM first — the account has to exist before any other tx targeting it
    // (Blend / Aquarius / Soroswap all need a funded account).
    updateRow("XLM", { status: "loading", message: undefined });
    const xlm = await runFaucet("XLM", walletAddress);
    applyResult("XLM", xlm);

    // Then the three USDC mints can run in parallel — each uses a different
    // backend so they don't share a rate-limit bucket.
    const remaining = ALL_TOKENS.filter((t) => t !== "XLM");
    remaining.forEach((t) => updateRow(t, { status: "loading", message: undefined }));
    const results = await Promise.all(
      remaining.map(async (t) => [t, await runFaucet(t, walletAddress)] as const)
    );
    for (const [t, r] of results) applyResult(t, r);

    setIsMintingAll(false);
    const failed = results.filter(([, r]) => !r.ok);
    if (failed.length === 0) toast.success("All tokens minted");
    else toast.error(`${failed.length} faucet(s) failed — see panel for details`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2001] w-[92vw] max-w-[440px] rounded-[16px] overflow-hidden ${
              isDark
                ? "bg-[#161616] border border-[#2A2A2A]"
                : "bg-white border border-[#E8E8E8]"
            }`}
            style={{
              boxShadow: isDark
                ? "0 24px 64px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.04)"
                : "0 24px 64px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.04)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Testnet token faucet"
          >
            {/* Header */}
            <div
              className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
                isDark ? "border-[#222]" : "border-[#F0F0F0]"
              }`}
            >
              <div>
                <h2
                  className={`text-[16px] font-semibold ${
                    isDark ? "text-white" : "text-[#111]"
                  }`}
                >
                  Testnet Faucet
                </h2>
                <p
                  className={`text-[12px] mt-0.5 ${
                    isDark ? "text-[#888]" : "text-[#666]"
                  }`}
                >
                  Mint test tokens used across Vanna pools
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close faucet"
                className={`p-1.5 rounded-md transition-colors ${
                  isDark
                    ? "text-[#999] hover:text-white hover:bg-[#222]"
                    : "text-[#666] hover:text-[#111] hover:bg-[#F2F2F2]"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 3l8 8M11 3l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Token rows */}
            <div className="p-2.5 flex flex-col gap-1.5">
              {ALL_TOKENS.map((token) => {
                const meta = FAUCET_TOKEN_META[token];
                const row = rows[token];
                return (
                  <FaucetRow
                    key={token}
                    token={token}
                    label={meta.label}
                    icon={meta.icon}
                    description={meta.description}
                    state={row}
                    isDark={isDark}
                    disabled={!walletAddress || isMintingAll}
                    onMint={() => mintOne(token)}
                  />
                );
              })}
            </div>

            {/* Action footer */}
            <div
              className={`px-5 py-3 border-t flex items-center justify-between gap-3 ${
                isDark ? "border-[#222]" : "border-[#F0F0F0]"
              }`}
            >
              <p
                className={`text-[11px] ${
                  isDark ? "text-[#888]" : "text-[#666]"
                }`}
              >
                {walletAddress
                  ? "Each mint sends a tx — sign in Freighter when prompted."
                  : "Connect wallet to use the faucet."}
              </p>
              <div className="shrink-0">
                <Button
                  size="small"
                  type="gradient"
                  text={isMintingAll ? "Minting..." : "Mint All"}
                  disabled={!walletAddress || isMintingAll}
                  onClick={mintAll}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

interface FaucetRowProps {
  token: FaucetTokenId;
  label: string;
  icon: string;
  description: string;
  state: RowState;
  isDark: boolean;
  disabled: boolean;
  onMint: () => void;
}

const FaucetRow = ({
  label,
  icon,
  description,
  state,
  isDark,
  disabled,
  onMint,
}: FaucetRowProps) => {
  const { status, message, hash } = state;
  return (
    <div
      className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 ${
        isDark ? "bg-[#1C1C1C]" : "bg-[#F7F7F7]"
      }`}
    >
      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
        <Image src={icon} alt={label} width={28} height={28} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[13px] font-semibold leading-tight ${
            isDark ? "text-white" : "text-[#111]"
          }`}
        >
          {label}
        </p>
        <p
          className={`text-[11px] mt-0.5 truncate ${
            isDark ? "text-[#888]" : "text-[#666]"
          }`}
          title={status === "error" ? message : description}
        >
          {status === "loading"
            ? "Minting..."
            : status === "success"
            ? hash
              ? `${message} · ${hash.slice(0, 8)}...${hash.slice(-4)}`
              : message
            : status === "error"
            ? `Error: ${message}`
            : description}
        </p>
      </div>
      <button
        onClick={onMint}
        disabled={disabled || status === "loading"}
        className={`shrink-0 text-[12px] font-semibold rounded-md px-3 py-1.5 transition-colors ${
          disabled || status === "loading"
            ? isDark
              ? "bg-[#222] text-[#555] cursor-not-allowed"
              : "bg-[#EEE] text-[#999] cursor-not-allowed"
            : status === "success"
            ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 cursor-pointer"
            : status === "error"
            ? "bg-[#FC5457]/15 text-[#FC5457] hover:bg-[#FC5457]/25 cursor-pointer"
            : isDark
            ? "bg-[#2A2A2A] text-white hover:bg-[#333] cursor-pointer"
            : "bg-[#111] text-white hover:bg-[#000] cursor-pointer"
        }`}
      >
        {status === "loading"
          ? "..."
          : status === "success"
          ? "Retry"
          : status === "error"
          ? "Retry"
          : "Mint"}
      </button>
    </div>
  );
};
