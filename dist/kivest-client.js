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
    isInCooldown = false;
    cooldownEndTime = 0;
    cooldownDelay = 0;
    constructor(config) {
        this.config = {
            apiKey: config.apiKey,
            baseUrl: config.baseUrl || 'https://se.ezif.in',
            requestsPerMinute: config.requestsPerMinute || 5,
            maxRetries: config.maxRetries || 3,
        };
        this.limiter = this.createLimiter();
        this.setupRetryHandler();
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
            if (retryCount >= this.config.maxRetries) {
                return;
            }
            const errorMessage = error?.message || String(error);
            const isRateLimit = errorMessage.includes('429') ||
                errorMessage.includes('rate limit') ||
                errorMessage.includes('too many requests');
            if (isRateLimit) {
                this.stats.rateLimitedRequests++;
                // Enter cooldown mode with random 1-10 second delay
                const cooldownMs = Math.floor(Math.random() * 9000) + 1000; // 1-10 seconds
                this.isInCooldown = true;
                this.cooldownDelay = cooldownMs;
                this.cooldownEndTime = Date.now() + cooldownMs;
                console.error(`[Kivest] Rate limit detected for provider "Kivest" - entering cooldown for ${cooldownMs}ms`);
                console.error(`[Kivest] Queue paused. Will resume at position 5 after cooldown.`);
                // Return the cooldown delay to requeue at position 5
                return cooldownMs;
            }
            console.error(`[Kivest] Request failed (attempt ${retryCount + 1}), retrying...`);
            return Math.pow(2, retryCount) * 1000;
        });
        this.limiter.on('retry', (error, jobInfo) => {
            console.error(`[Kivest] Retrying job ${jobInfo.options.id} (attempt ${jobInfo.retryCount + 1}) after cooldown`);
            // Check if we're exiting cooldown
            if (this.isInCooldown && Date.now() >= this.cooldownEndTime) {
                this.isInCooldown = false;
                console.error(`[Kivest] Cooldown complete - resuming normal queue processing`);
            }
        });
    }
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.config.apiKey && this.config.apiKey.length > 0) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        return headers;
    }
    generateJobId() {
        return `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    async search(request) {
        this.stats.totalRequests++;
        return this.limiter.schedule({ id: this.generateJobId() }, async () => {
            const encodedQuery = encodeURIComponent(request.query);
            const response = await fetch(`${this.config.baseUrl}/ai?q=${encodedQuery}`, {
                method: 'GET',
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            this.stats.successfulRequests++;
            return this.transformSimpleResponse(data.answer || data, request.model || 'gpt-5.1');
        });
    }
    async *searchStream(request) {
        this.stats.totalRequests++;
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                model: request.model || 'gpt-5.1',
                messages: [
                    { role: 'user', content: request.query }
                ],
                stream: true,
                max_tokens: request.maxTokens ?? 1024,
                temperature: request.temperature ?? 0.7,
                top_p: request.topP ?? 0.9,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        if (!response.body) {
            throw new Error('No response body for stream');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]')
                        continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            if (json.choices) {
                                this.stats.successfulRequests++;
                                yield json;
                            }
                        }
                        catch (e) {
                            console.error('[Kivest] Failed to parse stream chunk:', e);
                        }
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    async searchWithModel(query, model, options) {
        return this.search({
            query,
            model,
            ...options,
        });
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
    async getStats() {
        return {
            queued: this.limiter.queued(),
            running: await this.limiter.running(),
            done: await this.limiter.done(),
            failed: 0,
            ...this.stats,
        };
    }
    canExecute() {
        return this.limiter.queued() < 50;
    }
    getEstimatedWaitTime() {
        const queued = this.limiter.queued();
        if (queued === 0)
            return 0;
        return Math.ceil(queued / this.config.requestsPerMinute) * 60 * 1000;
    }
    destroy() {
        this.limiter.stop();
    }
    transformResponse(data) {
        return {
            id: data.id,
            object: data.object,
            created: data.created,
            model: data.model,
            choices: data.choices.map((choice) => ({
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
    transformSimpleResponse(text, model) {
        return {
            id: `search-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: text,
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
}
//# sourceMappingURL=kivest-client.js.map