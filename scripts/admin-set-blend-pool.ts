/**
 * Admin script: Set Blend pool address in Registry contract.
 *
 * This MUST be run by the protocol admin BEFORE any Blend deposit/withdraw
 * transactions can succeed. Without it, SmartAccount.execute() panics with:
 *   "No external protocol mapped for the given protocol address"
 *   → HostError: Error(WasmVm, InvalidAction) / UnreachableCodeReached
 *
 * Usage:
 *   npx ts-node scripts/admin-set-blend-pool.ts <ADMIN_SECRET_KEY>
 *
 * The admin wallet is: GAUVY7FNDKVWRMW3SYEMX6QMFSWQDKC6XIPJJKAMOEMLZPAI7XZPDV3D
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const REGISTRY_ADDRESS = 'CANOLJZH7YTQVRSNL4WFIT6EHZUK6OL7HQR2Q2UOMHFJCZH2JMHW3AR2';
const BLEND_POOL_ADDRESS = 'CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF'; // TestnetV2

async function setBlendPoolAddress(adminSecretKey: string) {
  const adminKeypair = StellarSdk.Keypair.fromSecret(adminSecretKey);
  console.log('Admin address:', adminKeypair.publicKey());

  const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  const adminAccount = await server.getAccount(adminKeypair.publicKey());

  const registryContract = new StellarSdk.Contract(REGISTRY_ADDRESS);

  const transaction = new StellarSdk.TransactionBuilder(adminAccount, {
    fee: (parseInt(StellarSdk.BASE_FEE) * 10).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      registryContract.call(
        'set_blend_pool_address',
        StellarSdk.nativeToScVal(BLEND_POOL_ADDRESS, { type: 'address' })
      )
    )
    .setTimeout(30)
    .build();

  console.log('Preparing transaction...');
  const preparedTx = await server.prepareTransaction(transaction);
  preparedTx.sign(adminKeypair);

  console.log('Submitting transaction...');
  const result = await server.sendTransaction(preparedTx as StellarSdk.Transaction);
  console.log('Transaction submitted:', result.hash);
  console.log('Status:', result.status);

  if (result.status === 'PENDING') {
    // Poll for completion
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const tx = await server.getTransaction(result.hash);
      if (tx.status !== 'NOT_FOUND') {
        if (tx.status === 'SUCCESS') {
          console.log('✓ Success! Blend pool address set in Registry.');
          console.log('  Registry:', REGISTRY_ADDRESS);
          console.log('  Blend pool:', BLEND_POOL_ADDRESS);
          return;
        } else {
          console.error('✗ Transaction failed:', tx.status);
          console.error(tx);
          process.exit(1);
        }
      }
      attempts++;
    }
    console.error('Transaction timed out');
    process.exit(1);
  }
}

const adminSecret = process.argv[2];
if (!adminSecret) {
  console.error('Usage: npx ts-node scripts/admin-set-blend-pool.ts <ADMIN_SECRET_KEY>');
  process.exit(1);
}

setBlendPoolAddress(adminSecret).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
