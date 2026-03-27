import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 3,
});

async function testCooldownBehavior() {
  console.log('=== COOLDOWN BEHAVIOR TEST ===');
  console.log('Testing: Random 1-10s cooldown on rate limit\n');
  
  const startTime = Date.now();
  
  // Send 30 queries quickly to trigger rate limits
  const queries = Array(30).fill(null).map((_, i) => ({
    query: `Cooldown test ${i + 1}`,
    maxTokens: 20
  }));
  
  let successCount = 0;
  let rateLimitedCount = 0;
  
  for (let i = 0; i < queries.length; i++) {
    const elapsed = Date.now() - startTime;
    process.stdout.write(`\r[${elapsed}ms] Progress: ${i + 1}/30 (Success: ${successCount}, Rate Limited: ${rateLimitedCount})`);
    
    try {
      await client.search(queries[i]);
      successCount++;
    } catch (error) {
      const errMsg = (error as Error).message;
      if (errMsg.includes('429') || errMsg.includes('rate limit')) {
        rateLimitedCount++;
      }
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n\n' + '='.repeat(60));
  console.log('RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total queries: 30`);
  console.log(`Successful: ${successCount}`);
  console.log(`Rate limited: ${rateLimitedCount}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)} seconds`);
  
  const stats = await client.getStats();
  console.log('\nStats:', JSON.stringify(stats, null, 2));
  
  client.destroy();
  console.log('\n=== TEST COMPLETE ===');
  console.log('\nExpected behavior:');
  console.log('- When rate limit hit, queue pauses for random 1-10s');
  console.log('- Failed requests requeue at position 5');
  console.log('- Queue resumes after cooldown period');
}

testCooldownBehavior();
