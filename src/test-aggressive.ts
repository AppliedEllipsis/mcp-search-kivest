import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 3,
});

async function testAggressiveRateLimiting() {
  console.log('=== AGGRESSIVE RATE LIMIT TEST ===');
  console.log('Sending 25 queries to trigger rate limiting...\n');
  
  const startTime = Date.now();
  const queries = Array(25).fill(null).map((_, i) => ({
    query: `Query ${i + 1}: What is ${['AI', 'ML', 'quantum', 'blockchain', 'cloud', 'cybersecurity', 'data science', 'IoT', '5G', 'edge computing', 'docker', 'kubernetes', 'microservices', 'serverless', 'DevOps', 'CI/CD', 'agile', 'scrum', 'kanban', 'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence'][i]}?`,
    maxTokens: 50
  }));
  
  console.log('Starting burst of 25 queries...');
  console.log('Expected: ~5 queries immediate, 20 queued\n');
  
  const promises = queries.map((q, i) => 
    client.search(q).then(
      (response) => {
        const elapsed = Date.now() - startTime;
        console.log(`[${elapsed}ms] ✓ Query ${i + 1}/25 completed - ${response.choices[0]?.message?.content?.substring(0, 40)}...`);
        return { success: true, index: i, time: elapsed };
      },
      (error) => {
        const elapsed = Date.now() - startTime;
        console.error(`[${elapsed}ms] ✗ Query ${i + 1}/25 FAILED: ${(error as Error).message.substring(0, 60)}`);
        return { success: false, index: i, error: (error as Error).message, time: elapsed };
      }
    )
  );
  
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;
  
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log('\n' + '='.repeat(50));
  console.log('FINAL RESULTS:');
  console.log('='.repeat(50));
  console.log(`Total queries: 25`);
  console.log(`Successful: ${succeeded.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)} seconds`);
  console.log(`Average time per query: ${(totalTime / 25).toFixed(0)}ms`);
  
  if (succeeded.length > 0) {
    console.log(`\nSuccess times:`);
    succeeded.forEach(r => console.log(`  Query ${r.index + 1}: ${r.time}ms`));
  }
  
  if (failed.length > 0) {
    console.log(`\nFailed queries:`);
    failed.forEach(r => console.log(`  Query ${r.index + 1}: ${r.error?.substring(0, 80)}`));
  }
  
  const stats = await client.getStats();
  console.log('\n' + '='.repeat(50));
  console.log('CLIENT STATS:');
  console.log('='.repeat(50));
  console.log(JSON.stringify(stats, null, 2));
  
  client.destroy();
  console.log('\n=== TEST COMPLETE ===');
}

testAggressiveRateLimiting();
