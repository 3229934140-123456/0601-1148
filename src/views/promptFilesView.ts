import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';

type PromptTreeItem = PromptGroupItem | PromptItem | PromptVersionItem;

interface PromptGroupItem {
  type: 'group';
  tag: string;
  prompts: types.Prompt[];
}

interface PromptItem {
  type: 'prompt';
  prompt: types.Prompt;
}

interface PromptVersionItem {
  type: 'version';
  promptId: string;
  version: types.PromptVersion;
  isCurrent: boolean;
}

export class PromptFilesProvider implements vscode.TreeDataProvider<PromptTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PromptTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PromptTreeItem): vscode.TreeItem {
    switch (element.type) {
      case 'group':
        return this.getGroupTreeItem(element);
      case 'prompt':
        return this.getPromptTreeItem(element);
      case 'version':
        return this.getVersionTreeItem(element);
    }
  }

  async getChildren(element?: PromptTreeItem): Promise<PromptTreeItem[]> {
    if (!element) {
      return this.getGroups();
    }

    switch (element.type) {
      case 'group':
        return this.getPromptsForGroup(element);
      case 'prompt':
        return this.getVersionsForPrompt(element);
      case 'version':
        return [];
    }
  }

  private getGroupTreeItem(item: PromptGroupItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.tag,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    treeItem.description = `${item.prompts.length} 个提示词`;
    treeItem.tooltip = `标签: ${item.tag}\n共 ${item.prompts.length} 个提示词`;
    treeItem.iconPath = new vscode.ThemeIcon('folder');
    treeItem.contextValue = 'promptGroup';

    return treeItem;
  }

  private getPromptTreeItem(item: PromptItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.prompt.name,
      item.prompt.versions.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    treeItem.description = `v${item.prompt.currentVersion}`;
    treeItem.tooltip = this.getPromptTooltip(item.prompt);
    treeItem.iconPath = new vscode.ThemeIcon('file-text');
    treeItem.contextValue = 'promptFile';

    return treeItem;
  }

  private getPromptTooltip(prompt: types.Prompt): string {
    const lines: string[] = [];
    lines.push(`名称: ${prompt.name}`);
    if (prompt.description) {
      lines.push(`描述: ${prompt.description}`);
    }
    lines.push(`当前版本: v${prompt.currentVersion}`);
    lines.push(`版本数量: ${prompt.versions.length}`);
    if (prompt.tags && prompt.tags.length > 0) {
      lines.push(`标签: ${prompt.tags.join(', ')}`);
    }
    lines.push(`创建时间: ${this.formatDate(prompt.createdAt)}`);
    lines.push(`更新时间: ${this.formatDate(prompt.updatedAt)}`);
    return lines.join('\n');
  }

  private getVersionTreeItem(item: PromptVersionItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      `v${item.version.version}`,
      vscode.TreeItemCollapsibleState.None
    );

    treeItem.description = this.formatDate(item.version.createdAt);
    treeItem.tooltip = this.getVersionTooltip(item);
    treeItem.iconPath = item.isCurrent
      ? new vscode.ThemeIcon('check')
      : new vscode.ThemeIcon('history');
    treeItem.contextValue = item.isCurrent ? 'promptVersionCurrent' : 'promptVersion';

    return treeItem;
  }

  private getVersionTooltip(item: PromptVersionItem): string {
    const lines: string[] = [];
    lines.push(`版本: v${item.version.version}`);
    lines.push(`创建时间: ${this.formatDate(item.version.createdAt)}`);
    if (item.version.note) {
      lines.push(`备注: ${item.version.note}`);
    }
    if (item.isCurrent) {
      lines.push('状态: 当前版本');
    }
    return lines.join('\n');
  }

  private async getGroups(): Promise<PromptGroupItem[]> {
    const prompts = await this.storageService.getPrompts();
    const tagMap = new Map<string, types.Prompt[]>();
    const untagged: types.Prompt[] = [];

    for (const prompt of prompts) {
      if (prompt.tags && prompt.tags.length > 0) {
        for (const tag of prompt.tags) {
          if (!tagMap.has(tag)) {
            tagMap.set(tag, []);
          }
          tagMap.get(tag)!.push(prompt);
        }
      } else {
        untagged.push(prompt);
      }
    }

    const groups: PromptGroupItem[] = [];

    const sortedTags = Array.from(tagMap.keys()).sort();
    for (const tag of sortedTags) {
      groups.push({
        type: 'group',
        tag,
        prompts: tagMap.get(tag)!.sort((a, b) => b.updatedAt - a.updatedAt)
      });
    }

    if (untagged.length > 0) {
      groups.push({
        type: 'group',
        tag: '未分类',
        prompts: untagged.sort((a, b) => b.updatedAt - a.updatedAt)
      });
    }

    return groups;
  }

  private getPromptsForGroup(group: PromptGroupItem): PromptItem[] {
    return group.prompts.map(prompt => ({
      type: 'prompt',
      prompt
    }));
  }

  private getVersionsForPrompt(item: PromptItem): PromptVersionItem[] {
    const versions = [...item.prompt.versions].sort((a, b) => b.version - a.version);
    return versions.map(version => ({
      type: 'version',
      promptId: item.prompt.id,
      version,
      isCurrent: version.version === item.prompt.currentVersion
    }));
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}
