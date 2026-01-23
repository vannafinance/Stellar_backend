import createNewStore from "@/zustand/index"

// Types
export interface User {
  address: string | null;
  isConnected: boolean;
  balance: string;
  depositedBalances: {
    XLM: string;
    USDC: string;
    EURC: string;
  };
  isLoading: boolean;
  manuallyDisconnected: boolean; // Track if user manually disconnected
}

// Initial State
const initialState: User = {
  address: null,
  isConnected: false,
  balance: '0',
  depositedBalances: {
    XLM: '0',
    USDC: '0',
    EURC: '0',
  },
  isLoading: false,
  manuallyDisconnected: false,
};

// Export Store
export const useUserStore = createNewStore(initialState, {
  name: "user-store",
  devTools: true,
  persist: true,
});

