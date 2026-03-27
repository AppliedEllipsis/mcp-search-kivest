import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 10,
});

async function testPriorityRetries() {
  console.log('=== PRIORITY-BASED RETRY TEST ===');
  console.log('Testing: Jobs retry based on initial time, not retry time\n');
  
  const startTime = Date.now();
  const queries = Array(20).fill(null).map((_, i) => ({
    query: `Priority test ${i + 1}`,
    maxTokens: 20
  }));
  
  let completed = 0;
  let failed = 0;
  
  const promises = queries.map((q, i) => 
    client.search(q).then(
      () => {
        completed++;
        const elapsed = Date.now() - startTime;
        console.log(`[${elapsed}ms] ✓ Query ${i + 1} completed`);
      },
      (err) => {
        failed++;
        const elapsed = Date.now() - startTime;
        console.log(`[${elapsed}ms] ✗ Query ${i + 1} failed: ${(err as Error).message.substring(0, 50)}`);
      }
    )
  );
  
  await Promise.all(promises);
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total queries: 20`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)} seconds`);
  
  const stats = await client.getStats();
  console.log('\nStats:', JSON.stringify(stats, null, 2));
  
  client.destroy();
  console.log('\n=== TEST COMPLETE ===');
  console.log('\nExpected: Rate-limited jobs go to retry queue');
  console.log('Retried based on initial time priority (10 max retries)');
}

testPriorityRetries();
