export const FILTER_OPTIONS = ["3 Months", "6 Months", "1 Year", "All Time"]

// Overall Deposit Data - Monthly data for approximately one year (Jan 2025 - Dec 2025)
export const depositData = [
    { date: "2025-01-01", amount: 850 },
    { date: "2025-01-15", amount: 920 },
    { date: "2025-02-01", amount: 980 },
    { date: "2025-02-15", amount: 1050 },
    { date: "2025-03-01", amount: 1120 },
    { date: "2025-03-15", amount: 1180 },
    { date: "2025-04-01", amount: 1250 },
    { date: "2025-04-15", amount: 1320 },
    { date: "2025-05-01", amount: 1400 },
    { date: "2025-05-15", amount: 1480 },
    { date: "2025-06-01", amount: 1560 },
    { date: "2025-06-15", amount: 1650 },
    { date: "2025-07-01", amount: 1740 },
    { date: "2025-07-15", amount: 1830 },
    { date: "2025-08-01", amount: 1920 },
    { date: "2025-08-15", amount: 2020 },
    { date: "2025-09-01", amount: 2120 },
    { date: "2025-09-15", amount: 2230 },
    { date: "2025-10-01", amount: 2350 },
    { date: "2025-10-15", amount: 2470 },
    { date: "2025-11-01", amount: 2600 },
    { date: "2025-11-15", amount: 2740 },
    { date: "2025-12-01", amount: 2890 },
    { date: "2025-12-15", amount: 3050 },
    { date: "2025-12-31", amount: 3220 },
]

// Net APY Data - Monthly data showing APY earnings in USD (Jan 2025 - Dec 2025)
export const netApyData = [
    { date: "2025-01-01", amount: 12.50 },
    { date: "2025-01-15", amount: 18.20 },
    { date: "2025-02-01", amount: 24.80 },
    { date: "2025-02-15", amount: 31.50 },
    { date: "2025-03-01", amount: 38.90 },
    { date: "2025-03-15", amount: 46.20 },
    { date: "2025-04-01", amount: 54.10 },
    { date: "2025-04-15", amount: 62.30 },
    { date: "2025-05-01", amount: 71.20 },
    { date: "2025-05-15", amount: 80.50 },
    { date: "2025-06-01", amount: 90.10 },
    { date: "2025-06-15", amount: 100.20 },
    { date: "2025-07-01", amount: 110.80 },
    { date: "2025-07-15", amount: 122.10 },
    { date: "2025-08-01", amount: 133.90 },
    { date: "2025-08-15", amount: 146.20 },
    { date: "2025-09-01", amount: 159.10 },
    { date: "2025-09-15", amount: 172.80 },
    { date: "2025-10-01", amount: 187.20 },
    { date: "2025-10-15", amount: 202.30 },
    { date: "2025-11-01", amount: 218.10 },
    { date: "2025-11-15", amount: 234.60 },
    { date: "2025-12-01", amount: 251.90 },
    { date: "2025-12-15", amount: 270.10 },
    { date: "2025-12-31", amount: 289.20 },
]     

export const tableHeadings = [
    { label: "Pool", id: "pool" },
    { label: "Assets Supplied", id: "assets-supplied" ,icon:true},
    { label: "Supply APY", id: "supply-apy" ,icon:true},
    { label: "Assets Borrowed", id: "assets-borrowed" ,icon:true},
    { label: "Borrow APY", id: "borrow-apy" ,icon:true},
    { label: "Utilization Rate", id: "utilization-rate" ,icon:true},
    { label: "Collateral", id: "collateral" },
  ]

// Stellar Blockchain Pool Data
export const tableBody = {
  rows: [
    {
      cell: [
        {
          chain: "XLM",
          title: "XLM",
          tag: "Active",
        },
        {
          title: "$125.4K",
          tag: "1.25M XLM",
        },
        {
          title: "8.45%",
          tag: "8.45%",
        },
        {
          title: "$45.2K",
          tag: "452K XLM",
        },
        {
          title: "6.25%",
          tag: "6.25%",
        },
        {
          title: "36.05%",
          tag: "36.05%",
        },
        {
          onlyIcons: ["XLM", "USDC", "EURC"],
          tag: "Collateral",
          clickable: "toggle",
        },
      ],
    },
    {
      cell: [
        {
          chain: "USDC",
          title: "USDC",
          tag: "Active",
        },
        {
          title: "$892.4K",
          tag: "892.4K USDC",
        },
        {
          title: "5.75%",
          tag: "5.75%",
        },
        {
          title: "$312.8K",
          tag: "312.8K USDC",
        },
        {
          title: "4.85%",
          tag: "4.85%",
        },
        {
          title: "35.05%",
          tag: "35.05%",
        },
        {
          onlyIcons: ["USDC", "XLM", "EURC"],
          tag: "Collateral",
          clickable: "toggle",
        },
      ],
    },
    {
      cell: [
        {
          chain: "EURC",
          title: "EURC",
          tag: "Active",
        },
        {
          title: "$567.8K",
          tag: "523.2K EURC",
        },
        {
          title: "6.25%",
          tag: "6.25%",
        },
        {
          title: "$198.5K",
          tag: "183.1K EURC",
        },
        {
          title: "5.15%",
          tag: "5.15%",
        },
        {
          title: "34.95%",
          tag: "34.95%",
        },
        {
          onlyIcons: ["EURC", "USDC", "XLM"],
          tag: "Collateral",
          clickable: "toggle",
        },
      ],
    },
    {
      cell: [
        {
          chain: "AquiresUSDC",
          title: "AquiresUSDC",
          tag: "Active",
        },
        {
          title: "0 AquiresUSDC",
          tag: "0.0000 AquiresUSDC",
        },
        {
          title: "2.50%",
          tag: "2.50%",
        },
        {
          title: "0 AquiresUSDC",
          tag: "0.0000 AquiresUSDC",
        },
        {
          title: "4.00%",
          tag: "4.00%",
        },
        {
          title: "0.00%",
          tag: "0.00%",
        },
        {
          onlyIcons: ["USDC", "XLM", "EURC"],
          tag: "Collateral",
          clickable: "toggle",
        },
      ],
    },
  ],
};

// Pool configuration with contract addresses (Stellar Testnet)
export const STELLAR_POOLS = {
  XLM: {
    id: 'XLM',
    name: 'Stellar Lumens',
    symbol: 'XLM',
    icon: '/icons/usdc-icon.svg', // Placeholder - replace with proper XLM icon
    decimals: 7,
    lendingProtocol: 'CDZX7NBK7FVYM5KTHSMKDHE44SKGOVXYXWCFHXHJ47RPBZO3XLSFZPHV',
    vToken: 'CDEQJMUKX7XGZQ5C7DX7WOGZHXCIC7ATRAUICYPYJGYXSVZPGUYLVXCI',
    nativeContract: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  },
  USDC: {
    id: 'USDC',
    name: 'USD Coin',
    symbol: 'USDC',
    icon: '/icons/usdc-icon.svg',
    decimals: 7,
    lendingProtocol: 'CAYBLJPQA22UFRERDDX2U62ZR52UDO7YRUSQUO7ZANERXA4UKARBQCFQ',
    vToken: 'CACVSNZ322SDFHWIU6DO3OKN5JYRL6Q7A6OHT2TVAE4ASWDU7I34GQSH',
    nativeContract: '', // Add USDC token contract when deployed
  },
  EURC: {
    id: 'EURC',
    name: 'Euro Coin',
    symbol: 'EURC',
    icon: '/icons/usdc-icon.svg', // Placeholder - replace with proper EURC icon
    decimals: 7,
    lendingProtocol: 'CCJM2PJR2PFN25VK7RNLDDBUC7U7OP6NO3BX6I7LRVKYOCAOJRUM3TTW',
    vToken: 'CCACTGHDA5KBAY3YVJJ2SJHIYTOQ54PJFUEEDA5FUO7XLBZRCIJ2RIT6',
    nativeContract: '', // Add EURC token contract when deployed
  },
  AQUARIUS_USDC: {
    id: 'AQUARIUS_USDC',
    name: 'Aquarius USD Coin',
    symbol: 'AquiresUSDC',
    icon: '/icons/usdc-icon.svg',
    decimals: 7,
    issuer: 'GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER',
    nativeContract: 'CAZRY5GSFBFXD7H6GAFBA5YGYQTDXU4QKWKMYFWBAZFUCURN3WKX6LF5',
    lendingProtocol: 'CCPOBSGDA5B32GNQURBIGQ6GQFO3SU6PLGQXMMT4QV6C6XGKK5V2MCDZ',
    vToken: 'CD7QIYFD5R22RDL4MI5PGU35M3FNWXPDIEKANJOHIC27OVGPMTECMFU4',
  },
} as const;

// Supported assets for dropdown
export const STELLAR_ASSETS = ['XLM', 'USDC', 'EURC', 'AQUARIUS_USDC'] as const;
export type StellarAsset = typeof STELLAR_ASSETS[number];