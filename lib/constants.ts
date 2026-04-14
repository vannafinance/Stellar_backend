export const navbarItems = [
  { title: "Portfolio", link: "/portfolio", group: "primary" },
  { title: "Earn", link: "/earn", group: "primary" },
  { title: "Margin", link: "/margin", group: "bordered" },
  { title: "Trade", link: "/trade" , group: "bordered"  },
  { title: "Farm", link: "/farm", group: "bordered" },
  { title: "Analytics", link: "/analytics", group: "secondary" },
];

export const tradeItems = [
  {title: "Spot", link: "/trade/spot" },
    { title: "Futures", link: "/trade/futures" },
    { title: "Options", link: "/trade/options" },
    {title:"Defi Greeks", link: "/trade/defi-greeks" },
]

// Stellar blockchain supported assets
export const DropdownOptions = [
  "XLM",
  "BLUSDC",
  "AqUSDC",
  "SoUSDC",
];

// Legacy ETH options (deprecated)
export const LegacyDropdownOptions = [
  "USDT",
  "USDC",
  "ETH",
  "SCROLL",
  "AVALANCHE",
  "OPTIMISM",
  "POLYGON",
  "APE",
  "KATANA",
  "ARBITRUM",
  "BASE",
];


export const iconPaths: Record<string, string> = {
  // Stellar assets - using USDC icon as placeholder for missing icons
  // TODO: Add proper XLM icon to /public/icons/
  XLM: "/icons/stellar.svg", // Placeholder - replace with "/icons/xlm-icon.png" when available
  BLUSDC: "/icons/usdc-icon.svg",
  AqUSDC: "/icons/usdc-icon.svg", // Aquarius USDC uses USDC icon
  SoUSDC: "/icons/usdc-icon.svg", // Soroswap USDC uses USDC icon
  USDC: "/icons/usdc-icon.svg",
  AquiresUSDC: "/icons/usdc-icon.svg", // Aquarius USDC uses USDC icon
  SoroswapUSDC: "/icons/usdc-icon.svg", // Soroswap USDC uses USDC icon
  // Legacy ETH assets (for backwards compatibility)
  USDT: "/icons/usdt-icon.svg",
  ETH: "/icons/eth-icon.png",
  BNB: "/icons/bnb-icon.png",
  SCROLL: "/icons/scroll-icon.png",
  AVALANCHE: "/icons/avalanche-icon.png",
  OPTIMISM: "/icons/optimism-icon.svg",
  POLYGON: "/icons/polygon-icon.png",
  APE: "/icons/ape-icon.png",
  KATANA: "/icons/katana.jpg",
  ARBITRUM: "/icons/arbitrum-icon.svg",
  BASE: "/icons/base-icon.svg",
  WBTC: "/icons/wbtc-icon.png",
};

