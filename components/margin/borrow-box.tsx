import { DropdownOptions, iconPaths } from "@/lib/constants";
import { Dropdown } from "../ui/dropdown";
import { useState, useEffect, useCallback } from "react";
import { LeverageSlider } from "../ui/leverage-slider";
import { BorrowInfo } from "@/lib/types";
import Image from "next/image";
import { motion } from "framer-motion";
import { MAX_LEVERAGE, MODE_CONFIG } from "@/lib/constants/margin";
import { useTheme } from "@/contexts/theme-context";
import { useUserStore } from "@/store/user";
import { useMarginAccountInfoStore } from "@/store/margin-account-info-store";

type Mode = "Deposit" | "Borrow";

interface BorrowBoxProps {
  mode?: Mode;
  leverage: number;
  setLeverage: (value: number) => void;
  totalDeposit: number;
  onBorrowItemsChange?: (items: BorrowInfo[]) => void;
}

export const BorrowBox = ({
  mode = "Deposit",
  leverage,
  setLeverage,
  totalDeposit,
  onBorrowItemsChange,
}: BorrowBoxProps) => {
  const { isDark } = useTheme();
  const getTokenBalanceKey = (symbol: string) => {
    if (symbol === "BLUSDC" || symbol === "BLEND_USDC") return "BLEND_USDC";
    if (symbol === "AqUSDC" || symbol === "AquiresUSDC") return "AQUARIUS_USDC";
    if (symbol === "SoUSDC" || symbol === "SoroswapUSDC") return "SOROSWAP_USDC";
    return symbol;
  };
  const getBorrowedBalanceKey = (symbol: string) => {
    if (symbol === "BLUSDC" || symbol === "BLEND_USDC" || symbol === "USDC") return "BLUSDC";
    if (symbol === "AqUSDC" || symbol === "AquiresUSDC" || symbol === "AQUARIUS_USDC") return "AQUSDC";
    if (symbol === "SoUSDC" || symbol === "SoroswapUSDC" || symbol === "SOROSWAP_USDC") return "SOUSDC";
    return symbol;
  };
  const config = MODE_CONFIG[mode];

  // Store access
  const tokenBalances = useUserStore((state) => state.tokenBalances);
  const borrowedBalances = useMarginAccountInfoStore((state) => state.borrowedBalances);
  const isLoadingBorrowedBalances = useMarginAccountInfoStore((state) => state.isLoadingBorrowedBalances);

  // Form state
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, string>
  >({});
  const [selectedAmountType, setSelectedAmountType] = useState<string>("Amount in %");
  const [inputValues, setInputValues] = useState<Record<number, number>>({});
  const [percentageInputValues, setPercentageInputValues] = useState<Record<number, number>>({});
  const [usdInputValues, setUsdInputValues] = useState<Record<number, number>>({});

  // Combined useEffect: Create BorrowInfo items and notify parent
  useEffect(() => {
    const newBorrowItems: BorrowInfo[] = [];

    for (let idx = 0; idx < config.maxItems; idx++) {
      const selectedOption = selectedOptions[idx];
      const inputValue = inputValues[idx] || 0;

      if (selectedOption && inputValue > 0) {
        // Calculate percentage of total deposit
        const percentage =
          totalDeposit > 0 ? (inputValue / totalDeposit) * 100 : 0;

        newBorrowItems.push({
          assetData: {
            asset: `0x${selectedOption}`,
            amount: inputValue.toString(),
          },
          percentage: Number(percentage.toFixed(2)),
          usdValue: inputValue, // 1:1 conversion
        });
      }
    }

    // Directly call parent callback
    if (onBorrowItemsChange) {
      onBorrowItemsChange(newBorrowItems);
    }
  }, [selectedOptions, inputValues, config.maxItems, totalDeposit, onBorrowItemsChange]);

  // Calculate total borrowed value inline (simple calculation)
  const totalBorrowedValue = mode === "Borrow" 
    ? (inputValues[0] || 0) + (inputValues[1] || 0)
    : (inputValues[0] || 0);

  // Simplified UI visibility flags
  const showInputBoxes = config.showInputBoxes;
  const showTotal = config.showTotal;

  // Handler for max leverage click
  const handleMaxLeverage = useCallback(() => {
    setLeverage(MAX_LEVERAGE);
  }, [setLeverage]);

  // Handler for selected option change - memoized to prevent re-renders
  const handleSetSelectedOption = useCallback((idx: number) => {
    return (
      option:
        | string
        | ((prev: string) => string)
    ) => {
      setSelectedOptions((prev) => {
        const currentValue = prev[idx];
        const selected =
          typeof option === "function"
            ? option(currentValue || DropdownOptions[0])
            : option;
        return {
          ...prev,
          [idx]: selected,
        };
      });
    };
  }, []);

  // Handler for input change - memoized to prevent re-renders
  const handleInputChange = useCallback((idx: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value) || 0;
      setInputValues((prev) => ({
        ...prev,
        [idx]: value,
      }));
    };
  }, []);

  const handlePercentageInputChange = useCallback((idx: number) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value) || 0;
      setPercentageInputValues((prev) => ({
        ...prev,
        [idx]: value,
      }));
    };
  }, []);

  const handleLeverageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Allow empty string for better UX while typing
    if (inputValue === "") {
      setLeverage(0);
      return;
    }
    const value = Number(inputValue);
    // Validate: must be a number, between 0 and MAX_LEVERAGE
    if (!isNaN(value)) {
      const clampedValue = Math.max(0, Math.min(MAX_LEVERAGE, value));
      setLeverage(clampedValue);
    }
  }, [setLeverage, MAX_LEVERAGE]);

  return (
    <motion.section
      className={`w-full rounded-2xl p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 border transition-colors ${
        isDark
          ? "bg-[#1A1A1A] border-[#2A2A2A]"
          : "bg-white border-[#EEEEEE]"
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Top section: Asset selector or borrowed items display */}
      <header className="flex justify-between gap-3">
        {/* Deposit mode: Single asset selector */}
        {mode === "Deposit" && (
          <>
            <motion.div
              className="flex flex-col gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Asset dropdown pill */}
              <Dropdown
                dropdownClassname="text-[13px] gap-2"
                items={DropdownOptions}
                selectedOption={selectedOptions[0] || DropdownOptions[0]}
                setSelectedOption={handleSetSelectedOption(0)}
                classname={`gap-2 px-3 py-2 rounded-full text-[14px] font-semibold transition-colors ${
                  isDark
                    ? "bg-[#333333] hover:bg-[#3D3D3D] text-white"
                    : "bg-[#EEEEEE] hover:bg-[#E2E2E2]"
                }`}
              />

              {/* Balance */}
              <div
                className={`text-[12px] font-medium ${
                  isDark ? "text-[#777777]" : "text-[#A7A7A7]"
                }`}
              >
                Balance:{" "}
                {tokenBalances[
                  getTokenBalanceKey(
                    selectedOptions[0] || "XLM",
                  ) as keyof typeof tokenBalances
                ] || tokenBalances.XLM}{" "}
                {selectedOptions[0] || "XLM"}
              </div>
            </motion.div>

            {/* Borrowed Amount + Max Value */}
            <motion.div
              className="flex flex-col items-end gap-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.button
                type="button"
                onClick={handleMaxLeverage}
                className="h-fit cursor-pointer rounded-lg bg-gradient p-[1px]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
                aria-label="Set maximum leverage"
              >
                <div
                  className={`py-1.5 px-4 rounded-lg text-[13px] font-semibold ${
                    leverage === MAX_LEVERAGE
                      ? "bg-gradient text-white"
                      : isDark
                        ? "bg-[#1A1A1A] text-white"
                        : "bg-white text-[#111111]"
                  }`}
                >
                  Max Value
                </div>
              </motion.button>

              {/* Borrowed balance row */}
              {Array.from({ length: 1 }).map((_, idx) => {
                const selectedOption = selectedOptions[0] || DropdownOptions[0];
                return (
                  <motion.div
                    key={idx}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Image
                      src={iconPaths[selectedOption]}
                      alt={selectedOption}
                      width={16}
                      height={16}
                      className="rounded-full shrink-0"
                    />
                    <div
                      className={`flex flex-col gap-0.5 text-right ${
                        isDark ? "text-white" : "text-[#111111]"
                      }`}
                    >
                      <span className="text-[13px] font-semibold">
                        {borrowedBalances[
                          getBorrowedBalanceKey(selectedOption)
                        ]
                          ? parseFloat(
                              borrowedBalances[
                                getBorrowedBalanceKey(selectedOption)
                              ].amount,
                            ).toFixed(4)
                          : "0.0000"}{" "}
                        {selectedOption}
                      </span>
                      <span
                        className={`text-[11px] ${
                          isDark ? "text-[#777777]" : "text-[#A7A7A7]"
                        }`}
                      >
                        {borrowedBalances[
                          getBorrowedBalanceKey(selectedOption)
                        ]
                          ? parseFloat(
                              borrowedBalances[
                                getBorrowedBalanceKey(selectedOption)
                              ].usdValue,
                            ).toFixed(2)
                          : "0.00"}{" "}
                        USD
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </>
        )}

        {/* Borrow mode: Display borrowed items */}
        {mode === "Borrow" && (
          <motion.div
            className="w-full flex justify-between items-start gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Borrowed items list */}
            <div className="flex flex-col gap-2">
              <span
                className={`text-[13px] font-medium ${
                  isDark ? "text-[#A7A7A7]" : "text-[#777777]"
                }`}
              >
                Borrowed Amount
              </span>
              <div className="flex gap-3">
                {Array.from({ length: config.maxItems }).map((_, idx) => {
                  const selectedOption =
                    selectedOptions[idx] || DropdownOptions[0];
                  return (
                    <motion.div
                      key={idx}
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.1 }}
                    >
                      <Image
                        src={iconPaths[selectedOption]}
                        alt={selectedOption}
                        width={16}
                        height={16}
                        className="rounded-full shrink-0"
                      />
                      <div
                        className={`flex flex-col gap-0.5 ${
                          isDark ? "text-white" : "text-[#111111]"
                        }`}
                      >
                        <span className="text-[13px] font-semibold">
                          {borrowedBalances[
                            getBorrowedBalanceKey(selectedOption)
                          ]
                            ? parseFloat(
                                borrowedBalances[
                                  getBorrowedBalanceKey(selectedOption)
                                ].amount,
                              ).toFixed(4)
                            : "0.0000"}{" "}
                          {selectedOption}
                        </span>
                        <span
                          className={`text-[11px] ${
                            isDark ? "text-[#777777]" : "text-[#A7A7A7]"
                          }`}
                        >
                          {borrowedBalances[
                            getBorrowedBalanceKey(selectedOption)
                          ]
                            ? parseFloat(
                                borrowedBalances[
                                  getBorrowedBalanceKey(selectedOption)
                                ].usdValue,
                              ).toFixed(2)
                            : "0.00"}{" "}
                          USD
                        </span>
                      </div>
                      {idx < config.maxItems - 1 && (
                        <span
                          className={`text-[18px] font-bold px-1 ${
                            isDark ? "text-[#555555]" : "text-[#CCCCCC]"
                          }`}
                        >
                          :
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Total borrowed value */}
            {showTotal && (
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`text-[13px] font-medium ${
                    isDark ? "text-[#A7A7A7]" : "text-[#777777]"
                  }`}
                >
                  Total Borrowable
                </span>
                <span
                  className={`text-[15px] font-bold ${
                    isDark ? "text-white" : "text-[#111111]"
                  }`}
                >
                  $
                  {totalBorrowedValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </header>

      {/* Input boxes for borrow items */}
      {showInputBoxes && (
        <motion.section
          className="flex gap-3 items-center justify-center relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {Array.from({ length: config.maxItems }).map((_, idx) => {
            const selectedOption = selectedOptions[idx] || DropdownOptions[0];
            const inputValue = inputValues[idx] || 0;

            const item: BorrowInfo | null =
              selectedOption && inputValue > 0
                ? {
                    assetData: {
                      asset: `0x${selectedOption}`,
                      amount: inputValue.toString(),
                    },
                    percentage:
                      totalDeposit > 0
                        ? Number(
                            ((inputValue / totalDeposit) * 100).toFixed(2),
                          )
                        : 0,
                    usdValue: inputValue,
                  }
                : null;

            return (
              <motion.div
                key={idx}
                className="flex gap-3 items-center w-full"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
              >
                <div
                  className={`flex-1 rounded-2xl p-3 sm:p-4 border ${
                    isDark
                      ? "bg-[#111111] border-[#2A2A2A]"
                      : "bg-[#F7F7F7] border-[#EEEEEE]"
                  }`}
                >
                  {/* Row 1: token selector + amount type */}
                  <div className="flex items-center justify-between mb-3">
                    <Dropdown
                      dropdownClassname="text-[13px] gap-2"
                      items={DropdownOptions}
                      selectedOption={selectedOptions[idx] || DropdownOptions[0]}
                      setSelectedOption={handleSetSelectedOption(idx)}
                      classname={`gap-2 px-3 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                        isDark
                          ? "bg-[#2A2A2A] hover:bg-[#333333] text-white"
                          : "bg-white hover:bg-[#EEEEEE]"
                      }`}
                    />
                    <Dropdown
                      dropdownClassname="text-[13px] gap-2"
                      items={["Amount in %", "Amount in $"]}
                      selectedOption={selectedAmountType}
                      setSelectedOption={setSelectedAmountType}
                      classname={`gap-1.5 text-[12px] font-medium ${
                        isDark ? "text-[#A7A7A7]" : "text-[#777777]"
                      }`}
                    />
                  </div>

                  {/* Row 2: amount inputs */}
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`borrow-amount-input-${idx}`}
                        className="sr-only"
                      >
                        Borrow amount for {selectedOption}
                      </label>
                      <input
                        id={`borrow-amount-input-${idx}`}
                        onChange={handleInputChange(idx)}
                        className={`text-[22px] font-semibold bg-transparent outline-none w-[120px] placeholder:opacity-30 ${
                          isDark
                            ? "text-white placeholder:text-[#555555]"
                            : "text-[#111111] placeholder:text-[#CCCCCC]"
                        }`}
                        type="text"
                        placeholder="0"
                        value={inputValues[idx]?.toString() || ""}
                      />
                      <span
                        className={`text-[12px] font-medium ${
                          isDark ? "text-[#777777]" : "text-[#A7A7A7]"
                        }`}
                        aria-live="polite"
                      >
                        {inputValue > 0 ? inputValue.toFixed(2) : "0.00"} USD
                      </span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <input
                        type="text"
                        placeholder="0"
                        onChange={handlePercentageInputChange(idx)}
                        className={`focus:outline-none text-[22px] font-semibold text-right bg-transparent w-[80px] placeholder:opacity-30 ${
                          isDark
                            ? "text-white placeholder:text-[#555555]"
                            : "text-[#111111] placeholder:text-[#CCCCCC]"
                        }`}
                        value={percentageInputValues[idx] || 0}
                      />
                      <span
                        className={`text-[12px] font-medium ${
                          isDark ? "text-[#777777]" : "text-[#A7A7A7]"
                        }`}
                      >
                        {item ? `1 ${selectedOption} = $1.00` : "0.00 USD"}
                      </span>
                    </div>
                  </div>
                </div>

                {idx < config.maxItems - 1 && (
                  <span
                    className={`text-[18px] font-bold shrink-0 ${
                      isDark ? "text-[#555555]" : "text-[#CCCCCC]"
                    }`}
                  >
                    :
                  </span>
                )}
              </motion.div>
            );
          })}
        </motion.section>
      )}

      {/* Leverage slider */}
      <motion.section
        className="relative z-0 flex items-start justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {/* -/+ stepper */}
        <div
          className={`flex gap-0.5 items-center rounded-lg border p-0.5 shrink-0 ${
            isDark ? "bg-[#111111] border-[#333333]" : "bg-white border-[#E2E2E2]"
          }`}
        >
          <motion.button
            type="button"
            onClick={() => leverage > 1 && setLeverage(leverage - 1)}
            disabled={leverage <= 1}
            className={`w-4 h-8 flex items-center justify-center rounded-md text-[14px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              isDark ? "text-white hover:bg-[#222222]" : "hover:bg-[#F7F7F7]"
            }`}
            whileHover={{ scale: leverage > 1 ? 1.05 : 1 }}
            whileTap={{ scale: leverage > 1 ? 0.95 : 1 }}
            aria-label="Decrease leverage"
          >
            −
          </motion.button>

          <input
            value={leverage}
            type="number"
            min={1}
            max={MAX_LEVERAGE}
            onChange={handleLeverageChange}
            className={`w-8 h-8 focus:outline-none bg-transparent px-1 text-[14px] font-medium text-center border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              isDark ? "text-white" : ""
            }`}
          />

          <motion.button
            type="button"
            onClick={() => leverage < MAX_LEVERAGE && setLeverage(leverage + 1)}
            disabled={leverage >= MAX_LEVERAGE}
            className={`w-4 h-8 flex items-center justify-center rounded-md text-[14px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              isDark ? "text-white hover:bg-[#222222]" : "hover:bg-[#F7F7F7]"
            }`}
            whileHover={{ scale: leverage < MAX_LEVERAGE ? 1.05 : 1 }}
            whileTap={{ scale: leverage < MAX_LEVERAGE ? 0.95 : 1 }}
            aria-label="Increase leverage"
          >
            +
          </motion.button>
        </div>

        {/* Slider */}
        <div className="flex-1 min-w-0 pl-4 pr-0 mt-1.5">
          <LeverageSlider
            value={leverage}
            onChange={setLeverage}
            max={MAX_LEVERAGE}
            min={1}
            step={1}
            markers={[1, 3, 5, 7, 10]}
          />
        </div>
      </motion.section>
    </motion.section>
  );
};
