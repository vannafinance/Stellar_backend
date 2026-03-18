import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import {
  CONTRACT_ADDRESSES,
  NETWORK_PASSPHRASE,
  SOROBAN_RPC_URL,
} from './stellar-utils';

export type AquariusAction = 'AddLiquidity' | 'RemoveLiquidity' | 'Swap';

export interface AquariusPoolStats {
  reserveA: string;   // XLM reserve, human-readable (7 decimals)
  reserveB: string;   // USDC reserve, human-readable (7 decimals)
  totalShares: string; // total LP shares, human-readable
  feeFraction: string; // e.g., "0.30%"
  feeRaw: number;      // raw fee fraction (30 = 0.30%)
}

export interface AquariusLpEvent {
  type: 'deposit' | 'withdraw';
  shareAmount: string;  // LP shares minted/burned
  amountA: string;      // token A amount
  amountB: string;      // token B amount
  timestamp: number;    // unix ms
  txHash: string;
  ledger: number;
}

export interface AquariusPoolConfig {
  id: string;
  tokens: [string, string];
  feeFraction: number; // 30 = 0.30%
  displayName: string;
}

export const AQUARIUS_POOLS: AquariusPoolConfig[] = [
  {
    id: 'aquarius-xlm-usdc',
    tokens: ['XLM', 'USDC'],
    feeFraction: 30,
    displayName: 'XLM / USDC',
  },
];

export interface AquariusTransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

const WAD = 1e18;

const toWad = (amount: number): bigint => {
  if (!Number.isFinite(amount) || amount <= 0) return BigInt(0);
  return BigInt(Math.floor(amount * WAD));
};

const makeKey = (name: string) => StellarSdk.xdr.ScVal.scvSymbol(name);

export class AquariusService {
  static async getAquariusRouterAddressFromRegistry(): Promise<string | null> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.REGISTRY);

      const hasTx = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('has_aquarius_router_address'))
        .setTimeout(30)
        .build();

      const hasSim = await server.simulateTransaction(hasTx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(hasSim) || !hasSim.result?.retval) {
        console.warn('[AquariusService] has_aquarius_router_address simulation failed');
        return null;
      }

      const hasRouter = StellarSdk.scValToNative(hasSim.result.retval);
      if (!hasRouter) {
        console.warn('[AquariusService] Aquarius router is not configured in Registry');
        return null;
      }

      const getTx = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('get_aquarius_router_address'))
        .setTimeout(30)
        .build();

      const getSim = await server.simulateTransaction(getTx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(getSim) || !getSim.result?.retval) {
        console.warn('[AquariusService] get_aquarius_router_address simulation failed');
        return null;
      }

      const address = StellarSdk.scValToNative(getSim.result.retval);
      return address as string;
    } catch (error: any) {
      console.error('[AquariusService] getAquariusRouterAddressFromRegistry error:', error);
      return null;
    }
  }

  static async hasAquariusPoolIndex(): Promise<boolean> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.REGISTRY);

      const tx = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('get_aquarius_pool_index'))
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);
      return StellarSdk.rpc.Api.isSimulationSuccess(sim) && !!sim.result?.retval;
    } catch (error) {
      return false;
    }
  }

  static async getTrackingTokenAddressFromRegistry(): Promise<string | null> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.REGISTRY);

      const hasTx = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('has_tracking_token_contract_addr'))
        .setTimeout(30)
        .build();

      const hasSim = await server.simulateTransaction(hasTx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(hasSim) || !hasSim.result?.retval) {
        return null;
      }

      const hasTracking = StellarSdk.scValToNative(hasSim.result.retval);
      if (!hasTracking) return null;

      const getTx = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('get_tracking_token_contract_addr'))
        .setTimeout(30)
        .build();

      const getSim = await server.simulateTransaction(getTx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(getSim) || !getSim.result?.retval) {
        return null;
      }

      const address = StellarSdk.scValToNative(getSim.result.retval);
      return address as string;
    } catch (error) {
      console.error('[AquariusService] getTrackingTokenAddressFromRegistry error:', error);
      return null;
    }
  }

  static async isAquariusConfigured(): Promise<boolean> {
    const [router, hasIndex] = await Promise.all([
      AquariusService.getAquariusRouterAddressFromRegistry(),
      AquariusService.hasAquariusPoolIndex(),
    ]);
    return !!router && hasIndex;
  }

  // Always returns true — we always have hardcoded fallback addresses.
  static isAquariusUsable(): boolean {
    return true;
  }

  // Returns router address from Registry, or falls back to hardcoded constant.
  static async getEffectiveRouterAddress(): Promise<string> {
    const fromRegistry = await AquariusService.getAquariusRouterAddressFromRegistry();
    return fromRegistry ?? CONTRACT_ADDRESSES.AQUARIUS_ROUTER;
  }

  static getLpTrackingSymbol(tokenA: string, tokenB: string): string | null {
    const a = tokenA.toUpperCase();
    const b = tokenB.toUpperCase();
    if ((a === 'XLM' && b === 'USDC') || (a === 'USDC' && b === 'XLM')) {
      return 'AQ_XLM_USDC';
    }
    return null;
  }

  static async getLpBalance(
    marginAccountAddress: string,
    tokenA: string,
    tokenB: string
  ): Promise<string> {
    try {
      const trackingSymbol = AquariusService.getLpTrackingSymbol(tokenA, tokenB);
      if (!trackingSymbol) return '0';

      const trackingAddress = await AquariusService.getTrackingTokenAddressFromRegistry();
      if (!trackingAddress) return '0';

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      const contract = new StellarSdk.Contract(trackingAddress);

      const tx = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'balance',
            StellarSdk.nativeToScVal(marginAccountAddress, { type: 'address' }),
            StellarSdk.nativeToScVal(trackingSymbol, { type: 'symbol' })
          )
        )
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
        return '0';
      }

      const balance = StellarSdk.scValToNative(sim.result.retval);
      const lp = Number(balance?.toString?.() ?? balance ?? 0) / WAD;
      return Number.isFinite(lp) ? lp.toFixed(7) : '0';
    } catch (error) {
      return '0';
    }
  }

  // Fetch pool reserves, fee, and total shares directly from the Aquarius pool contract.
  static async getAquariusPoolStats(poolAddress: string): Promise<AquariusPoolStats | null> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      const contract = new StellarSdk.Contract(poolAddress);

      const makeSim = (method: string) =>
        server.simulateTransaction(
          new StellarSdk.TransactionBuilder(tempAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
          })
            .addOperation(contract.call(method))
            .setTimeout(30)
            .build()
        );

      const [resSim, feeSim, sharesSim] = await Promise.all([
        makeSim('get_reserves'),
        makeSim('get_fee_fraction'),
        makeSim('get_total_shares'),
      ]);

      let reserveA = '0';
      let reserveB = '0';
      if (StellarSdk.rpc.Api.isSimulationSuccess(resSim) && resSim.result?.retval) {
        const resNative = StellarSdk.scValToNative(resSim.result.retval) as any[];
        if (Array.isArray(resNative) && resNative.length >= 2) {
          reserveA = (Number(resNative[0].toString()) / 1e7).toFixed(7);
          reserveB = (Number(resNative[1].toString()) / 1e7).toFixed(7);
        }
      }

      let feeRaw = 30;
      if (StellarSdk.rpc.Api.isSimulationSuccess(feeSim) && feeSim.result?.retval) {
        feeRaw = Number(StellarSdk.scValToNative(feeSim.result.retval)) || 30;
      }

      let totalShares = '0';
      if (StellarSdk.rpc.Api.isSimulationSuccess(sharesSim) && sharesSim.result?.retval) {
        const sharesNative = StellarSdk.scValToNative(sharesSim.result.retval);
        totalShares = (Number(sharesNative?.toString?.() ?? sharesNative ?? 0) / 1e7).toFixed(7);
      }

      return {
        reserveA,
        reserveB,
        totalShares,
        feeFraction: `${(feeRaw / 100).toFixed(2)}%`,
        feeRaw,
      };
    } catch (error) {
      console.error('[AquariusService] getAquariusPoolStats error:', error);
      return null;
    }
  }

  // Get user's LP share balance directly from the pool contract.
  // Falls back to tracking token approach first (for Registry-configured setups).
  static async getUserLpBalance(
    marginAccountAddress: string,
    poolAddress: string,
    tokenA = 'XLM',
    tokenB = 'USDC'
  ): Promise<string> {
    try {
      // Try tracking token from Registry first
      const tracked = await AquariusService.getLpBalance(marginAccountAddress, tokenA, tokenB);
      if (tracked && tracked !== '0') return tracked;

      // Fallback: read directly from pool's get_user_shares()
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const tempKeypair = StellarSdk.Keypair.random();
      const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0');
      const contract = new StellarSdk.Contract(poolAddress);

      const tx = new StellarSdk.TransactionBuilder(tempAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'get_user_shares',
            StellarSdk.nativeToScVal(marginAccountAddress, { type: 'address' })
          )
        )
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return '0';

      const shares = StellarSdk.scValToNative(sim.result.retval);
      const sharesNum = Number(shares?.toString?.() ?? shares ?? 0) / 1e7;
      return Number.isFinite(sharesNum) && sharesNum > 0 ? sharesNum.toFixed(7) : '0';
    } catch {
      return '0';
    }
  }

  // Fetch deposit_liquidity / withdraw_liquidity events from the Aquarius pool contract.
  static async getAquariusEvents(
    poolAddress: string
  ): Promise<AquariusLpEvent[]> {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const latest = await server.getLatestLedger();
      const startLedger = Math.max(0, latest.sequence - 518400); // ~30 days

      const [depositResult, withdrawResult] = await Promise.all([
        server
          .getEvents({
            startLedger,
            filters: [{ contractIds: [poolAddress], topics: [['deposit_liquidity']] }],
          })
          .catch(() => ({ events: [] })),
        server
          .getEvents({
            startLedger,
            filters: [{ contractIds: [poolAddress], topics: [['withdraw_liquidity']] }],
          })
          .catch(() => ({ events: [] })),
      ]);

      const parseEv = (ev: any, type: 'deposit' | 'withdraw'): AquariusLpEvent | null => {
        try {
          // body: [share_amount, amountA, amountB]
          const body = ev.value ? (StellarSdk.scValToNative(ev.value) as any[]) : null;
          if (!Array.isArray(body) || body.length < 3) return null;
          const toHuman = (v: any) => (Number(v?.toString?.() ?? v ?? 0) / 1e7).toFixed(7);
          return {
            type,
            shareAmount: toHuman(body[0]),
            amountA: toHuman(body[1]),
            amountB: toHuman(body[2]),
            timestamp: ev.ledgerClosedAt ? new Date(ev.ledgerClosedAt).getTime() : 0,
            txHash: ev.txHash ?? '',
            ledger: ev.ledger ?? 0,
          };
        } catch {
          return null;
        }
      };

      const all: AquariusLpEvent[] = [
        ...(depositResult.events || []).map((ev: any) => parseEv(ev, 'deposit')),
        ...(withdrawResult.events || []).map((ev: any) => parseEv(ev, 'withdraw')),
      ].filter((e): e is AquariusLpEvent => e !== null);

      return all.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[AquariusService] getAquariusEvents error:', error);
      return [];
    }
  }

  static buildExternalProtocolCallBytes(
    routerAddress: string,
    action: AquariusAction,
    tokensOut: string[],
    amountsOutWad: bigint[],
    marginAccountAddress: string,
    feeFraction: number,
    isTokenPair: boolean
  ): Buffer {
    const amountOut = StellarSdk.xdr.ScVal.scvVec(
      amountsOutWad.map((amt) => StellarSdk.nativeToScVal(amt, { type: 'u256' }))
    );

    const tokensOutVal = StellarSdk.xdr.ScVal.scvVec(
      tokensOut.map((t) => StellarSdk.xdr.ScVal.scvSymbol(t))
    );

    const amountIn = StellarSdk.xdr.ScVal.scvVec([]);
    const tokensIn = StellarSdk.xdr.ScVal.scvVec([]);

    const scvMap = StellarSdk.xdr.ScVal.scvMap([
      new StellarSdk.xdr.ScMapEntry({ key: makeKey('amount_in'), val: amountIn }),
      new StellarSdk.xdr.ScMapEntry({ key: makeKey('amount_out'), val: amountOut }),
      new StellarSdk.xdr.ScMapEntry({
        key: makeKey('fee_fraction'),
        val: StellarSdk.xdr.ScVal.scvU32(feeFraction),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: makeKey('is_token_pair'),
        val: StellarSdk.xdr.ScVal.scvBool(isTokenPair),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: makeKey('margin_account'),
        val: StellarSdk.nativeToScVal(marginAccountAddress, { type: 'address' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: makeKey('min_liquidity_out'),
        val: StellarSdk.nativeToScVal(BigInt(0), { type: 'u256' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: makeKey('protocol_address'),
        val: StellarSdk.nativeToScVal(routerAddress, { type: 'address' }),
      }),
      new StellarSdk.xdr.ScMapEntry({
        key: makeKey('token_pair_ratio'),
        val: StellarSdk.xdr.ScVal.scvU64(StellarSdk.xdr.Uint64.fromString('0')),
      }),
      new StellarSdk.xdr.ScMapEntry({ key: makeKey('tokens_in'), val: tokensIn }),
      new StellarSdk.xdr.ScMapEntry({ key: makeKey('tokens_out'), val: tokensOutVal }),
      new StellarSdk.xdr.ScMapEntry({
        key: makeKey('type_action'),
        val: StellarSdk.xdr.ScVal.scvVec([StellarSdk.xdr.ScVal.scvSymbol(action)]),
      }),
    ]);

    return Buffer.from(scvMap.toXDR());
  }

  static async addLiquidity(
    walletAddress: string,
    _marginAccountAddress: string,
    _tokenA: string,
    _tokenB: string,
    usdcAmount: number,
    xlmAmount: number
  ): Promise<AquariusTransactionResult> {
    try {
      // Call pool.deposit(walletAddress, [usdc_1e7, xlm_1e7], 1) directly on the Aquarius pool.
      // Pool token order: TokenA = CAZRY5 (Aquarius USDC), TokenB = CDLZFC (XLM).
      // Amounts are in Stellar 7-decimal units (1e7 stroop equivalent).
      const poolAddress = CONTRACT_ADDRESSES.AQUARIUS_XLM_USDC_POOL;
      const usdcAmountStroops = BigInt(Math.round(usdcAmount * 1e7));
      const xlmAmountStroops = BigInt(Math.round(xlmAmount * 1e7));

      const desiredAmounts = StellarSdk.xdr.ScVal.scvVec([
        StellarSdk.nativeToScVal(usdcAmountStroops, { type: 'i128' }),
        StellarSdk.nativeToScVal(xlmAmountStroops, { type: 'i128' }),
      ]);

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(walletAddress);
      const poolContract = new StellarSdk.Contract(poolAddress);

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: (parseInt(StellarSdk.BASE_FEE) * 20).toString(),
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          poolContract.call(
            'deposit',
            StellarSdk.nativeToScVal(walletAddress, { type: 'address' }),
            desiredAmounts,
            StellarSdk.nativeToScVal(BigInt(1), { type: 'i128' })
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
        return { success: true, hash: result.hash };
      }
      return { success: false, error: 'Transaction rejected by network' };
    } catch (error: any) {
      console.error('[AquariusService] addLiquidity error:', error);
      return { success: false, error: error?.message || 'Add liquidity failed' };
    }
  }

  static async removeLiquidity(
    walletAddress: string,
    marginAccountAddress: string,
    tokenA: string,
    tokenB: string,
    lpAmount: number
  ): Promise<AquariusTransactionResult> {
    try {
      // Use Registry address if available, otherwise fall back to hardcoded constant
      const routerAddress = await AquariusService.getEffectiveRouterAddress();

      const pool = AQUARIUS_POOLS.find(
        (p) =>
          (p.tokens[0] === tokenA && p.tokens[1] === tokenB) ||
          (p.tokens[0] === tokenB && p.tokens[1] === tokenA)
      );
      const feeFraction = pool?.feeFraction ?? 30;

      const callBytes = AquariusService.buildExternalProtocolCallBytes(
        routerAddress,
        'RemoveLiquidity',
        [tokenA, tokenB],
        [toWad(lpAmount)],
        marginAccountAddress,
        feeFraction,
        true
      );

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(walletAddress);
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESSES.ACCOUNT_MANAGER);

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: (parseInt(StellarSdk.BASE_FEE) * 20).toString(),
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'execute',
            StellarSdk.nativeToScVal(marginAccountAddress, { type: 'address' }),
            StellarSdk.xdr.ScVal.scvBytes(callBytes)
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
        return { success: true, hash: result.hash };
      }
      return { success: false, error: 'Transaction rejected by network' };
    } catch (error: any) {
      console.error('[AquariusService] removeLiquidity error:', error);
      return { success: false, error: error?.message || 'Remove liquidity failed' };
    }
  }
}
