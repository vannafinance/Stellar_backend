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
import { WalletService } from "@/lib/stellar-utils";

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
            
            // Get margin account balance
            await refreshMarginAccountBalance(account.address);
          }
          
          // Get wallet balance
          const balance = await WalletService.getBalance(address.address);
          setWalletBalance(parseFloat(balance) || 0);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    
    loadUserData();
  }, []);

  // Refresh margin account balance
  const refreshMarginAccountBalance = async (marginAccountAddress: string) => {
    try {
      const result = await MarginAccountService.getCollateralBalances(marginAccountAddress);
      if (result.success && result.data) {
        const tokenData = result.data[normalizeContractTokenSymbol(selectedCurrency)];
        if (tokenData) {
          setMarginAccountBalance(parseFloat(tokenData.amount) || 0);
        }
      }
    } catch (error) {
      console.error("Error refreshing margin account balance:", error);
    }
  };

  // Refresh when currency changes
  useEffect(() => {
    if (marginAccount) {
      refreshMarginAccountBalance(marginAccount);
    }
  }, [selectedCurrency, marginAccount]);

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
      alert("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      // Convert amount to WAD format (18 decimals)
      const amountWad = (BigInt(Math.floor(Number(valueInput) * 1000000)) * BigInt(1000000000000)).toString();
      
      const result = await MarginAccountService.depositCollateralTokens(
        marginAccount,
        normalizeContractTokenSymbol(selectedCurrency),
        amountWad
      );

      if (result.success) {
        alert(`✅ Transfer successful! Transaction hash: ${result.hash}`);
        // Refresh balances
        await refreshMarginAccountBalance(marginAccount);
        const balance = await WalletService.getBalance(userAddress);
        setWalletBalance(parseFloat(balance) || 0);
        setValueInput("");
        setValueInUsd(0);
      } else {
        alert(`❌ Transfer failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.section 
      className="flex flex-col justify-between gap-[24px] pt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.article 
        className={`flex flex-col gap-[24px] rounded-[16px] p-[20px] border-[1px] ${
          isDark ? "bg-[#111111]" : "bg-[#FFFFFF]"
        }`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <motion.header
          key="editing"
          className="flex justify-between "
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
            {/* Currency dropdown */}
            <div className="p-[10px]">
              <Dropdown
                classname="text-[16px] font-medium gap-[8px]"
                selectedOption={selectedCurrency}
                setSelectedOption={setSelectedCurrency}
                items={DropdownOptions}
                dropdownClassname="text-[14px] font-medium gap-[8px]"
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key="editing-middle"
                className="flex gap-[8px]"
                role="group"
                aria-label="Deposit percentage"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{
                  duration: 0.3,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                {/* Percentage buttons */}
                {DEPOSIT_PERCENTAGES.map((item) => {
                  return (
                    <motion.button
                      type="button"
                      key={item}
                      onClick={() => handlePercentageClick(item)}
                      className={`h-[44px] w-[95px] text-center text-[14px] text-medium cursor-pointer ${
                        percentage === item
                          ? `${PERCENTAGE_COLORS[item]} text-white`
                          : isDark
                          ? "bg-[#222222] text-white"
                          : "bg-[#F4F4F4]"
                      } p-[10px] rounded-[12px]`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      aria-label={`Select ${item} percent`}
                      aria-pressed={percentage === item}
                    >
                      {item}%
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </motion.header>
        <motion.section 
          className="flex justify-between gap-[10px] items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <motion.div 
            className="px-[10px] flex flex-col gap-[8px]"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <label htmlFor={`collateral-amount-input`} className="sr-only">
              Collateral amount
            </label>
            <input
              id={`collateral-amount-input`}
              onChange={handleInputChange}
              className={`w-fit text-[20px] focus:border-[0px] focus:outline-none focus:bg-transparent font-medium placeholder:text-[#C7C7C7] ${
                isDark ? "placeholder:text-[#A7A7A7]  text-white bg-[#111111]" : "bg-white"
              }`}
              type="text"
              placeholder="0.0"
              value={valueInput}
            />
            <motion.p
              className={`text-[12px] font-medium ${
                isDark ? "text-[#919191]" : "text-[#76737B]"
              }`}
              aria-live="polite"
              key={valueInUsd}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {valueInUsd} USD
            </motion.p>
          </motion.div>
          <motion.aside 
            className="flex flex-col gap-[8px] items-end"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
          >
            <p className={`text-[10px] font-medium ${isDark ? "text-white" : ""}`}>
              Transfer To: <span className="font-semibold">Margin Account</span>
            </p>
            <p className={`text-[20px] font-medium ${isDark ? "text-white" : ""}`}>
              {walletBalance.toFixed(2)} {selectedCurrency}
            </p>

            <motion.button
              onClick={handleMaxValueClick}
              className="cursor-pointer bg-[#FFE6F2] rounded-[4px] py-[4px] px-[8px] text-[12px] font-medium text-[#FF007A]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              Max Value
            </motion.button>
          </motion.aside>
        </motion.section>
      </motion.article>
      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <DetailsPanel
          items={[
            { title: "Transfer Collateral", value: `${valueInput || '0'} ${selectedCurrency}` },
            { title: "Margin Account Balance", value: `${marginAccountBalance.toFixed(7)} ${selectedCurrency}` }
          ]}
        />
      </motion.aside>
      <motion.section 
        className="flex flex-col gap-[16px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.45 }}
        >
          <Button
            text={isLoading ? "Processing..." : "Transfer"}
            size="large"
            type="gradient"
            disabled={Number(valueInput) > 0 && !isLoading && marginAccount ? false : true}
            onClick={handleTransferClick}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <Button
            text="Flash Close"
            size="large"
            type="ghost"
            disabled={Number(valueInput) > 0 && !isLoading && marginAccount ? false : true}
            onClick={handleTransferClick}
          />
        </motion.div>
      </motion.section>
    </motion.section>
  );
};

