import { KivestClient } from './kivest-client.js';

const client = new KivestClient({
  apiKey: '',
  requestsPerMinute: 5,
  maxRetries: 10,
});

async function testNewEndpoints() {
  console.log('=== TESTING NEW ENDPOINTS ===\n');
  
  try {
    // Test 1: Web Search
    console.log('1. Testing /search?q=');
    const webResults = await client.searchWeb('machine learning');
    console.log(`   ✓ Found ${webResults.results.length} web results`);
    console.log(`   First result: ${webResults.results[0]?.title?.substring(0, 60)}...\n`);
  } catch (error) {
    console.log(`   ✗ Web search failed: ${(error as Error).message}\n`);
  }
  
  try {
    // Test 2: Image Search
    console.log('2. Testing /images?q=');
    const imageResults = await client.searchImages('cat');
    console.log(`   ✓ Found ${imageResults.results.length} images`);
    console.log(`   First image: ${imageResults.results[0]?.image_url?.substring(0, 60)}...\n`);
  } catch (error) {
    console.log(`   ✗ Image search failed: ${(error as Error).message}\n`);
  }
  
  try {
    // Test 3: Usage
    console.log('3. Testing /usage');
    const usage = await client.getUsage();
    console.log(`   ✓ Total requests: ${usage.total}`);
    console.log(`   Endpoints:`, usage.endpoints, '\n');
  } catch (error) {
    console.log(`   ✗ Usage failed: ${(error as Error).message}\n`);
  }
  
  const stats = await client.getStats();
  console.log('Stats:', JSON.stringify(stats, null, 2));
  
  client.destroy();
  console.log('\n=== TEST COMPLETE ===');
}

testNewEndpoints();
