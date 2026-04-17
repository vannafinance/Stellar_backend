"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "./ui/button";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { tradeItems } from "@/lib/constants";
import { useTheme } from "@/contexts/theme-context";
import { useUserStore } from "@/store/user";
import { useWallet } from "@/hooks/use-wallet";

interface Navbar {
  items: {
    title: string;
    link: string;
    group: string;
  }[];
}

export const Navbar = (props: Navbar) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  useUserStore();
  const { address, connectWallet, disconnectWallet, isLoading } = useWallet();

  const groupedItems = {
    primary: props.items.filter((item) => item.group === "primary"),
    bordered: props.items.filter((item) => item.group === "bordered"),
    secondary: props.items.filter((item) => item.group === "secondary"),
  };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const walletCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      if (walletCloseTimeoutRef.current) clearTimeout(walletCloseTimeoutRef.current);
    };
  }, []);

  const handleNavItemClickWithLink = (item: { title: string; link: string }) => {
    if (item.title === "Trade") return;
    router.push(item.link);
  };

  const handleMouseEnter = (item: { title: string; link: string }) => {
    if (closeTimeoutRef.current) { clearTimeout(closeTimeoutRef.current); closeTimeoutRef.current = null; }
    if (item.title === "Trade") setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setIsDropdownOpen(false), 150);
  };

  const handleDropdownMouseEnter = () => {
    if (closeTimeoutRef.current) { clearTimeout(closeTimeoutRef.current); closeTimeoutRef.current = null; }
  };

  const handleDropdownMouseLeave = () => setIsDropdownOpen(false);

  const handleWalletMouseEnter = () => {
    if (walletCloseTimeoutRef.current) { clearTimeout(walletCloseTimeoutRef.current); walletCloseTimeoutRef.current = null; }
  };

  const handleWalletMouseLeave = () => {
    walletCloseTimeoutRef.current = setTimeout(() => setIsWalletDropdownOpen(false), 150);
  };

  const handleDisconnect = () => { disconnectWallet(); setIsWalletDropdownOpen(false); };

  const handleNavKeyDown = (item: { title: string; link: string }) => (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleNavItemClickWithLink(item); }
    if (event.key === "Escape") setIsDropdownOpen(false);
  };

  return (
    <div className={`sticky top-0 z-[1000] ${isDark ? "bg-[#111111] border-b border-[rgba(255,255,255,0.06)]" : "bg-white border-b border-[#EBEBEB]"}`}>
      <motion.div
        className="h-[56px] lg:h-[72px] px-4 sm:px-8 lg:px-[48px] w-full flex items-center overflow-visible"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="flex-1 flex items-center">
          <motion.a
            href="/"
            className="cursor-pointer"
            aria-label="Vanna home page"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, duration: 0.8 }}
            whileHover={{
              scale: 1.05,
              rotate: [0, -5, 5, -5, 0],
              transition: { rotate: { duration: 0.5, ease: "easeInOut" }, scale: { type: "spring", stiffness: 400, damping: 17 } },
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Image
              alt="Vanna"
              width={307}
              height={96}
              className="h-[28px] w-auto sm:h-[36px] lg:h-[46px]"
              src={isDark ? "/logos/vanna-white.png" : "/logos/vanna.png"}
            />
          </motion.a>
        </div>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden lg:flex gap-2 items-center">
          {groupedItems.primary.map((item, idx) => {
            const isActive = pathname === item.link;
            return (
              <motion.div
                key={item.link}
                onClick={() => handleNavItemClickWithLink(item)}
                onKeyDown={handleNavKeyDown(item)}
                role="button"
                tabIndex={0}
                className={`rounded-[8px] py-[9px] px-[16px] text-[14px] font-semibold group flex gap-1.5 items-center hover:text-[#FF007A] cursor-pointer transition-colors ${
                  isActive ? "bg-[#FFE6F2] text-[#FF007A]" : isDark ? "text-white" : ""
                }`}
                aria-label={`Navigate to ${item.title}`}
                aria-current={isActive ? "page" : undefined}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1, ease: "easeOut" }}
                whileHover={{ scale: 0.95, transition: { type: "spring", stiffness: 300, damping: 15 } }}
                whileTap={{ scale: 0.95 }}
              >
                {item.title}
              </motion.div>
            );
          })}

          {/* Bordered group */}
          <div className={`rounded-[8px] border-[1px] ${isDark ? "border-[#2A2A2A]" : "border-[#E5E7EB]"} p-1 flex gap-1 overflow-visible`}>
            {groupedItems.bordered.map((item, idx) => {
              const isActive =
                item.title === "Trade"
                  ? pathname === item.link || tradeItems.some((t) => pathname === t.link)
                  : pathname === item.link;

              if (item.title === "Trade") {
                return (
                  <div key={item.link} className="relative">
                    <motion.div
                      onHoverStart={() => handleMouseEnter(item)}
                      onHoverEnd={handleMouseLeave}
                      onClick={() => handleNavItemClickWithLink(item)}
                      onKeyDown={handleNavKeyDown(item)}
                      role="button"
                      tabIndex={0}
                      className={`rounded-[8px] py-[9px] px-[16px] text-[14px] font-semibold group flex gap-1.5 items-center hover:text-[#FF007A] cursor-pointer transition-colors ${
                        isActive ? "bg-[#FFE6F2] text-[#FF007A]" : isDark ? "text-white" : ""
                      }`}
                      aria-haspopup="menu"
                      aria-expanded={isDropdownOpen}
                      aria-controls="trade-menu"
                      aria-label="Navigate to Trade"
                      aria-current={isActive ? "page" : undefined}
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.1, ease: "easeOut" }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {item.title}
                      <motion.div
                        className="w-3 h-3 flex justify-center items-center"
                        animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <svg width="10" height="6" viewBox="0 0 18 10" fill="none">
                          <path
                            d="M17 1L9 9L0.999999 1"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={isActive ? "stroke-[#FF007A]" : isDark ? "stroke-white group-hover:stroke-[#FF007A]" : "stroke-black group-hover:stroke-[#FF007A]"}
                          />
                        </svg>
                      </motion.div>
                    </motion.div>

                    {/* Floating card dropdown */}
                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          id="trade-menu"
                          role="menu"
                          aria-label="Trade menu"
                          initial={{ opacity: 0, y: 6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.97 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          onMouseEnter={handleDropdownMouseEnter}
                          onMouseLeave={handleDropdownMouseLeave}
                          className={`absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-50 w-[200px] rounded-[14px] overflow-hidden ${
                            isDark ? "bg-[#161616] border border-[#2A2A2A]" : "bg-white border border-[#E8E8E8]"
                          }`}
                          style={{
                            boxShadow: isDark
                              ? "0 12px 40px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04)"
                              : "0 12px 40px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.04)",
                          }}
                        >
                          <div className="p-[6px]">
                            {tradeItems.map((tradeItem) => {
                              const isTradeActive = pathname === tradeItem.link;
                              return (
                                <motion.div
                                  key={tradeItem.link}
                                  role="menuitem"
                                  tabIndex={0}
                                  onClick={() => handleNavItemClickWithLink(tradeItem)}
                                  onKeyDown={handleNavKeyDown(tradeItem)}
                                  className={`flex items-center gap-3 px-3 py-[10px] rounded-[10px] cursor-pointer transition-colors ${
                                    isTradeActive
                                      ? isDark ? "bg-[#1E1E1E] text-[#FF007A]" : "bg-[#FFF0F6] text-[#FF007A]"
                                      : isDark
                                      ? "text-[#C0C0C0] hover:bg-[#1E1E1E] hover:text-white"
                                      : "text-[#3A3A3A] hover:bg-[#F5F5F5] hover:text-[#111]"
                                  }`}
                                  whileHover={{ x: 2 }}
                                  whileTap={{ scale: 0.98 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${isDark ? "bg-[#242424]" : "bg-[#F0F0F0]"}`}>
                                    {tradeItem.title === "Spot" ? (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="4" stroke={isTradeActive ? "#FF007A" : isDark ? "#A0A0A0" : "#666"} strokeWidth="2" />
                                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke={isTradeActive ? "#FF007A" : isDark ? "#A0A0A0" : "#666"} strokeWidth="2" strokeLinecap="round" />
                                      </svg>
                                    ) : (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <path d="M3 17l4-8 4 4 4-6 4 10" stroke={isTradeActive ? "#FF007A" : isDark ? "#A0A0A0" : "#666"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-semibold leading-tight">{tradeItem.title}</p>
                                    <p className={`text-[11px] mt-0.5 whitespace-nowrap ${isDark ? "text-[#666]" : "text-[#999]"}`}>
                                      {tradeItem.title === "Spot" ? "Leveraged Spot" : "Leverage over Leverage"}
                                    </p>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <motion.div
                  key={item.link}
                  onClick={() => handleNavItemClickWithLink(item)}
                  onKeyDown={handleNavKeyDown(item)}
                  role="button"
                  tabIndex={0}
                  className={`rounded-[8px] py-[9px] px-[16px] text-[14px] font-semibold group flex gap-1.5 items-center hover:text-[#FF007A] cursor-pointer transition-colors ${
                    isActive ? "bg-[#FFE6F2] text-[#FF007A]" : isDark ? "text-white" : ""
                  }`}
                  aria-label={`Navigate to ${item.title}`}
                  aria-current={isActive ? "page" : undefined}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1, ease: "easeOut" }}
                  whileTap={{ scale: 0.95 }}
                >
                  {item.title === "Margin" && (
                    <div className="w-4 h-4 flex flex-col justify-center items-center">
                      <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
                        <path opacity="0.3" d="M7.33332 4L3.99999 0.666672L0.666656 4" className={`transition-colors ${isActive ? "stroke-[#FF007A]" : isDark ? "stroke-white group-hover:stroke-[#FF007A]" : "stroke-black group-hover:stroke-[#FF007A]"}`} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                        <path opacity="0.6" d="M7.33332 8L3.99999 4.66667L0.666656 8" className={`transition-colors ${isActive ? "stroke-[#FF007A]" : isDark ? "stroke-white group-hover:stroke-[#FF007A]" : "stroke-black group-hover:stroke-[#FF007A]"}`} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M7.33332 12L3.99999 8.66667L0.666656 12" className={`transition-colors ${isActive ? "stroke-[#FF007A]" : isDark ? "stroke-white group-hover:stroke-[#FF007A]" : "stroke-black group-hover:stroke-[#FF007A]"}`} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  {item.title}
                </motion.div>
              );
            })}
          </div>

          {groupedItems.secondary.map((item, idx) => {
            const isActive = pathname === item.link;
            return (
              <motion.div
                key={item.link}
                onClick={() => handleNavItemClickWithLink(item)}
                onKeyDown={handleNavKeyDown(item)}
                role="button"
                tabIndex={0}
                className={`rounded-[8px] py-[9px] px-[16px] text-[14px] font-semibold group flex gap-1.5 items-center hover:text-[#FF007A] cursor-pointer transition-colors ${
                  isActive ? "bg-[#FFE6F2] text-[#FF007A]" : isDark ? "text-white" : ""
                }`}
                aria-label={`Navigate to ${item.title}`}
                aria-current={isActive ? "page" : undefined}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1, ease: "easeOut" }}
                whileHover={{ scale: 0.95, transition: { type: "spring", stiffness: 300, damping: 15 } }}
                whileTap={{ scale: 0.95 }}
              >
                {item.title}
              </motion.div>
            );
          })}
        </div>

        {/* Right section */}
        <div className="flex-1 flex items-center justify-end">
          {/* Desktop right: deposit + theme + wallet */}
          <motion.div
            className="hidden lg:flex items-center gap-3"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          >
            {address && (
              <Button
                size="small"
                type="navbar"
                disabled={false}
                onClick={() => router.push("/portfolio")}
                text="DEPOSIT"
                ariaLabel="Go to portfolio to deposit"
              />
            )}

            {/* Theme toggle */}
            <button
              type="button"
              className={`flex justify-center items-center rounded-[8px] py-[9px] px-[10px] h-[38px] cursor-pointer transition-colors hover:opacity-80 ${
                isDark ? "bg-[#222222] text-white" : "bg-[#F4F4F4]"
              }`}
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              aria-pressed={isDark}
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#FF007A" width={16} height={16} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364 6.364l-1.591 1.591M21 12h-2.25m-6.364 6.364l-1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="#FF007A" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#FF007A" width={16} height={16} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              )}
            </button>

            {/* Connect / wallet address */}
            {!address ? (
              <Button
                size="small"
                type="navbar"
                disabled={isLoading}
                onClick={connectWallet}
                text={isLoading ? "Connecting..." : "Connect Wallet"}
                ariaLabel="Connect your Freighter wallet"
              />
            ) : (
              <div
                className="relative"
                onMouseEnter={handleWalletMouseEnter}
                onMouseLeave={handleWalletMouseLeave}
              >
                <div
                  onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                  className={`cursor-pointer py-[9px] px-[16px] text-[14px] font-semibold rounded-[8px] transition-colors hover:opacity-80 ${
                    isDark ? "bg-[#222222] text-white" : "bg-[#F4F4F4] text-[#111111]"
                  }`}
                >
                  {address.slice(0, 6) + "..." + address.slice(-4)}
                </div>
                <AnimatePresence>
                  {isWalletDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className={`absolute top-full right-0 mt-2 py-1 w-44 rounded-[12px] shadow-lg border ${
                        isDark ? "bg-[#161616] border-[#2A2A2A] text-white" : "bg-white border-[#E8E8E8]"
                      }`}
                      style={{ boxShadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.08)" }}
                    >
                      <div
                        onClick={handleDisconnect}
                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors hover:text-[#FF007A] ${
                          isDark ? "hover:bg-[#222222]" : "hover:bg-[#F5F5F5]"
                        }`}
                      >
                        Disconnect Wallet
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Mobile right: wallet chip + hamburger */}
          <motion.div
            className="flex lg:hidden gap-[8px] items-center flex-shrink-0"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          >
            {!address ? (
              <Button
                size="small"
                type="gradient"
                disabled={isLoading}
                onClick={connectWallet}
                text={isLoading ? "..." : "LOGIN"}
                ariaLabel="Connect your wallet"
              />
            ) : (
              <div
                onClick={() => setIsWalletDropdownOpen(!isWalletDropdownOpen)}
                className={`cursor-pointer py-[8px] px-[12px] text-[13px] font-semibold rounded-[8px] transition-colors ${
                  isDark ? "bg-[#222222] text-white" : "bg-[#F4F4F4] text-[#111111]"
                }`}
              >
                {address.slice(0, 4) + "..." + address.slice(-4)}
              </div>
            )}

            {/* Hamburger button */}
            <motion.button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`flex flex-col justify-center items-center rounded-[8px] py-1.5 px-2 h-[34px] border cursor-pointer ${
                isDark ? "border-[#2A2A2A]" : "border-[#E5E7EB]"
              }`}
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="w-[18px] h-[14px] flex flex-col justify-between">
                <motion.span
                  className={`w-full h-[2px] rounded-full ${isDark ? "bg-white" : "bg-black"}`}
                  animate={{ rotate: isMobileMenuOpen ? 45 : 0, y: isMobileMenuOpen ? 6 : 0 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className={`w-full h-[2px] rounded-full ${isDark ? "bg-white" : "bg-black"}`}
                  animate={{ opacity: isMobileMenuOpen ? 0 : 1 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.span
                  className={`w-full h-[2px] rounded-full ${isDark ? "bg-white" : "bg-black"}`}
                  animate={{ rotate: isMobileMenuOpen ? -45 : 0, y: isMobileMenuOpen ? -6 : 0 }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 top-full bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`lg:hidden absolute left-3 right-3 top-[calc(100%+6px)] rounded-2xl border shadow-2xl ${
                isDark ? "bg-[#1A1A1A] border-[#2A2A2A]" : "bg-white border-[#E8E8E8]"
              }`}
            >
              <nav className="flex flex-col p-2 gap-0.5">
                {[...groupedItems.primary, ...groupedItems.bordered].map((item, idx) => {
                  const isActive =
                    item.title === "Trade"
                      ? pathname === item.link || tradeItems.some((t) => pathname === t.link)
                      : pathname === item.link;
                  return (
                    <div key={item.link}>
                      <motion.div
                        onClick={() => {
                          if (item.title === "Trade") {
                            setIsDropdownOpen(!isDropdownOpen);
                          } else {
                            handleNavItemClickWithLink(item);
                            setIsMobileMenuOpen(false);
                          }
                        }}
                        className={`px-3 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all flex items-center justify-between ${
                          isActive
                            ? "bg-[#FFE6F2] text-[#FF007A]"
                            : isDark
                            ? "text-[#E0E0E0] hover:bg-[#222222]"
                            : "text-[#333333] hover:bg-[#F5F5F5]"
                        }`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.03 }}
                      >
                        <span>{item.title}</span>
                        {item.title === "Trade" && (
                          <motion.svg
                            width="14" height="14" viewBox="0 0 14 14" fill="none"
                            animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                        )}
                      </motion.div>

                      {/* Trade sub-items */}
                      <AnimatePresence>
                        {item.title === "Trade" && isDropdownOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className={`flex flex-col ml-3 mt-0.5 mb-0.5 pl-3 gap-0.5 border-l-2 ${isDark ? "border-[#333333]" : "border-[#E8E8E8]"}`}>
                              {tradeItems.map((tradeItem, subIdx) => {
                                const isSubActive = pathname === tradeItem.link;
                                return (
                                  <motion.div
                                    key={tradeItem.link}
                                    onClick={() => {
                                      handleNavItemClickWithLink(tradeItem);
                                      setIsMobileMenuOpen(false);
                                      setIsDropdownOpen(false);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer transition-colors ${
                                      isSubActive
                                        ? "text-[#FF007A] bg-[#FFE6F2]"
                                        : isDark
                                        ? "text-[#999999] hover:text-white hover:bg-[#222222]"
                                        : "text-[#777777] hover:text-[#111111] hover:bg-[#F5F5F5]"
                                    }`}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.12, delay: subIdx * 0.03 }}
                                  >
                                    {tradeItem.title}
                                  </motion.div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* Deposit button in mobile menu */}
                {address && (
                  <>
                    <div className={`my-1 mx-2 border-t ${isDark ? "border-[#2A2A2A]" : "border-[#E8E8E8]"}`} />
                    <motion.div
                      className="px-2 pb-1"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: 0.2 }}
                    >
                      <Button
                        text="Deposit"
                        size="small"
                        type="gradient"
                        disabled={false}
                        width="w-full"
                        onClick={() => { router.push("/portfolio"); setIsMobileMenuOpen(false); }}
                        ariaLabel="Deposit funds"
                      />
                    </motion.div>
                  </>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
