/**
 * Token Bucket Rate Limiter with Request Queue
 *
 * Implements a global rate limit of 5 requests per minute (RPM)
 * with automatic queuing and requeuing of requests when limit is hit.
 */
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
export declare class RateLimiter {
    private config;
    private queue;
    private tokens;
    private lastRefill;
    private processing;
    private stats;
    private refillInterval;
    private processTimeout;
    constructor(config?: Partial<RateLimiterConfig>);
    /**
     * Execute a function with rate limiting
     */
    execute<T>(fn: () => Promise<T>, options?: {
        priority?: number;
        maxAttempts?: number;
    }): Promise<T>;
    /**
     * Get current statistics
     */
    getStats(): RateLimiterStats;
    /**
     * Check if we can make a request now
     */
    canExecute(): boolean;
    /**
     * Get estimated wait time in milliseconds
     */
    getEstimatedWaitTime(): number;
    /**
     * Destroy the rate limiter and clean up resources
     */
    destroy(): void;
    private insertByPriority;
    private refillTokens;
    private scheduleProcessing;
    private processQueue;
    private isRateLimitError;
    private delay;
}
export declare function getGlobalRateLimiter(config?: Partial<RateLimiterConfig>): RateLimiter;
export declare function resetGlobalRateLimiter(): void;
export type { RateLimiterConfig, RateLimiterStats };
//# sourceMappingURL=rate-limiter.d.ts.map