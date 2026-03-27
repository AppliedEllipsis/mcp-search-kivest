import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 10,
});

async function testQuickBurst() {
  console.log('=== QUICK BURST TEST (5 queries) ===');
  console.log('Sending 5 queries to test rate limiting...\n');
  
  const startTime = Date.now();
  const queries = [
    { query: 'What is AI?', maxTokens: 20 },
    { query: 'What is ML?', maxTokens: 20 },
    { query: 'What is quantum computing?', maxTokens: 20 },
    { query: 'What is blockchain?', maxTokens: 20 },
    { query: 'What is cloud computing?', maxTokens: 20 },
  ];
  
  let completed = 0;
  
  for (let i = 0; i < queries.length; i++) {
    const qStart = Date.now();
    try {
      await client.search(queries[i]);
      const elapsed = Date.now() - startTime;
      const duration = Date.now() - qStart;
      completed++;
      console.log(`[${elapsed}ms] ✓ Query ${i + 1} completed in ${duration}ms`);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.log(`[${elapsed}ms] ✗ Query ${i + 1} failed: ${(err as Error).message.substring(0, 50)}`);
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  console.log('='.repeat(60));
  console.log(`Completed: ${completed}/5`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)} seconds`);
  console.log(`Expected time: ~60 seconds (5 queries × 12s each)`);
  
  const stats = await client.getStats();
  console.log('\nStats:', JSON.stringify(stats, null, 2));
  
  client.destroy();
  console.log('\n=== TEST COMPLETE ===');
}

testQuickBurst();
