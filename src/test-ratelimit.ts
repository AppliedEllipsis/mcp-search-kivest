import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 3,
});

async function testRateLimiting() {
  console.log('=== Testing Rate Limiting (5 RPM) ===\n');
  
  // Test 1: Sequential burst (8 queries to exceed 5 RPM limit)
  console.log('Test 1: Sending 8 sequential queries (exceeds 5 RPM)...');
  const queries1 = Array(8).fill(null).map((_, i) => 
    `Query ${i + 1}: What is ${['AI', 'ML', 'quantum computing', 'blockchain', 'cloud computing', 'cybersecurity', 'data science', 'IoT'][i]}?`
  );
  
  for (let i = 0; i < queries1.length; i++) {
    console.log(`  Sending query ${i + 1}/8...`);
    try {
      const response = await client.search({ query: queries1[i], maxTokens: 100 });
      console.log(`  ✓ Query ${i + 1} completed`);
    } catch (error) {
      console.error(`  ✗ Query ${i + 1} failed:`, (error as Error).message);
    }
  }
  
  const stats1 = await client.getStats();
  console.log('\nStats after burst:', JSON.stringify(stats1, null, 2));
  
  // Test 2: Concurrent queries (12 at once to trigger queue)
  console.log('\nTest 2: Sending 12 concurrent queries...');
  const concurrentQueries = Array(12).fill(null).map((_, i) => 
    `Concurrent query ${i + 1}: Explain ${i + 1}`
  );
  
  const promises = concurrentQueries.map((query, i) => 
    client.search({ query, maxTokens: 50 }).then(
      () => ({ success: true, index: i }),
      (error) => ({ success: false, index: i, error: (error as Error).message })
    )
  );
  
  const results = await Promise.all(promises);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`  Results: ${succeeded} succeeded, ${failed} failed`);
  
  const stats2 = await client.getStats();
  console.log('\nFinal Stats:', JSON.stringify(stats2, null, 2));
  
  client.destroy();
  console.log('\n=== Rate Limiting Test Complete ===');
}

testRateLimiting();
