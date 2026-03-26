/**
 * Kivest AI Search API Client with Rate Limiting
 * 
 * Wraps the Kivest AI Search API with intelligent rate limiting
 * and automatic request queuing/requeuing.
 */

import Bottleneck from 'bottleneck';

export interface KivestConfig {
  apiKey: string;
  baseUrl?: string;
  requestsPerMinute?: number;
  maxRetries?: number;
}

export interface SearchRequest {
  query: string;
  model?: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface SearchResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finishReason: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface KivestStats {
  queued: number;
  running: number;
  done: number;
  failed: number;
}

export class KivestClient {
  private config: Required<KivestConfig>;
  private limiter: Bottleneck;
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
  };

  constructor(config: KivestConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://ai.ezif.in/v1',
      requestsPerMinute: config.requestsPerMinute || 5,
      maxRetries: config.maxRetries || 3,
    };

    this.limiter = this.createLimiter();
    this.setupRetryHandler();
  }

  private createLimiter(): Bottleneck {
    return new Bottleneck({
      maxConcurrent: 1,
      minTime: 12000,
      reservoir: this.config.requestsPerMinute,
      reservoirRefreshAmount: this.config.requestsPerMinute,
      reservoirRefreshInterval: 60 * 1000,
      highWater: 50,
      strategy: Bottleneck.strategy.OVERFLOW,
    });
  }

  private setupRetryHandler(): void {
    this.limiter.on('failed', async (error, jobInfo) => {
      const retryCount = jobInfo.retryCount;
      
      if (retryCount >= this.config.maxRetries) {
        return;
      }

      const errorMessage = error?.message || String(error);
      const isRateLimit = 
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests');

      if (isRateLimit) {
        this.stats.rateLimitedRequests++;
        console.log(`[Kivest] Rate limited (attempt ${retryCount + 1}), requeuing...`);
        return 15000;
      }

      console.log(`[Kivest] Request failed (attempt ${retryCount + 1}), retrying...`);
      return Math.pow(2, retryCount) * 1000;
    });

    this.limiter.on('retry', (error, jobInfo) => {
      console.log(`[Kivest] Retrying job ${jobInfo.options.id} (attempt ${jobInfo.retryCount + 1})`);
    });
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    this.stats.totalRequests++;

    return this.limiter.schedule({ id: `search-${Date.now()}` }, async () => {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model || 'gpt-5.1',
          messages: [
            { role: 'user', content: request.query }
          ],
          stream: request.stream ?? false,
          max_tokens: request.maxTokens ?? 1024,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 0.9,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      this.stats.successfulRequests++;
      
      return this.transformResponse(data);
    });
  }

  async searchWithModel(
    query: string,
    model: string,
    options?: Omit<SearchRequest, 'query' | 'model'>
  ): Promise<SearchResponse> {
    return this.search({
      query,
      model,
      ...options,
    });
  }

  async batchSearch(
    requests: SearchRequest[],
    options?: { concurrency?: number }
  ): Promise<SearchResponse[]> {
    const results: SearchResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.search(request);
        results.push(result);
      } catch (error) {
        results.push(this.createErrorResponse(error));
      }
    }
    
    return results;
  }

  getStats(): KivestStats & typeof this.stats {
    return {
      queued: this.limiter.queued(),
      running: this.limiter.running(),
      done: this.limiter.done(),
      failed: this.limiter.jobStatus(this.limiter.DONE).failed || 0,
      ...this.stats,
    };
  }

  canExecute(): boolean {
    return this.limiter.queued() < 50;
  }

  getEstimatedWaitTime(): number {
    const queued = this.limiter.queued();
    if (queued === 0) return 0;
    return Math.ceil(queued / this.config.requestsPerMinute) * 60 * 1000;
  }

  destroy(): void {
    this.limiter.stop();
  }

  private transformResponse(data: any): SearchResponse {
    return {
      id: data.id,
      object: data.object,
      created: data.created,
      model: data.model,
      choices: data.choices.map((choice: any) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content,
        },
        finishReason: choice.finish_reason,
      })),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  private createErrorResponse(error: unknown): SearchResponse {
    this.stats.failedRequests++;
    return {
      id: 'error',
      object: 'error',
      created: Date.now(),
      model: 'error',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
        finishReason: 'error',
      }],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}
