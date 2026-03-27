import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 3,
});

async function testQueueOverflow() {
  console.log('=== QUEUE OVERFLOW TEST ===');
  console.log('Queue limit: 50 requests');
  console.log('Sending 75 queries to trigger overflow...\n');
  
  const startTime = Date.now();
  const queries = Array(75).fill(null).map((_, i) => ({
    query: `Overflow test query ${i + 1}`,
    maxTokens: 20
  }));
  
  let overflowCount = 0;
  let successCount = 0;
  let rateLimitedCount = 0;
  let failCount = 0;
  
  const promises = queries.map((q, i) => 
    client.search(q).then(
      (response) => {
        const elapsed = Date.now() - startTime;
        successCount++;
        process.stdout.write(`\r[${elapsed}ms] Progress: ${successCount + failCount + overflowCount}/75 (Success: ${successCount}, Failed: ${failCount}, Overflow: ${overflowCount})`);
        return { success: true, index: i, time: elapsed };
      },
      (error) => {
        const elapsed = Date.now() - startTime;
        const errorMsg = (error as Error).message;
        
        if (errorMsg.includes('overflow') || errorMsg.includes('Queue') || errorMsg.includes('highWater')) {
          overflowCount++;
        } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
          rateLimitedCount++;
        } else {
          failCount++;
        }
        
        process.stdout.write(`\r[${elapsed}ms] Progress: ${successCount + failCount + overflowCount}/75 (Success: ${successCount}, Failed: ${failCount}, Overflow: ${overflowCount})`);
        return { success: false, index: i, error: errorMsg, time: elapsed };
      }
    )
  );
  
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;
  
  console.log('\n\n' + '='.repeat(60));
  console.log('FINAL RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total queries sent: 75`);
  console.log(`Successful: ${successCount}`);
  console.log(`Rate Limited (429): ${rateLimitedCount}`);
  console.log(`Queue Overflow: ${overflowCount}`);
  console.log(`Other failures: ${failCount}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)} seconds`);
  
  const stats = await client.getStats();
  console.log('\n' + '='.repeat(60));
  console.log('CLIENT STATS:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(stats, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('ANALYSIS:');
  console.log('='.repeat(60));
  
  if (overflowCount > 0) {
    console.log(`✅ Queue overflow detected: ${overflowCount} requests rejected`);
    console.log('Bottleneck strategy OVERFLOW is working - excess requests fail fast');
  } else if (successCount === 75) {
    console.log('⚠️  No overflow occurred - all 75 requests were queued and processed');
    console.log('This means the API server is not enforcing strict rate limits, or');
    console.log('the client-side throttling is preventing server rate limits.');
  }
  
  if (rateLimitedCount > 0) {
    console.log(`\n✅ Server rate limiting detected: ${rateLimitedCount} requests got 429`);
    console.log('Bottleneck retry mechanism should have requeued these.');
  }
  
  const errors = results.filter(r => !r.success && r.error);
  if (errors.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('ERROR SAMPLES:');
    console.log('='.repeat(60));
    errors.slice(0, 5).forEach((e: any) => {
      console.log(`Query ${e.index + 1}: ${e.error?.substring(0, 100)}`);
    });
  }
  
  client.destroy();
  console.log('\n=== TEST COMPLETE ===');
}

testQueueOverflow();
