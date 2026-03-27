import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 100,
  maxRetries: 3,
});

async function testServerRateLimiting() {
  console.log('=== SERVER-SIDE RATE LIMIT TEST ===');
  console.log('Bypassing client rate limit (100 RPM) to hit server limits...\n');
  
  const startTime = Date.now();
  const queries = Array(50).fill(null).map((_, i) => ({
    query: `Query ${i + 1}: Quick test ${i}`,
    maxTokens: 20
  }));
  
  console.log('Sending 50 queries as fast as possible...');
  console.log('Expected: Server should return 429 errors after ~5 queries\n');
  
  let rateLimitedCount = 0;
  let successCount = 0;
  let failCount = 0;
  
  const promises = queries.map((q, i) => {
    const queryStart = Date.now();
    return client.search(q).then(
      (response) => {
        const elapsed = Date.now() - startTime;
        const queryTime = Date.now() - queryStart;
        successCount++;
        console.log(`[${elapsed}ms] ✓ Query ${i + 1}/50 completed in ${queryTime}ms`);
        return { success: true, index: i, time: elapsed, queryTime };
      },
      (error) => {
        const elapsed = Date.now() - startTime;
        const queryTime = Date.now() - queryStart;
        const errorMsg = (error as Error).message;
        
        if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
          rateLimitedCount++;
          console.log(`[${elapsed}ms] ⚠ Query ${i + 1}/50 RATE LIMITED (429) after ${queryTime}ms`);
        } else {
          failCount++;
          console.error(`[${elapsed}ms] ✗ Query ${i + 1}/50 FAILED: ${errorMsg.substring(0, 60)}`);
        }
        return { success: false, index: i, error: errorMsg, time: elapsed, queryTime, rateLimited: errorMsg.includes('429') };
      }
    );
  });
  
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total queries: 50`);
  console.log(`Successful: ${successCount}`);
  console.log(`Rate Limited (429): ${rateLimitedCount}`);
  console.log(`Other failures: ${failCount}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)} seconds`);
  
  const stats = await client.getStats();
  console.log('\n' + '='.repeat(60));
  console.log('CLIENT STATS:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(stats, null, 2));
  
  if (rateLimitedCount > 0) {
    console.log('\n✅ RATE LIMITING OBSERVED!');
    console.log(`The server returned 429 errors for ${rateLimitedCount} requests`);
    console.log('Bottleneck should have queued and retried these...');
  } else {
    console.log('\n⚠️  No rate limiting observed');
    console.log('The server accepted all requests without 429 errors');
  }
  
  client.destroy();
  console.log('\n=== TEST COMPLETE ===');
}

testServerRateLimiting();
