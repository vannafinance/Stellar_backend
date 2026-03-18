import { requestAccess, getAddress, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

// Soroban Network Constants
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'; // Testnet
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// Contract Addresses (deployed to Stellar testnet)
// Deployed on 2026-03-05 by vanna_deployer: GAUVY7FNDKVWRMW3SYEMX6QMFSWQDKC6XIPJJKAMOEMLZPAI7XZPDV3D
export const CONTRACT_ADDRESSES = {
  // Core Infrastructure
  REGISTRY: 'CANOLJZH7YTQVRSNL4WFIT6EHZUK6OL7HQR2Q2UOMHFJCZH2JMHW3AR2',
  ORACLE: 'CDXBPOUKDMC23C7BINQOO6Z2JKXDSHLW5VIPEQSJONB4CT3P56M2PQ7B',
  RATE_MODEL: 'CCC6MVWLV7W6OHAFZSZZKFCPXMYN4CFH65AILN3VECQBV7MRO6NJ3YGW',
  RISK_ENGINE: 'CCGQGMDSORBVXIGSYXXCADJH5ZVZLLKVHDJ644RPJ2K6C7ZGGB2KVMZU',

  // Token Contracts (deployed and initialized)
  VXLM_TOKEN: 'CC7XU2DPNVYB5FFNX7XR4LEEEZFOSLTOBSCY6AXXIYUONYKTFMLYZ4ZT',
  VUSDC_TOKEN: 'CAPAKQXQQMFPLEHGZXGHSEUIFIM6F2UQ6LMNCXNDSYDKSPAVSQVKWNJC',
  VEURC_TOKEN: 'CC6OY2PKOK3SBMS6GVCXF43Z35ROOHBLNW5QX2FPDIFBDRGESPSVEPTE',

  // Lending Protocols (deployed and functional)
  LENDING_PROTOCOL_XLM: 'CAOPI6NYPXEVMDRTUWAGMWNSIXMBCBDSJBJARLIUJB6LNRPQCCJUN3VO',
  LENDING_PROTOCOL_USDC: 'CDDE2DYGM63OBA63OQTGDTLDV5LZQ6TELKCNVWGZP47OAABUTGJRKA3H',
  LENDING_PROTOCOL_EURC: 'CC3Q65H5H4ELYC67PYKETI5S76SXJEPAORWKYDIDNULIHD3CBE43JLSN',
  ACCOUNT_MANAGER: 'CCXRQX5XTUXMAYA2MOIWHITDCLMQX4L3DKDX2SYJBBWFFABBWA6QY3PK',

  // ── Blend Capital Testnet Addresses (https://github.com/blend-capital/blend-utils) ──
  // Single pool contract that handles XLM, USDC, wETH, wBTC supplies/borrows
  BLEND_POOL: 'CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF',       // TestnetV2 pool
  BLEND_BACKSTOP: 'CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA',    // BackstopV2
  BLEND_EMITTER: 'CC3WJVJINN4E3LPMNTWKK7LQZLYDQMZHZA7EZGXATPHHBPKNZRIO3KZ6',    // Emitter
  BLEND_TOKEN: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',      // BLND token
  // Blend testnet asset contracts (used as reserve assets inside the Blend pool)
  BLEND_XLM: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',        // XLM (matches our registry)
  BLEND_USDC: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',       // Blend testnet USDC

  // ── Aquarius AMM Testnet Addresses ──
  // Real router (found from pool's ["Router"] storage key)
  AQUARIUS_ROUTER: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
  // XLM/USDC pool (TokenA=CAZRY5 Aquarius USDC, TokenB=CDLZFC XLM)
  AQUARIUS_XLM_USDC_POOL: 'CD3LFMMLBQ6RBJUD3Z2LFDFE6544WDRMWHEZYPI5YDVESYRSO2TT32BX',
  // Aquarius USDC token contract (issuer GAHPYWLK6...)
  AQUARIUS_USDC: 'CAZRY5GSFBFXD7H6GAFBA5YGYQTDXU4QKWKMYFWBAZFUCURN3WKX6LF5',
} as const;

// Asset Types
export const ASSET_TYPES = {
  XLM: 'XLM',
  USDC: 'USDC',
  EURC: 'EURC',
} as const;

// Asset Issuers (Stellar Testnet)
export const ASSET_ISSUERS = {
  USDC: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  USDC_AQUARIUS: 'GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER',
  EURC: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
  AQUA: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
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
      console.log(`[getDepositedBalance] Fetching balance for ${assetType}, address:`, address);
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
      
      console.log(`[getDepositedBalance] Using vToken contract:`, contractAddress);
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
      console.log(`[getDepositedBalance] Simulation response:`, simulationResponse);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
        const result = simulationResponse.result;
        if (result && result.retval) {
          const balance = StellarSdk.scValToNative(result.retval);
          console.log(`[getDepositedBalance] Raw balance from contract:`, balance);
          // Convert from token decimals to regular decimal
          // vTokens typically have 7 decimals for Stellar
          const balanceDecimal = Number(balance) / 1e7;
          console.log(`[getDepositedBalance] Converted balance:`, balanceDecimal.toFixed(7));
          return balanceDecimal.toFixed(7);
        } else {
          console.log(`[getDepositedBalance] No retval in result, returning 0`);
          return '0';
        }
      } else {
        console.error(`[getDepositedBalance] Simulation failed:`, simulationResponse);
        return '0';
      }
    } catch (error: any) {
      console.error(`[getDepositedBalance] Error fetching deposited balance for ${assetType}:`, error);
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

  // Get total liquidity in pool
  static async getPoolLiquidity(assetType: AssetType = ASSET_TYPES.XLM): Promise<string> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      
      let contractAddress: string;
      switch (assetType) {
        case ASSET_TYPES.XLM:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_XLM;
          break;
        case ASSET_TYPES.USDC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_USDC;
          break;
        case ASSET_TYPES.EURC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_EURC;
          break;
        default:
          throw new Error('Unsupported asset type');
      }
      
      // Create a temporary account for simulation
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      
      const contract = new StellarSdk.Contract(contractAddress);
      
      const transaction = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('get_total_liquidity_in_pool'))
        .setTimeout(30)
        .build();

      const simulationResponse = await server.simulateTransaction(transaction);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
        const result = simulationResponse.result;
        if (result && result.retval) {
          const liquidityWad = StellarSdk.scValToNative(result.retval);
          // Convert from WAD (18 decimals) to regular decimal
          const liquidity = Number(liquidityWad) / 1e18;
          return liquidity.toFixed(7);
        }
      }
      return '0';
    } catch (error: any) {
      console.error('Error fetching pool liquidity:', error);
      return '0';
    }
  }

  // Get total borrows in pool
  static async getPoolBorrows(assetType: AssetType = ASSET_TYPES.XLM): Promise<string> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      
      let contractAddress: string;
      switch (assetType) {
        case ASSET_TYPES.XLM:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_XLM;
          break;
        case ASSET_TYPES.USDC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_USDC;
          break;
        case ASSET_TYPES.EURC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_EURC;
          break;
        default:
          throw new Error('Unsupported asset type');
      }
      
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      
      const contract = new StellarSdk.Contract(contractAddress);
      
      const transaction = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('get_borrows'))
        .setTimeout(30)
        .build();

      const simulationResponse = await server.simulateTransaction(transaction);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
        const result = simulationResponse.result;
        if (result && result.retval) {
          const borrowsWad = StellarSdk.scValToNative(result.retval);
          const borrows = Number(borrowsWad) / 1e18;
          return borrows.toFixed(7);
        }
      }
      return '0';
    } catch (error: any) {
      console.error('Error fetching pool borrows:', error);
      return '0';
    }
  }

  // Get total assets (liquidity + borrows)
  static async getTotalAssets(assetType: AssetType = ASSET_TYPES.XLM): Promise<string> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      
      let contractAddress: string;
      switch (assetType) {
        case ASSET_TYPES.XLM:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_XLM;
          break;
        case ASSET_TYPES.USDC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_USDC;
          break;
        case ASSET_TYPES.EURC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_EURC;
          break;
        default:
          throw new Error('Unsupported asset type');
      }
      
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      
      const contract = new StellarSdk.Contract(contractAddress);
      
      const transaction = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('total_assets'))
        .setTimeout(30)
        .build();

      const simulationResponse = await server.simulateTransaction(transaction);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
        const result = simulationResponse.result;
        if (result && result.retval) {
          const totalWad = StellarSdk.scValToNative(result.retval);
          const total = Number(totalWad) / 1e18;
          return total.toFixed(7);
        }
      }
      return '0';
    } catch (error: any) {
      console.error('Error fetching total assets:', error);
      return '0';
    }
  }

  // Get vToken total supply
  static async getVTokenTotalSupply(assetType: AssetType = ASSET_TYPES.XLM): Promise<string> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      
      let contractAddress: string;
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
      
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      
      const contract = new StellarSdk.Contract(contractAddress);
      
      const transaction = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('total_supply'))
        .setTimeout(30)
        .build();

      const simulationResponse = await server.simulateTransaction(transaction);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
        const result = simulationResponse.result;
        if (result && result.retval) {
          const supply = StellarSdk.scValToNative(result.retval);
          // vTokens have 7 decimals
          const supplyDecimal = Number(supply) / 1e7;
          return supplyDecimal.toFixed(7);
        }
      }
      return '0';
    } catch (error: any) {
      console.error('Error fetching vToken supply:', error);
      return '0';
    }
  }

  // Get complete pool statistics
  static async getPoolStats(assetType: AssetType = ASSET_TYPES.XLM): Promise<{
    totalSupply: string;
    totalBorrowed: string;
    availableLiquidity: string;
    utilizationRate: string;
    vTokenSupply: string;
  }> {
    try {
      const [liquidity, borrows, vTokenSupply] = await Promise.all([
        this.getPoolLiquidity(assetType),
        this.getPoolBorrows(assetType),
        this.getVTokenTotalSupply(assetType),
      ]);
      
      const liquidityNum = parseFloat(liquidity) || 0;
      const borrowsNum = parseFloat(borrows) || 0;
      const totalSupply = liquidityNum + borrowsNum;
      
      // Calculate utilization rate
      const utilizationRate = totalSupply > 0 
        ? ((borrowsNum / totalSupply) * 100).toFixed(2)
        : '0';
      
      return {
        totalSupply: totalSupply.toFixed(7),
        totalBorrowed: borrows,
        availableLiquidity: liquidity,
        utilizationRate,
        vTokenSupply,
      };
    } catch (error: any) {
      console.error('Error fetching pool stats:', error);
      return {
        totalSupply: '0',
        totalBorrowed: '0',
        availableLiquidity: '0',
        utilizationRate: '0',
        vTokenSupply: '0',
      };
    }
  }

  // Get user borrow balance
  static async getUserBorrowBalance(
    address: string,
    assetType: AssetType = ASSET_TYPES.XLM
  ): Promise<string> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(address);
      
      let contractAddress: string;
      switch (assetType) {
        case ASSET_TYPES.XLM:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_XLM;
          break;
        case ASSET_TYPES.USDC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_USDC;
          break;
        case ASSET_TYPES.EURC:
          contractAddress = CONTRACT_ADDRESSES.LENDING_PROTOCOL_EURC;
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
            'get_borrow_balance',
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
          const balanceDecimal = Number(balance) / 1e18;
          return balanceDecimal.toFixed(7);
        }
      }
      return '0';
    } catch (error: any) {
      console.error('Error fetching borrow balance:', error);
      return '0';
    }
  }

  // Get all token balances for a wallet (XLM, USDC, EURC)
  static async getAllTokenBalances(address: string): Promise<{
    XLM: string;
    USDC: string;
    EURC: string;
  }> {
    try {
      const server = new StellarSdk.Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(address);
      
      let xlmBalance = '0';
      let usdcBalance = '0';
      let eurcBalance = '0';
      
      for (const balance of account.balances) {
        if (balance.asset_type === 'native') {
          xlmBalance = parseFloat(balance.balance).toFixed(7);
        } else if (balance.asset_type === 'credit_alphanum4' || balance.asset_type === 'credit_alphanum12') {
          const assetBalance = balance as StellarSdk.Horizon.HorizonApi.BalanceLineAsset;
          if (assetBalance.asset_code === 'USDC' && (
            assetBalance.asset_issuer === ASSET_ISSUERS.USDC ||
            assetBalance.asset_issuer === ASSET_ISSUERS.USDC_AQUARIUS
          )) {
            // Sum both Circle USDC and Aquarius USDC balances
            usdcBalance = (parseFloat(usdcBalance) + parseFloat(assetBalance.balance)).toFixed(7);
          } else if (assetBalance.asset_code === 'EURC' && assetBalance.asset_issuer === ASSET_ISSUERS.EURC) {
            eurcBalance = parseFloat(assetBalance.balance).toFixed(7);
          }
        }
      }
      
      return {
        XLM: xlmBalance,
        USDC: usdcBalance,
        EURC: eurcBalance,
      };
    } catch (error: any) {
      console.error('Error fetching token balances:', error);
      return {
        XLM: '0',
        USDC: '0',
        EURC: '0',
      };
    }
  }
}
