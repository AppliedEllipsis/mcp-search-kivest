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
export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
}
export interface WebSearchResponse {
    success: boolean;
    type: 'search';
    query: string;
    results: WebSearchResult[];
}
export interface ImageResult {
    title: string;
    url: string;
    image_url: string;
    source: string;
    resolution: string;
}
export interface ImageSearchResponse {
    success: boolean;
    type: 'images';
    query: string;
    results: ImageResult[];
}
export interface VideoResult {
    title: string;
    url: string;
    thumbnail: string;
    source: string;
    duration: string;
}
export interface VideoSearchResponse {
    success: boolean;
    type: 'videos';
    query: string;
    results: VideoResult[];
}
export interface NewsResult {
    title: string;
    url: string;
    snippet: string;
    source: string;
    published_at: string;
}
export interface NewsSearchResponse {
    success: boolean;
    type: 'news';
    query: string;
    results: NewsResult[];
}
export interface WebScrapeResponse {
    success: boolean;
    type: 'web';
    url: string;
    content: string;
}
export interface UsageResponse {
    total: number;
    endpoints: {
        '/search': number;
        '/images': number;
        '/videos': number;
        '/news': number;
        '/web': number;
        [key: string]: number;
    };
}
export declare class KivestClient {
    private config;
    private limiter;
    private stats;
    private pendingRetries;
    private isProcessingRetries;
    constructor(config: KivestConfig);
    private createLimiter;
    private setupRetryHandler;
    private startRetryProcessor;
    private processRetries;
    private executeSearch;
    search(request: SearchRequest): Promise<SearchResponse>;
    private generateJobId;
    getStats(): Promise<KivestStats & typeof this.stats & {
        pendingRetries: number;
    }>;
    canExecute(): boolean;
    getEstimatedWaitTime(): number;
    destroy(): void;
    searchWithModel(query: string, model: string, options?: Omit<SearchRequest, 'query' | 'model'>): Promise<SearchResponse>;
    searchStream(request: SearchRequest): AsyncGenerator<StreamChunk, void, unknown>;
    batchSearch(requests: SearchRequest[], options?: {
        concurrency?: number;
    }): Promise<SearchResponse[]>;
    private createErrorResponse;
    private executeRequest;
    private scheduleRequest;
    searchWeb(query: string): Promise<WebSearchResponse>;
    searchImages(query: string): Promise<ImageSearchResponse>;
    searchVideos(query: string): Promise<VideoSearchResponse>;
    searchNews(query: string): Promise<NewsSearchResponse>;
    scrapeWeb(url: string): Promise<WebScrapeResponse>;
    getUsage(): Promise<UsageResponse>;
}
//# sourceMappingURL=kivest-client.d.ts.map