#!/usr/bin/env node

/**
 * Kivest AI Search MCP Server
 * 
 * An MCP server that provides AI-powered search capabilities
 * using the Kivest AI Search API with intelligent rate limiting.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { KivestClient, SearchRequest } from './kivest-client.js';

const API_KEY = process.env.KIVEST_API_KEY;

if (!API_KEY) {
  console.error('[Kivest] Warning: KIVEST_API_KEY not set. Some features may be limited.');
  console.error('[Kivest] Get your free API key at: https://ai.ezif.in/api-key');
}

const client = new KivestClient({
  apiKey: API_KEY || '',
  requestsPerMinute: 5,
  maxRetries: 3,
});

const SEARCH_TOOL: Tool = {
  name: 'kivest_search',
  description: `
Search the web using Kivest AI Search API. Supports multiple AI models including GPT-5.1 and LLaMA 3.1 8B.
Rate limited to 5 requests per minute with automatic queuing and retry.

Models:
- gpt-5.1: Fast, high-quality results (4 RPM limit)
- llama3.1-8B: Unlimited requests, open source
- deepseek-chat: Good balance (8 RPM limit)
- qwen3.5-plus: Latest Qwen model (8 RPM limit)

Best for: Current events, factual queries, general knowledge.
  `.trim(),
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query or question',
      },
      model: {
        type: 'string',
        description: 'AI model to use (default: gpt-5.1)',
        enum: [
          'gpt-5.1',
          'llama3.1-8B',
          'deepseek-chat',
          'qwen3.5-plus',
          'claude-sonnet-4.6',
          'gemini-3-flash-preview',
          'kimi-k2.5',
        ],
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum tokens in response (default: 1024)',
      },
      temperature: {
        type: 'number',
        description: 'Temperature for response randomness 0-2 (default: 0.7)',
      },
    },
    required: ['query'],
  },
};

const STREAMING_SEARCH_TOOL: Tool = {
  name: 'kivest_search_stream',
  description: `
Search the web using Kivest AI Search API with streaming response. 
Returns response tokens as they are generated for real-time feedback.
Supports the same models as kivest_search.
  `.trim(),
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query or question',
      },
      model: {
        type: 'string',
        description: 'AI model to use (default: gpt-5.1)',
        enum: [
          'gpt-5.1',
          'llama3.1-8B',
          'deepseek-chat',
          'qwen3.5-plus',
          'claude-sonnet-4.6',
          'gemini-3-flash-preview',
          'kimi-k2.5',
        ],
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum tokens in response (default: 1024)',
      },
      temperature: {
        type: 'number',
        description: 'Temperature for response randomness 0-2 (default: 0.7)',
      },
    },
    required: ['query'],
  },
};

const STATS_TOOL: Tool = {
  name: 'kivest_stats',
  description: 'Get current rate limiter statistics including queue size and token availability',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const MODELS_TOOL: Tool = {
  name: 'kivest_models',
  description: 'List available AI models and their rate limits',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

const server = new Server(
  {
    name: 'kivest-search-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [SEARCH_TOOL, STREAMING_SEARCH_TOOL, STATS_TOOL, MODELS_TOOL],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'kivest_search': {
        if (!args || typeof args.query !== 'string') {
          throw new Error('Missing required parameter: query');
        }
        const searchRequest: SearchRequest = {
          query: args.query,
          model: typeof args.model === 'string' ? args.model : 'gpt-5.1',
          maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : 1024,
          temperature: typeof args.temperature === 'number' ? args.temperature : 0.7,
          stream: false,
        };

        console.error(`[MCP] Executing search: ${searchRequest.query}`);
        const response = await client.search(searchRequest);
        
        const result = {
          content: response.choices[0]?.message?.content || 'No response',
          model: response.model,
          tokens: response.usage,
          finishReason: response.choices[0]?.finishReason,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'kivest_stats': {
        const stats = await client.getStats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      case 'kivest_search_stream': {
        if (!args || typeof args.query !== 'string') {
          throw new Error('Missing required parameter: query');
        }
        const streamRequest: SearchRequest = {
          query: args.query,
          model: typeof args.model === 'string' ? args.model : 'gpt-5.1',
          maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : 1024,
          temperature: typeof args.temperature === 'number' ? args.temperature : 0.7,
          stream: true,
        };

        console.error(`[MCP] Executing streaming search: ${streamRequest.query}`);
        
        const chunks: string[] = [];
        for await (const chunk of client.searchStream(streamRequest)) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            chunks.push(content);
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: chunks.join(''),
            },
          ],
        };
      }

      case 'kivest_models': {
        const models = [
          { name: 'gpt-5.1', rpm: 4, description: 'Fast, high-quality results' },
          { name: 'llama3.1-8B', rpm: 'Unlimited', description: 'Open source, no rate limit' },
          { name: 'deepseek-chat', rpm: 8, description: 'Balanced speed and quality' },
          { name: 'qwen3.5-plus', rpm: 8, description: 'Latest Qwen model' },
          { name: 'claude-sonnet-4.6', rpm: 1, description: 'Anthropic\'s latest' },
          { name: 'gemini-3-flash-preview', rpm: 1, description: 'Google\'s fast model' },
          { name: 'kimi-k2.5', rpm: 2, description: 'Moonshot AI model' },
        ];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(models, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[MCP] Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  
  console.error('Kivest AI Search MCP Server starting...');
  console.error('Rate limit: 5 requests per minute');
  console.error('Requests will be queued when limit is reached');
  
  await server.connect(transport);
  
  console.error('Kivest AI Search MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  client.destroy();
  process.exit(1);
});

process.on('SIGINT', () => {
  console.error('\nShutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  client.destroy();
  process.exit(0);
});
