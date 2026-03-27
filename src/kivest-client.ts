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

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finishReason: string | null;
  }>;
}

export interface KivestStats {
  queued: number;
  running: number;
  done: number;
  failed: number;
}

interface PendingRetry {
  request: SearchRequest;
  initialTime: number;
  retryCount: number;
  maxRetries: number;
  jobId: string;
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
  private pendingRetries: PendingRetry[] = [];
  private isProcessingRetries = false;

  constructor(config: KivestConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://se.ezif.in',
      requestsPerMinute: config.requestsPerMinute || 5,
      maxRetries: config.maxRetries || 10,
    };

    this.limiter = this.createLimiter();
    this.setupRetryHandler();
    this.startRetryProcessor();
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
      
      if (retryCount >= 3) {
        return;
      }

      const errorMessage = error?.message || String(error);
      const isRateLimit = 
        errorMessage.includes('429') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests');

      if (isRateLimit) {
        this.stats.rateLimitedRequests++;
        console.error(`[Kivest] Rate limit detected - deferring to retry queue with priority based on initial time`);
        return 0;
      }

      console.error(`[Kivest] Request failed (attempt ${retryCount + 1}), retrying...`);
      return Math.pow(2, retryCount) * 1000;
    });
  }

  private startRetryProcessor(): void {
    setInterval(() => {
      this.processRetries();
    }, 1000);
  }

  private async processRetries(): Promise<void> {
    if (this.isProcessingRetries || this.pendingRetries.length === 0) {
      return;
    }

    this.isProcessingRetries = true;

    try {
      const now = Date.now();
      
      const readyRetries = this.pendingRetries.filter(pr => {
        const delay = Math.floor(Math.random() * 9000) + 1000;
        return now >= pr.initialTime + (pr.retryCount * delay);
      });

      readyRetries.sort((a, b) => a.initialTime - b.initialTime);

      for (const retry of readyRetries.slice(0, 5)) {
        const index = this.pendingRetries.indexOf(retry);
        if (index > -1) {
          this.pendingRetries.splice(index, 1);
        }

        console.error(`[Kivest] Processing retry for job ${retry.jobId} (attempt ${retry.retryCount + 1}/${retry.maxRetries})`);

        try {
          const result = await this.executeSearch(retry.request, retry.jobId);
          this.stats.successfulRequests++;
          console.error(`[Kivest] Retry succeeded for job ${retry.jobId}`);
        } catch (error) {
          const errorMsg = (error as Error).message;
          const isRateLimit = 
            errorMsg.includes('429') ||
            errorMsg.includes('rate limit');

          if (isRateLimit && retry.retryCount < retry.maxRetries - 1) {
            console.error(`[Kivest] Still rate limited, requeuing for later retry`);
            this.pendingRetries.push({
              ...retry,
              retryCount: retry.retryCount + 1,
            });
          } else {
            console.error(`[Kivest] Max retries exceeded for job ${retry.jobId}`);
            this.stats.failedRequests++;
          }
        }
      }
    } finally {
      this.isProcessingRetries = false;
    }
  }

  private async executeSearch(request: SearchRequest, jobId: string): Promise<SearchResponse> {
    const encodedQuery = encodeURIComponent(request.query);
    const response = await fetch(`${this.config.baseUrl}/ai?q=${encodedQuery}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    
    return {
      id: jobId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model || 'kivest-search',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.answer || String(data),
        },
        finishReason: 'stop',
      }],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    this.stats.totalRequests++;
    const jobId = this.generateJobId();
    const initialTime = Date.now();

    return this.limiter.schedule({ id: jobId }, async () => {
      try {
        const result = await this.executeSearch(request, jobId);
        this.stats.successfulRequests++;
        return result;
      } catch (error) {
        const errorMsg = (error as Error).message;
        const isRateLimit = 
          errorMsg.includes('429') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('too many requests');

        if (isRateLimit) {
          this.stats.rateLimitedRequests++;
          console.error(`[Kivest] Rate limit hit for job ${jobId} - deferring to priority retry queue`);
          
          this.pendingRetries.push({
            request,
            initialTime,
            retryCount: 0,
            maxRetries: 10,
            jobId,
          });

          throw error;
        }

        this.stats.failedRequests++;
        throw error;
      }
    });
  }

  private generateJobId(): string {
    return `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async getStats(): Promise<KivestStats & typeof this.stats & { pendingRetries: number }> {
    return {
      queued: this.limiter.queued() + this.pendingRetries.length,
      running: await this.limiter.running(),
      done: await this.limiter.done(),
      failed: 0,
      ...this.stats,
      pendingRetries: this.pendingRetries.length,
    };
  }

  canExecute(): boolean {
    return this.limiter.queued() < 50;
  }

  getEstimatedWaitTime(): number {
    const queued = this.limiter.queued() + this.pendingRetries.length;
    if (queued === 0) return 0;
    return Math.ceil(queued / this.config.requestsPerMinute) * 60 * 1000;
  }

  destroy(): void {
    this.limiter.stop();
    this.pendingRetries = [];
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

  async *searchStream(request: SearchRequest): AsyncGenerator<StreamChunk, void, unknown> {
    this.stats.totalRequests++;

    const response = await fetch(`${this.config.baseUrl}/ai?q=${encodeURIComponent(request.query)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    this.stats.successfulRequests++;

    yield {
      id: this.generateJobId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: request.model || 'kivest-search',
      choices: [{
        index: 0,
        delta: {
          role: 'assistant',
          content: data.answer || String(data),
        },
        finishReason: null,
      }],
    };

    yield {
      id: this.generateJobId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: request.model || 'kivest-search',
      choices: [{
        index: 0,
        delta: {},
        finishReason: 'stop',
      }],
    };
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
