import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { CONTRACT_ADDRESSES, NETWORK_PASSPHRASE, SOROBAN_RPC_URL, HORIZON_URL } from './stellar-utils';

// ─── Faucet endpoints / constants ──────────────────────────────────────────
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const BLEND_FAUCET_URL = 'https://ewqw4hx7oa.execute-api.us-east-1.amazonaws.com/getAssets';
const SOROSWAP_FAUCET_URL = 'https://api.soroswap.finance/api/faucet';

// Aquarius publishes this faucet keypair's secret in their app bundle. It's
// the testnet-only distribution account that pays out classic assets like
// USDC/AQUA. We use the same keypair to mint AQUARIUS_USDC for the user.
const AQUARIUS_FAUCET_SECRET = 'SBPQCB4DOUQ26OC43QNAA3ODZOGECHJUVHDHYRHKYPL4SA22RRYGHQCX';
const AQUARIUS_USDC_CODE = 'USDC';
const AQUARIUS_USDC_ISSUER = 'GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER';
const AQUARIUS_USDC_FAUCET_AMOUNT = '1000.0000000';

export type FaucetTokenId = 'XLM' | 'BLEND_USDC' | 'AQUARIUS_USDC' | 'SOROSWAP_USDC';

export interface FaucetResult {
  ok: boolean;
  hash?: string;
  alreadyFunded?: boolean;
  error?: string;
}

// ─── XLM via Friendbot ──────────────────────────────────────────────────────
export const fundXlmViaFriendbot = async (address: string): Promise<FaucetResult> => {
  try {
    const url = `${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`;
    const res = await fetch(url, { method: 'GET' });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: true, hash: body?.hash };
    }
    // Friendbot returns 400 with "op_already_exists" once an account is funded.
    // That's not a failure — it just means the user already has XLM.
    const errText = await res.text().catch(() => '');
    if (errText.includes('op_already_exists') || errText.includes('createAccountAlreadyExist')) {
      return { ok: true, alreadyFunded: true };
    }
    return { ok: false, error: `Friendbot ${res.status}: ${errText.slice(0, 160)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Friendbot request failed' };
  }
};

// ─── Soroswap USDC via Soroswap faucet API ─────────────────────────────────
export const fundSoroswapUsdc = async (address: string): Promise<FaucetResult> => {
  try {
    const url = `${SOROSWAP_FAUCET_URL}?address=${encodeURIComponent(address)}&contract=${encodeURIComponent(CONTRACT_ADDRESSES.SOROSWAP_USDC)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json().catch(() => null) as { status?: string; txHash?: string; message?: string } | null;
    if (res.ok && body?.status === 'SUCCESS') {
      return { ok: true, hash: body.txHash };
    }
    return { ok: false, error: body?.message || `Soroswap faucet ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Soroswap faucet request failed' };
  }
};

// ─── Blend USDC via Blend's getAssets endpoint ─────────────────────────────
// Blend returns a TransactionEnvelope already signed by their distribution
// account. We add the user's signature (Freighter) and submit. This mints
// the Blend testnet basket: USDC, BLND, wETH, wBTC + trustlines as needed.
export const fundBlendAssets = async (address: string): Promise<FaucetResult> => {
  try {
    const url = `${BLEND_FAUCET_URL}?userId=${encodeURIComponent(address)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Blend faucet ${res.status}: ${errText.slice(0, 160)}` };
    }
    const xdrBase64 = (await res.text()).replace(/^"|"$/g, '');
    if (!xdrBase64) return { ok: false, error: 'Blend faucet returned empty body' };

    const partiallySignedTx = StellarSdk.TransactionBuilder.fromXDR(
      xdrBase64,
      NETWORK_PASSPHRASE
    );
    const signedXdr = await signTransaction(partiallySignedTx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    if (signedXdr.error) return { ok: false, error: String(signedXdr.error) };

    const finalTx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr.signedTxXdr,
      NETWORK_PASSPHRASE
    );

    // Blend's tx is mostly classic-asset ops (changeTrust + payment) so
    // Horizon's transactions endpoint is the right submitter. Use Soroban
    // RPC only when the body actually invokes a host function.
    const isSoroban = finalTx.operations.some((op) => op.type === 'invokeHostFunction');
    if (isSoroban) {
      const sorobanServer = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sent = await sorobanServer.sendTransaction(finalTx as StellarSdk.Transaction);
      if (sent.status === 'PENDING' || sent.status === 'DUPLICATE') {
        return { ok: true, hash: sent.hash };
      }
      return { ok: false, error: `Submit failed: ${sent.status}` };
    } else {
      const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL);
      const result = await horizonServer.submitTransaction(finalTx as StellarSdk.Transaction);
      return { ok: true, hash: result.hash };
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { extras?: { result_codes?: unknown } } }; message?: string };
    const horizonExtras = err?.response?.data?.extras?.result_codes;
    const msg = horizonExtras
      ? JSON.stringify(horizonExtras).slice(0, 200)
      : err?.message || 'Blend faucet submission failed';
    return { ok: false, error: msg };
  }
};

// ─── Aquarius USDC via published distribution keypair ──────────────────────
// Aquarius's testnet distribution flow: build a tx with a changeTrust op
// (user-signed, default source) and a payment op sourced by the faucet
// account (faucet-signed). Both signatures are needed to submit.
export const fundAquariusUsdc = async (address: string): Promise<FaucetResult> => {
  try {
    const horizonServer = new StellarSdk.Horizon.Server(HORIZON_URL);
    const userAccount = await horizonServer.loadAccount(address);
    const faucetKeypair = StellarSdk.Keypair.fromSecret(AQUARIUS_FAUCET_SECRET);
    const usdc = new StellarSdk.Asset(AQUARIUS_USDC_CODE, AQUARIUS_USDC_ISSUER);

    const balanceLine = userAccount.balances.find((b) => {
      const asAsset = b as { asset_code?: string; asset_issuer?: string };
      return asAsset.asset_code === AQUARIUS_USDC_CODE && asAsset.asset_issuer === AQUARIUS_USDC_ISSUER;
    });
    const needsTrustline = !balanceLine;

    const txBuilder = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    }).setTimeout(120);

    if (needsTrustline) {
      txBuilder.addOperation(StellarSdk.Operation.changeTrust({ asset: usdc }));
    }
    txBuilder.addOperation(
      StellarSdk.Operation.payment({
        source: faucetKeypair.publicKey(),
        destination: address,
        asset: usdc,
        amount: AQUARIUS_USDC_FAUCET_AMOUNT,
      })
    );

    const builtTx = txBuilder.build();
    // Faucet signs first (it's the source of the payment op). Then the user
    // signs (they're the tx source and the source of changeTrust).
    builtTx.sign(faucetKeypair);

    const userSigned = await signTransaction(builtTx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    if (userSigned.error) return { ok: false, error: String(userSigned.error) };

    const finalTx = StellarSdk.TransactionBuilder.fromXDR(
      userSigned.signedTxXdr,
      NETWORK_PASSPHRASE
    );
    const result = await horizonServer.submitTransaction(finalTx as StellarSdk.Transaction);
    return { ok: true, hash: result.hash };
  } catch (e: unknown) {
    const err = e as { response?: { data?: { extras?: { result_codes?: unknown } } }; message?: string };
    const horizonExtras = err?.response?.data?.extras?.result_codes;
    const msg = horizonExtras
      ? JSON.stringify(horizonExtras).slice(0, 200)
      : err?.message || 'Aquarius faucet submission failed';
    return { ok: false, error: msg };
  }
};

export const FAUCET_TOKEN_META: Record<FaucetTokenId, { label: string; icon: string; description: string }> = {
  XLM: {
    label: 'XLM',
    icon: '/coins/xlmbg.png',
    description: 'Native Stellar asset · funded by Friendbot (10,000 XLM)',
  },
  BLEND_USDC: {
    label: 'Blend USDC',
    icon: '/icons/usdc-icon.svg',
    description: 'Issued by Blend testnet · also mints BLND, wETH, wBTC',
  },
  AQUARIUS_USDC: {
    label: 'Aquarius USDC',
    icon: '/icons/usdc-icon.svg',
    description: 'Classic asset on Aquarius testnet · 1,000 USDC',
  },
  SOROSWAP_USDC: {
    label: 'Soroswap USDC',
    icon: '/icons/usdc-icon.svg',
    description: 'Soroswap testnet faucet (rate-limited 5/min)',
  },
};

export const runFaucet = async (
  token: FaucetTokenId,
  address: string
): Promise<FaucetResult> => {
  switch (token) {
    case 'XLM':
      return fundXlmViaFriendbot(address);
    case 'BLEND_USDC':
      return fundBlendAssets(address);
    case 'AQUARIUS_USDC':
      return fundAquariusUsdc(address);
    case 'SOROSWAP_USDC':
      return fundSoroswapUsdc(address);
  }
};
