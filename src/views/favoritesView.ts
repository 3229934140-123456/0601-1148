import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';

type FavoritesTreeItem = FavoriteTypeGroupItem | FavoriteItem | SnippetGroupItem | SnippetItem;

interface FavoriteTypeGroupItem {
  type: 'favoriteGroup';
  favoriteType: types.FavoriteItem['type'];
  favorites: types.FavoriteItem[];
}

interface FavoriteItem {
  type: 'favorite';
  favorite: types.FavoriteItem;
}

interface SnippetGroupItem {
  type: 'snippetGroup';
  category: string;
  snippets: types.Snippet[];
}

interface SnippetItem {
  type: 'snippet';
  snippet: types.Snippet;
}

export class FavoritesProvider implements vscode.TreeDataProvider<FavoritesTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FavoritesTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FavoritesTreeItem): vscode.TreeItem {
    switch (element.type) {
      case 'favoriteGroup':
        return this.getFavoriteGroupTreeItem(element);
      case 'favorite':
        return this.getFavoriteTreeItem(element);
      case 'snippetGroup':
        return this.getSnippetGroupTreeItem(element);
      case 'snippet':
        return this.getSnippetTreeItem(element);
    }
  }

  async getChildren(element?: FavoritesTreeItem): Promise<FavoritesTreeItem[]> {
    if (!element) {
      return this.getRootGroups();
    }

    switch (element.type) {
      case 'favoriteGroup':
        return this.getFavoritesForGroup(element);
      case 'snippetGroup':
        return this.getSnippetsForGroup(element);
      case 'favorite':
      case 'snippet':
        return [];
    }
  }

  private async getRootGroups(): Promise<FavoritesTreeItem[]> {
    const groups: FavoritesTreeItem[] = [];

    const snippetGroups = await this.getSnippetGroups();
    groups.push(...snippetGroups);

    const favoriteGroups = await this.getFavoriteTypeGroups();
    groups.push(...favoriteGroups);

    return groups;
  }

  private getFavoriteGroupTreeItem(item: FavoriteTypeGroupItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      `⭐ ${this.getTypeLabel(item.favoriteType)}`,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    treeItem.description = `${item.favorites.length} 项`;
    treeItem.tooltip = `${this.getTypeLabel(item.favoriteType)}\n共 ${item.favorites.length} 项`;
    treeItem.iconPath = new vscode.ThemeIcon('folder');
    treeItem.contextValue = 'favoriteGroup';

    return treeItem;
  }

  private getFavoriteTreeItem(item: FavoriteItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.favorite.name,
      vscode.TreeItemCollapsibleState.None
    );

    treeItem.description = item.favorite.note || '';
    treeItem.tooltip = this.getFavoriteTooltip(item.favorite);
    treeItem.iconPath = this.getTypeIcon(item.favorite.type);
    treeItem.contextValue = 'favorite';
    treeItem.command = {
      command: 'aiStudio.openFavorite',
      title: '打开',
      arguments: [item.favorite]
    };

    return treeItem;
  }

  private getSnippetGroupTreeItem(item: SnippetGroupItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      `📝 ${item.category}`,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    treeItem.description = `${item.snippets.length} 个片段`;
    treeItem.tooltip = `分类：${item.category}\n共 ${item.snippets.length} 个片段`;
    treeItem.iconPath = new vscode.ThemeIcon('folder');
    treeItem.contextValue = 'snippetGroup';

    return treeItem;
  }

  private getSnippetTreeItem(item: SnippetItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.snippet.name,
      vscode.TreeItemCollapsibleState.None
    );

    treeItem.description = `${item.snippet.usageCount || 0} 次使用`;
    treeItem.tooltip = this.getSnippetTooltip(item.snippet);
    treeItem.iconPath = new vscode.ThemeIcon('code');
    treeItem.contextValue = 'snippet';
    treeItem.command = {
      command: 'aiStudio.copySnippet',
      title: '复制内容',
      arguments: [item.snippet]
    };

    return treeItem;
  }

  private getFavoriteTooltip(favorite: types.FavoriteItem): string {
    const lines: string[] = [];
    lines.push(`名称: ${favorite.name}`);
    lines.push(`类型: ${this.getTypeLabel(favorite.type)}`);
    if (favorite.note) {
      lines.push(`备注: ${favorite.note}`);
    }
    lines.push(`收藏时间: ${this.formatDate(favorite.createdAt)}`);
    return lines.join('\n');
  }

  private getSnippetTooltip(snippet: types.Snippet): string {
    const lines: string[] = [];
    lines.push(`名称: ${snippet.name}`);
    lines.push(`分类: ${snippet.category}`);
    lines.push(`使用次数: ${snippet.usageCount || 0}`);
    lines.push(`创建时间: ${this.formatDate(snippet.createdAt)}`);
    lines.push('');
    lines.push('内容:');
    lines.push(snippet.content.slice(0, 200));
    if (snippet.content.length > 200) {
      lines.push('...');
    }
    return lines.join('\n');
  }

  private getTypeLabel(type: types.FavoriteItem['type']): string {
    const labels: Record<types.FavoriteItem['type'], string> = {
      prompt: '提示词',
      sample: '样例',
      snippet: '收藏片段',
      conversation: '对话'
    };
    return labels[type] || type;
  }

  private getTypeIcon(type: types.FavoriteItem['type']): vscode.ThemeIcon {
    const icons: Record<types.FavoriteItem['type'], string> = {
      prompt: 'file-text',
      sample: 'beaker',
      snippet: 'star',
      conversation: 'comment'
    };
    return new vscode.ThemeIcon(icons[type] || 'star');
  }

  private async getSnippetGroups(): Promise<SnippetGroupItem[]> {
    const snippets = await this.storageService.getSnippets();

    const groupMap = new Map<string, SnippetGroupItem>();

    for (const snippet of snippets) {
      const category = snippet.category || '未分类';
      if (!groupMap.has(category)) {
        groupMap.set(category, {
          type: 'snippetGroup',
          category,
          snippets: []
        });
      }
      groupMap.get(category)!.snippets.push(snippet);
    }

    const groups: SnippetGroupItem[] = [];
    for (const group of Array.from(groupMap.values())) {
      group.snippets.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      groups.push(group);
    }

    groups.sort((a, b) => a.category.localeCompare(b.category));
    return groups;
  }

  private getSnippetsForGroup(group: SnippetGroupItem): SnippetItem[] {
    return group.snippets.map(snippet => ({
      type: 'snippet',
      snippet
    }));
  }

  private async getFavoriteTypeGroups(): Promise<FavoriteTypeGroupItem[]> {
    const favorites = await this.storageService.getFavorites();

    const groupMap = new Map<types.FavoriteItem['type'], FavoriteTypeGroupItem>();

    const typesList: types.FavoriteItem['type'][] = ['prompt', 'sample', 'snippet', 'conversation'];
    for (const type of typesList) {
      groupMap.set(type, {
        type: 'favoriteGroup',
        favoriteType: type,
        favorites: []
      });
    }

    for (const favorite of favorites) {
      const group = groupMap.get(favorite.type);
      if (group) {
        group.favorites.push(favorite);
      }
    }

    const groups: FavoriteTypeGroupItem[] = [];

    for (const group of Array.from(groupMap.values())) {
      if (group.favorites.length > 0) {
        group.favorites.sort((a, b) => b.createdAt - a.createdAt);
        groups.push(group);
      }
    }

    return groups;
  }

  private getFavoritesForGroup(group: FavoriteTypeGroupItem): FavoriteItem[] {
    return group.favorites.map(favorite => ({
      type: 'favorite',
      favorite
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
