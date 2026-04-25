import { useState, useEffect } from "react";
import { Dropdown } from "../ui/dropdown";
import { AnimatePresence, motion } from "framer-motion";
import { DropdownOptions } from "@/lib/constants";
import { DEPOSIT_PERCENTAGES, PERCENTAGE_COLORS } from "@/lib/constants/margin";
import { DetailsPanel } from "../ui/details-panel";
import { Button } from "../ui/button";
import { useTheme } from "@/contexts/theme-context";
import { MarginAccountService } from "@/lib/margin-utils";
import { getAddress } from "@stellar/freighter-api";
import { ContractService } from "@/lib/stellar-utils";
import toast from "react-hot-toast";

export const TransferCollateral = () => {
  const { isDark } = useTheme();
  const normalizeContractTokenSymbol = (symbol: string) =>
    symbol === "BLUSDC" || symbol === "BLEND_USDC" || symbol === "USDC"
      ? "BLUSDC"
      : symbol === "AqUSDC" || symbol === "AquiresUSDC" || symbol === "AQUARIUS_USDC"
        ? "AQUSDC"
        : symbol === "SoUSDC" || symbol === "SoroswapUSDC" || symbol === "SOROSWAP_USDC"
          ? "SOUSDC"
          : symbol;
  const [selectedCurrency, setSelectedCurrency] = useState<string>("XLM");
  const [valueInput, setValueInput] = useState<string>("");
  const [valueInUsd, setValueInUsd] = useState<number>(0.0);
  const [percentage, setPercentage] = useState<number>(0);
  
  // Wallet and margin account state
  const [userAddress, setUserAddress] = useState<string>("");
  const [marginAccount, setMarginAccount] = useState<string>("");
  const [marginAccountBalance, setMarginAccountBalance] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const getSelectedWalletBalance = async (address: string, tokenSymbol: string): Promise<number> => {
    try {
      const balances = await ContractService.getAllTokenBalances(address);
      const contractTokenSymbol = normalizeContractTokenSymbol(tokenSymbol);

      if (contractTokenSymbol === "BLUSDC") return parseFloat(balances.BLEND_USDC) || 0;
      if (contractTokenSymbol === "AQUSDC") return parseFloat(balances.AQUARIUS_USDC) || 0;
      if (contractTokenSymbol === "SOUSDC") return parseFloat(balances.SOROSWAP_USDC) || 0;

      return parseFloat(balances.XLM) || 0;
    } catch (error) {
      console.error("Error fetching selected wallet balance:", error);
      return 0;
    }
  };

  const refreshTokenBalances = async (address: string, marginAccountAddress?: string) => {
    const selectedWalletBalance = await getSelectedWalletBalance(address, selectedCurrency);
    setWalletBalance(selectedWalletBalance);

    const accountAddress = marginAccountAddress ?? marginAccount;
    if (!accountAddress) return;

    try {
      const result = await MarginAccountService.getCollateralBalances(accountAddress);
      if (result.success && result.data) {
        const tokenData = result.data[normalizeContractTokenSymbol(selectedCurrency)];
        setMarginAccountBalance(tokenData ? parseFloat(tokenData.amount) || 0 : 0);
      }
    } catch (error) {
      console.error("Error refreshing margin account balance:", error);
    }
  };

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const address = await getAddress();
        if (!address.error && address.address) {
          setUserAddress(address.address);
          
          // Get margin account
          const account = MarginAccountService.getStoredMarginAccount(address.address);
          if (account && account.isActive) {
            setMarginAccount(account.address);
            await refreshTokenBalances(address.address, account.address);
          } else {
            await refreshTokenBalances(address.address);
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    
    loadUserData();
  }, []);

  // Refresh when currency changes
  useEffect(() => {
    if (userAddress) {
      refreshTokenBalances(userAddress, marginAccount);
    }
  }, [selectedCurrency, marginAccount, userAddress]);

  const handlePercentageClick = (item: number) => {
    setPercentage(item);
    // Calculate amount based on percentage of wallet balance
    const calculatedAmount = (walletBalance * item) / 100;
    setValueInput(calculatedAmount.toFixed(7));
    setValueInUsd(calculatedAmount * 1); // Placeholder for price conversion
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValueInput(value);
    setValueInUsd(Number(value) * 1); // Placeholder for price conversion
  };

  const handleMaxValueClick = () => {
    setValueInput(walletBalance.toFixed(7));
    setValueInUsd(walletBalance);
  };

  const handleTransferClick = async () => {
    if (!marginAccount || !valueInput || Number(valueInput) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      const amountWad = (BigInt(Math.floor(Number(valueInput) * 1000000)) * BigInt(1000000000000)).toString();
      
      const result = await MarginAccountService.depositCollateralTokens(
        marginAccount,
        normalizeContractTokenSymbol(selectedCurrency),
        amountWad
      );

      if (result.success) {
        toast.success(`Transfer successful! Tx: ${result.hash ? result.hash.slice(0, 16) + '…' : ''}`);
        await refreshTokenBalances(userAddress, marginAccount);
        setValueInput("");
        setValueInUsd(0);
      } else {
        toast.error(`Transfer failed: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.section
      className="flex flex-col justify-between gap-6 pt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Transfer form card */}
      <motion.article
        className={`w-full rounded-2xl border p-3 sm:p-4 flex flex-col gap-2 ${
          isDark
            ? "bg-[#1A1A1A] border-[#2A2A2A]"
            : "bg-white border-[#EEEEEE]"
        }`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {/* Row 1: "Transfer" label + % chips */}
        <div className="flex items-center justify-between">
          <span
            className={`text-sm font-medium ${
              isDark ? "text-[#A7A7A7]" : "text-[#777777]"
            }`}
          >
            Transfer
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key="pct-chips"
              className="flex items-center gap-1 sm:gap-1.5"
              role="group"
              aria-label="Deposit percentage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {DEPOSIT_PERCENTAGES.map((item) => (
                <motion.button
                  type="button"
                  key={item}
                  onClick={() => handlePercentageClick(item)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-all ${
                    percentage === item
                      ? `${PERCENTAGE_COLORS[item]} text-white border-transparent`
                      : isDark
                        ? "bg-[#2A2A2A] text-[#A7A7A7] border-[#333333] hover:text-white"
                        : "bg-[#F0F0F0] text-[#888888] hover:text-[#555555] border-[#E2E2E2]"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.93 }}
                  transition={{ duration: 0.1 }}
                  aria-label={`Select ${item} percent`}
                  aria-pressed={percentage === item}
                >
                  {item}%
                </motion.button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Row 2: token dropdown pill + amount input */}
        <div className="flex items-center justify-between gap-3">
          <div className="shrink-0">
            <Dropdown
              classname={`gap-2 px-3 py-2 rounded-full text-[14px] font-semibold transition-colors ${
                isDark
                  ? "bg-[#333333] hover:bg-[#3D3D3D] text-white"
                  : "bg-[#EEEEEE] hover:bg-[#E2E2E2]"
              }`}
              selectedOption={selectedCurrency}
              setSelectedOption={setSelectedCurrency}
              items={DropdownOptions}
              dropdownClassname="text-[13px] gap-2"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="collateral-amount-input" className="sr-only">
              Collateral amount
            </label>
            <input
              id="collateral-amount-input"
              onChange={handleInputChange}
              className={`w-full text-right text-[22px] sm:text-[28px] font-semibold bg-transparent outline-none placeholder:opacity-30 ${
                isDark
                  ? "text-white placeholder:text-[#555555]"
                  : "text-[#111111] placeholder:text-[#CCCCCC]"
              }`}
              type="text"
              placeholder="0"
              value={valueInput}
            />
          </div>
        </div>

        {/* Row 3: balance info + USD + Max */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[12px] font-medium ${
                isDark ? "text-[#777777]" : "text-[#A7A7A7]"
              }`}
            >
              Transfer To:{" "}
              <span
                className={`font-semibold ${
                  isDark ? "text-white" : "text-[#111111]"
                }`}
              >
                Margin Account
              </span>
            </span>
            <motion.button
              onClick={handleMaxValueClick}
              className={`cursor-pointer rounded-md py-0.5 px-2 text-[11px] font-semibold ${
                isDark
                  ? "bg-[#2A1A3E] text-[#A97EFF]"
                  : "bg-[#F1EBFD] text-[#703AE6]"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              Max
            </motion.button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[13px] font-semibold ${
                isDark ? "text-white" : "text-[#111111]"
              }`}
            >
              {walletBalance.toFixed(2)} {selectedCurrency}
            </span>
            <motion.p
              className={`text-sm font-medium ${
                isDark ? "text-[#777777]" : "text-[#A7A7A7]"
              }`}
              aria-live="polite"
              key={valueInUsd}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              ≈ {valueInUsd} USD
            </motion.p>
          </div>
        </div>
      </motion.article>

      {/* Details panel */}
      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <DetailsPanel
          items={[
            {
              title: "Transfer Collateral",
              value: `${valueInput || "0"} ${selectedCurrency}`,
            },
            {
              title: "Margin Account Balance",
              value: `${marginAccountBalance.toFixed(7)} ${selectedCurrency}`,
            },
          ]}
        />
      </motion.aside>

      {/* Action buttons */}
      <motion.section
        className="flex flex-col gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Button
          text={isLoading ? "Processing..." : "Transfer"}
          size="large"
          type="gradient"
          disabled={!(Number(valueInput) > 0 && !isLoading && marginAccount)}
          onClick={handleTransferClick}
        />
        <Button
          text="Flash Close"
          size="large"
          type="ghost"
          disabled={!(Number(valueInput) > 0 && !isLoading && marginAccount)}
          onClick={handleTransferClick}
        />
      </motion.section>
    </motion.section>
  );
};

