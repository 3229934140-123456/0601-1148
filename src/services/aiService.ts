import * as types from '../types';

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface AIProvider {
  readonly name: string;
  chat(messages: types.Message[], options?: ChatOptions): Promise<string>;
  streamChat(
    messages: types.Message[],
    options: ChatOptions | undefined,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string>;
}

export class OpenAIProvider implements AIProvider {
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: types.AIProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.defaultModel = config.model || 'gpt-3.5-turbo';
  }

  private buildMessages(messages: types.Message[], systemPrompt?: string): any[] {
    const result: any[] = [];
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
      result.push({ role: msg.role, content: msg.content });
    }
    return result;
  }

  async chat(messages: types.Message[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const body: any = {
      model,
      messages: this.buildMessages(messages, options?.systemPrompt),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: false,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  async streamChat(
    messages: types.Message[],
    options: ChatOptions | undefined,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string> {
    const model = options?.model || this.defaultModel;
    const body: any = {
      model,
      messages: this.buildMessages(messages, options?.systemPrompt),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: true,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            onChunk({ content: '', done: true });
            continue;
          }
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onChunk({ content, done: false });
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }
}

export class AnthropicProvider implements AIProvider {
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: types.AIProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.defaultModel = config.model || 'claude-3-sonnet-20240229';
  }

  private buildMessages(messages: types.Message[]): any[] {
    const result: any[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') continue;
      result.push({ role: msg.role, content: msg.content });
    }
    return result;
  }

  private getSystemPrompt(messages: types.Message[], systemPrompt?: string): string {
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemPrompt) {
      return systemMsg ? `${systemMsg.content}\n${systemPrompt}` : systemPrompt;
    }
    return systemMsg?.content || '';
  }

  async chat(messages: types.Message[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const systemPrompt = this.getSystemPrompt(messages, options?.systemPrompt);
    const body: any = {
      model,
      messages: this.buildMessages(messages),
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature,
      stream: false,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  async streamChat(
    messages: types.Message[],
    options: ChatOptions | undefined,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string> {
    const model = options?.model || this.defaultModel;
    const systemPrompt = this.getSystemPrompt(messages, options?.systemPrompt);
    const body: any = {
      model,
      messages: this.buildMessages(messages),
      max_tokens: options?.maxTokens || 1024,
      temperature: options?.temperature,
      stream: true,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) continue;
          if (!trimmed.startsWith('data:')) continue;
          
          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const content = data.delta.text || '';
              if (content) {
                fullContent += content;
                onChunk({ content, done: false });
              }
            } else if (data.type === 'message_stop') {
              onChunk({ content: '', done: true });
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }
}

export class OllamaProvider implements AIProvider {
  readonly name: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: types.AIProviderConfig) {
    this.name = config.name;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.defaultModel = config.model || 'llama2';
  }

  private buildPrompt(messages: types.Message[], systemPrompt?: string): string {
    let prompt = '';
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }
    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'Assistant' : msg.role === 'system' ? 'System' : 'User';
      prompt += `${role}: ${msg.content}\n`;
    }
    prompt += 'Assistant: ';
    return prompt;
  }

  async chat(messages: types.Message[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const body: any = {
      model,
      prompt: this.buildPrompt(messages, options?.systemPrompt),
      stream: false,
    };

    if (options?.temperature !== undefined) {
      body.options = { temperature: options.temperature };
    }

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  async streamChat(
    messages: types.Message[],
    options: ChatOptions | undefined,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string> {
    const model = options?.model || this.defaultModel;
    const body: any = {
      model,
      prompt: this.buildPrompt(messages, options?.systemPrompt),
      stream: true,
    };

    if (options?.temperature !== undefined) {
      body.options = { temperature: options.temperature };
    }

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            const content = data.response || '';
            if (content) {
              fullContent += content;
              onChunk({ content, done: false });
            }
            if (data.done) {
              onChunk({ content: '', done: true });
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();

  constructor(providerConfigs: types.AIProviderConfig[]) {
    for (const config of providerConfigs) {
      if (!config.enabled) continue;
      let provider: AIProvider | null = null;

      switch (config.type) {
        case 'openai':
          provider = new OpenAIProvider(config);
          break;
        case 'anthropic':
          provider = new AnthropicProvider(config);
          break;
        case 'ollama':
          provider = new OllamaProvider(config);
          break;
      }

      if (provider) {
        this.providers.set(config.name, provider);
      }
    }
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async chat(
    providerName: string,
    messages: types.Message[],
    options?: ChatOptions
  ): Promise<string> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider "${providerName}" not found or not enabled`);
    }
    return provider.chat(messages, options);
  }

  async streamChat(
    providerName: string,
    messages: types.Message[],
    options: ChatOptions | undefined,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<string> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider "${providerName}" not found or not enabled`);
    }
    return provider.streamChat(messages, options, onChunk);
  }
}
