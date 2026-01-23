import { requestAccess, getAddress, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

// Soroban Network Constants
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'; // Testnet
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// Contract Addresses (deployed to Stellar testnet)
export const CONTRACT_ADDRESSES = {
  // Core Infrastructure
  REGISTRY: 'CCUCFIYAFFPP7BZPTE4M354IJDAE5TNK3X7IVF4LGQBIZG4MCIG44XCR',
  ORACLE: 'CDMK4JPBZZYXTJ3AYQ2GF2P5CX5STW3YOPBLVA7AO7X64TXHAES3DHFY',
  RATE_MODEL: 'CAFYIBXFVY6KEFES4PEDXPS3ZY7IN7PRP72A5VR6GHKVHKG6C5ZKL5MY',
  
  // Token Contracts (deployed and initialized)
  VXLM_TOKEN: 'CDEQJMUKX7XGZQ5C7DX7WOGZHXCIC7ATRAUICYPYJGYXSVZPGUYLVXCI',
  VUSDC_TOKEN: 'CACVSNZ322SDFHWIU6DO3OKN5JYRL6Q7A6OHT2TVAE4ASWDU7I34GQSH',
  VEURC_TOKEN: 'CCACTGHDA5KBAY3YVJJ2SJHIYTOQ54PJFUEEDA5FUO7XLBZRCIJ2RIT6',
  
  // Lending Protocols (deployed and functional)
  LENDING_PROTOCOL_XLM: 'CDZX7NBK7FVYM5KTHSMKDHE44SKGOVXYXWCFHXHJ47RPBZO3XLSFZPHV',
  LENDING_PROTOCOL_USDC: 'CAYBLJPQA22UFRERDDX2U62ZR52UDO7YRUSQUO7ZANERXA4UKARBQCFQ',
  LENDING_PROTOCOL_EURC: 'CCJM2PJR2PFN25VK7RNLDDBUC7U7OP6NO3BX6I7LRVKYOCAOJRUM3TTW',
  ACCOUNT_MANAGER: 'CCRVL6J45GRHI4JEFDBLERIQ27Z72SJENZIZD4WQZMMKNZMCG6ZQ7WVU',
} as const;

// Asset Types
export const ASSET_TYPES = {
  XLM: 'XLM',
  USDC: 'USDC',
  EURC: 'EURC',
} as const;

export type AssetType = typeof ASSET_TYPES[keyof typeof ASSET_TYPES];

// Wallet connection utilities
export class WalletService {
  static async connectWallet(): Promise<{ address: string; success: boolean; error?: string }> {
    try {
      const accessGranted = await requestAccess();
      if (!accessGranted) {
        return { address: '', success: false, error: 'Please approve the connection in Freighter' };
      }
      
      const result = await getAddress();
      if (result.error) {
        return { address: '', success: false, error: result.error };
      }
      
      if (!result.address) {
        return { address: '', success: false, error: 'Wallet is locked. Please unlock Freighter' };
      }
      
      return { address: result.address, success: true };
    } catch (error: any) {
      return { address: '', success: false, error: error?.message || 'Failed to connect wallet' };
    }
  }

  static async checkConnection(): Promise<{ address: string; connected: boolean }> {
    try {
      const result = await getAddress();
      if (result.address && !result.error) {
        return { address: result.address, connected: true };
      }
      return { address: '', connected: false };
    } catch (error) {
      return { address: '', connected: false };
    }
  }

  static async getBalance(address: string): Promise<string> {
    try {
      const server = new StellarSdk.Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(address);
      
      const xlmBalance = account.balances.find(
        (balance: any) => balance.asset_type === 'native'
      );
      
      return xlmBalance ? parseFloat(xlmBalance.balance).toFixed(7) : '0';
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return '0 (Not funded)';
      }
      return 'Error';
    }
  }
}

// Contract interaction utilities
export class ContractService {
  static async deposit(
    walletAddress: string, 
    amount: number, 
    assetType: AssetType = ASSET_TYPES.XLM
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(walletAddress);
      
      let contractAddress: string;
      let methodName: string;
      
      // Select appropriate contract and method based on asset type
      switch (assetType) {
        case ASSET_TYPES.XLM:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_XLM;
          methodName = 'deposit_xlm';
          break;
        case ASSET_TYPES.USDC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_USDC;
          methodName = 'deposit_usdc';
          break;
        case ASSET_TYPES.EURC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_EURC;
          methodName = 'deposit_eurc';
          break;
        default:
          throw new Error('Unsupported asset type');
      }
      
      const contract = new StellarSdk.Contract(contractAddress);
      
      // Convert amount to appropriate format (WAD - 18 decimals)
      const amountWAD = (BigInt(Math.floor(amount * 1e18))).toString();
      
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            methodName,
            StellarSdk.nativeToScVal(walletAddress, { type: 'address' }),
            StellarSdk.nativeToScVal(amountWAD, { type: 'u256' })
          )
        )
        .setTimeout(30)
        .build();

      console.log('Preparing transaction with required authorizations...');
      const preparedTx = await server.prepareTransaction(transaction);

      const operation = preparedTx.operations[0] as StellarSdk.Operation.InvokeHostFunction;
      console.log('Transaction prepared. Auth entries count:', operation?.auth?.length || 0);

      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      console.log('Sending transaction...');
      const result = await server.sendTransaction(signedTx as StellarSdk.Transaction);

      if (result.status === 'PENDING') {
        console.log('Transaction pending, polling for status...');
        await ContractService.pollTransactionStatus(server, result.hash);
        return { success: true, hash: result.hash };
      } else {
        throw new Error('Transaction rejected by network');
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      return { success: false, error: error?.message || 'Deposit failed' };
    }
  }

  static async withdraw(
    walletAddress: string, 
    amount: number, 
    assetType: AssetType = ASSET_TYPES.XLM
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(walletAddress);
      
      let contractAddress: string;
      let methodName: string;
      
      // Select appropriate contract and method based on asset type
      switch (assetType) {
        case ASSET_TYPES.XLM:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_XLM;
          methodName = 'redeem_vxlm';
          break;
        case ASSET_TYPES.USDC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_USDC;
          methodName = 'redeem_vusdc';
          break;
        case ASSET_TYPES.EURC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_EURC;
          methodName = 'redeem_veurc';
          break;
        default:
          throw new Error('Unsupported asset type');
      }
      
      const contract = new StellarSdk.Contract(contractAddress);
      
      // Convert amount to appropriate format (WAD - 18 decimals)
      const amountWAD = (BigInt(Math.floor(amount * 1e18))).toString();
      
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            methodName,
            StellarSdk.nativeToScVal(walletAddress, { type: 'address' }),
            StellarSdk.nativeToScVal(amountWAD, { type: 'u256' })
          )
        )
        .setTimeout(30)
        .build();

      const preparedTx = await server.prepareTransaction(transaction);

      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      const result = await server.sendTransaction(signedTx as StellarSdk.Transaction);

      if (result.status === 'PENDING') {
        await ContractService.pollTransactionStatus(server, result.hash);
        return { success: true, hash: result.hash };
      } else {
        throw new Error('Transaction rejected by network');
      }
    } catch (error: any) {
      console.error('Withdraw error:', error);
      return { success: false, error: error?.message || 'Withdraw failed' };
    }
  }

  static async getDepositedBalance(
    address: string,
    assetType: AssetType = ASSET_TYPES.XLM
  ): Promise<string> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(address);
      
      let contractAddress: string;
      
      // Select appropriate vToken contract based on asset type
      switch (assetType) {
        case ASSET_TYPES.XLM:
          contractAddress = CONTRACT_ADDRESSES.VXLM_TOKEN;
          break;
        case ASSET_TYPES.USDC:
          contractAddress = CONTRACT_ADDRESSES.VUSDC_TOKEN;
          break;
        case ASSET_TYPES.EURC:
          contractAddress = CONTRACT_ADDRESSES.VEURC_TOKEN;
          break;
        default:
          throw new Error('Unsupported asset type');
      }
      
      const contract = new StellarSdk.Contract(contractAddress);
      
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'balance',
            StellarSdk.nativeToScVal(address, { type: 'address' })
          )
        )
        .setTimeout(30)
        .build();

      const simulationResponse = await server.simulateTransaction(transaction);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
        const result = simulationResponse.result;
        if (result && result.retval) {
          const balance = StellarSdk.scValToNative(result.retval);
          // Convert from token decimals to regular decimal
          // vTokens typically have 7 decimals for Stellar
          const balanceDecimal = Number(balance) / 1e7;
          return balanceDecimal.toFixed(7);
        } else {
          return '0';
        }
      } else {
        return '0';
      }
    } catch (error: any) {
      console.error('Error fetching deposited balance:', error);
      return 'Error';
    }
  }

  static async pollTransactionStatus(server: StellarSdk.rpc.Server, hash: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        const transaction = await server.getTransaction(hash);
        if (transaction.status !== 'NOT_FOUND') {
          if (transaction.status === 'SUCCESS') {
            return;
          } else {
            throw new Error('Transaction failed');
          }
        }
      } catch (error: any) {
        if (error?.message?.includes('Transaction failed')) {
          throw error;
        }
        // Continue polling
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    throw new Error('Transaction timeout');
  }
}