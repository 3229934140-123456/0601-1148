import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';

type FavoriteTreeItem = FavoriteTypeGroupItem | FavoriteItem;

interface FavoriteTypeGroupItem {
  type: 'group';
  favoriteType: types.FavoriteItem['type'];
  favorites: types.FavoriteItem[];
}

interface FavoriteItem {
  type: 'favorite';
  favorite: types.FavoriteItem;
}

export class FavoritesProvider implements vscode.TreeDataProvider<FavoriteTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FavoriteTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FavoriteTreeItem): vscode.TreeItem {
    switch (element.type) {
      case 'group':
        return this.getGroupTreeItem(element);
      case 'favorite':
        return this.getFavoriteTreeItem(element);
    }
  }

  async getChildren(element?: FavoriteTreeItem): Promise<FavoriteTreeItem[]> {
    if (!element) {
      return this.getTypeGroups();
    }

    switch (element.type) {
      case 'group':
        return this.getFavoritesForGroup(element);
      case 'favorite':
        return [];
    }
  }

  private getGroupTreeItem(item: FavoriteTypeGroupItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      this.getTypeLabel(item.favoriteType),
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

  private getTypeLabel(type: types.FavoriteItem['type']): string {
    const labels: Record<types.FavoriteItem['type'], string> = {
      prompt: '提示词',
      sample: '样例',
      snippet: '片段',
      conversation: '对话'
    };
    return labels[type] || type;
  }

  private getTypeIcon(type: types.FavoriteItem['type']): vscode.ThemeIcon {
    const icons: Record<types.FavoriteItem['type'], string> = {
      prompt: 'file-text',
      sample: 'beaker',
      snippet: 'code',
      conversation: 'comment'
    };
    return new vscode.ThemeIcon(icons[type] || 'star');
  }

  private async getTypeGroups(): Promise<FavoriteTypeGroupItem[]> {
    const favorites = await this.storageService.getFavorites();

    const groupMap = new Map<types.FavoriteItem['type'], FavoriteTypeGroupItem>();

    const typesList: types.FavoriteItem['type'][] = ['prompt', 'sample', 'snippet', 'conversation'];
    for (const type of typesList) {
      groupMap.set(type, {
        type: 'group',
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
