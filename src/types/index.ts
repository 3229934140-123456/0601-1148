export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  rating?: number;
  hallucinations?: HallucinationPoint[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  promptId?: string;
  sampleId?: string;
}

export interface PromptVersion {
  id: string;
  version: number;
  content: string;
  createdAt: number;
  note?: string;
}

export interface Prompt {
  id: string;
  name: string;
  description?: string;
  versions: PromptVersion[];
  currentVersion: number;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

export interface SampleInput {
  id: string;
  name: string;
  content: string;
  variables?: Record<string, string>;
  createdAt: number;
  promptId?: string;
}

export interface Variable {
  id: string;
  name: string;
  defaultValue?: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  options?: string[];
}

export interface CompareResult {
  id: string;
  promptId: string;
  sampleId?: string;
  responses: CompareResponse[];
  createdAt: number;
}

export interface CompareResponse {
  id: string;
  model: string;
  provider: string;
  content: string;
  rating?: number;
  hallucinations?: HallucinationPoint[];
  duration?: number;
  tokens?: number;
}

export interface HallucinationPoint {
  id: string;
  text: string;
  reason?: string;
  position?: {
    start: number;
    end: number;
  };
}

export interface ReviewReport {
  id: string;
  promptId: string;
  responseId: string;
  rewriteSuggestions?: string[];
  acceptanceCriteria?: string[];
  qualityScore?: number;
  createdAt: number;
}

export interface Snippet {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: number;
  usageCount: number;
}

export interface FavoriteItem {
  id: string;
  type: 'prompt' | 'sample' | 'snippet' | 'conversation';
  targetId: string;
  name: string;
  note?: string;
  createdAt: number;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
}

export interface AISettings {
  defaultModel: string;
  defaultProvider: string;
  temperature: number;
  maxTokens?: number;
}

export interface AIProviderConfig {
  type: 'openai' | 'anthropic' | 'ollama' | 'custom';
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

export interface AppSettings {
  dataDirectory: string;
  forbiddenWords: string[];
  maxHistoryPerPrompt: number;
  ai: AISettings;
  providers: AIProviderConfig[];
}

export type ViewType = 'chat' | 'prompts' | 'samples' | 'compare' | 'variables' | 'review' | 'favorites';
