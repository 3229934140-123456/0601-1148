import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';

type VariableTreeItem = VariableItem;

interface VariableItem {
  type: 'variable';
  variable: types.Variable;
}

export class VariablesProvider implements vscode.TreeDataProvider<VariableTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<VariableTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: VariableTreeItem): vscode.TreeItem {
    return this.getVariableTreeItem(element);
  }

  async getChildren(element?: VariableTreeItem): Promise<VariableTreeItem[]> {
    if (!element) {
      return this.getVariables();
    }
    return [];
  }

  private getVariableTreeItem(item: VariableItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      item.variable.name,
      vscode.TreeItemCollapsibleState.None
    );

    const typeLabel = this.getTypeLabel(item.variable.type);
    const defaultValue = item.variable.defaultValue ?? '';
    treeItem.description = `${typeLabel}${defaultValue ? ' = ' + defaultValue : ''}`;
    treeItem.tooltip = this.getVariableTooltip(item.variable);
    treeItem.iconPath = this.getTypeIcon(item.variable.type);
    treeItem.contextValue = 'variable';

    return treeItem;
  }

  private getVariableTooltip(variable: types.Variable): string {
    const lines: string[] = [];
    lines.push(`名称: ${variable.name}`);
    lines.push(`类型: ${this.getTypeLabel(variable.type)}`);
    if (variable.defaultValue !== undefined) {
      lines.push(`默认值: ${variable.defaultValue}`);
    }
    if (variable.description) {
      lines.push(`描述: ${variable.description}`);
    }
    if (variable.options && variable.options.length > 0) {
      lines.push(`选项: ${variable.options.join(', ')}`);
    }
    return lines.join('\n');
  }

  private getTypeLabel(type: types.Variable['type']): string {
    const labels: Record<types.Variable['type'], string> = {
      string: '字符串',
      number: '数字',
      boolean: '布尔',
      select: '选择'
    };
    return labels[type] || type;
  }

  private getTypeIcon(type: types.Variable['type']): vscode.ThemeIcon {
    const icons: Record<types.Variable['type'], string> = {
      string: 'symbol-text',
      number: 'symbol-number',
      boolean: 'symbol-boolean',
      select: 'list-flat'
    };
    return new vscode.ThemeIcon(icons[type] || 'symbol-variable');
  }

  private async getVariables(): Promise<VariableItem[]> {
    const variables = await this.storageService.getVariables();
    return variables.map(variable => ({
      type: 'variable',
      variable
    }));
  }
}
