import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';

type SampleTreeItem = SampleGroupItem | SampleItem;

interface SampleGroupItem {
  type: 'group';
  promptId: string;
  promptName: string;
  samples: types.SampleInput[];
}

interface SampleItem {
  type: 'sample';
  sample: types.SampleInput;
}

export class SamplesProvider implements vscode.TreeDataProvider<SampleTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SampleTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SampleTreeItem): vscode.TreeItem {
    switch (element.type) {
      case 'group':
        return this.getGroupTreeItem(element);
      case 'sample':
        return this.getSampleTreeItem(element);
    }
  }

  async getChildren(element?: SampleTreeItem): Promise<SampleTreeItem[]> {
    if (!element) {
      return this.getGroups();
    }

    switch (element.type) {
      case 'group':
        return this.getSamplesForGroup(element);
      case 'sample':
        return [];
    }
  }

  private getGroupTreeItem(item: SampleGroupItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.promptName,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    treeItem.description = `${item.samples.length} 个样例`;
    treeItem.tooltip = `提示词: ${item.promptName}\n共 ${item.samples.length} 个样例`;
    treeItem.iconPath = new vscode.ThemeIcon('folder');
    treeItem.contextValue = 'sampleGroup';

    return treeItem;
  }

  private getSampleTreeItem(item: SampleItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.sample.name,
      vscode.TreeItemCollapsibleState.None
    );

    const contentPreview = item.sample.content.slice(0, 30);
    const suffix = item.sample.content.length > 30 ? '...' : '';
    treeItem.description = contentPreview + suffix;
    treeItem.tooltip = item.sample.content;
    treeItem.iconPath = new vscode.ThemeIcon('file-code');
    treeItem.contextValue = 'sample';

    return treeItem;
  }

  private async getGroups(): Promise<SampleGroupItem[]> {
    const [prompts, samples] = await Promise.all([
      this.storageService.getPrompts(),
      this.storageService.getSamples()
    ]);

    const groupMap = new Map<string, SampleGroupItem>();

    for (const prompt of prompts) {
      groupMap.set(prompt.id, {
        type: 'group',
        promptId: prompt.id,
        promptName: prompt.name,
        samples: []
      });
    }

    const ungrouped: types.SampleInput[] = [];

    for (const sample of samples) {
      if (sample.promptId && groupMap.has(sample.promptId)) {
        groupMap.get(sample.promptId)!.samples.push(sample);
      } else {
        ungrouped.push(sample);
      }
    }

    const groups: SampleGroupItem[] = [];

    for (const group of Array.from(groupMap.values())) {
      if (group.samples.length > 0) {
        group.samples.sort((a, b) => b.createdAt - a.createdAt);
        groups.push(group);
      }
    }

    if (ungrouped.length > 0) {
      groups.push({
        type: 'group',
        promptId: '__ungrouped__',
        promptName: '未分组',
        samples: ungrouped.sort((a, b) => b.createdAt - a.createdAt)
      });
    }

    return groups;
  }

  private getSamplesForGroup(group: SampleGroupItem): SampleItem[] {
    return group.samples.map(sample => ({
      type: 'sample',
      sample
    }));
  }
}
