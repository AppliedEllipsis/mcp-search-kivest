/**
 * Comprehensive Test Suite for Kivest MCP Server
 * Tests all modes: individual, concurrent, stress, and celestial event queries
 */

import { KivestClient, SearchRequest } from './kivest-client.js';

const API_KEY = process.env.KIVEST_API_KEY || '';

interface TestResult {
  name: string;
  mode: 'individual' | 'concurrent' | 'stress' | 'celestial';
  passed: boolean;
  duration: number;
  error?: string;
  data?: any;
  timestamp: string;
}

class ComprehensiveTestRunner {
  private results: TestResult[] = [];
  private client: KivestClient;
  private testStartTime: number;

  constructor() {
    this.client = new KivestClient({
      apiKey: API_KEY,
      requestsPerMinute: 5,
      maxRetries: 3,
    });
    this.testStartTime = Date.now();
  }

  async runTest(
    name: string,
    mode: TestResult['mode'],
    fn: () => Promise<any>
  ): Promise<void> {
    const start = Date.now();
    try {
      const data = await fn();
      const duration = Date.now() - start;
      this.results.push({
        name,
        mode,
        passed: true,
        duration,
        data,
        timestamp: new Date().toISOString(),
      });
      console.log(`✓ [${mode.toUpperCase()}] ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({
        name,
        mode,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error) || 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      console.log(`✗ [${mode.toUpperCase()}] ${name} (${duration}ms) - ${error}`);
    }
  }

  // ============ INDIVIDUAL QUERY TESTS ============
  async runIndividualTests(): Promise<void> {
    console.log('\n=== INDIVIDUAL QUERY TESTS ===\n');

    const individualQueries: SearchRequest[] = [
      { query: 'What is machine learning?', model: 'llama3.1-8B', maxTokens: 100 },
      { query: 'Explain quantum computing in simple terms', model: 'llama3.1-8B', maxTokens: 150 },
      { query: 'What are the benefits of exercise?', model: 'gpt-5.1', maxTokens: 100 },
    ];

    for (let i = 0; i < individualQueries.length; i++) {
      await this.runTest(
        `Individual Query ${i + 1}: "${individualQueries[i].query.substring(0, 50)}..."`,
        'individual',
        async () => {
          const response = await this.client.search(individualQueries[i]);
          return {
            model: response.model,
            content: response.choices[0]?.message?.content?.substring(0, 100) + '...',
            tokens: response.usage,
            finishReason: response.choices[0]?.finishReason,
          };
        }
      );
    }

    // Get stats after individual tests
    const stats = await this.client.getStats();
    console.log('\nStats after individual tests:', JSON.stringify(stats, null, 2));
  }

  // ============ CONCURRENT QUERY TESTS ============
  async runConcurrentTests(): Promise<void> {
    console.log('\n=== CONCURRENT QUERY TESTS ===\n');

    const concurrentQueries: SearchRequest[] = [
      { query: 'What is the speed of light?', model: 'llama3.1-8B', maxTokens: 50 },
      { query: 'Who invented the telephone?', model: 'llama3.1-8B', maxTokens: 50 },
      { query: 'What is photosynthesis?', model: 'llama3.1-8B', maxTokens: 50 },
      { query: 'How does DNA work?', model: 'llama3.1-8B', maxTokens: 50 },
    ];

    await this.runTest(
      'Concurrent Batch - 4 queries simultaneously',
      'concurrent',
      async () => {
        const start = Date.now();
        const promises = concurrentQueries.map((req, idx) =>
          this.client.search(req).then(res => ({
            idx,
            model: res.model,
            content: res.choices[0]?.message?.content?.substring(0, 80) + '...',
            tokens: res.usage,
          }))
        );

        const results = await Promise.all(promises);
        const duration = Date.now() - start;

        return {
          totalQueries: concurrentQueries.length,
          completed: results.length,
          duration: `${duration}ms`,
          avgTimePerQuery: `${(duration / concurrentQueries.length).toFixed(0)}ms`,
          results: results,
        };
      }
    );

    // Test concurrent with mixed models
    await this.runTest(
      'Concurrent Mixed Models',
      'concurrent',
      async () => {
        const mixedQueries: SearchRequest[] = [
          { query: 'What is AI?', model: 'gpt-5.1', maxTokens: 50 },
          { query: 'What is AI?', model: 'llama3.1-8B', maxTokens: 50 },
          { query: 'What is AI?', model: 'deepseek-chat', maxTokens: 50 },
        ];

        const start = Date.now();
        const results = await Promise.all(
          mixedQueries.map(req =>
            this.client.search(req).then(res => ({
              requestedModel: req.model,
              returnedModel: res.model,
              content: res.choices[0]?.message?.content?.substring(0, 80) + '...',
            }))
          )
        );
        const duration = Date.now() - start;

        return {
          duration: `${duration}ms`,
          results,
        };
      }
    );
  }

  // ============ STRESS TESTS - EXCEED RPM ============
  async runStressTests(): Promise<void> {
    console.log('\n=== STRESS TESTS (Exceeding 5 RPM) ===\n');

    // Test 1: Sequential burst to queue up
    await this.runTest(
      'Stress Test 1: Sequential burst (8 queries to trigger queue)',
      'stress',
      async () => {
        const queries: SearchRequest[] = Array.from({ length: 8 }, (_, i) => ({
          query: `Stress test query ${i + 1}: What is ${i + 1} squared?`,
          model: 'llama3.1-8B',
          maxTokens: 30,
        }));

        const start = Date.now();
        const results = [];
        
        for (let i = 0; i < queries.length; i++) {
          console.log(`  Sending query ${i + 1}/8...`);
          const result = await this.client.search(queries[i]);
          results.push({
            idx: i,
            success: result.id !== 'error',
            content: result.choices[0]?.message?.content?.substring(0, 50) + '...',
          });
        }

        const duration = Date.now() - start;
        const stats = await this.client.getStats();

        return {
          totalQueries: queries.length,
          completed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          duration: `${duration}ms`,
          avgTimePerQuery: `${(duration / queries.length).toFixed(0)}ms`,
          rateLimitedCount: stats.rateLimitedRequests,
          queueBehavior: duration > 60000 ? 'Queuing occurred ( > 60s )' : 'Fast responses',
          finalStats: stats,
        };
      }
    );

    // Test 2: Concurrent burst to overwhelm queue
    await this.runTest(
      'Stress Test 2: Concurrent burst (12 simultaneous queries)',
      'stress',
      async () => {
        const queries: SearchRequest[] = Array.from({ length: 12 }, (_, i) => ({
          query: `Concurrent burst ${i + 1}`,
          model: 'llama3.1-8B',
          maxTokens: 20,
        }));

        const start = Date.now();
        console.log('  Sending 12 concurrent queries...');
        
        const promises = queries.map((req, idx) =>
          this.client.search(req).then(res => ({
            idx,
            success: res.id !== 'error',
            model: res.model,
          })).catch(err => ({
            idx,
            success: false,
            error: err.message,
          }))
        );

        const results = await Promise.all(promises);
        const duration = Date.now() - start;
        const stats = await this.client.getStats();

        return {
          totalQueries: queries.length,
          completed: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          duration: `${duration}ms`,
          expectedMinTime: '60-120s (due to 5 RPM limit)',
          rateLimitedCount: stats.rateLimitedRequests,
          queueStats: {
            queued: stats.queued,
            running: stats.running,
            done: stats.done,
          },
        };
      }
    );

    // Test 3: Monitor queue behavior
    await this.runTest(
      'Stress Test 3: Queue behavior monitoring',
      'stress',
      async () => {
        const queries: SearchRequest[] = Array.from({ length: 6 }, (_, i) => ({
          query: `Queue monitor ${i + 1}`,
          model: 'llama3.1-8B',
          maxTokens: 20,
        }));

        const queueSnapshots: any[] = [];
        const start = Date.now();

        // Send all queries rapidly
        const promises = queries.map(async (req, idx) => {
          const stats = await this.client.getStats();
          queueSnapshots.push({
            beforeQuery: idx,
            queued: stats.queued,
            running: stats.running,
            done: stats.done,
            timestamp: Date.now() - start,
          });
          
          return this.client.search(req);
        });

        await Promise.all(promises);
        const duration = Date.now() - start;
        const finalStats = await this.client.getStats();

        return {
          totalQueries: queries.length,
          duration: `${duration}ms`,
          queueSnapshots: queueSnapshots.slice(0, 5),
          finalStats,
          conclusion: duration > 60000 
            ? 'Queue successfully managed requests over time' 
            : 'Requests processed quickly',
        };
      }
    );
  }

  // ============ CELESTIAL EVENTS QUERIES ============
  async runCelestialTests(): Promise<void> {
    console.log('\n=== CELESTIAL EVENTS SEARCH ===\n');

    const celestialQueries = [
      {
        name: 'Meteor Showers 2025-2026',
        query: 'What are the upcoming meteor showers in 2025 and 2026? Include dates and best viewing times.',
        model: 'gpt-5.1',
        maxTokens: 300,
      },
      {
        name: 'Solar and Lunar Eclipses',
        query: 'When are the next solar and lunar eclipses visible from Earth in 2025 and 2026?',
        model: 'gpt-5.1',
        maxTokens: 300,
      },
      {
        name: 'Planetary Conjunctions',
        query: 'What planetary conjunctions and alignments are happening in the next 12 months?',
        model: 'llama3.1-8B',
        maxTokens: 250,
      },
      {
        name: 'Space Missions 2025',
        query: 'What major space missions are scheduled for 2025? Include NASA, SpaceX, and international missions.',
        model: 'deepseek-chat',
        maxTokens: 300,
      },
      {
        name: 'Asteroid Approaches',
        query: 'Are there any notable near-Earth asteroid approaches expected in 2025?',
        model: 'llama3.1-8B',
        maxTokens: 200,
      },
    ];

    const celestialResults: any[] = [];

    for (const query of celestialQueries) {
      await this.runTest(
        `Celestial: ${query.name}`,
        'celestial',
        async () => {
          const response = await this.client.search({
            query: query.query,
            model: query.model,
            maxTokens: query.maxTokens,
          });

          const result = {
            topic: query.name,
            model: response.model,
            content: response.choices[0]?.message?.content,
            tokens: response.usage,
          };

          celestialResults.push(result);
          return result;
        }
      );
    }

    // Print summary of celestial findings
    console.log('\n=== CELESTIAL EVENTS SUMMARY ===\n');
    celestialResults.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.topic}`);
      console.log(`   Model: ${result.model}`);
      console.log(`   Content Preview: ${result.content?.substring(0, 200)}...`);
      console.log(`   Tokens: ${JSON.stringify(result.tokens)}`);
      console.log('');
    });
  }

  // ============ FINAL REPORT ============
  async generateReport(): Promise<void> {
    const totalDuration = Date.now() - this.testStartTime;
    
    console.log('\n\n========================================');
    console.log('COMPREHENSIVE TEST REPORT');
    console.log('========================================\n');

    // Group results by mode
    const byMode = this.results.reduce((acc, result) => {
      if (!acc[result.mode]) acc[result.mode] = [];
      acc[result.mode].push(result);
      return acc;
    }, {} as Record<string, TestResult[]>);

    // Summary by mode
    Object.entries(byMode).forEach(([mode, results]) => {
      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;
      console.log(`${mode.toUpperCase()} TESTS: ${passed} passed, ${failed} failed (${results.length} total)`);
    });

    console.log('\n--- OVERALL STATISTICS ---');
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`Total Duration: ${(totalDuration/1000).toFixed(1)}s`);

    // Final rate limiter stats
    const finalStats = await this.client.getStats();
    console.log('\n--- FINAL RATE LIMITER STATS ---');
    console.log(JSON.stringify(finalStats, null, 2));

    // Failed tests details
    if (failed > 0) {
      console.log('\n--- FAILED TESTS ---');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`\n[${r.mode}] ${r.name}`);
          console.log(`  Error: ${r.error}`);
          console.log(`  Duration: ${r.duration}ms`);
        });
    }

    console.log('\n========================================');
    console.log('END OF REPORT');
    console.log('========================================\n');

    this.client.destroy();
  }

  async runNewEndpointTests(): Promise<void> {
    console.log('\n=== NEW ENDPOINT TESTS ===\n');

    await this.runTest(
      'Web Search - Basic query',
      'individual',
      async () => {
        const response = await this.client.searchWeb('TypeScript programming');
        return {
          success: response.success,
          type: response.type,
          query: response.query,
          resultCount: response.results?.length || 0,
          firstResult: response.results?.[0] || null,
        };
      }
    );

    await this.runTest(
      'Image Search - Find cat images',
      'individual',
      async () => {
        const response = await this.client.searchImages('cute cats');
        return {
          success: response.success,
          type: response.type,
          query: response.query,
          resultCount: response.results?.length || 0,
          firstResult: response.results?.[0] || null,
        };
      }
    );

    await this.runTest(
      'Video Search - Find tutorials',
      'individual',
      async () => {
        const response = await this.client.searchVideos('JavaScript tutorial');
        return {
          success: response.success,
          type: response.type,
          query: response.query,
          resultCount: response.results?.length || 0,
          firstResult: response.results?.[0] || null,
        };
      }
    );

    await this.runTest(
      'News Search - Current events',
      'individual',
      async () => {
        const response = await this.client.searchNews('artificial intelligence');
        return {
          success: response.success,
          type: response.type,
          query: response.query,
          resultCount: response.results?.length || 0,
          firstResult: response.results?.[0] || null,
        };
      }
    );

    await this.runTest(
      'Web Scrape - Extract markdown',
      'individual',
      async () => {
        const response = await this.client.scrapeWeb('https://example.com');
        return {
          success: response.success,
          type: response.type,
          url: response.url,
          contentLength: response.content?.length || 0,
          contentPreview: response.content?.substring(0, 200) + '...' || '',
        };
      }
    );

    await this.runTest(
      'Usage Statistics',
      'individual',
      async () => {
        const response = await this.client.getUsage();
        return {
          total: response.total,
          endpoints: response.endpoints,
        };
      }
    );

    await this.runTest(
      'Concurrent New Endpoints',
      'concurrent',
      async () => {
        const start = Date.now();
        const promises = [
          this.client.searchWeb('concurrent test 1'),
          this.client.searchImages('concurrent test 2'),
          this.client.searchVideos('concurrent test 3'),
        ];

        const results = await Promise.all(promises);
        const duration = Date.now() - start;

        return {
          duration: `${duration}ms`,
          results: results.map((r, i) => ({
            index: i,
            type: r.type,
            success: r.success,
          })),
        };
      }
    );
  }

  // Run all tests
  async runAll(): Promise<void> {
    console.log('Starting Comprehensive Test Suite...');
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log(`API Key: ${API_KEY ? 'Configured' : 'Not configured (optional)'}`);

    await this.runIndividualTests();
    await this.runConcurrentTests();
    await this.runStressTests();
    await this.runCelestialTests();
    await this.runNewEndpointTests();
    await this.generateReport();
  }
}

// Run tests
const runner = new ComprehensiveTestRunner();
runner.runAll().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
