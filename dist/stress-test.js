/**
 * Stress Test for Rate Limiting
 * Tests behavior under heavy load and captures detailed output
 */
import { KivestClient } from './kivest-client.js';
const API_KEY = process.env.KIVEST_API_KEY || '';
async function runStressTest(client, requestCount, concurrent = true) {
    const startTime = Date.now();
    const timestamps = [];
    let completedCount = 0;
    let failedCount = 0;
    let maxQueueDepth = 0;
    let totalTokens = 0;
    console.log(`\nStarting stress test: ${requestCount} requests`);
    console.log(`Mode: ${concurrent ? 'Concurrent' : 'Sequential'}`);
    console.log(`Rate limit: 5 RPM\n`);
    const requests = Array.from({ length: requestCount }, (_, i) => ({
        query: `Stress test query ${i + 1}: What is ${i + 1} + ${i + 1}?`,
        model: 'llama3.1-8B',
        maxTokens: 50,
    }));
    const updateStats = async () => {
        const stats = await client.getStats();
        maxQueueDepth = Math.max(maxQueueDepth, stats.queued);
        process.stdout.write(`\rQueue: ${stats.queued} | Running: ${stats.running} | Done: ${stats.done} | Failed: ${failedCount}`);
    };
    const statsInterval = setInterval(updateStats, 100);
    if (concurrent) {
        const promises = requests.map(async (req, i) => {
            const reqStart = Date.now();
            try {
                const response = await client.search(req);
                timestamps.push(Date.now() - reqStart);
                completedCount++;
                if (response.usage) {
                    totalTokens += response.usage.totalTokens;
                }
            }
            catch (error) {
                timestamps.push(Date.now() - reqStart);
                failedCount++;
            }
        });
        await Promise.all(promises);
    }
    else {
        for (let i = 0; i < requests.length; i++) {
            const reqStart = Date.now();
            try {
                const response = await client.search(requests[i]);
                timestamps.push(Date.now() - reqStart);
                completedCount++;
                if (response.usage) {
                    totalTokens += response.usage.totalTokens;
                }
            }
            catch (error) {
                timestamps.push(Date.now() - reqStart);
                failedCount++;
            }
            await updateStats();
        }
    }
    clearInterval(statsInterval);
    console.log('\n');
    const totalDuration = Date.now() - startTime;
    const finalStats = await client.getStats();
    return {
        timestamp: new Date().toISOString(),
        totalRequests: requestCount,
        completed: completedCount,
        failed: failedCount,
        rateLimited: finalStats.rateLimitedRequests,
        avgResponseTime: timestamps.length > 0
            ? timestamps.reduce((a, b) => a + b, 0) / timestamps.length
            : 0,
        minResponseTime: timestamps.length > 0 ? Math.min(...timestamps) : 0,
        maxResponseTime: timestamps.length > 0 ? Math.max(...timestamps) : 0,
        totalDuration,
        queueMaxDepth: maxQueueDepth,
        tokensUsed: totalTokens,
    };
}
async function main() {
    const client = new KivestClient({
        apiKey: API_KEY,
        requestsPerMinute: 5,
        maxRetries: 3,
    });
    console.log('=== Kivest MCP Server Stress Test ===\n');
    console.log('This test will:');
    console.log('1. Send multiple requests to exceed the 5 RPM limit');
    console.log('2. Measure queue behavior and requeue performance');
    console.log('3. Capture detailed timing and token usage statistics\n');
    const results = [];
    // Test 1: Sequential burst
    console.log('\n--- Test 1: Sequential Burst (10 requests) ---');
    results.push(await runStressTest(client, 10, false));
    // Wait for rate limit reset
    console.log('\nWaiting 60 seconds for rate limit reset...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    // Test 2: Concurrent burst
    console.log('\n--- Test 2: Concurrent Burst (10 requests) ---');
    results.push(await runStressTest(client, 10, true));
    // Test 3: High volume
    console.log('\nWaiting 60 seconds for rate limit reset...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    console.log('\n--- Test 3: High Volume (15 requests) ---');
    results.push(await runStressTest(client, 15, true));
    // Print summary
    console.log('\n\n=== Stress Test Summary ===\n');
    results.forEach((result, i) => {
        console.log(`Test ${i + 1}:`);
        console.log(`  Timestamp: ${result.timestamp}`);
        console.log(`  Total Requests: ${result.totalRequests}`);
        console.log(`  Completed: ${result.completed} (${((result.completed / result.totalRequests) * 100).toFixed(1)}%)`);
        console.log(`  Failed: ${result.failed}`);
        console.log(`  Rate Limited: ${result.rateLimited}`);
        console.log(`  Response Time: avg=${result.avgResponseTime.toFixed(0)}ms, min=${result.minResponseTime}ms, max=${result.maxResponseTime}ms`);
        console.log(`  Total Duration: ${(result.totalDuration / 1000).toFixed(1)}s`);
        console.log(`  Max Queue Depth: ${result.queueMaxDepth}`);
        console.log(`  Tokens Used: ${result.tokensUsed}`);
        console.log(`  Throughput: ${(result.completed / (result.totalDuration / 1000)).toFixed(2)} req/s`);
        console.log('');
    });
    console.log('=== Final Stats ===');
    console.log(JSON.stringify(client.getStats(), null, 2));
    client.destroy();
}
main().catch(error => {
    console.error('Stress test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=stress-test.js.map