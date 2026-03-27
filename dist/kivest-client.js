import Bottleneck from 'bottleneck';
export class KivestClient {
    config;
    limiter;
    stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimitedRequests: 0,
    };
    pendingRetries = [];
    isProcessingRetries = false;
    constructor(config) {
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
    createLimiter() {
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
    setupRetryHandler() {
        this.limiter.on('failed', async (error, jobInfo) => {
            const retryCount = jobInfo.retryCount;
            if (retryCount >= 3) {
                return;
            }
            const errorMessage = error?.message || String(error);
            const isRateLimit = errorMessage.includes('429') ||
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
    startRetryProcessor() {
        setInterval(() => {
            this.processRetries();
        }, 1000);
    }
    async processRetries() {
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
                }
                catch (error) {
                    const errorMsg = error.message;
                    const isRateLimit = errorMsg.includes('429') ||
                        errorMsg.includes('rate limit');
                    if (isRateLimit && retry.retryCount < retry.maxRetries - 1) {
                        console.error(`[Kivest] Still rate limited, requeuing for later retry`);
                        this.pendingRetries.push({
                            ...retry,
                            retryCount: retry.retryCount + 1,
                        });
                    }
                    else {
                        console.error(`[Kivest] Max retries exceeded for job ${retry.jobId}`);
                        this.stats.failedRequests++;
                    }
                }
            }
        }
        finally {
            this.isProcessingRetries = false;
        }
    }
    async executeSearch(request, jobId) {
        const encodedQuery = encodeURIComponent(request.query);
        const response = await fetch(`${this.config.baseUrl}/ai?q=${encodedQuery}`, {
            method: 'GET',
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const data = await response.json();
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
    async search(request) {
        this.stats.totalRequests++;
        const jobId = this.generateJobId();
        const initialTime = Date.now();
        return this.limiter.schedule({ id: jobId }, async () => {
            try {
                const result = await this.executeSearch(request, jobId);
                this.stats.successfulRequests++;
                return result;
            }
            catch (error) {
                const errorMsg = error.message;
                const isRateLimit = errorMsg.includes('429') ||
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
    generateJobId() {
        return `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    async getStats() {
        return {
            queued: this.limiter.queued() + this.pendingRetries.length,
            running: await this.limiter.running(),
            done: await this.limiter.done(),
            failed: 0,
            ...this.stats,
            pendingRetries: this.pendingRetries.length,
        };
    }
    canExecute() {
        return this.limiter.queued() < 50;
    }
    getEstimatedWaitTime() {
        const queued = this.limiter.queued() + this.pendingRetries.length;
        if (queued === 0)
            return 0;
        return Math.ceil(queued / this.config.requestsPerMinute) * 60 * 1000;
    }
    destroy() {
        this.limiter.stop();
        this.pendingRetries = [];
    }
    async searchWithModel(query, model, options) {
        return this.search({
            query,
            model,
            ...options,
        });
    }
    async *searchStream(request) {
        this.stats.totalRequests++;
        const response = await fetch(`${this.config.baseUrl}/ai?q=${encodeURIComponent(request.query)}`, {
            method: 'GET',
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const data = await response.json();
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
    async batchSearch(requests, options) {
        const results = [];
        for (const request of requests) {
            try {
                const result = await this.search(request);
                results.push(result);
            }
            catch (error) {
                results.push(this.createErrorResponse(error));
            }
        }
        return results;
    }
    createErrorResponse(error) {
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
    async executeRequest(endpoint, jobId) {
        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
            method: 'GET',
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        return response.json();
    }
    async scheduleRequest(endpoint) {
        this.stats.totalRequests++;
        const jobId = this.generateJobId();
        const initialTime = Date.now();
        return this.limiter.schedule({ id: jobId }, async () => {
            try {
                const result = await this.executeRequest(endpoint, jobId);
                this.stats.successfulRequests++;
                return result;
            }
            catch (error) {
                const errorMsg = error.message;
                const isRateLimit = errorMsg.includes('429') ||
                    errorMsg.includes('rate limit') ||
                    errorMsg.includes('too many requests');
                if (isRateLimit) {
                    this.stats.rateLimitedRequests++;
                    console.error(`[Kivest] Rate limit hit for job ${jobId} - deferring to priority retry queue`);
                    this.pendingRetries.push({
                        request: { query: endpoint },
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
    async searchWeb(query) {
        const encodedQuery = encodeURIComponent(query);
        return this.scheduleRequest(`/search?q=${encodedQuery}`);
    }
    async searchImages(query) {
        const encodedQuery = encodeURIComponent(query);
        return this.scheduleRequest(`/images?q=${encodedQuery}`);
    }
    async searchVideos(query) {
        const encodedQuery = encodeURIComponent(query);
        return this.scheduleRequest(`/videos?q=${encodedQuery}`);
    }
    async searchNews(query) {
        const encodedQuery = encodeURIComponent(query);
        return this.scheduleRequest(`/news?q=${encodedQuery}`);
    }
    async scrapeWeb(url) {
        const encodedUrl = encodeURIComponent(url);
        return this.scheduleRequest(`/web?url=${encodedUrl}`);
    }
    async getUsage() {
        return this.scheduleRequest('/usage');
    }
}
//# sourceMappingURL=kivest-client.js.map