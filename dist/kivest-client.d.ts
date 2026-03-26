/**
 * Kivest AI Search API Client with Rate Limiting
 *
 * Wraps the Kivest AI Search API with intelligent rate limiting
 * and automatic request queuing/requeuing.
 */
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
export declare class KivestClient {
    private config;
    private limiter;
    private stats;
    constructor(config: KivestConfig);
    private createLimiter;
    private setupRetryHandler;
    search(request: SearchRequest): Promise<SearchResponse>;
    searchWithModel(query: string, model: string, options?: Omit<SearchRequest, 'query' | 'model'>): Promise<SearchResponse>;
    batchSearch(requests: SearchRequest[], options?: {
        concurrency?: number;
    }): Promise<SearchResponse[]>;
    getStats(): KivestStats & typeof this.stats;
    canExecute(): boolean;
    getEstimatedWaitTime(): number;
    destroy(): void;
    private transformResponse;
    private createErrorResponse;
}
//# sourceMappingURL=kivest-client.d.ts.map