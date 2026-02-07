#!/usr/bin/env node

/**
 * MM4CLAW Load Test Script
 *
 * Tests concurrent registration (vote) requests
 *
 * Usage:
 *   node test-load.js                    # Default: 1000 wallets, 200 concurrency
 *   TOTAL=500 CONCURRENCY=50 node test-load.js
 *   TOTAL=100 CONCURRENCY=10 node test-load.js
 */

const BASE_URL = process.env.BASE_URL || 'https://preview.mm4claw.xyz';
const TOTAL_WALLETS = parseInt(process.env.TOTAL) || 1000;
const CONCURRENCY = parseInt(process.env.CONCURRENCY) || 200;

// Cloudflare Access credentials (if needed)
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID || '36df10ca70f2fd607e909f8f6822ac20.access';
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET || '2ff5362e476b9e7dfaa9c5583303ebd554770b6441ce5974668256a02a34d33e';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color, msg) {
  console.log(`${color}${msg}${colors.reset}`);
}

function generateWallet(index) {
  // Generate a valid Base chain address (0x + 40 hex chars)
  const hex = index.toString(16).padStart(40, '0').slice(0, 40);
  return `0x${hex}`;
}

function generateAgentName(index) {
  return `TestAgent${index}`;
}

async function vote(wallet, agentName) {
  const startTime = Date.now();

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add Cloudflare Access headers if configured
    if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
      headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
      headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
    }

    const response = await fetch(`${BASE_URL}/api/vote`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        wallet,
        agent_name: agentName,
        description: `Load test agent #${agentName}`,
      }),
    });

    const elapsed = Date.now() - startTime;
    const data = await response.json();

    return {
      success: response.ok,
      status: response.status,
      elapsed,
      wallet,
      agentName,
      data,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    return {
      success: false,
      error: error.message,
      elapsed,
      wallet,
      agentName,
    };
  }
}

async function batchVote(wallets, agentNames, batchIndex) {
  log(colors.blue, `Batch ${batchIndex + 1}: Processing ${wallets.length} wallets...`);

  const promises = wallets.map((wallet, i) =>
    vote(wallet, agentNames[i])
  );

  const results = await Promise.all(promises);

  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  // Print progress
  const symbol = success > 0 ? '✓' : '✗';
  const color = success > 0 ? colors.green : colors.red;
  log(color, `${symbol} Batch ${batchIndex + 1}: ${success} succeeded, ${failed} failed`);

  return results;
}

async function runLoadTest() {
  log(colors.cyan, `╔════════════════════════════════════════════════════════╗`);
  log(colors.cyan, `║     MM4CLAW Load Test - Concurrent Registration      ║`);
  log(colors.cyan, `╚════════════════════════════════════════════════════════╝`);
  log(colors.yellow, `Target: ${BASE_URL}`);
  log(colors.yellow, `Total Wallets: ${TOTAL_WALLETS}`);
  log(colors.yellow, `Concurrency: ${CONCURRENCY}`);
  console.log();

  // Generate test data
  log(colors.blue, 'Generating test wallets...');
  const wallets = [];
  const agentNames = [];

  for (let i = 0; i < TOTAL_WALLETS; i++) {
    wallets.push(generateWallet(i));
    agentNames.push(generateAgentName(i));
  }
  log(colors.green, `Generated ${wallets.length} unique wallets\n`);

  // Run concurrent requests in batches
  const startTime = Date.now();
  const allResults = [];
  const batches = Math.ceil(TOTAL_WALLETS / CONCURRENCY);

  log(colors.magenta, `Starting ${batches} batches of ${CONCURRENCY} concurrent requests...\n`);

  for (let i = 0; i < batches; i++) {
    const start = i * CONCURRENCY;
    const end = Math.min(start + CONCURRENCY, TOTAL_WALLETS);

    const batchWallets = wallets.slice(start, end);
    const batchNames = agentNames.slice(start, end);

    const batchResults = await batchVote(batchWallets, batchNames, i);
    allResults.push(...batchResults);

    // Show cumulative progress
    const totalSuccess = allResults.filter(r => r.success).length;
    log(colors.cyan, `[${i + 1}/${batches}] Cumulative: ${totalSuccess}/${TOTAL_WALLETS} succeeded\n`);

    // Small delay between batches to avoid overwhelming
    if (i < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const totalElapsed = Date.now() - startTime;

  // Calculate statistics
  const successResults = allResults.filter(r => r.success);
  const failedResults = allResults.filter(r => !r.success);

  const successCount = successResults.length;
  const failedCount = failedResults.length;

  const times = allResults.map(r => r.elapsed);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  // Sort times for percentile
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  // Print results
  console.log();
  log(colors.cyan, `╔════════════════════════════════════════════════════════╗`);
  log(colors.cyan, `║                  TEST RESULTS                          ║`);
  log(colors.cyan, `╚════════════════════════════════════════════════════════╝`);
  console.log();

  log(colors.green, `✓ Success: ${successCount} (${((successCount/TOTAL_WALLETS)*100).toFixed(1)}%)`);
  if (failedCount > 0) {
    log(colors.red, `✗ Failed: ${failedCount} (${((failedCount/TOTAL_WALLETS)*100).toFixed(1)}%)`);
  } else {
    log(colors.green, `✗ Failed: 0`);
  }
  console.log();

  log(colors.blue, `Timing Statistics:`);
  log(colors.blue, `  Total Time: ${(totalElapsed/1000).toFixed(2)}s`);
  log(colors.blue, `  Requests/sec: ${(TOTAL_WALLETS/(totalElapsed/1000)).toFixed(2)}`);
  console.log();

  log(colors.blue, `Response Times (ms):`);
  log(colors.blue, `  Average: ${avgTime.toFixed(0)}`);
  log(colors.blue, `  Min: ${minTime}`);
  log(colors.blue, `  Max: ${maxTime}`);
  log(colors.blue, `  P50: ${p50}`);
  log(colors.blue, `  P95: ${p95}`);
  log(colors.blue, `  P99: ${p99}`);
  console.log();

  // Error breakdown
  if (failedCount > 0) {
    log(colors.yellow, `Error Breakdown:`);
    const errors = {};
    failedResults.forEach(r => {
      const key = r.error || r.data?.error || 'unknown';
      errors[key] = (errors[key] || 0) + 1;
    });

    Object.entries(errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5 errors
      .forEach(([error, count]) => {
        log(colors.red, `  ${error}: ${count}`);
      });
    console.log();
  }

  // Sample successful response
  if (successResults.length > 0) {
    log(colors.blue, `Sample Successful Response:`);
    log(colors.green, JSON.stringify(successResults[0].data, null, 2));
    console.log();
  }

  // Verify final stats
  try {
    log(colors.blue, 'Verifying final agent count...');
    const headers = {};
    if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
      headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
      headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
    }
    const statsResponse = await fetch(`${BASE_URL}/api/stats`, { headers });
    const statsData = await statsResponse.json();
    log(colors.green, `Final agent count: ${statsData.total_agents}`);
  } catch (error) {
    log(colors.red, `Failed to fetch stats: ${error.message}`);
  }

  // Exit with appropriate code
  console.log();
  if (failedCount === 0) {
    log(colors.green, `✅ All tests passed!`);
    process.exit(0);
  } else {
    log(colors.yellow, `⚠️  ${failedCount} requests failed`);
    process.exit(1);
  }
}

// Run the test
runLoadTest().catch(error => {
  log(colors.red, `Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
