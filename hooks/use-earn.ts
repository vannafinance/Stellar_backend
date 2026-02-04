'use client';

import { useState, useEffect, useCallback } from 'react';
import { WalletService, ContractService, AssetType, ASSET_TYPES } from '@/lib/stellar-utils';
import { useUserStore } from '@/store/user';
import { useEarnPoolStore, addTransaction, PoolStats, UserPoolPosition } from '@/store/earn-pool-store';

// Hook for managing pool data
export const usePoolData = () => {
  const { pools, isLoadingPools, lastUpdated } = useEarnPoolStore();
  const [error, setError] = useState<string | null>(null);

  const fetchPoolData = useCallback(async () => {
    useEarnPoolStore.getState().set({ isLoadingPools: true });
    setError(null);

    try {
      const [xlmStats, usdcStats, eurcStats] = await Promise.all([
        ContractService.getPoolStats(ASSET_TYPES.XLM),
        ContractService.getPoolStats(ASSET_TYPES.USDC),
        ContractService.getPoolStats(ASSET_TYPES.EURC),
      ]);

      // Calculate APYs (simplified - in production, use rate model contract)
      const calculateSupplyAPY = (utilizationRate: string) => {
        const utilization = parseFloat(utilizationRate) / 100;
        // Base rate + utilization premium
        const baseRate = 2.0;
        const utilizationPremium = utilization * 10;
        return (baseRate + utilizationPremium).toFixed(2);
      };

      const calculateBorrowAPY = (utilizationRate: string) => {
        const utilization = parseFloat(utilizationRate) / 100;
        const baseRate = 4.0;
        const utilizationPremium = utilization * 15;
        return (baseRate + utilizationPremium).toFixed(2);
      };

      useEarnPoolStore.getState().set({
        pools: {
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
          EURC: {
            ...eurcStats,
            supplyAPY: calculateSupplyAPY(eurcStats.utilizationRate),
            borrowAPY: calculateBorrowAPY(eurcStats.utilizationRate),
            exchangeRate: eurcStats.vTokenSupply !== '0'
              ? (parseFloat(eurcStats.totalSupply) / parseFloat(eurcStats.vTokenSupply)).toFixed(7)
              : '1',
          },
        },
        lastUpdated: Date.now(),
        isLoadingPools: false,
      });
    } catch (err: any) {
      console.error('Error fetching pool data:', err);
      setError(err.message || 'Failed to fetch pool data');
      useEarnPoolStore.getState().set({ isLoadingPools: false });
    }
  }, []);

  // Auto-refresh pool data every 30 seconds
  useEffect(() => {
    fetchPoolData();
    const interval = setInterval(fetchPoolData, 30000);
    return () => clearInterval(interval);
  }, [fetchPoolData]);

  return {
    pools,
    isLoading: isLoadingPools,
    lastUpdated,
    error,
    refresh: fetchPoolData,
  };
};

// Hook for user positions
export const useUserPositions = () => {
  const address = useUserStore((state) => state.address);
  const isConnected = useUserStore((state) => state.isConnected);
  const { userPositions, isLoadingPositions } = useEarnPoolStore();
  const [error, setError] = useState<string | null>(null);

  const fetchUserPositions = useCallback(async () => {
    if (!address || !isConnected) {
      useEarnPoolStore.getState().set({
        userPositions: {
          XLM: { deposited: '0', vTokenBalance: '0', borrowed: '0', borrowShares: '0', earnedInterest: '0', accruedDebt: '0' },
          USDC: { deposited: '0', vTokenBalance: '0', borrowed: '0', borrowShares: '0', earnedInterest: '0', accruedDebt: '0' },
          EURC: { deposited: '0', vTokenBalance: '0', borrowed: '0', borrowShares: '0', earnedInterest: '0', accruedDebt: '0' },
        },
      });
      // Also update user store
      useUserStore.getState().set({
        depositedBalances: {
          XLM: '0',
          USDC: '0',
          EURC: '0',
        },
      });
      return;
    }

    useEarnPoolStore.getState().set({ isLoadingPositions: true });
    setError(null);

    try {
      // Fetch vToken balances (these are deposited amounts)
      const [xlmVBalance, usdcVBalance, eurcVBalance] = await Promise.all([
        ContractService.getDepositedBalance(address, ASSET_TYPES.XLM),
        ContractService.getDepositedBalance(address, ASSET_TYPES.USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.EURC),
      ]);

      // Fetch borrow balances
      const [xlmBorrow, usdcBorrow, eurcBorrow] = await Promise.all([
        ContractService.getUserBorrowBalance(address, ASSET_TYPES.XLM),
        ContractService.getUserBorrowBalance(address, ASSET_TYPES.USDC),
        ContractService.getUserBorrowBalance(address, ASSET_TYPES.EURC),
      ]);

      // Update earn pool store
      useEarnPoolStore.getState().set({
        userPositions: {
          XLM: {
            deposited: xlmVBalance,
            vTokenBalance: xlmVBalance,
            borrowed: xlmBorrow,
            borrowShares: '0',
            earnedInterest: '0',
            accruedDebt: '0',
          },
          USDC: {
            deposited: usdcVBalance,
            vTokenBalance: usdcVBalance,
            borrowed: usdcBorrow,
            borrowShares: '0',
            earnedInterest: '0',
            accruedDebt: '0',
          },
          EURC: {
            deposited: eurcVBalance,
            vTokenBalance: eurcVBalance,
            borrowed: eurcBorrow,
            borrowShares: '0',
            earnedInterest: '0',
            accruedDebt: '0',
          },
        },
        isLoadingPositions: false,
      });

      // Also update user store depositedBalances for withdraw hook
      useUserStore.getState().set({
        depositedBalances: {
          XLM: xlmVBalance,
          USDC: usdcVBalance,
          EURC: eurcVBalance,
        },
      });
    } catch (err: any) {
      console.error('Error fetching user positions:', err);
      setError(err.message || 'Failed to fetch user positions');
      useEarnPoolStore.getState().set({ isLoadingPositions: false });
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchUserPositions();
  }, [fetchUserPositions]);

  return {
    positions: userPositions,
    isLoading: isLoadingPositions,
    error,
    refresh: fetchUserPositions,
  };
};

// Hook for supply liquidity
export const useSupplyLiquidity = () => {
  const address = useUserStore((state) => state.address);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | '', text: string }>({ type: '', text: '' });

  const refreshAllBalances = useCallback(async () => {
    if (!address) return;

    try {
      const balance = await WalletService.getBalance(address);
      
      const [xlmDeposited, usdcDeposited, eurcDeposited] = await Promise.all([
        ContractService.getDepositedBalance(address, ASSET_TYPES.XLM),
        ContractService.getDepositedBalance(address, ASSET_TYPES.USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.EURC),
      ]);

      useUserStore.getState().set({
        balance,
        depositedBalances: {
          XLM: xlmDeposited,
          USDC: usdcDeposited,
          EURC: eurcDeposited,
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
        
        // Add transaction to history
        if (result.hash) {
          addTransaction('supply', assetType, amount.toString(), result.hash, 'success');
        }
        
        // Refresh balances after successful deposit
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

// Hook for withdraw liquidity
export const useWithdrawLiquidity = () => {
  const address = useUserStore((state) => state.address);
  const { userPositions } = useEarnPoolStore();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | '', text: string }>({ type: '', text: '' });

  const refreshAllBalances = useCallback(async () => {
    if (!address) return;

    try {
      const balance = await WalletService.getBalance(address);
      
      const [xlmDeposited, usdcDeposited, eurcDeposited] = await Promise.all([
        ContractService.getDepositedBalance(address, ASSET_TYPES.XLM),
        ContractService.getDepositedBalance(address, ASSET_TYPES.USDC),
        ContractService.getDepositedBalance(address, ASSET_TYPES.EURC),
      ]);

      useUserStore.getState().set({
        balance,
        depositedBalances: {
          XLM: xlmDeposited,
          USDC: usdcDeposited,
          EURC: eurcDeposited,
        },
      });

      // Also update the earn pool store
      useEarnPoolStore.getState().set({
        userPositions: {
          XLM: { ...useEarnPoolStore.getState().userPositions.XLM, vTokenBalance: xlmDeposited, deposited: xlmDeposited },
          USDC: { ...useEarnPoolStore.getState().userPositions.USDC, vTokenBalance: usdcDeposited, deposited: usdcDeposited },
          EURC: { ...useEarnPoolStore.getState().userPositions.EURC, vTokenBalance: eurcDeposited, deposited: eurcDeposited },
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

    // Get deposited balance from the earn pool store (vToken balance)
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
        
        // Add transaction to history
        if (result.hash) {
          addTransaction('withdraw', assetType, amount.toString(), result.hash, 'success');
        }
        
        // Refresh balances after successful withdrawal
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
      EURC: userPositions.EURC?.vTokenBalance || '0',
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

  // Calculate total deposited value across all pools
  const totalDeposited = Object.values(userPositionsData.positions).reduce(
    (sum, pos) => sum + (parseFloat(pos.deposited) || 0),
    0
  );

  // Calculate total borrowed value across all pools
  const totalBorrowed = Object.values(userPositionsData.positions).reduce(
    (sum, pos) => sum + (parseFloat(pos.borrowed) || 0),
    0
  );

  // Calculate weighted average APY
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
    // Wallet state
    isConnected: wallet.isConnected,
    address: wallet.address,
    nativeBalance: wallet.balance,
    
    // Pool data
    pools: poolData.pools,
    isLoadingPools: poolData.isLoading,
    
    // User positions
    userPositions: userPositionsData.positions,
    isLoadingPositions: userPositionsData.isLoading,
    
    // Aggregated data
    totalDeposited,
    totalBorrowed,
    weightedAPY: calculateWeightedAPY(),
    
    // Transactions
    recentTransactions,
    
    // Actions
    refresh,
  };
};
