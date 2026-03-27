/**
 * Test suite for Kivest MCP Server
 * Tests endpoints, payloads, and stress tests rate limiting
 */

import { KivestClient, SearchRequest } from './kivest-client.js';

const API_KEY = process.env.KIVEST_API_KEY || '';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  data?: any;
}

class TestRunner {
  private results: TestResult[] = [];
  private client: KivestClient;

  constructor() {
    this.client = new KivestClient({
      apiKey: API_KEY,
      requestsPerMinute: 5,
      maxRetries: 3,
    });
  }

  async runTest(name: string, fn: () => Promise<any>): Promise<void> {
    const start = Date.now();
    try {
      const data = await fn();
      const duration = Date.now() - start;
      this.results.push({ name, passed: true, duration, data });
      console.log(`✓ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      this.results.push({
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error) || 'Unknown error',
      });
      console.log(`✗ ${name} (${duration}ms) - ${error}`);
    }
  }

  async testEndpoint(): Promise<void> {
    await this.runTest('Endpoint Test - Basic Search', async () => {
      const request: SearchRequest = {
        query: 'What is the capital of France?',
        model: 'llama3.1-8B',
        maxTokens: 100,
      };
      
      const response = await this.client.search(request);
      
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No choices in response');
      }
      
      if (!response.choices[0].message.content) {
        throw new Error('No content in response');
      }
      
      return {
        model: response.model,
        content: response.choices[0].message.content.substring(0, 100),
        tokens: response.usage,
      };
    });
  }

  async testPayloads(): Promise<void> {
    const payloads: SearchRequest[] = [
      { query: 'Simple query', model: 'llama3.1-8B' },
      { query: 'Query with options', model: 'llama3.1-8B', maxTokens: 50, temperature: 0.5 },
      { query: 'Query with top_p', model: 'llama3.1-8B', topP: 0.8 },
    ];

    for (let i = 0; i < payloads.length; i++) {
      await this.runTest(`Payload Test ${i + 1}`, async () => {
        const response = await this.client.search(payloads[i]);
        return {
          model: response.model,
          contentLength: response.choices[0]?.message?.content?.length || 0,
        };
      });
    }
  }

  async testModels(): Promise<void> {
    const models = ['gpt-5.1', 'llama3.1-8B'];
    
    for (const model of models) {
      await this.runTest(`Model Test - ${model}`, async () => {
        const response = await this.client.searchWithModel(
          'Say "Hello"',
          model,
          { maxTokens: 50 }
        );
        return {
          requestedModel: model,
          returnedModel: response.model,
          content: response.choices[0]?.message?.content?.substring(0, 50),
        };
      });
    }
  }

  async testRateLimiting(): Promise<void> {
    await this.runTest('Rate Limit Test - Sequential Requests', async () => {
      const start = Date.now();
      const requests: SearchRequest[] = [
        { query: 'Request 1', model: 'llama3.1-8B', maxTokens: 20 },
        { query: 'Request 2', model: 'llama3.1-8B', maxTokens: 20 },
        { query: 'Request 3', model: 'llama3.1-8B', maxTokens: 20 },
      ];

      const results = await this.client.batchSearch(requests);
      const duration = Date.now() - start;
      
      const successCount = results.filter(r => r.id !== 'error').length;
      const stats = await this.client.getStats();
      
      return {
        totalRequests: requests.length,
        successful: successCount,
        duration: `${duration}ms`,
        rateLimited: results.filter(r => r.id === 'error').length,
      };
    });
  }

  async stressTest(): Promise<void> {
    await this.runTest('Stress Test - 10 Rapid Requests', async () => {
      const start = Date.now();
      const requests: SearchRequest[] = Array.from({ length: 10 }, (_, i) => ({
        query: `Stress test query ${i + 1}`,
        model: 'llama3.1-8B',
        maxTokens: 30,
      }));

      const results = await this.client.batchSearch(requests);
      const duration = Date.now() - start;
      
      const stats = await this.client.getStats();
      
      return {
        totalRequests: requests.length,
        successful: results.filter(r => r.id !== 'error').length,
        failed: results.filter(r => r.id === 'error').length,
        duration: `${duration}ms`,
        avgTimePerRequest: `${(duration / requests.length).toFixed(0)}ms`,
        queueStats: {
          queued: stats.queued,
          running: stats.running,
          done: stats.done,
        },
      };
    });
  }

  async testRequeue(): Promise<void> {
    await this.runTest('Requeue Test - Exceed Rate Limit', async () => {
      const start = Date.now();
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < 7; i++) {
        promises.push(
          this.client.search({
            query: `Requeue test ${i + 1}`,
            model: 'llama3.1-8B',
            maxTokens: 20,
          })
        );
      }
      
      const results = await Promise.all(promises);
      const duration = Date.now() - start;
      
      const stats = await this.client.getStats()
      
      return {
        totalRequests: 7,
        completed: results.filter(r => r.id !== 'error').length,
        failed: results.filter(r => r.id === 'error').length,
        duration: `${duration}ms`,
        stats,
      };
    });
  }

  async testStats(): Promise<void> {
    await this.runTest('Stats Test - Get Rate Limiter Stats', async () => {
      const stats = await this.client.getStats();
      
      return {
        queued: stats.queued,
        running: stats.running,
        done: stats.done,
        totalRequests: stats.totalRequests,
        successful: stats.successfulRequests,
        failed: stats.failedRequests,
        rateLimited: stats.rateLimitedRequests,
      };
    });
  }

  async runAllTests(): Promise<void> {
    console.log('\n=== Kivest MCP Server Test Suite ===\n');
    
    console.log('--- Basic Tests ---');
    await this.testEndpoint();
    await this.testPayloads();
    await this.testModels();
    await this.testStats();
    
    console.log('\n--- Rate Limiting Tests ---');
    await this.testRateLimiting();
    await this.testRequeue();
    
    console.log('\n--- Stress Tests ---');
    await this.stressTest();
    
    this.printSummary();
  }

  printSummary(): void {
    console.log('\n=== Test Summary ===\n');
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
    
    console.log('\n--- Detailed Results ---');
    this.results.forEach(r => {
      console.log(`\n${r.name}:`);
      console.log(`  Status: ${r.passed ? 'PASSED' : 'FAILED'}`);
      console.log(`  Duration: ${r.duration}ms`);
      if (r.data) {
        console.log(`  Data: ${JSON.stringify(r.data, null, 2)}`);
      }
      if (r.error) {
        console.log(`  Error: ${r.error}`);
      }
    });
    
    const finalStats = this.client.getStats();
    console.log('\n=== Final Rate Limiter Stats ===');
    console.log(JSON.stringify(finalStats, null, 2));
    
    this.client.destroy();
  }
}

const runner = new TestRunner();
runner.runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
