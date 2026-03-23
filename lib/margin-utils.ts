import * as StellarSdk from '@stellar/stellar-sdk';
import { getAddress, signTransaction } from '@stellar/freighter-api';
import { CONTRACT_ADDRESSES, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from './stellar-utils';

// Types
export interface MarginAccount {
  address: string;
  owner: string;
  isActive: boolean;
  createdAt: number;
}

export interface MarginAccountCreationResult {
  success: boolean;
  marginAccountAddress?: string;
  hash?: string;
  error?: string;
}

// Margin account management class
export class MarginAccountService {
  // Local storage key for margin accounts
  private static STORAGE_KEY = 'vanna_margin_accounts';

  private static normalizeContractTokenSymbol(tokenSymbol: string): string {
    const normalized = tokenSymbol?.toUpperCase();
    if (normalized === 'AQUIRESUSDC' || normalized === 'AQUARIUS_USDC') {
      return 'USDC';
    }
    return normalized;
  }

  private static parseBorrowNotAllowedMessage(raw: any, tokenSymbol: string): string {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});

    if (text.includes('is_borrow_allowed') && text.includes('false')) {
      return `Borrow not allowed by Risk Engine for ${tokenSymbol}. Your account collateral/debt ratio is too low for this borrow amount. Please repay existing debt or add more collateral, then try again.`;
    }

    if (text.includes('InvalidAction') || text.includes('UnreachableCodeReached')) {
      return `Borrow action rejected for ${tokenSymbol}. This usually means borrow constraints are not satisfied (health factor, debt limit, or collateral requirements).`;
    }

    return `Borrow failed for ${tokenSymbol}. Please check collateral, existing debt, and risk limits, then retry.`;
  }

  /**
   * Get stored margin account for a user
   */
  static getStoredMarginAccount(userAddress: string): MarginAccount | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;
      
      const accounts: Record<string, MarginAccount> = JSON.parse(stored);
      return accounts[userAddress] || null;
    } catch (error) {
      console.error('Error reading margin account from storage:', error);
      return null;
    }
  }

  /**
   * Store margin account for a user
   */
  static storeMarginAccount(userAddress: string, marginAccount: MarginAccount): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY) || '{}';
      const accounts: Record<string, MarginAccount> = JSON.parse(stored);
      
      accounts[userAddress] = marginAccount;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
    } catch (error) {
      console.error('Error storing margin account:', error);
    }
  }

  /**
   * Check if user has a margin account
   */
  static hasMarginAccount(userAddress: string): boolean {
    const account = this.getStoredMarginAccount(userAddress);
    return account !== null && account.isActive;
  }

  /**
   * Create a new margin account by calling the smart contract
   * STRICT ENFORCEMENT: Only creates if no existing account found
   */
  static async createMarginAccount(
    userAddress: string
  ): Promise<MarginAccountCreationResult> {
    try {
      console.log('🔍 Checking for existing margin account for:', userAddress);
      
      // STEP 1: Check localStorage first
      const existingAccount = this.getStoredMarginAccount(userAddress);
      if (existingAccount && existingAccount.isActive) {
        console.log('✅ User already has active margin account in localStorage:', existingAccount.address);
        return {
          success: true,
          marginAccountAddress: existingAccount.address,
          error: 'User already has an active margin account (localStorage)'
        };
      }
      
      // STEP 2: Check blockchain for existing accounts (comprehensive search)
      console.log('🌐 No local account found, checking blockchain for existing accounts...');
      const blockchainAccount = await this.getMarginAccountFromRegistry(userAddress);
      if (blockchainAccount) {
        console.log('✅ Found existing active margin account on blockchain:', blockchainAccount);
        return {
          success: true,
          marginAccountAddress: blockchainAccount,
          error: 'User already has an active margin account (recovered from blockchain)'
        };
      }
      
      // STEP 3: No existing account found anywhere - proceed with creation
      console.log('🆕 No existing margin account found. Creating new account...');
      
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(userAddress);
      
      // Create contract instance for AccountManager
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);
      
      // Build the transaction to call create_account
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'create_account',
            StellarSdk.nativeToScVal(userAddress, { type: 'address' })
          )
        )
        .setTimeout(30)
        .build();

      console.log('Preparing margin account creation transaction...');
      const preparedTx = await server.prepareTransaction(transaction);
      
      // Sign the transaction
      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      console.log('Sending margin account creation transaction...');
      const result = await server.sendTransaction(signedTx as StellarSdk.Transaction);

      if (result.status === 'PENDING') {
        // Poll for transaction completion
        console.log('Transaction pending, polling for completion...');
        const finalResult = await this.pollTransactionStatus(server, result.hash);
        
        if (finalResult.status === 'SUCCESS') {
          // Extract the margin account address from the result
          let marginAccountAddress = this.extractMarginAccountAddress(finalResult);
          
          // If we couldn't extract the address, try to get it via contract call
          if (!marginAccountAddress) {
            console.log('Could not extract address from transaction, trying registry lookup...');
            marginAccountAddress = await this.getMarginAccountFromRegistry(userAddress);
          }
          
          if (marginAccountAddress) {
            // Store the margin account
            const marginAccount: MarginAccount = {
              address: marginAccountAddress,
              owner: userAddress,
              isActive: true,
              createdAt: Date.now()
            };
            
            this.storeMarginAccount(userAddress, marginAccount);
            
            return {
              success: true,
              marginAccountAddress,
              hash: result.hash
            };
          } else {
            return {
              success: false,
              error: 'Failed to extract margin account address from transaction result'
            };
          }
        } else {
          return {
            success: false,
            error: `Transaction failed with status: ${finalResult.status}`
          };
        }
      } else {
        return {
          success: false,
          error: `Transaction failed immediately with status: ${result.status}`
        };
      }
    } catch (error: any) {
      console.error('Create margin account error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to create margin account'
      };
    }
  }

  /**
   * Get margin account from blockchain by querying smart contracts
   * Uses Registry contract and event system to find existing accounts
   */
  private static async getMarginAccountFromRegistry(userAddress: string): Promise<string | null> {
    try {
      console.log('🔍 Discovering existing margin accounts from blockchain for:', userAddress);
      
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      
      // Step 1: Query Smart_account_creation events to find accounts created for this user
      console.log('📋 Step 1: Searching for Smart_account_creation events...');
      const eventAccounts = await this.getAccountsFromEvents(userAddress, server);
      console.log('📋 Accounts found from events:', eventAccounts);
      
      // Step 2: For each account found, check if it's still active
      console.log('🔍 Step 2: Checking account activity status...');
      for (const accountAddress of eventAccounts) {
        try {
          const isActive = await this.isAccountActive(accountAddress, server);
          console.log(`📊 Account ${accountAddress} is active: ${isActive}`);
          
          if (isActive) {
            // Found an active account! Store it locally for future use
            const marginAccount: MarginAccount = {
              address: accountAddress,
              owner: userAddress,
              isActive: true,
              createdAt: Date.now()
            };
            
            this.storeMarginAccount(userAddress, marginAccount);
            console.log('✅ Successfully recovered existing margin account:', accountAddress);
            return accountAddress;
          } else {
            console.log('⚠️ Account found but inactive:', accountAddress);
          }
        } catch (accountError) {
          console.warn('⚠️ Error checking account activity for:', accountAddress, accountError);
        }
      }
      
      console.log('❌ No existing active margin account found for user');
      return null;
    } catch (error) {
      console.error('❌ Error discovering existing margin account from blockchain:', error);
      return null;
    }
  }

  /**
   * Get user's inactive accounts from the AccountManager contract
   */
  private static async getUserInactiveAccounts(userAddress: string, server: StellarSdk.rpc.Server): Promise<string[]> {
    try {
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);
      
      const call = contract.call(
        'get_inactive_accounts',
        StellarSdk.nativeToScVal(userAddress, { type: 'address' })
      );
      
      const result = await server.simulateTransaction(
        new StellarSdk.TransactionBuilder(
          new StellarSdk.Account(CONTRACT_ADDRESSES.ACCOUNT_MANAGER, '0'), 
          { fee: '0', networkPassphrase: NETWORK_PASSPHRASE }
        ).addOperation(call).setTimeout(30).build()
      );
      
      // Check for successful simulation result
      if ('result' in result && result.result) {
        const accounts = StellarSdk.scValToNative(result.result.retval);
        return Array.isArray(accounts) ? accounts : [];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting inactive accounts from contract:', error);
      return [];
    }
  }

  /**
   * Get accounts from Smart_account_creation events with improved error handling
   */
  private static async getAccountsFromEvents(userAddress: string, server: StellarSdk.rpc.Server): Promise<string[]> {
    try {
      const recentLedger = await this.getRecentLedger(server);
      console.log('📅 Searching events from ledger:', recentLedger);
      
      const events = await server.getEvents({
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ADDRESSES.ACCOUNT_MANAGER]
          }
        ],
        startLedger: recentLedger,
        limit: 100
      });
      
      console.log('📊 Total events found:', events.events.length);
      const accounts: string[] = [];
      
      for (const event of events.events) {
        try {
          if (event.type === 'contract' && event.value) {
            const eventBody = event.value;
            
            // Convert ScVal to native format first to check if it's an array
            const nativeEventBody = StellarSdk.scValToNative(eventBody);
            if (nativeEventBody && Array.isArray(nativeEventBody) && nativeEventBody.length >= 2) {
              // First element is the event topics (event name + trader)
              const eventTopics = nativeEventBody[0];
              
              // Check if this is a Smart_account_creation event for our user
              if (eventTopics && Array.isArray(eventTopics) && eventTopics.length >= 2) {
                const eventName = eventTopics[0];
                const eventUser = eventTopics[1];
                
                if (eventName === 'Smart_account_creation' && eventUser === userAddress) {
                  // Second element is the event data
                  const eventData = nativeEventBody[1];
                  console.log('📋 Found Smart_account_creation event data:', eventData);
                  
                  if (eventData && typeof eventData === 'object' && eventData.smart_account) {
                    accounts.push(eventData.smart_account);
                    console.log('✅ Added account from event:', eventData.smart_account);
                  }
                }
              }
            }
          }
        } catch (eventError) {
          console.warn('⚠️ Failed to parse individual event, skipping:', eventError);
          continue;
        }
      }
      
      return [...new Set(accounts)]; // Remove duplicates
    } catch (error) {
      console.error('❌ Error getting accounts from events:', error);
      return [];
    }
  }

  /**
   * Check if a smart account is active with improved error handling
   */
  private static async isAccountActive(accountAddress: string, server: StellarSdk.rpc.Server): Promise<boolean> {
    try {
      console.log('🔍 Checking if account is active:', accountAddress);
      
      // Create contract client for the smart account
      const contract = new StellarSdk.Contract(accountAddress);
      const call = contract.call('is_account_active');
      
      // Create a transaction to simulate the call
      const transaction = new StellarSdk.TransactionBuilder(
        new StellarSdk.Account(CONTRACT_ADDRESSES.ACCOUNT_MANAGER, '0'), 
        { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
      )
      .addOperation(call)
      .setTimeout(30)
      .build();
      
      const result = await server.simulateTransaction(transaction);
      
      // Check for simulation errors
      if ('error' in result && result.error) {
        console.warn('⚠️ Contract simulation failed for account:', accountAddress, result.error);
        return false;
      }
      
      // Check for successful simulation result
      if ('result' in result && result.result) {
        const isActive = StellarSdk.scValToNative(result.result.retval) === true;
        console.log('📊 Account active status:', isActive);
        return isActive;
      }
      
      console.warn('⚠️ No valid result from account activity check');
      return false;
    } catch (error) {
      console.error('❌ Error checking account active status:', error);
      return false;
    }
  }

  /**
   * Get recent ledger for event querying with better range
   */
  private static async getRecentLedger(server: StellarSdk.rpc.Server): Promise<number> {
    try {
      const latestLedger = await server.getLatestLedger();
      // Look back further to catch more accounts (about 1 day of ledgers)
      const lookBackLedgers = 17280; // Approximately 24 hours of ledgers (5 second blocks)
      const startLedger = Math.max(1, latestLedger.sequence - lookBackLedgers);
      console.log('📅 Searching from ledger', startLedger, 'to', latestLedger.sequence);
      return startLedger;
    } catch (error) {
      console.error('❌ Error getting recent ledger, using default:', error);
      return 1;
    }
  }

  /**
   * Extract margin account address from transaction result
   */
  private static extractMarginAccountAddress(result: any): string | null {
    try {
      console.log('Extracting margin account address from result:', result);
      
      // The create_account function returns the margin account address
      // Try to extract from returnValue first (newer Stellar SDK structure)
      if (result.returnValue) {
        try {
          const returnValue = StellarSdk.scValToNative(result.returnValue);
          console.log('Extracted return value:', returnValue);
          if (returnValue && typeof returnValue === 'string') {
            return returnValue;
          }
        } catch (e) {
          console.warn('Failed to parse return value:', e);
        }
      }
      
      // Try result.result.retval (current SDK structure)
      if (result.result && !result.error && result.result.retval) {
        try {
          const returnValue = StellarSdk.scValToNative(result.result.retval);
          console.log('Extracted result.result.retval:', returnValue);
          if (returnValue && typeof returnValue === 'string') {
            return returnValue;
          }
        } catch (e) {
          console.warn('Failed to parse result.result.retval:', e);
        }
      }
      
      // Try result.result.result (alternative structure)
      if (result.result && result.result.result && result.result.result.ok) {
        try {
          const returnValue = StellarSdk.scValToNative(result.result.result.ok);
          console.log('Extracted result.result.result.ok:', returnValue);
          if (returnValue && typeof returnValue === 'string') {
            return returnValue;
          }
        } catch (e) {
          console.warn('Failed to parse result.result.result.ok:', e);
        }
      }
      
      // Alternative: try to extract from events
      if (result.events && result.events.length > 0) {
        console.log('Checking events for margin account address...');
        for (const event of result.events) {
          console.log('Event:', event);
          if (event.type === 'contract') {
            try {
              // Parse the event data - look for Smart_account_creation event
              const eventTopic = event.value[0]; // Event topic
              const eventData = event.value[1]; // Event data
              
              if (eventTopic && StellarSdk.scValToNative(eventTopic) === 'Smart_account_creation') {
                const data = StellarSdk.scValToNative(eventData);
                console.log('Smart account creation event data:', data);
                
                if (data && typeof data === 'object' && data.smart_account) {
                  return data.smart_account;
                }
              }
            } catch (e) {
              console.warn('Failed to parse event data:', e);
            }
          }
        }
      }
      
      // If we can't extract the address, we'll have to implement a different approach
      console.warn('Could not extract margin account address from transaction result');
      return null;
    } catch (error) {
      console.error('Error extracting margin account address:', error);
      return null;
    }
  }

  /**
   * Poll transaction status until completion
   */
  private static async pollTransactionStatus(
    server: StellarSdk.rpc.Server,
    hash: string
  ): Promise<any> {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      try {
        const result = await server.getTransaction(hash);
        
        if (result.status !== 'NOT_FOUND') {
          return result;
        }
      } catch (error: any) {
        console.error('Error polling transaction:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    throw new Error('Transaction timeout');
  }

  /**
   * Public method to discover existing margin account from blockchain
   * Used when localStorage is empty but user might have account on blockchain
   */
  static async discoverExistingAccount(userAddress: string): Promise<string | null> {
    return await this.getMarginAccountFromRegistry(userAddress);
  }

  /**
   * Get margin account info (for display)
   */
  static getMarginAccountInfo(userAddress: string): {
    hasAccount: boolean;
    accountAddress?: string;
    isActive?: boolean;
    createdAt?: number;
  } {
    const account = this.getStoredMarginAccount(userAddress);
    
    if (!account) {
      return { hasAccount: false };
    }
    
    return {
      hasAccount: true,
      accountAddress: account.address,
      isActive: account.isActive,
      createdAt: account.createdAt
    };
  }

  /**
   * Format margin account address for display
   */
  static formatAccountAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Clear stored margin account (for testing/reset)
   */
  static clearMarginAccount(userAddress: string): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY) || '{}';
      const accounts: Record<string, MarginAccount> = JSON.parse(stored);
      
      delete accounts[userAddress];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
    } catch (error) {
      console.error('Error clearing margin account:', error);
    }
  }

  /**
   * Check if a token is allowed as collateral
   */
  static async isCollateralAllowed(tokenSymbol: string): Promise<boolean> {
    try {
      const contractTokenSymbol = this.normalizeContractTokenSymbol(tokenSymbol);
      console.log('🔍 Checking if collateral is allowed for:', contractTokenSymbol);
      
      const userAddress = await getAddress();
      if (userAddress.error) {
        console.error('Failed to get user address for simulation');
        return false;
      }

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(userAddress.address);
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);
      
      const call = contract.call(
        'get_iscollateral_allowed',
        StellarSdk.nativeToScVal(contractTokenSymbol, { type: 'symbol' })
      );
      
      const transaction = new StellarSdk.TransactionBuilder(
        sourceAccount,
        { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
      )
      .addOperation(call)
      .setTimeout(30)
      .build();
      
      const result = await server.simulateTransaction(transaction);
      
      if ('result' in result && result.result) {
        const isAllowed = StellarSdk.scValToNative(result.result.retval) === true;
        console.log(`📊 ${contractTokenSymbol} collateral allowed:`, isAllowed);
        return isAllowed;
      }
      
      console.warn('⚠️ Could not determine collateral status');
      return false;
    } catch (error) {
      console.error('❌ Error checking collateral allowed status:', error);
      return false;
    }
  }

  /**
   * Get max asset cap from contract
   */
  static async getMaxAssetCap(): Promise<number> {
    try {
      console.log('🔍 Getting max asset cap...');
      
      const userAddress = await getAddress();
      if (userAddress.error) {
        console.error('Failed to get user address for simulation');
        return 0;
      }

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(userAddress.address);
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);
      
      const call = contract.call('get_max_asset_cap');
      
      const transaction = new StellarSdk.TransactionBuilder(
        sourceAccount,
        { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
      )
      .addOperation(call)
      .setTimeout(30)
      .build();
      
      const result = await server.simulateTransaction(transaction);
      
      if ('result' in result && result.result) {
        const maxCap = StellarSdk.scValToNative(result.result.retval);
        console.log('📊 Max asset cap:', maxCap);
        return Number(maxCap) || 0;
      }
      
      console.warn('⚠️ Could not get max asset cap');
      return 0;
    } catch (error) {
      console.error('❌ Error getting max asset cap:', error);
      return 0;
    }
  }

  /**
   * Check if a token is properly configured in the Registry
   */
  static async isTokenConfigured(tokenSymbol: string): Promise<{ configured: boolean; error?: string }> {
    const contractTokenSymbol = this.normalizeContractTokenSymbol(tokenSymbol);
    try {
      console.log(`🔍 Checking if ${contractTokenSymbol} is configured in Registry...`);

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const userAddress = await getAddress();
      if (userAddress.error) {
        return { configured: false, error: 'Failed to get user address' };
      }

      const sourceAccount = await server.getAccount(userAddress.address);
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.REGISTRY);

      // Build function name based on token
      let functionName: string;
      if (contractTokenSymbol === 'XLM') {
        functionName = 'get_xlm_contract_adddress'; // Note: typo in contract
      } else if (contractTokenSymbol === 'USDC') {
        functionName = 'get_usdc_contract_address';
      } else if (contractTokenSymbol === 'EURC') {
        functionName = 'get_eurc_contract_address';
      } else {
        return { configured: false, error: `Unknown token: ${contractTokenSymbol}` };
      }

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(functionName))
        .setTimeout(30)
        .build();

      const simulationResult = await server.simulateTransaction(transaction);

      if ('error' in simulationResult && simulationResult.error) {
        console.warn(`⚠️ ${contractTokenSymbol} not configured in Registry:`, simulationResult.error);
        return { 
          configured: false, 
          error: `${contractTokenSymbol} token contract address not set in Registry. Please configure it first.` 
        };
      }

      if ('result' in simulationResult && simulationResult.result) {
        console.log(`✅ ${contractTokenSymbol} is configured in Registry`);
        return { configured: true };
      }

      return { configured: false, error: 'Unable to verify token configuration' };
    } catch (error: any) {
      console.error(`❌ Error checking token configuration:`, error);
      if (error.message?.includes('UnreachableCodeReached') || 
          error.message?.includes('Failed to fetch')) {
        return { 
          configured: false, 
          error: `${contractTokenSymbol} token not configured in Registry. Admin must set the token contract address.` 
        };
      }
      return { configured: false, error: error.message };
    }
  }

  /**
   * Deposit collateral tokens to margin account
   */
  static async depositCollateralTokens(
    marginAccountAddress: string,
    tokenSymbol: string,
    amountWad: string
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const contractTokenSymbol = this.normalizeContractTokenSymbol(tokenSymbol);
      console.log('🏦 Depositing collateral tokens:', { marginAccountAddress, tokenSymbol: contractTokenSymbol, amountWad });
      
      // Pre-flight checks
      console.log('🔍 Running pre-flight checks...');
      
      // Check 0: Token configuration in Registry
      const configCheck = await this.isTokenConfigured(contractTokenSymbol);
      if (!configCheck.configured) {
        return {
          success: false,
          error: `⚠️ Configuration Issue: ${configCheck.error}\n\n` +
                 `The ${contractTokenSymbol} token contract address needs to be set in the Registry contract.\n` +
                 `Please contact the admin or use XLM which is already configured.`
        };
      }
      
      // Check 1: Is collateral allowed for this token?
      const isCollateralAllowed = await this.isCollateralAllowed(contractTokenSymbol);
      if (!isCollateralAllowed) {
        return {
          success: false,
          error: `${contractTokenSymbol} is not allowed as collateral. Please ask the contract admin to enable this token first.`
        };
      }
      
      // Check 2: Get max asset cap
      const maxAssetCap = await this.getMaxAssetCap();
      console.log('📊 Max asset cap:', maxAssetCap);
      if (maxAssetCap === 0) {
        return {
          success: false,
          error: 'Max asset cap is not set or is zero. Contract needs to be configured properly.'
        };
      }
      
      console.log('✅ Pre-flight checks passed');
      
      const userAddress = await getAddress();
      if (userAddress.error) {
        return {
          success: false,
          error: 'Failed to get user address'
        };
      }

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(userAddress.address);

      // Create contract instance for AccountManager
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);
      
      // Build the transaction to call deposit_collateral_tokens with higher fee
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: (parseInt(StellarSdk.BASE_FEE) * 20).toString(), // 20x base fee for deposit operations
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'deposit_collateral_tokens',
            StellarSdk.nativeToScVal(marginAccountAddress, { type: 'address' }),
            StellarSdk.nativeToScVal(contractTokenSymbol, { type: 'symbol' }),
            StellarSdk.nativeToScVal(amountWad, { type: 'u256' })
          )
        )
        .setTimeout(30)
        .build();

      console.log('🔍 Preparing deposit transaction...');
      const preparedTx = await server.prepareTransaction(transaction);
      
      // Sign the transaction
      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      console.log('📤 Sending deposit transaction...');
      const result = await server.sendTransaction(signedTx as StellarSdk.Transaction);
      
      if (result.status === 'PENDING') {
        console.log('Deposit transaction pending, polling for completion...');
        const finalResult = await this.pollTransactionStatus(server, result.hash);
        
        if (finalResult.status === 'SUCCESS') {
          console.log('✅ Deposit transaction successful');
          return {
            success: true,
            hash: result.hash
          };
        } else {
          return {
            success: false,
            error: `Deposit transaction failed with status: ${finalResult.status}`
          };
        }
      } else {
        return {
          success: false,
          error: `Deposit transaction failed immediately with status: ${result.status}`
        };
      }
    } catch (error: any) {
      console.error('❌ Error depositing collateral tokens:', error);
      return {
        success: false,
        error: error?.message || 'Failed to deposit collateral tokens'
      };
    }
  }

  /**
   * Borrow tokens from lending pool to margin account - SIMPLIFIED VERSION
   */
  static async borrowTokens(
    marginAccountAddress: string,
    tokenSymbol: string,
    borrowAmountWad: string
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const contractTokenSymbol = this.normalizeContractTokenSymbol(tokenSymbol);
      console.log('💰 Borrowing tokens:', { marginAccountAddress, tokenSymbol: contractTokenSymbol, borrowAmountWad });
      
      const userAddress = await getAddress();
      if (userAddress.error) {
        return {
          success: false,
          error: 'Failed to get user address'
        };
      }

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(userAddress.address);

      // Create contract instance for AccountManager
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);
      
      // Pre-check: Verify margin account exists and is active
      console.log('🔍 Verifying margin account state before borrowing...');
      
      try {
        const isActive = await this.testContractInteraction(marginAccountAddress);
        if (!isActive) {
          return {
            success: false,
            error: 'Margin account is not active or accessible. Please check account status.'
          };
        }
        console.log('✅ Margin account verification passed');
      } catch (verifyError: any) {
        console.warn('⚠️ Could not verify margin account state:', verifyError.message);
        // Continue anyway, but log the warning
      }
      
      // SIMPLIFIED: Use consistent parameters like deposit operation
      console.log('🔍 Building borrow transaction with standard fee...');
      
      // Use same fee structure as successful deposit operation
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: (parseInt(StellarSdk.BASE_FEE) * 50).toString(), // 50x base fee (more than deposit's 20x)
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'borrow',
            StellarSdk.nativeToScVal(marginAccountAddress, { type: 'address' }),
            StellarSdk.nativeToScVal(borrowAmountWad, { type: 'u256' }),
            StellarSdk.nativeToScVal(contractTokenSymbol, { type: 'symbol' })
          )
        )
        .setTimeout(60) // Reasonable timeout like successful operations
        .build();

      const simulationResult = await server.simulateTransaction(transaction);
      if ('error' in simulationResult && simulationResult.error) {
        return {
          success: false,
          error: this.parseBorrowNotAllowedMessage(simulationResult, contractTokenSymbol),
        };
      }

      console.log('🔍 Preparing borrow transaction...');
      const preparedTx = await server.prepareTransaction(transaction);
      
      // Sign the transaction
      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      console.log('📤 Sending borrow transaction...');
      const result = await server.sendTransaction(signedTx as StellarSdk.Transaction);
      
      console.log('📊 Borrow transaction result:', {
        status: result.status,
        hash: result.hash,
        errorResultXdr: result.errorResult?.toXDR()
      });
      
      if (result.status === 'PENDING') {
        console.log('Borrow transaction pending, polling for completion...');
        const finalResult = await this.pollTransactionStatus(server, result.hash);
        
        if (finalResult.status === 'SUCCESS') {
          console.log('✅ Borrow transaction successful');
          return {
            success: true,
            hash: result.hash
          };
        } else {
          console.error('❌ Borrow transaction failed after polling:', finalResult);
          return {
            success: false,
            error: `Borrow transaction failed with final status: ${finalResult.status}. Details: ${JSON.stringify(finalResult)}`
          };
        }
      } else if (result.status === 'ERROR') {
        console.error('❌ Borrow transaction failed immediately with ERROR status');
        console.error('Error details:', {
          errorResultXdr: result.errorResult?.toXDR(),
          diagnosticEvents: result.diagnosticEvents
        });
        
        // Try to extract more meaningful error information
        let errorMessage = this.parseBorrowNotAllowedMessage(result, contractTokenSymbol);
        
        if (result.errorResult) {
          try {
            const errorResult = result.errorResult;
            console.error('Detailed error result:', errorResult);
            errorMessage = `Transaction failed: ${errorResult.toXDR()}`;
          } catch (e) {
            console.error('Could not parse error result:', e);
          }
        }
        
        return {
          success: false,
          error: errorMessage
        };
      } else {
        console.error('❌ Borrow transaction failed with unexpected status:', result.status);
        return {
          success: false,
          error: `Borrow transaction failed with status: ${result.status}`
        };
      }
    } catch (error: any) {
      console.error('❌ Error borrowing tokens:', error);
      return {
        success: false,
        error: error?.message || 'Failed to borrow tokens'
      };
    }
  }

  /**
   * Check if current user is admin
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const userAddress = await getAddress();
      if (userAddress.error) {
        return false;
      }
      
      // The admin address from deployment script (rohit_testnet identity)
      const ADMIN_ADDRESS = 'GCD35D3HP7437SCURVDNFELQLADVX363SZG7VCQS3Z2IHMZOUIX5HOPL';
      return userAddress.address === ADMIN_ADDRESS;
    } catch {
      return false;
    }
  }

  /**
   * Helper function to setup contract configuration (for admin use)
   */
  static async setupContractConfiguration(): Promise<{ success: boolean; error?: string; transactionHashes?: string[] }> {
    try {
      // First check if user is admin
      const isAdmin = await this.isCurrentUserAdmin();
      if (!isAdmin) {
        // Get the current user first
        const userAddress = await getAddress();
        if (userAddress.error) {
          return {
            success: false,
            error: 'Failed to get user address'
          };
        }
        
        const currentUser = userAddress.address;
        const adminAddress = 'GCD35D3HP7437SCURVDNFELQLADVX363SZG7VCQS3Z2IHMZOUIX5HOPL';
        console.log('🚫 Admin check failed:', { currentUser, adminAddress, isAdmin });
        return {
          success: false,
          error: `Only the contract admin can setup contract configuration. Current user: ${currentUser}, Admin: ${adminAddress}`
        };
      }
      
      console.log('🔧 Setting up contract configuration...');
      
      const userAddress = await getAddress();
      if (userAddress.error) {
        return {
          success: false,
          error: 'Failed to get user address'
        };
      }

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);
      const transactionHashes: string[] = [];
      
      // Define setup operations
      const setupOperations = [
        {
          name: 'Set max asset cap',
          call: contract.call(
            'set_max_asset_cap',
            StellarSdk.nativeToScVal('10', { type: 'u256' })
          )
        },
        {
          name: 'Allow XLM as collateral',
          call: contract.call(
            'set_iscollateral_allowed',
            StellarSdk.nativeToScVal('XLM', { type: 'symbol' })
          )
        },
        {
          name: 'Allow USDC as collateral',
          call: contract.call(
            'set_iscollateral_allowed',
            StellarSdk.nativeToScVal('USDC', { type: 'symbol' })
          )
        },
        {
          name: 'Allow EURC as collateral',
          call: contract.call(
            'set_iscollateral_allowed',
            StellarSdk.nativeToScVal('EURC', { type: 'symbol' })
          )
        }
      ];

      // Execute each operation in a separate transaction
      for (const operation of setupOperations) {
        try {
          console.log(`🔧 ${operation.name}...`);
          
          // Get fresh account for each transaction
          const sourceAccount = await server.getAccount(userAddress.address);
          
          const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(operation.call)
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
            const finalResult = await this.pollTransactionStatus(server, result.hash);
            
            if (finalResult.status === 'SUCCESS') {
              console.log(`✅ ${operation.name} successful`);
              transactionHashes.push(result.hash);
            } else {
              console.error(`❌ ${operation.name} failed with status: ${finalResult.status}`);
              return {
                success: false,
                error: `${operation.name} failed with status: ${finalResult.status}`
              };
            }
          } else {
            console.error(`❌ ${operation.name} failed immediately with status: ${result.status}`);
            return {
              success: false,
              error: `${operation.name} failed immediately with status: ${result.status}`
            };
          }
          
          // Wait between transactions to avoid sequence number issues
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (operationError: any) {
          console.error(`❌ Error in ${operation.name}:`, operationError);
          return {
            success: false,
            error: `${operation.name} failed: ${operationError?.message || 'Unknown error'}`
          };
        }
      }

      console.log('✅ All contract configuration setup operations successful');
      return {
        success: true
      };
      
    } catch (error: any) {
      console.error('❌ Error setting up contract configuration:', error);
      return {
        success: false,
        error: error?.message || 'Failed to setup contract configuration'
      };
    }
  }

  /**
   * Test if basic contract interaction works with minimal operations
   */
  static async testContractInteraction(marginAccountAddress: string): Promise<boolean> {
    try {
      console.log('🔧 Testing basic contract interaction...');
      
      const userAddress = await getAddress();
      if (userAddress.error) return false;

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(userAddress.address);
      
      // Simple test: check if margin account is active
      const contract = new StellarSdk.Contract(marginAccountAddress);
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('is_account_active'))
        .setTimeout(30)
        .build();

      const result = await server.simulateTransaction(transaction);
      console.log('🔧 Contract test result:', !('error' in result));
      return !('error' in result);
    } catch (error) {
      console.warn('🔧 Contract test failed:', error);
      return false;
    }
  }

  /**
   * Get current borrowed token balances for a margin account
   * @param marginAccountAddress - The margin account address
   * @returns Object with borrowed token balances
   */
  static async getCurrentBorrowedBalances(
    marginAccountAddress: string
  ): Promise<{ success: boolean; data?: Record<string, { amount: string; usdValue: string }>; error?: string }> {
    try {
      // Validate address before making any blockchain calls
      if (!marginAccountAddress || typeof marginAccountAddress !== 'string' || marginAccountAddress.length < 10) {
        return {
          success: false,
          error: 'Invalid margin account address'
        };
      }
      console.log('📊 Getting borrowed balances for margin account:', marginAccountAddress);
      
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const userAddress = await getAddress();
      if (userAddress.error) {
        return {
          success: false,
          error: 'Failed to get user address'
        };
      }
      
      const sourceAccount = await server.getAccount(userAddress.address);
      const contract = new StellarSdk.Contract(marginAccountAddress);
      
      // Get all borrowed tokens
      const getAllBorrowedTokensTx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'get_all_borrowed_tokens'
          )
        )
        .setTimeout(30)
        .build();
      
      const preparedTx = await server.prepareTransaction(getAllBorrowedTokensTx);
      const simulationResult = await server.simulateTransaction(preparedTx);
      
      if ('error' in simulationResult) {
        console.error('❌ Failed to get borrowed tokens:', simulationResult.error);
        return {
          success: false,
          error: 'Failed to get borrowed tokens from margin account'
        };
      }
      
      if (!('result' in simulationResult) || !simulationResult.result) {
        return { success: true, data: {} };
      }

      const borrowedTokens = StellarSdk.scValToNative(simulationResult.result.retval) as string[];
      console.log('📊 Found borrowed tokens:', borrowedTokens);
      
      const borrowedBalances: Record<string, { amount: string; usdValue: string }> = {};
      
      // Get balance for each borrowed token
      for (const token of borrowedTokens) {
        try {
          const getBalanceTx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              contract.call(
                'get_borrowed_token_debt',
                StellarSdk.nativeToScVal(token, { type: 'symbol' })
              )
            )
            .setTimeout(30)
            .build();
          
          const preparedBalanceTx = await server.prepareTransaction(getBalanceTx);
          const balanceResult = await server.simulateTransaction(preparedBalanceTx);
          
          if (!('error' in balanceResult) && 'result' in balanceResult && balanceResult.result) {
            const balanceWad = StellarSdk.scValToNative(balanceResult.result.retval) as string;
            const balanceNumber = parseFloat(balanceWad) / Math.pow(10, 18); // Convert from WAD
            
            // For now, assume 1:1 USD conversion (you can enhance this with actual price feeds)
            const usdValue = balanceNumber.toFixed(2);
            
            borrowedBalances[token] = {
              amount: balanceNumber.toFixed(6),
              usdValue
            };
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get balance for token ${token}:`, error);
        }
      }
      
      console.log('📊 Current borrowed balances:', borrowedBalances);
      return {
        success: true,
        data: borrowedBalances
      };
      
    } catch (error: any) {
      console.error('❌ Error getting borrowed balances:', error);
      return {
        success: false,
        error: error?.message || 'Failed to get borrowed balances'
      };
    }
  }

  /**
   * Get collateral balances for a margin account
   * @param marginAccountAddress - The margin account address
   * @returns Object with collateral token balances
   */
  static async getCollateralBalances(
    marginAccountAddress: string
  ): Promise<{ success: boolean; data?: Record<string, { amount: string; usdValue: string }>; error?: string }> {
    try {
      // Validate address before making any blockchain calls
      if (!marginAccountAddress || typeof marginAccountAddress !== 'string' || marginAccountAddress.length < 10) {
        return {
          success: false,
          error: 'Invalid margin account address'
        };
      }
      console.log('📊 Getting collateral balances for margin account:', marginAccountAddress);

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const contract = new StellarSdk.Contract(marginAccountAddress);

      const balances: Record<string, { amount: string; usdValue: string }> = {};

      // Query collateral balances for each token
      for (const tokenSymbol of ['XLM', 'USDC', 'EURC']) {
        try {
          const userAddress = await getAddress();
          if (userAddress.error) continue;

          const sourceAccount = await server.getAccount(userAddress.address);

          const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(
              contract.call(
                'get_collateral_token_balance',
                StellarSdk.nativeToScVal(tokenSymbol, { type: 'symbol' })
              )
            )
            .setTimeout(30)
            .build();

          const simulationResult = await server.simulateTransaction(transaction);

          if ('result' in simulationResult && simulationResult.result) {
            const balance = StellarSdk.scValToNative(simulationResult.result.retval);
            const balanceInToken = parseFloat(balance.toString()) / Math.pow(10, 18);
            
            balances[tokenSymbol] = {
              amount: balanceInToken.toFixed(7),
              usdValue: (balanceInToken * 1).toFixed(2) // Placeholder for price conversion
            };
          }
        } catch (error) {
          console.warn(`Could not get ${tokenSymbol} collateral balance:`, error);
          balances[tokenSymbol] = { amount: '0', usdValue: '0' };
        }
      }

      return { success: true, data: balances };
    } catch (error: any) {
      console.error('❌ Error getting collateral balances:', error);
      return {
        success: false,
        error: error?.message || 'Failed to get collateral balances'
      };
    }
  }

  /**
   * Repay borrowed tokens to margin account
   * @param marginAccountAddress - The margin account address
   * @param tokenSymbol - Token symbol to repay (XLM, USDC, EURC)
   * @param repayAmountWad - Amount to repay in WAD format
   * @returns Result with success status and transaction hash
   */
  static async repayLoan(
    marginAccountAddress: string,
    tokenSymbol: string,
    repayAmountWad: string
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const contractTokenSymbol = this.normalizeContractTokenSymbol(tokenSymbol);
      console.log('💳 Repaying loan:', { marginAccountAddress, tokenSymbol: contractTokenSymbol, repayAmountWad });

      const userAddress = await getAddress();
      if (userAddress.error) {
        return {
          success: false,
          error: 'Failed to get user address'
        };
      }

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(userAddress.address);

      // Create contract instance for AccountManager
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);

      // Build the transaction to call repay
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: (parseInt(StellarSdk.BASE_FEE) * 50).toString(),
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'repay',
            StellarSdk.nativeToScVal(repayAmountWad, { type: 'u256' }),
            StellarSdk.nativeToScVal(contractTokenSymbol, { type: 'symbol' }),
            StellarSdk.nativeToScVal(marginAccountAddress, { type: 'address' })
          )
        )
        .setTimeout(30)
        .build();

      console.log('🔧 Preparing repay transaction...');
      const preparedTx = await server.prepareTransaction(transaction);

      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      console.log('📤 Sending repay transaction...');
      const result = await server.sendTransaction(signedTx as StellarSdk.Transaction);

      if (result.status === 'PENDING') {
        console.log('⏳ Repay transaction pending...');
        const finalResult = await this.pollTransactionStatus(server, result.hash);

        if (finalResult.status === 'SUCCESS') {
          console.log('✅ Repay transaction successful');
          return {
            success: true,
            hash: result.hash
          };
        } else {
          return {
            success: false,
            error: `Repay transaction failed: ${finalResult.status}`
          };
        }
      } else if (result.status === 'ERROR') {
        return {
          success: false,
          error: 'Repay transaction failed with ERROR status'
        };
      } else {
        return {
          success: false,
          error: `Unexpected status: ${result.status}`
        };
      }
    } catch (error: any) {
      console.error('❌ Error repaying loan:', error);
      return {
        success: false,
        error: error?.message || 'Failed to repay loan'
      };
    }
  }

  /**
   * Combined deposit and borrow operation (leverage)
   */
  static async depositAndBorrow(
    marginAccountAddress: string,
    depositAmount: number,
    multiplier: number,
    tokenSymbol: string = 'XLM'
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    try {
      const contractTokenSymbol = this.normalizeContractTokenSymbol(tokenSymbol);
      console.log('🚀 Executing deposit and borrow:', { marginAccountAddress, depositAmount, multiplier, tokenSymbol: contractTokenSymbol });
      console.log(`📝 Leverage Explanation: Depositing ${depositAmount} ${contractTokenSymbol}, with ${multiplier}x leverage = borrowing ${depositAmount * (multiplier - 1)} ${contractTokenSymbol} for total ${depositAmount * multiplier} ${contractTokenSymbol} position`);
      
      // Convert amounts to WAD format (18 decimals) - using string multiplication for better precision
      const depositAmountWad = (BigInt(Math.floor(depositAmount * 1000000)) * BigInt(1000000000000)).toString();
      const borrowAmountWad = (BigInt(Math.floor(depositAmount * (multiplier - 1) * 1000000)) * BigInt(1000000000000)).toString();
      
      console.log('💰 Amounts:', { depositAmountWad, borrowAmountWad });
      console.log('💰 In human terms:', { 
        depositAmount: `${parseFloat(depositAmountWad) / Math.pow(10, 18)} ${contractTokenSymbol}`, 
        borrowAmount: `${parseFloat(borrowAmountWad) / Math.pow(10, 18)} ${contractTokenSymbol}`,
        totalPosition: `${(parseFloat(depositAmountWad) + parseFloat(borrowAmountWad)) / Math.pow(10, 18)} ${contractTokenSymbol}`
      });

      // Step 1: Deposit collateral
      console.log('🏦 Step 1: Depositing collateral...');
      const depositResult = await this.depositCollateralTokens(
        marginAccountAddress,
        contractTokenSymbol,
        depositAmountWad
      );
      
      if (!depositResult.success) {
        return {
          success: false,
          error: `Deposit failed: ${depositResult.error}`
        };
      }

      // Step 2: Wait a bit for deposit to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: Borrow additional funds if multiplier > 1
      if (multiplier > 1) {
        console.log('💰 Step 2: Borrowing additional funds...');
        const borrowResult = await this.borrowTokens(
          marginAccountAddress,
          contractTokenSymbol,
          borrowAmountWad
        );
        
        if (!borrowResult.success) {
          return {
            success: false,
            error: `Borrow failed: ${borrowResult.error}. Deposit was successful with hash: ${depositResult.hash}`
          };
        }
        
        return {
          success: true,
          hash: `Deposit: ${depositResult.hash}, Borrow: ${borrowResult.hash}`
        };
      }
      
      return depositResult;
    } catch (error: any) {
      console.error('❌ Error in deposit and borrow:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error in deposit and borrow operation'
      };
    }
  }
}