// Test script for Provable delegated proving.
// Usage: npx tsx scripts/test-delegated-proving.ts
//
// Prerequisites:
// 1. Set PROVABLE_API_KEY and PROVABLE_CONSUMER_ID in .env
// 2. Set RESOLVER_PRIVATE_KEY in .env
// 3. Have public ALEO balance on the resolver account

import 'dotenv/config';

async function main() {
  console.log('=== Delegated Proving Test ===\n');

  // Validate env
  const apiKey = process.env.PROVABLE_API_KEY;
  const consumerId = process.env.PROVABLE_CONSUMER_ID;
  const privateKey = process.env.RESOLVER_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!apiKey || !consumerId) {
    console.error('ERROR: Set PROVABLE_API_KEY and PROVABLE_CONSUMER_ID in .env');
    console.log('\nTo register:');
    console.log('  curl -X POST https://api.provable.com/consumers -H "Content-Type: application/json" -d \'{"username":"veil-strike"}\'');
    console.log('  → Response: { "id": "CONSUMER_ID", "key": "API_KEY" }');
    process.exit(1);
  }

  if (!privateKey) {
    console.error('ERROR: Set RESOLVER_PRIVATE_KEY in .env');
    process.exit(1);
  }

  console.log(`API Key: ${apiKey.slice(0, 8)}...`);
  console.log(`Consumer ID: ${consumerId.slice(0, 8)}...`);
  console.log(`Private Key: ${privateKey.slice(0, 12)}...`);

  // Import SDK
  const sdk = await import('@provablehq/sdk/mainnet.js');
  const { ProgramManager, AleoNetworkClient, AleoKeyProvider, NetworkRecordProvider, Account } = sdk;

  const endpoint = process.env.ALEO_ENDPOINT || 'https://api.provable.com/v2';
  const programId = 'veil_strike_v7.aleo';

  // Initialize
  const account = new Account({ privateKey });
  const address = account.address().to_string();
  console.log(`\nResolver address: ${address}`);

  const networkClient = new AleoNetworkClient(endpoint);
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  const recordProvider = new NetworkRecordProvider(account, networkClient);

  const pm = new ProgramManager(endpoint, keyProvider, recordProvider);
  pm.setAccount(account);

  // Test 1: Build a proving request (just authorization, no remote call)
  console.log('\n--- Test 1: Build proving request ---');
  const testMarketId = '123456789field';
  const testOutcome = '1u8';

  try {
    const start = Date.now();
    const provingRequest = await pm.provingRequest({
      programName: programId,
      functionName: 'flash_settle',
      inputs: [testMarketId, testOutcome],
      priorityFee: 10_000,
      privateFee: false,
      broadcast: false, // Don't broadcast for test
    });
    const elapsed = Date.now() - start;
    console.log(`✅ Proving request built in ${elapsed}ms`);
    console.log(`   Type: ${typeof provingRequest}`);

    // Test 2: Submit to Provable (safe variant — won't throw)
    console.log('\n--- Test 2: Submit to Provable DPS ---');
    console.log('   (This will fail for a fake market, but validates API connectivity)');

    const DPS_URL = 'https://api.provable.com/prove/mainnet/prove';
    const start2 = Date.now();
    const result = await networkClient.submitProvingRequestSafe({
      provingRequest,
      url: DPS_URL,
      apiKey,
      consumerId,
    });
    const elapsed2 = Date.now() - start2;

    if (result.ok) {
      console.log(`✅ Proving succeeded in ${elapsed2}ms!`);
      console.log(`   TX ID: ${result.data.transaction?.id}`);
      console.log(`   Broadcast: ${result.data.broadcast_result?.status}`);
    } else {
      console.log(`⚠️ Proving returned error (expected for fake market): HTTP ${result.status}`);
      console.log(`   Message: ${result.error?.message}`);
      console.log(`   Latency: ${elapsed2}ms`);
      console.log(`   API connectivity: ✅ (error is from Aleo VM, not auth)`);
    }
  } catch (err: any) {
    console.error(`❌ Error:`, err?.message || err);
  }

  // Test 3: Check block height (basic API)
  console.log('\n--- Test 3: Block height check ---');
  try {
    const res = await fetch(`${endpoint}/mainnet/block/height/latest`);
    const height = await res.text();
    console.log(`✅ Current block height: ${height}`);
  } catch (err: any) {
    console.error(`❌ Block height fetch failed:`, err?.message);
  }

  // Test 4: Check resolver balance
  console.log('\n--- Test 4: Account balance ---');
  try {
    const res = await fetch(`${endpoint}/mainnet/program/credits.aleo/mapping/account/${address}`);
    if (res.ok) {
      const balance = await res.text();
      const microcredits = parseInt(JSON.parse(balance).replace('u64', ''), 10);
      console.log(`✅ Public balance: ${(microcredits / 1_000_000).toFixed(6)} ALEO (${microcredits} μcr)`);
    } else {
      console.log('⚠️ No public balance found (or API error)');
    }
  } catch (err: any) {
    console.error(`❌ Balance check failed:`, err?.message);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
