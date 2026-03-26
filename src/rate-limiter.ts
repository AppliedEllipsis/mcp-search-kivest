/**
 * Token Bucket Rate Limiter with Request Queue
 * 
 * Implements a global rate limit of 5 requests per minute (RPM)
 * with automatic queuing and requeuing of requests when limit is hit.
 */

interface QueuedRequest<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  attempts: number;
  maxAttempts: number;
  priority: number;
}

interface RateLimiterConfig {
  /** Maximum number of requests per minute (default: 5) */
  requestsPerMinute: number;
  /** Maximum queue size (default: 100) */
  maxQueueSize: number;
  /** Maximum retry attempts for rate-limited requests (default: 3) */
  maxRetryAttempts: number;
  /** Base delay in ms before retrying (default: 1000) */
  retryDelayMs: number;
}

interface RateLimiterStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  rateLimited: number;
  tokensAvailable: number;
  lastRequestTime: Date | null;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private queue: QueuedRequest<unknown>[] = [];
  private tokens: number;
  private lastRefill: number;
  private processing = new Set<string>();
  private stats = {
    completed: 0,
    failed: 0,
    rateLimited: 0,
  };
  private refillInterval: ReturnType<typeof setInterval> | null = null;
  private processTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      requestsPerMinute: 5,
      maxQueueSize: 100,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      ...config,
    };

    // Initialize token bucket
    this.tokens = this.config.requestsPerMinute;
    this.lastRefill = Date.now();

    // Start token refill interval (every minute)
    this.refillInterval = setInterval(() => this.refillTokens(), 60000);

    // Start processing queue
    this.scheduleProcessing();
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: {
      priority?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<T> {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Check queue capacity
      if (this.queue.length >= this.config.maxQueueSize) {
        reject(new Error('Rate limiter queue is full'));
        return;
      }

      const request: QueuedRequest<T> = {
        id,
        execute: fn,
        resolve: resolve as (value: unknown) => void,
        reject: reject as (error: Error) => void,
        attempts: 0,
        maxAttempts: options.maxAttempts ?? this.config.maxRetryAttempts,
        priority: options.priority ?? 0,
      };

      // Add to queue (sorted by priority)
      this.insertByPriority(request as QueuedRequest<unknown>);
      
      // Trigger processing
      this.scheduleProcessing();
    });
  }

  /**
   * Get current statistics
   */
  getStats(): RateLimiterStats {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.stats.completed,
      failed: this.stats.failed,
      rateLimited: this.stats.rateLimited,
      tokensAvailable: Math.floor(this.tokens),
      lastRequestTime: this.lastRefill ? new Date(this.lastRefill) : null,
    };
  }

  /**
   * Check if we can make a request now
   */
  canExecute(): boolean {
    this.refillTokens();
    return this.tokens >= 1;
  }

  /**
   * Get estimated wait time in milliseconds
   */
  getEstimatedWaitTime(): number {
    if (this.canExecute()) return 0;
    
    const queuePosition = this.queue.length;
    const tokensNeeded = queuePosition + 1;
    const minutesNeeded = Math.ceil(tokensNeeded / this.config.requestsPerMinute);
    return minutesNeeded * 60000;
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
      this.processTimeout = null;
    }
    
    // Reject all pending requests
    const error = new Error('Rate limiter destroyed');
    for (const request of this.queue) {
      request.reject(error);
    }
    this.queue = [];
  }

  private insertByPriority(request: QueuedRequest<unknown>): void {
    // Insert maintaining priority order (higher priority first)
    const index = this.queue.findIndex(r => r.priority < request.priority);
    if (index === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(index, 0, request);
    }
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const minutesPassed = timePassed / 60000;
    
    if (minutesPassed >= 1) {
      const tokensToAdd = Math.floor(minutesPassed * this.config.requestsPerMinute);
      this.tokens = Math.min(
        this.config.requestsPerMinute,
        this.tokens + tokensToAdd
      );
      this.lastRefill = now;
    }
  }

  private scheduleProcessing(): void {
    if (this.processTimeout) return; // Already scheduled
    
    this.processTimeout = setTimeout(() => {
      this.processTimeout = null;
      this.processQueue();
    }, 0);
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    if (this.processing.size > 0) return; // Process one at a time for rate limit accuracy

    this.refillTokens();
    
    if (this.tokens < 1) {
      // No tokens available, schedule next check
      const timeUntilNextToken = 60000 / this.config.requestsPerMinute;
      this.processTimeout = setTimeout(() => {
        this.processTimeout = null;
        this.processQueue();
      }, timeUntilNextToken);
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.tokens--;
    this.processing.add(request.id);

    try {
      request.attempts++;
      const result = await request.execute();
      this.stats.completed++;
      request.resolve(result);
    } catch (error) {
      const isRateLimit = this.isRateLimitError(error);
      
      if (isRateLimit && request.attempts < request.maxAttempts) {
        // Requeue the request
        this.stats.rateLimited++;
        console.log(`[RateLimiter] Request ${request.id} rate limited, requeuing (attempt ${request.attempts}/${request.maxAttempts})`);
        
        // Wait before retrying
        await this.delay(this.config.retryDelayMs * request.attempts);
        
        // Re-insert into queue
        this.insertByPriority(request);
      } else {
        this.stats.failed++;
        request.reject(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.processing.delete(request.id);
      // Continue processing queue
      this.scheduleProcessing();
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429') ||
        message.includes('quota exceeded')
      );
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for global rate limiting
let globalRateLimiter: RateLimiter | null = null;

export function getGlobalRateLimiter(config?: Partial<RateLimiterConfig>): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(config);
  }
  return globalRateLimiter;
}

export function resetGlobalRateLimiter(): void {
  if (globalRateLimiter) {
    globalRateLimiter.destroy();
    globalRateLimiter = null;
  }
}

export type { RateLimiterConfig, RateLimiterStats };
