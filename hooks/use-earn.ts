'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WalletService, ContractService, AssetType, ASSET_TYPES } from '@/lib/stellar-utils';
import { useUserStore } from '@/store/user';
import { useEarnPoolStore, addTransaction } from '@/store/earn-pool-store';

// ─────────────────────────────────────────────────────────────────────────────
// Pool data
//
// Moved to react-query so multiple consumers share a single fetch, the cache
// survives page navigation (gcTime 5 min), and stale-while-revalidate kicks in.
// We still write into `useEarnPoolStore` so components that read the pools
// from the store directly keep working unchanged (dual-write pattern).
// ─────────────────────────────────────────────────────────────────────────────
const calculateSupplyAPY = (utilizationRate: string) => {
  const utilization = parseFloat(utilizationRate) / 100;
  return (2.0 + utilization * 10).toFixed(2);
};

const calculateBorrowAPY = (utilizationRate: string) => {
  const utilization = parseFloat(utilizationRate) / 100;
  return (4.0 + utilization * 15).toFixed(2);
};

export const usePoolData = () => {
  const storePools = useEarnPoolStore((s) => s.pools);
  const lastUpdated = useEarnPoolStore((s) => s.lastUpdated);

  const query = useQuery({
    queryKey: ['earn', 'pools'],
    queryFn: async () => {
      useEarnPoolStore.getState().set({ isLoadingPools: true });

      const [xlmStats, usdcStats, aquiresUsdcStats, soroswapUsdcStats] = await Promise.all([
        ContractService.getPoolStats(ASSET_TYPES.XLM),
        ContractService.getPoolStats(ASSET_TYPES.USDC),
        ContractService.getPoolStats(ASSET_TYPES.AQUARIUS_USDC),
        ContractService.getPoolStats(ASSET_TYPES.SOROSWAP_USDC),
      ]);

      const mapped = {
        XLM: {
          ...xlmStats,
          supplyAPY: calculateSupplyAPY(xlmStats.utilizationRate),
          borrowAPY: calculateBorrowAPY(xlmStats.utilizationRate),
          exchangeRate: xlmStats.vTokenSupply !== '0'
            ? (parseFloat(xlmStats.totalSupply) / parseFloat(xlmStats.vTokenSupply)).toFixed(7)
            : '1',
        },
        USDC: {
          ...usdcStats,
          supplyAPY: calculateSupplyAPY(usdcStats.utilizationRate),
          borrowAPY: calculateBorrowAPY(usdcStats.utilizationRate),
          exchangeRate: usdcStats.vTokenSupply !== '0'
            ? (parseFloat(usdcStats.totalSupply) / parseFloat(usdcStats.vTokenSupply)).toFixed(7)
            : '1',
        },
        AQUARIUS_USDC: {
          ...aquiresUsdcStats,
          supplyAPY: calculateSupplyAPY(aquiresUsdcStats.utilizationRate),
          borrowAPY: calculateBorrowAPY(aquiresUsdcStats.utilizationRate),
          exchangeRate: aquiresUsdcStats.vTokenSupply !== '0'
            ? (parseFloat(aquiresUsdcStats.totalSupply) / parseFloat(aquiresUsdcStats.vTokenSupply)).toFixed(7)
            : '1',
        },
        SOROSWAP_USDC: {
          ...soroswapUsdcStats,
          supplyAPY: calculateSupplyAPY(soroswapUsdcStats.utilizationRate),
          borrowAPY: calculateBorrowAPY(soroswapUsdcStats.utilizationRate),
          exchangeRate: soroswapUsdcStats.vTokenSupply !== '0'
            ? (parseFloat(soroswapUsdcStats.totalSupply) / parseFloat(soroswapUsdcStats.vTokenSupply)).toFixed(7)
            : '1',
        },
      };

      useEarnPoolStore.getState().set({
        pools: mapped,
        lastUpdated: Date.now(),
        isLoadingPools: false,
      });

      return mapped;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Let the store's loading flag stay false after an error — the store write
  // in queryFn only runs on success. Reset it here so retries don't get stuck.
  if (query.isError) {
    useEarnPoolStore.getState().set({ isLoadingPools: false });
  }

  return {
    pools: query.data ?? storePools,
    isLoading: query.isLoading || query.isFetching,
    lastUpdated,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => query.refetch(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// User positions
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_POSITION = {
  deposited: '0',
  vTokenBalance: '0',
  borrowed: '0',
  borrowShares: '0',
  earnedInterest: '0',
  accruedDebt: '0',
};

const EMPTY_POSITIONS = {
  XLM: { ...EMPTY_POSITION },
  USDC: { ...EMPTY_POSITION },
  AQUARIUS_USDC: { ...EMPTY_POSITION },
  SOROSWAP_USDC: { ...EMPTY_POSITION },
};

export const useUserPositions = () => {
  const address = useUserStore((state) => state.address);
  const isConnected = useUserStore((state) => state.isConnected);
  const storePositions = useEarnPoolStore((s) => s.userPositions);

  const query = useQuery({
    queryKey: ['earn', 'userPositions', address ?? null],
    enabled: Boolean(address && isConnected),
    queryFn: async () => {
      if (!address) {
        useEarnPoolStore.getState().set({ userPositions: EMPTY_POSITIONS });
        useUserStore.getState().set({
          depositedBalances: { XLM: '0', USDC: '0', AQUARIUS_USDC: '0', SOROSWAP_USDC: '0' },
        });
        return EMPTY_POSITIONS;
      }

      useEarnPoolStore.getState().set({ isLoadingPositions: true });

      const [xlmVBalance, usdcVBalance, aquiresUsdcVBalance, soroswapUsdcVBalance] = await Promise.all([
        ContractService.getDepositedBalance(address, ASSET_TYPES.XLM),
        ContractService.getDepositedBalance(address, ASSET_TYPES.USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.AQUARIUS_USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.SOROSWAP_USDC),
      ]);

      const [xlmBorrow, usdcBorrow, aquiresUsdcBorrow, soroswapUsdcBorrow] = await Promise.all([
        ContractService.getUserBorrowBalance(address, ASSET_TYPES.XLM),
        ContractService.getUserBorrowBalance(address, ASSET_TYPES.USDC),
        ContractService.getUserBorrowBalance(address, ASSET_TYPES.AQUARIUS_USDC),
        ContractService.getUserBorrowBalance(address, ASSET_TYPES.SOROSWAP_USDC),
      ]);

      const positions = {
        XLM: { deposited: xlmVBalance, vTokenBalance: xlmVBalance, borrowed: xlmBorrow, borrowShares: '0', earnedInterest: '0', accruedDebt: '0' },
        USDC: { deposited: usdcVBalance, vTokenBalance: usdcVBalance, borrowed: usdcBorrow, borrowShares: '0', earnedInterest: '0', accruedDebt: '0' },
        AQUARIUS_USDC: { deposited: aquiresUsdcVBalance, vTokenBalance: aquiresUsdcVBalance, borrowed: aquiresUsdcBorrow, borrowShares: '0', earnedInterest: '0', accruedDebt: '0' },
        SOROSWAP_USDC: { deposited: soroswapUsdcVBalance, vTokenBalance: soroswapUsdcVBalance, borrowed: soroswapUsdcBorrow, borrowShares: '0', earnedInterest: '0', accruedDebt: '0' },
      };

      useEarnPoolStore.getState().set({
        userPositions: positions,
        isLoadingPositions: false,
      });

      useUserStore.getState().set({
        depositedBalances: {
          XLM: xlmVBalance,
          USDC: usdcVBalance,
          AQUARIUS_USDC: aquiresUsdcVBalance,
          SOROSWAP_USDC: soroswapUsdcVBalance,
        },
      });

      return positions;
    },
  });

  if (query.isError) {
    useEarnPoolStore.getState().set({ isLoadingPositions: false });
  }

  return {
    positions: query.data ?? storePositions,
    isLoading: query.isLoading || query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => query.refetch(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Mutations — stay imperative. react-query's `useMutation` would be a clean
// fit here, but the message/loading UX is already wired through setState and
// the callers expect the existing return shape.
// ─────────────────────────────────────────────────────────────────────────────
export const useSupplyLiquidity = () => {
  const address = useUserStore((state) => state.address);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | '', text: string }>({ type: '', text: '' });

  const refreshAllBalances = useCallback(async () => {
    if (!address) return;

    try {
      const balance = await WalletService.getBalance(address);

      const [xlmDeposited, usdcDeposited, aquiresUsdcDeposited, soroswapUsdcDeposited] = await Promise.all([
        ContractService.getDepositedBalance(address, ASSET_TYPES.XLM),
        ContractService.getDepositedBalance(address, ASSET_TYPES.USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.AQUARIUS_USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.SOROSWAP_USDC),
      ]);

      useUserStore.getState().set({
        balance,
        depositedBalances: {
          XLM: xlmDeposited,
          USDC: usdcDeposited,
          AQUARIUS_USDC: aquiresUsdcDeposited,
          SOROSWAP_USDC: soroswapUsdcDeposited,
        },
      });
    } catch (error) {
      console.error('Error refreshing balances:', error);
    }
  }, [address]);

  const supply = useCallback(async (amount: number, assetType: AssetType = ASSET_TYPES.XLM) => {
    if (!address) {
      setMessage({ type: 'error', text: 'Please connect your wallet first' });
      return { success: false };
    }

    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return { success: false };
    }

    try {
      setIsLoading(true);
      setMessage({ type: 'info', text: `Supplying ${amount} ${assetType} to the lending pool...` });

      const result = await ContractService.deposit(address, amount, assetType);

      if (result.success) {
        setMessage({ type: 'success', text: `Successfully supplied ${amount} ${assetType}! You received v${assetType} tokens.` });

        if (result.hash) {
          addTransaction('supply', assetType, amount.toString(), result.hash, 'success');
        }

        await refreshAllBalances();

        return { success: true, hash: result.hash };
      } else {
        setMessage({ type: 'error', text: result.error || 'Supply failed' });
        return { success: false };
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Supply failed' });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [address, refreshAllBalances]);

  return {
    supply,
    isLoading,
    message,
    clearMessage: () => setMessage({ type: '', text: '' }),
  };
};

export const useWithdrawLiquidity = () => {
  const address = useUserStore((state) => state.address);
  const userPositions = useEarnPoolStore((s) => s.userPositions);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | '', text: string }>({ type: '', text: '' });

  const refreshAllBalances = useCallback(async () => {
    if (!address) return;

    try {
      const balance = await WalletService.getBalance(address);

      const [xlmDeposited, usdcDeposited, aquiresUsdcDeposited, soroswapUsdcDeposited] = await Promise.all([
        ContractService.getDepositedBalance(address, ASSET_TYPES.XLM),
        ContractService.getDepositedBalance(address, ASSET_TYPES.USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.AQUARIUS_USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.SOROSWAP_USDC),
      ]);

      useUserStore.getState().set({
        balance,
        depositedBalances: {
          XLM: xlmDeposited,
          USDC: usdcDeposited,
          AQUARIUS_USDC: aquiresUsdcDeposited,
          SOROSWAP_USDC: soroswapUsdcDeposited,
        },
      });

      useEarnPoolStore.getState().set({
        userPositions: {
          XLM: { ...useEarnPoolStore.getState().userPositions.XLM, vTokenBalance: xlmDeposited, deposited: xlmDeposited },
          USDC: { ...useEarnPoolStore.getState().userPositions.USDC, vTokenBalance: usdcDeposited, deposited: usdcDeposited },
          AQUARIUS_USDC: { ...useEarnPoolStore.getState().userPositions.AQUARIUS_USDC, vTokenBalance: aquiresUsdcDeposited, deposited: aquiresUsdcDeposited },
          SOROSWAP_USDC: { ...useEarnPoolStore.getState().userPositions.SOROSWAP_USDC, vTokenBalance: soroswapUsdcDeposited, deposited: soroswapUsdcDeposited },
        },
      });
    } catch (error) {
      console.error('Error refreshing balances:', error);
    }
  }, [address]);

  const withdraw = useCallback(async (amount: number, assetType: AssetType = ASSET_TYPES.XLM) => {
    if (!address) {
      setMessage({ type: 'error', text: 'Please connect your wallet first' });
      return { success: false };
    }

    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return { success: false };
    }

    const depositedAmount = parseFloat(userPositions[assetType]?.vTokenBalance || '0');
    if (amount > depositedAmount) {
      setMessage({ type: 'error', text: `Cannot withdraw more than deposited balance (${depositedAmount.toFixed(7)} v${assetType})` });
      return { success: false };
    }

    try {
      setIsLoading(true);
      setMessage({ type: 'info', text: `Withdrawing ${amount} v${assetType} from the lending pool...` });

      const result = await ContractService.withdraw(address, amount, assetType);

      if (result.success) {
        setMessage({ type: 'success', text: `Successfully withdrew ${assetType}! Transaction confirmed.` });

        if (result.hash) {
          addTransaction('withdraw', assetType, amount.toString(), result.hash, 'success');
        }

        await refreshAllBalances();

        return { success: true, hash: result.hash };
      } else {
        setMessage({ type: 'error', text: result.error || 'Withdrawal failed' });
        return { success: false };
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Withdrawal failed' });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [address, userPositions, refreshAllBalances]);

  return {
    withdraw,
    isLoading,
    message,
    depositedBalances: {
      XLM: userPositions.XLM?.vTokenBalance || '0',
      USDC: userPositions.USDC?.vTokenBalance || '0',
      AQUARIUS_USDC: userPositions.AQUARIUS_USDC?.vTokenBalance || '0',
      SOROSWAP_USDC: userPositions.SOROSWAP_USDC?.vTokenBalance || '0',
    },
    clearMessage: () => setMessage({ type: '', text: '' }),
  };
};

// Combined hook for earn page
export const useEarnPage = () => {
  const wallet = useUserStore();
  const poolData = usePoolData();
  const userPositionsData = useUserPositions();
  const { recentTransactions } = useEarnPoolStore();

  const totalDeposited = Object.values(userPositionsData.positions).reduce(
    (sum, pos) => sum + (parseFloat(pos.deposited) || 0),
    0
  );

  const totalBorrowed = Object.values(userPositionsData.positions).reduce(
    (sum, pos) => sum + (parseFloat(pos.borrowed) || 0),
    0
  );

  const calculateWeightedAPY = () => {
    let totalValue = 0;
    let weightedAPY = 0;

    Object.entries(poolData.pools).forEach(([asset, pool]) => {
      const deposited = parseFloat(userPositionsData.positions[asset as keyof typeof userPositionsData.positions]?.deposited || '0');
      if (deposited > 0) {
        totalValue += deposited;
        weightedAPY += deposited * parseFloat(pool.supplyAPY || '0');
      }
    });

    return totalValue > 0 ? (weightedAPY / totalValue).toFixed(2) : '0';
  };

  const refresh = useCallback(async () => {
    await Promise.all([
      poolData.refresh(),
      userPositionsData.refresh(),
    ]);
  }, [poolData, userPositionsData]);

  return {
    isConnected: wallet.isConnected,
    address: wallet.address,
    nativeBalance: wallet.balance,

    pools: poolData.pools,
    isLoadingPools: poolData.isLoading,

    userPositions: userPositionsData.positions,
    isLoadingPositions: userPositionsData.isLoading,

    totalDeposited,
    totalBorrowed,
    weightedAPY: calculateWeightedAPY(),

    recentTransactions,

    refresh,
  };
};
