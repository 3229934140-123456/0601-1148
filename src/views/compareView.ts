import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';
import { AIService } from '../services/aiService';
import { getHtmlForWebview } from '../utils/webviewUtils';

export class CompareViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiStudio.compareView';

    private _view?: vscode.WebviewView;
    private _compareResult?: types.CompareResult;
    private _extensionUri: vscode.Uri;
    private _storage: StorageService;
    private _aiService: AIService;
    private _isRunning: boolean = false;

    constructor(
        extensionUri: vscode.Uri,
        storage: StorageService,
        aiService: AIService
    ) {
        this._extensionUri = extensionUri;
        this._storage = storage;
        this._aiService = aiService;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        this._setUpMessageHandler(webviewView);

        webviewView.onDidDispose(() => {
            this._view = undefined;
        });
    }

    public async runComparison(
        promptContent: string,
        modelConfigs: { provider: string; model: string }[],
        sampleId?: string,
        promptId?: string
    ): Promise<void> {
        if (this._isRunning || modelConfigs.length === 0) {
            return;
        }

        this._isRunning = true;

        try {
            const responses: types.CompareResponse[] = [];

            const promises = modelConfigs.map(async (config, index) => {
                const startTime = Date.now();
                try {
                    const messages: types.Message[] = [
                        { id: `msg-${index}`, role: 'user', content: promptContent, timestamp: 0 }
                    ];

                    const content = await this._aiService.chat(
                        config.provider,
                        messages,
                        { model: config.model }
                    );

                    const duration = Date.now() - startTime;

                    return {
                        id: `resp-${index}-${Date.now()}`,
                        model: config.model,
                        provider: config.provider,
                        content,
                        duration,
                        tokens: this._estimateTokens(content)
                    } as types.CompareResponse;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : '未知错误';
                    return {
                        id: `resp-${index}-${Date.now()}`,
                        model: config.model,
                        provider: config.provider,
                        content: `错误：${errorMessage}`,
                        duration: Date.now() - startTime
                    } as types.CompareResponse;
                }
            });

            const results = await Promise.all(promises);
            responses.push(...results.filter(Boolean) as types.CompareResponse[]);

            const compareResult: Omit<types.CompareResult, 'id' | 'createdAt'> = {
                promptId: promptId || '',
                sampleId,
                responses
            };

            const savedResult = await this._storage.createCompareResult(compareResult);
            this._compareResult = savedResult;

            if (this._view) {
                this._sendToWebview('compare:setData', {
                    ...savedResult,
                    title: '对比运行结果',
                    sampleName: sampleId ? `样例 ${sampleId}` : `对比 ${responses.length} 个模型的回答`
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`对比运行失败：${errorMessage}`);
        } finally {
            this._isRunning = false;
        }
    }

    public setCompareResult(result: types.CompareResult): void {
        this._compareResult = result;
        if (this._view) {
            this._sendToWebview('compare:setData', {
                ...result,
                title: '对比运行结果',
                sampleName: result.sampleId ? `样例 ${result.sampleId}` : `对比 ${result.responses.length} 个模型的回答`
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return getHtmlForWebview(webview, this._extensionUri, {
            viewType: 'compare',
            title: '对比运行',
            data: this._compareResult ? {
                ...this._compareResult,
                title: '对比运行结果',
                sampleName: this._compareResult.sampleId
                    ? `样例 ${this._compareResult.sampleId}`
                    : `对比 ${this._compareResult.responses.length} 个模型的回答`
            } : {}
        });
    }

    private _setUpMessageHandler(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'compare:rate':
                    await this._handleRate(message.payload);
                    break;
                case 'compare:refresh':
                    await this._handleRefresh();
                    break;
                case 'compare:run':
                    await this._handleRun(message.payload);
                    break;
            }
        });
    }

    private async _handleRate(payload: { responseId: string; rating: number }): Promise<void> {
        if (!this._compareResult) {
            return;
        }

        const response = this._compareResult.responses.find(r => r.id === payload.responseId);
        if (response) {
            response.rating = payload.rating;

            await this._storage.updateCompareResult(this._compareResult.id, {
                responses: this._compareResult.responses
            });

            vscode.window.showInformationMessage(`已评分：${payload.rating} 星`);
        }
    }

    private async _handleRefresh(): Promise<void> {
        if (this._compareResult) {
            const result = await this._storage.getCompareResultById(this._compareResult.id);
            if (result) {
                this.setCompareResult(result);
            }
        }
    }

    private async _handleRun(payload: any): Promise<void> {
        vscode.commands.executeCommand('aiStudio.runCompare');
    }

    private _estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    private _sendToWebview(type: string, payload: any): void {
        if (this._view) {
            this._view.webview.postMessage({ type, payload });
        }
    }
}
