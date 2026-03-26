/**
 * Token Bucket Rate Limiter with Request Queue
 *
 * Implements a global rate limit of 5 requests per minute (RPM)
 * with automatic queuing and requeuing of requests when limit is hit.
 */
export class RateLimiter {
    config;
    queue = [];
    tokens;
    lastRefill;
    processing = new Set();
    stats = {
        completed: 0,
        failed: 0,
        rateLimited: 0,
    };
    refillInterval = null;
    processTimeout = null;
    constructor(config = {}) {
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
    async execute(fn, options = {}) {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return new Promise((resolve, reject) => {
            // Check queue capacity
            if (this.queue.length >= this.config.maxQueueSize) {
                reject(new Error('Rate limiter queue is full'));
                return;
            }
            const request = {
                id,
                execute: fn,
                resolve: resolve,
                reject: reject,
                attempts: 0,
                maxAttempts: options.maxAttempts ?? this.config.maxRetryAttempts,
                priority: options.priority ?? 0,
            };
            // Add to queue (sorted by priority)
            this.insertByPriority(request);
            // Trigger processing
            this.scheduleProcessing();
        });
    }
    /**
     * Get current statistics
     */
    getStats() {
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
    canExecute() {
        this.refillTokens();
        return this.tokens >= 1;
    }
    /**
     * Get estimated wait time in milliseconds
     */
    getEstimatedWaitTime() {
        if (this.canExecute())
            return 0;
        const queuePosition = this.queue.length;
        const tokensNeeded = queuePosition + 1;
        const minutesNeeded = Math.ceil(tokensNeeded / this.config.requestsPerMinute);
        return minutesNeeded * 60000;
    }
    /**
     * Destroy the rate limiter and clean up resources
     */
    destroy() {
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
    insertByPriority(request) {
        // Insert maintaining priority order (higher priority first)
        const index = this.queue.findIndex(r => r.priority < request.priority);
        if (index === -1) {
            this.queue.push(request);
        }
        else {
            this.queue.splice(index, 0, request);
        }
    }
    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const minutesPassed = timePassed / 60000;
        if (minutesPassed >= 1) {
            const tokensToAdd = Math.floor(minutesPassed * this.config.requestsPerMinute);
            this.tokens = Math.min(this.config.requestsPerMinute, this.tokens + tokensToAdd);
            this.lastRefill = now;
        }
    }
    scheduleProcessing() {
        if (this.processTimeout)
            return; // Already scheduled
        this.processTimeout = setTimeout(() => {
            this.processTimeout = null;
            this.processQueue();
        }, 0);
    }
    async processQueue() {
        if (this.queue.length === 0)
            return;
        if (this.processing.size > 0)
            return; // Process one at a time for rate limit accuracy
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
        if (!request)
            return;
        this.tokens--;
        this.processing.add(request.id);
        try {
            request.attempts++;
            const result = await request.execute();
            this.stats.completed++;
            request.resolve(result);
        }
        catch (error) {
            const isRateLimit = this.isRateLimitError(error);
            if (isRateLimit && request.attempts < request.maxAttempts) {
                // Requeue the request
                this.stats.rateLimited++;
                console.log(`[RateLimiter] Request ${request.id} rate limited, requeuing (attempt ${request.attempts}/${request.maxAttempts})`);
                // Wait before retrying
                await this.delay(this.config.retryDelayMs * request.attempts);
                // Re-insert into queue
                this.insertByPriority(request);
            }
            else {
                this.stats.failed++;
                request.reject(error instanceof Error ? error : new Error(String(error)));
            }
        }
        finally {
            this.processing.delete(request.id);
            // Continue processing queue
            this.scheduleProcessing();
        }
    }
    isRateLimitError(error) {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (message.includes('rate limit') ||
                message.includes('too many requests') ||
                message.includes('429') ||
                message.includes('quota exceeded'));
        }
        return false;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Singleton instance for global rate limiting
let globalRateLimiter = null;
export function getGlobalRateLimiter(config) {
    if (!globalRateLimiter) {
        globalRateLimiter = new RateLimiter(config);
    }
    return globalRateLimiter;
}
export function resetGlobalRateLimiter() {
    if (globalRateLimiter) {
        globalRateLimiter.destroy();
        globalRateLimiter = null;
    }
}
//# sourceMappingURL=rate-limiter.js.map