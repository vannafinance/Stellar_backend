import createNewStore from "@/zustand/index";
import { MarginAccountService, type MarginAccount } from "@/lib/margin-utils";

// Types
export interface BorrowedBalance {
  amount: string;
  usdValue: string;
}

export interface MarginAccountInfoStateType {
  totalBorrowedValue: number;
  totalCollateralValue: number;
  totalValue: number;
  avgHealthFactor: number;
  timeToLiquidation: number;
  borrowRate: number;
  liquidationPremium: number;
  liquidationFee: number;
  debtLimit: number;
  minDebt: number;
  maxDebt: number;
  hasMarginAccount: boolean;
  marginAccountAddress: string | null;
  isCreatingAccount: boolean;
  accountCreationError: string | null;
  borrowedBalances: Record<string, BorrowedBalance>;
  isLoadingBorrowedBalances: boolean;
}

// Initial State
const initialState: MarginAccountInfoStateType = {
  totalBorrowedValue: 90,
  totalCollateralValue: 1000,
  totalValue: 0,
  avgHealthFactor: 0,
  timeToLiquidation: 0,
  borrowRate: 0,
  liquidationPremium: 0,
  liquidationFee: 0,
  debtLimit: 0,
  minDebt: 0,
  maxDebt: 0,
  hasMarginAccount: false,
  marginAccountAddress: null,
  isCreatingAccount: false,
  accountCreationError: null,
  borrowedBalances: {},
  isLoadingBorrowedBalances: false,
};

// Export Store
export const useMarginAccountInfoStore = createNewStore(initialState, {
  name: "margin-account-info-store",
  devTools: true,
  persist: true,
});

// Action functions
export const setMarginAccount = (account: MarginAccount) => {
  useMarginAccountInfoStore.getState().set({
    hasMarginAccount: true,
    marginAccountAddress: account.address,
    accountCreationError: null,
  });
};

export const clearMarginAccount = () => {
  useMarginAccountInfoStore.getState().set({
    hasMarginAccount: false,
    marginAccountAddress: null,
    accountCreationError: null,
  });
};

export const setAccountCreationLoading = (loading: boolean) => {
  useMarginAccountInfoStore.getState().set({
    isCreatingAccount: loading,
    accountCreationError: loading ? null : useMarginAccountInfoStore.getState().get((state) => state.accountCreationError),
  });
};

export const setAccountCreationError = (error: string | null) => {
  useMarginAccountInfoStore.getState().set({
    accountCreationError: error,
    isCreatingAccount: false,
  });
};

// Add deposit and borrow action
export const depositAndBorrow = async (
  userAddress: string, 
  depositAmount: number, 
  multiplier: number, 
  tokenSymbol: string = 'XLM'
): Promise<{ success: boolean; hash?: string; error?: string }> => {
  try {
    // Get current margin account
    const account = MarginAccountService.getStoredMarginAccount(userAddress);
    if (!account || !account.isActive) {
      return {
        success: false,
        error: 'No active margin account found'
      };
    }

    // Execute deposit and borrow
    const result = await MarginAccountService.depositAndBorrow(
      account.address,
      depositAmount,
      multiplier,
      tokenSymbol
    );

    // Refresh borrowed balances after successful deposit (even if borrow fails, deposit might still succeed)
    if (result.success || result.error?.includes('Deposit was successful')) {
      await refreshBorrowedBalances(account.address);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Add standalone borrow function
export const borrowTokens = async (
  userAddress: string,
  tokenSymbol: string,
  borrowAmount: number
): Promise<{ success: boolean; hash?: string; error?: string }> => {
  try {
    console.log('🏦 === MARGIN STORE: BORROW OPERATION ===');
    console.log('📊 Borrow parameters:', {
      userAddress,
      tokenSymbol,
      borrowAmount
    });

    // Get current margin account
    const account = MarginAccountService.getStoredMarginAccount(userAddress);
    if (!account || !account.isActive) {
      console.error('❌ No active margin account found');
      return {
        success: false,
        error: 'No active margin account found. Please create a margin account first.'
      };
    }

    console.log('✅ Found active margin account:', account.address);

    // Convert borrow amount to WAD (18 decimals)
    const borrowAmountWad = (borrowAmount * Math.pow(10, 18)).toString();
    console.log('🔢 Converting to WAD:', {
      originalAmount: borrowAmount,
      wadAmount: borrowAmountWad
    });

    // Update loading state
    useMarginAccountInfoStore.getState().set({ 
      isLoadingBorrowedBalances: true 
    });

    // Execute borrow operation
    const result = await MarginAccountService.borrowTokens(
      account.address,
      tokenSymbol,
      borrowAmountWad
    );

    console.log('📈 Borrow operation result:', result);

    // Always refresh borrowed balances after operation (success or failure)
    try {
      console.log('🔄 Refreshing borrowed balances...');
      await refreshBorrowedBalances(account.address);
      console.log('✅ Borrowed balances refreshed');
    } catch (refreshError) {
      console.warn('⚠️ Failed to refresh borrowed balances:', refreshError);
    }

    // Update loading state
    useMarginAccountInfoStore.getState().set({ 
      isLoadingBorrowedBalances: false 
    });

    return result;
  } catch (error) {
    console.error('💥 Error in borrowTokens store function:', error);
    
    // Make sure to reset loading state
    useMarginAccountInfoStore.getState().set({ 
      isLoadingBorrowedBalances: false 
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Add contract setup action (for admin/testing purposes)
export const setupContractConfiguration = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await MarginAccountService.setupContractConfiguration();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const checkUserMarginAccount = async (userAddress: string) => {
  try {
    console.log('🔍 Checking margin account for user:', userAddress);
    
    // Step 1: Check localStorage first (fastest)
    const accountInfo = MarginAccountService.getMarginAccountInfo(userAddress);
    
    if (accountInfo.hasAccount) {
      console.log('✅ Found margin account in localStorage:', accountInfo.accountAddress);
      useMarginAccountInfoStore.getState().set({
        hasMarginAccount: true,
        marginAccountAddress: accountInfo.accountAddress || null,
      });
      return;
    }
    
    // Step 2: No account in localStorage - check blockchain
    console.log('🌐 No account in localStorage, searching blockchain...');
    
    try {
      // Discover existing account from blockchain
      const blockchainAccount = await MarginAccountService.discoverExistingAccount(userAddress);
      
      if (blockchainAccount) {
        console.log('✅ Recovered margin account from blockchain:', blockchainAccount);
        useMarginAccountInfoStore.getState().set({
          hasMarginAccount: true,
          marginAccountAddress: blockchainAccount,
        });
      } else {
        console.log('❌ No margin account found - user needs to create one');
        useMarginAccountInfoStore.getState().set({
          hasMarginAccount: false,
          marginAccountAddress: null,
        });
      }
    } catch (blockchainError) {
      console.error('❌ Error checking blockchain for existing account:', blockchainError);
      // Fallback to no account on blockchain error
      useMarginAccountInfoStore.getState().set({
        hasMarginAccount: false,
        marginAccountAddress: null,
      });
    }
  } catch (error) {
    console.error('❌ Error in checkUserMarginAccount:', error);
    useMarginAccountInfoStore.getState().set({
      hasMarginAccount: false,
      marginAccountAddress: null,
    });
  }
};

export const createMarginAccount = async (userAddress: string): Promise<boolean> => {
  try {
    setAccountCreationLoading(true);
    
    const result = await MarginAccountService.createMarginAccount(userAddress);
    
    if (result.success && result.marginAccountAddress) {
      const marginAccount: MarginAccount = {
        address: result.marginAccountAddress,
        owner: userAddress,
        isActive: true,
        createdAt: Date.now()
      };
      
      setMarginAccount(marginAccount);
      return true;
    } else {
      setAccountCreationError(result.error || 'Failed to create margin account');
      return false;
    }
  } catch (error: any) {
    setAccountCreationError(error?.message || 'Failed to create margin account');
    return false;
  }
};

export const updateAccountData = (data: Partial<MarginAccountInfoStateType>) => {
  useMarginAccountInfoStore.getState().set(data);
};

export const refreshBorrowedBalances = async (marginAccountAddress: string) => {
  try {
    useMarginAccountInfoStore.getState().set({ isLoadingBorrowedBalances: true });
    
    const result = await MarginAccountService.getCurrentBorrowedBalances(marginAccountAddress);
    
    if (result.success && result.data) {
      useMarginAccountInfoStore.getState().set({ 
        borrowedBalances: result.data,
        isLoadingBorrowedBalances: false 
      });
    } else {
      console.error('❌ Failed to refresh borrowed balances:', result.error);
      useMarginAccountInfoStore.getState().set({ 
        isLoadingBorrowedBalances: false 
      });
    }
  } catch (error: any) {
    console.error('❌ Error refreshing borrowed balances:', error);
    useMarginAccountInfoStore.getState().set({ 
      isLoadingBorrowedBalances: false 
    });
  }
};

export const resetToInitialState = () => {
  useMarginAccountInfoStore.getState().reset();
};

export const resetCreationState = () => {
  useMarginAccountInfoStore.getState().set({
    isCreatingAccount: false,
    accountCreationError: null,
  });
};

