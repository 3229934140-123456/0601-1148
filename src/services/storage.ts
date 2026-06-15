import * as vscode from 'vscode';
import * as types from '../types';

const DEFAULT_DATA_DIR = '.ai-studio';
const PROMPTS_FILE = 'prompts.json';
const SAMPLES_FILE = 'samples.json';
const VARIABLES_FILE = 'variables.json';
const CONVERSATIONS_DIR = 'conversations';
const COMPARE_RESULTS_FILE = 'compare-results.json';
const REVIEW_REPORTS_FILE = 'review-reports.json';
const SNIPPETS_FILE = 'snippets.json';
const FAVORITES_FILE = 'favorites.json';

export class StorageService {
  private dataDirUri: vscode.Uri | null = null;

  constructor() {
    this.initializeDataDirectory();
  }

  private initializeDataDirectory(): void {
    const config = vscode.workspace.getConfiguration('aiStudio');
    const customDir = config.get<string>('dataDirectory', '');

    if (customDir) {
      this.dataDirUri = vscode.Uri.file(customDir);
    } else {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        this.dataDirUri = vscode.Uri.joinPath(workspaceFolders[0].uri, DEFAULT_DATA_DIR);
      }
    }
  }

  private async ensureDataDir(): Promise<vscode.Uri> {
    if (!this.dataDirUri) {
      throw new Error('数据目录未初始化，请打开工作区或配置数据目录');
    }

    try {
      await vscode.workspace.fs.stat(this.dataDirUri);
    } catch {
      await vscode.workspace.fs.createDirectory(this.dataDirUri);
    }

    return this.dataDirUri;
  }

  private async ensureDir(dirUri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.stat(dirUri);
    } catch {
      await vscode.workspace.fs.createDirectory(dirUri);
    }
  }

  private async readJsonFile<T>(fileName: string, defaultValue: T): Promise<T> {
    const dataDir = await this.ensureDataDir();
    const fileUri = vscode.Uri.joinPath(dataDir, fileName);

    try {
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = Buffer.from(content).toString('utf-8');
      return JSON.parse(text) as T;
    } catch {
      return defaultValue;
    }
  }

  private async writeJsonFile<T>(fileName: string, data: T): Promise<void> {
    const dataDir = await this.ensureDataDir();
    const fileUri = vscode.Uri.joinPath(dataDir, fileName);
    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(fileUri, content);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getMaxHistoryPerPrompt(): number {
    const config = vscode.workspace.getConfiguration('aiStudio');
    return config.get<number>('maxHistoryPerPrompt', 20);
  }

  async getPrompts(): Promise<types.Prompt[]> {
    return this.readJsonFile<types.Prompt[]>(PROMPTS_FILE, []);
  }

  async getPromptById(id: string): Promise<types.Prompt | undefined> {
    const prompts = await this.getPrompts();
    return prompts.find(p => p.id === id);
  }

  async createPrompt(prompt: Omit<types.Prompt, 'id' | 'createdAt' | 'updatedAt' | 'versions' | 'currentVersion'>): Promise<types.Prompt> {
    const prompts = await this.getPrompts();
    const now = Date.now();
    const newPrompt: types.Prompt = {
      ...prompt,
      id: this.generateId(),
      versions: [],
      currentVersion: 0,
      createdAt: now,
      updatedAt: now
    };
    prompts.push(newPrompt);
    await this.writeJsonFile(PROMPTS_FILE, prompts);
    return newPrompt;
  }

  async updatePrompt(id: string, updates: Partial<Omit<types.Prompt, 'id' | 'createdAt' | 'versions'>>): Promise<types.Prompt | undefined> {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(p => p.id === id);
    if (index === -1) {
      return undefined;
    }

    prompts[index] = {
      ...prompts[index],
      ...updates,
      updatedAt: Date.now()
    };

    await this.writeJsonFile(PROMPTS_FILE, prompts);
    return prompts[index];
  }

  async deletePrompt(id: string): Promise<boolean> {
    const prompts = await this.getPrompts();
    const filtered = prompts.filter(p => p.id !== id);
    if (filtered.length === prompts.length) {
      return false;
    }
    await this.writeJsonFile(PROMPTS_FILE, filtered);
    return true;
  }

  async addPromptVersion(promptId: string, content: string, note?: string): Promise<types.PromptVersion | undefined> {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(p => p.id === promptId);
    if (index === -1) {
      return undefined;
    }

    const prompt = prompts[index];
    const newVersion: types.PromptVersion = {
      id: this.generateId(),
      version: prompt.versions.length + 1,
      content,
      createdAt: Date.now(),
      note
    };

    prompt.versions.push(newVersion);
    prompt.currentVersion = newVersion.version;
    prompt.updatedAt = Date.now();

    const maxVersions = this.getMaxHistoryPerPrompt();
    if (prompt.versions.length > maxVersions) {
      prompt.versions = prompt.versions.slice(-maxVersions);
    }

    prompts[index] = prompt;
    await this.writeJsonFile(PROMPTS_FILE, prompts);
    return newVersion;
  }

  async rollbackPromptVersion(promptId: string, versionId: string): Promise<types.Prompt | undefined> {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(p => p.id === promptId);
    if (index === -1) {
      return undefined;
    }

    const prompt = prompts[index];
    const targetVersion = prompt.versions.find(v => v.id === versionId);
    if (!targetVersion) {
      return undefined;
    }

    prompt.currentVersion = targetVersion.version;
    prompt.updatedAt = Date.now();
    prompts[index] = prompt;

    await this.writeJsonFile(PROMPTS_FILE, prompts);
    return prompt;
  }

  async getPromptVersions(promptId: string): Promise<types.PromptVersion[]> {
    const prompt = await this.getPromptById(promptId);
    return prompt?.versions || [];
  }

  async getCurrentPromptVersion(promptId: string): Promise<types.PromptVersion | undefined> {
    const prompt = await this.getPromptById(promptId);
    if (!prompt) {
      return undefined;
    }
    return prompt.versions.find(v => v.version === prompt.currentVersion);
  }

  async getSamples(): Promise<types.SampleInput[]> {
    return this.readJsonFile<types.SampleInput[]>(SAMPLES_FILE, []);
  }

  async getSampleById(id: string): Promise<types.SampleInput | undefined> {
    const samples = await this.getSamples();
    return samples.find(s => s.id === id);
  }

  async getSamplesByPromptId(promptId: string): Promise<types.SampleInput[]> {
    const samples = await this.getSamples();
    return samples.filter(s => s.promptId === promptId);
  }

  async createSample(sample: Omit<types.SampleInput, 'id' | 'createdAt'>): Promise<types.SampleInput> {
    const samples = await this.getSamples();
    const newSample: types.SampleInput = {
      ...sample,
      id: this.generateId(),
      createdAt: Date.now()
    };
    samples.push(newSample);
    await this.writeJsonFile(SAMPLES_FILE, samples);
    return newSample;
  }

  async updateSample(id: string, updates: Partial<Omit<types.SampleInput, 'id' | 'createdAt'>>): Promise<types.SampleInput | undefined> {
    const samples = await this.getSamples();
    const index = samples.findIndex(s => s.id === id);
    if (index === -1) {
      return undefined;
    }

    samples[index] = {
      ...samples[index],
      ...updates
    };

    await this.writeJsonFile(SAMPLES_FILE, samples);
    return samples[index];
  }

  async deleteSample(id: string): Promise<boolean> {
    const samples = await this.getSamples();
    const filtered = samples.filter(s => s.id !== id);
    if (filtered.length === samples.length) {
      return false;
    }
    await this.writeJsonFile(SAMPLES_FILE, filtered);
    return true;
  }

  async getVariables(): Promise<types.Variable[]> {
    return this.readJsonFile<types.Variable[]>(VARIABLES_FILE, []);
  }

  async getVariableById(id: string): Promise<types.Variable | undefined> {
    const variables = await this.getVariables();
    return variables.find(v => v.id === id);
  }

  async createVariable(variable: Omit<types.Variable, 'id'>): Promise<types.Variable> {
    const variables = await this.getVariables();
    const newVariable: types.Variable = {
      ...variable,
      id: this.generateId()
    };
    variables.push(newVariable);
    await this.writeJsonFile(VARIABLES_FILE, variables);
    return newVariable;
  }

  async updateVariable(id: string, updates: Partial<Omit<types.Variable, 'id'>>): Promise<types.Variable | undefined> {
    const variables = await this.getVariables();
    const index = variables.findIndex(v => v.id === id);
    if (index === -1) {
      return undefined;
    }

    variables[index] = {
      ...variables[index],
      ...updates
    };

    await this.writeJsonFile(VARIABLES_FILE, variables);
    return variables[index];
  }

  async deleteVariable(id: string): Promise<boolean> {
    const variables = await this.getVariables();
    const filtered = variables.filter(v => v.id !== id);
    if (filtered.length === variables.length) {
      return false;
    }
    await this.writeJsonFile(VARIABLES_FILE, filtered);
    return true;
  }

  private async getConversationsDir(): Promise<vscode.Uri> {
    const dataDir = await this.ensureDataDir();
    const convDir = vscode.Uri.joinPath(dataDir, CONVERSATIONS_DIR);
    await this.ensureDir(convDir);
    return convDir;
  }

  private getConversationFileName(id: string): string {
    return `${id}.json`;
  }

  async getConversations(): Promise<types.Conversation[]> {
    try {
      const convDir = await this.getConversationsDir();
      const files = await vscode.workspace.fs.readDirectory(convDir);
      const conversations: types.Conversation[] = [];

      for (const [name, type] of files) {
        if (type === vscode.FileType.File && name.endsWith('.json')) {
          try {
            const fileUri = vscode.Uri.joinPath(convDir, name);
            const content = await vscode.workspace.fs.readFile(fileUri);
            const text = Buffer.from(content).toString('utf-8');
            const conv = JSON.parse(text) as types.Conversation;
            conversations.push(conv);
          } catch {
            // skip invalid files
          }
        }
      }

      conversations.sort((a, b) => b.updatedAt - a.updatedAt);
      return conversations;
    } catch {
      return [];
    }
  }

  async getConversationById(id: string): Promise<types.Conversation | undefined> {
    try {
      const convDir = await this.getConversationsDir();
      const fileUri = vscode.Uri.joinPath(convDir, this.getConversationFileName(id));
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = Buffer.from(content).toString('utf-8');
      return JSON.parse(text) as types.Conversation;
    } catch {
      return undefined;
    }
  }

  async createConversation(conversation: Omit<types.Conversation, 'id' | 'createdAt' | 'updatedAt' | 'messages'>): Promise<types.Conversation> {
    const now = Date.now();
    const newConv: types.Conversation = {
      ...conversation,
      id: this.generateId(),
      messages: [],
      createdAt: now,
      updatedAt: now
    };

    const convDir = await this.getConversationsDir();
    const fileUri = vscode.Uri.joinPath(convDir, this.getConversationFileName(newConv.id));
    const content = Buffer.from(JSON.stringify(newConv, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(fileUri, content);

    return newConv;
  }

  async updateConversation(id: string, updates: Partial<Omit<types.Conversation, 'id' | 'createdAt'>>): Promise<types.Conversation | undefined> {
    const conv = await this.getConversationById(id);
    if (!conv) {
      return undefined;
    }

    const updated: types.Conversation = {
      ...conv,
      ...updates,
      updatedAt: Date.now()
    };

    const convDir = await this.getConversationsDir();
    const fileUri = vscode.Uri.joinPath(convDir, this.getConversationFileName(id));
    const content = Buffer.from(JSON.stringify(updated, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(fileUri, content);

    return updated;
  }

  async addMessage(conversationId: string, message: Omit<types.Message, 'id' | 'timestamp'>): Promise<types.Message | undefined> {
    const conv = await this.getConversationById(conversationId);
    if (!conv) {
      return undefined;
    }

    const newMessage: types.Message = {
      ...message,
      id: this.generateId(),
      timestamp: Date.now()
    };

    conv.messages.push(newMessage);
    conv.updatedAt = Date.now();

    const convDir = await this.getConversationsDir();
    const fileUri = vscode.Uri.joinPath(convDir, this.getConversationFileName(conversationId));
    const content = Buffer.from(JSON.stringify(conv, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(fileUri, content);

    return newMessage;
  }

  async deleteConversation(id: string): Promise<boolean> {
    try {
      const convDir = await this.getConversationsDir();
      const fileUri = vscode.Uri.joinPath(convDir, this.getConversationFileName(id));
      await vscode.workspace.fs.delete(fileUri);
      return true;
    } catch {
      return false;
    }
  }

  async getCompareResults(): Promise<types.CompareResult[]> {
    return this.readJsonFile<types.CompareResult[]>(COMPARE_RESULTS_FILE, []);
  }

  async getCompareResultById(id: string): Promise<types.CompareResult | undefined> {
    const results = await this.getCompareResults();
    return results.find(r => r.id === id);
  }

  async getCompareResultsByPromptId(promptId: string): Promise<types.CompareResult[]> {
    const results = await this.getCompareResults();
    return results.filter(r => r.promptId === promptId);
  }

  async createCompareResult(result: Omit<types.CompareResult, 'id' | 'createdAt'>): Promise<types.CompareResult> {
    const results = await this.getCompareResults();
    const newResult: types.CompareResult = {
      ...result,
      id: this.generateId(),
      createdAt: Date.now()
    };
    results.push(newResult);
    await this.writeJsonFile(COMPARE_RESULTS_FILE, results);
    return newResult;
  }

  async updateCompareResult(id: string, updates: Partial<Omit<types.CompareResult, 'id' | 'createdAt'>>): Promise<types.CompareResult | undefined> {
    const results = await this.getCompareResults();
    const index = results.findIndex(r => r.id === id);
    if (index === -1) {
      return undefined;
    }

    results[index] = {
      ...results[index],
      ...updates
    };

    await this.writeJsonFile(COMPARE_RESULTS_FILE, results);
    return results[index];
  }

  async deleteCompareResult(id: string): Promise<boolean> {
    const results = await this.getCompareResults();
    const filtered = results.filter(r => r.id !== id);
    if (filtered.length === results.length) {
      return false;
    }
    await this.writeJsonFile(COMPARE_RESULTS_FILE, filtered);
    return true;
  }

  async getReviewReports(): Promise<types.ReviewReport[]> {
    return this.readJsonFile<types.ReviewReport[]>(REVIEW_REPORTS_FILE, []);
  }

  async getReviewReportById(id: string): Promise<types.ReviewReport | undefined> {
    const reports = await this.getReviewReports();
    return reports.find(r => r.id === id);
  }

  async getReviewReportsByPromptId(promptId: string): Promise<types.ReviewReport[]> {
    const reports = await this.getReviewReports();
    return reports.filter(r => r.promptId === promptId);
  }

  async createReviewReport(report: Omit<types.ReviewReport, 'id' | 'createdAt'>): Promise<types.ReviewReport> {
    const reports = await this.getReviewReports();
    const newReport: types.ReviewReport = {
      ...report,
      id: this.generateId(),
      createdAt: Date.now()
    };
    reports.push(newReport);
    await this.writeJsonFile(REVIEW_REPORTS_FILE, reports);
    return newReport;
  }

  async updateReviewReport(id: string, updates: Partial<Omit<types.ReviewReport, 'id' | 'createdAt'>>): Promise<types.ReviewReport | undefined> {
    const reports = await this.getReviewReports();
    const index = reports.findIndex(r => r.id === id);
    if (index === -1) {
      return undefined;
    }

    reports[index] = {
      ...reports[index],
      ...updates
    };

    await this.writeJsonFile(REVIEW_REPORTS_FILE, reports);
    return reports[index];
  }

  async deleteReviewReport(id: string): Promise<boolean> {
    const reports = await this.getReviewReports();
    const filtered = reports.filter(r => r.id !== id);
    if (filtered.length === reports.length) {
      return false;
    }
    await this.writeJsonFile(REVIEW_REPORTS_FILE, filtered);
    return true;
  }

  async getSnippets(): Promise<types.Snippet[]> {
    return this.readJsonFile<types.Snippet[]>(SNIPPETS_FILE, []);
  }

  async getSnippetById(id: string): Promise<types.Snippet | undefined> {
    const snippets = await this.getSnippets();
    return snippets.find(s => s.id === id);
  }

  async getSnippetsByCategory(category: string): Promise<types.Snippet[]> {
    const snippets = await this.getSnippets();
    return snippets.filter(s => s.category === category);
  }

  async getSnippetCategories(): Promise<string[]> {
    const snippets = await this.getSnippets();
    const categories = new Set(snippets.map(s => s.category));
    return Array.from(categories);
  }

  async createSnippet(snippet: Omit<types.Snippet, 'id' | 'createdAt' | 'usageCount'>): Promise<types.Snippet> {
    const snippets = await this.getSnippets();
    const newSnippet: types.Snippet = {
      ...snippet,
      id: this.generateId(),
      createdAt: Date.now(),
      usageCount: 0
    };
    snippets.push(newSnippet);
    await this.writeJsonFile(SNIPPETS_FILE, snippets);
    return newSnippet;
  }

  async updateSnippet(id: string, updates: Partial<Omit<types.Snippet, 'id' | 'createdAt'>>): Promise<types.Snippet | undefined> {
    const snippets = await this.getSnippets();
    const index = snippets.findIndex(s => s.id === id);
    if (index === -1) {
      return undefined;
    }

    snippets[index] = {
      ...snippets[index],
      ...updates
    };

    await this.writeJsonFile(SNIPPETS_FILE, snippets);
    return snippets[index];
  }

  async incrementSnippetUsage(id: string): Promise<types.Snippet | undefined> {
    const snippets = await this.getSnippets();
    const index = snippets.findIndex(s => s.id === id);
    if (index === -1) {
      return undefined;
    }

    snippets[index].usageCount += 1;
    await this.writeJsonFile(SNIPPETS_FILE, snippets);
    return snippets[index];
  }

  async deleteSnippet(id: string): Promise<boolean> {
    const snippets = await this.getSnippets();
    const filtered = snippets.filter(s => s.id !== id);
    if (filtered.length === snippets.length) {
      return false;
    }
    await this.writeJsonFile(SNIPPETS_FILE, filtered);
    return true;
  }

  async getFavorites(): Promise<types.FavoriteItem[]> {
    return this.readJsonFile<types.FavoriteItem[]>(FAVORITES_FILE, []);
  }

  async getFavoriteById(id: string): Promise<types.FavoriteItem | undefined> {
    const favorites = await this.getFavorites();
    return favorites.find(f => f.id === id);
  }

  async getFavoritesByType(type: types.FavoriteItem['type']): Promise<types.FavoriteItem[]> {
    const favorites = await this.getFavorites();
    return favorites.filter(f => f.type === type);
  }

  async isFavorited(type: types.FavoriteItem['type'], targetId: string): Promise<boolean> {
    const favorites = await this.getFavorites();
    return favorites.some(f => f.type === type && f.targetId === targetId);
  }

  async createFavorite(favorite: Omit<types.FavoriteItem, 'id' | 'createdAt'>): Promise<types.FavoriteItem> {
    const favorites = await this.getFavorites();
    const existing = favorites.find(f => f.type === favorite.type && f.targetId === favorite.targetId);
    if (existing) {
      return existing;
    }

    const newFavorite: types.FavoriteItem = {
      ...favorite,
      id: this.generateId(),
      createdAt: Date.now()
    };
    favorites.push(newFavorite);
    await this.writeJsonFile(FAVORITES_FILE, favorites);
    return newFavorite;
  }

  async updateFavorite(id: string, updates: Partial<Omit<types.FavoriteItem, 'id' | 'createdAt' | 'type' | 'targetId'>>): Promise<types.FavoriteItem | undefined> {
    const favorites = await this.getFavorites();
    const index = favorites.findIndex(f => f.id === id);
    if (index === -1) {
      return undefined;
    }

    favorites[index] = {
      ...favorites[index],
      ...updates
    };

    await this.writeJsonFile(FAVORITES_FILE, favorites);
    return favorites[index];
  }

  async deleteFavorite(id: string): Promise<boolean> {
    const favorites = await this.getFavorites();
    const filtered = favorites.filter(f => f.id !== id);
    if (filtered.length === favorites.length) {
      return false;
    }
    await this.writeJsonFile(FAVORITES_FILE, filtered);
    return true;
  }

  async removeFavoriteByTarget(type: types.FavoriteItem['type'], targetId: string): Promise<boolean> {
    const favorites = await this.getFavorites();
    const filtered = favorites.filter(f => !(f.type === type && f.targetId === targetId));
    if (filtered.length === favorites.length) {
      return false;
    }
    await this.writeJsonFile(FAVORITES_FILE, filtered);
    return true;
  }

  async getDataDirectory(): Promise<string | null> {
    if (!this.dataDirUri) {
      return null;
    }
    return this.dataDirUri.fsPath;
  }

  refreshDataDirectory(): void {
    this.initializeDataDirectory();
  }
}
