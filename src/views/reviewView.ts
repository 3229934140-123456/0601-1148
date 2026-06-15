import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';
import { AIService } from '../services/aiService';
import { getHtmlForWebview } from '../utils/webviewUtils';

interface AcceptanceCriteriaItem {
    text: string;
    completed: boolean;
}

export class ReviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiStudio.reviewView';

    private _view?: vscode.WebviewView;
    private _reviewReport?: types.ReviewReport;
    private _extensionUri: vscode.Uri;
    private _storage: StorageService;
    private _aiService: AIService;
    private _acceptanceCriteria: AcceptanceCriteriaItem[] = [];

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

    public setReviewData(report: types.ReviewReport): void {
        this._reviewReport = report;
        this._acceptanceCriteria = (report.acceptanceCriteria || []).map(c =>
            typeof c === 'string'
                ? { text: c, completed: false }
                : { text: (c as any).text || '', completed: (c as any).completed || false }
        );

        if (this._view) {
            this._sendToWebview('review:setData', {
                qualityScore: report.qualityScore,
                rewriteSuggestions: report.rewriteSuggestions,
                acceptanceCriteria: this._acceptanceCriteria
            });
        }
    }

    public async generateReview(
        content: string,
        responseId: string,
        promptId?: string
    ): Promise<void> {
        if (!this._view) {
            await vscode.commands.executeCommand('aiStudio.reviewView.focus');
        }

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: '正在生成评审报告...',
                cancellable: false
            },
            async (progress) => {
                try {
                    progress.report({ increment: 20, message: '分析质量评分...' });
                    const qualityScore = await this._generateQualityScore(content);

                    progress.report({ increment: 40, message: '生成改写建议...' });
                    const rewriteSuggestions = await this._generateRewriteSuggestions(content);

                    progress.report({ increment: 30, message: '提取验收标准...' });
                    const acceptanceCriteria = await this._extractAcceptanceCriteria(content);

                    const report: Omit<types.ReviewReport, 'id' | 'createdAt'> = {
                        promptId: promptId || '',
                        responseId,
                        qualityScore,
                        rewriteSuggestions,
                        acceptanceCriteria
                    };

                    const savedReport = await this._storage.createReviewReport(report);
                    this.setReviewData(savedReport);

                    progress.report({ increment: 10, message: '完成' });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : '未知错误';
                    vscode.window.showErrorMessage(`生成评审报告失败：${errorMessage}`);
                }
            }
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return getHtmlForWebview(webview, this._extensionUri, {
            viewType: 'review',
            title: '评审报告',
            data: this._reviewReport ? {
                qualityScore: this._reviewReport.qualityScore,
                rewriteSuggestions: this._reviewReport.rewriteSuggestions,
                acceptanceCriteria: this._acceptanceCriteria
            } : {}
        });
    }

    private _setUpMessageHandler(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'review:toggleCriteria':
                    await this._handleToggleCriteria(message.payload);
                    break;
                case 'review:refresh':
                    await this._handleRefresh();
                    break;
                case 'review:export':
                    await this._handleExport();
                    break;
                case 'review:generateFromInput':
                    await this._handleGenerateFromInput(message.payload);
                    break;
            }
        });
    }

    private async _handleToggleCriteria(payload: { index: number; completed: boolean }): Promise<void> {
        if (payload.index >= 0 && payload.index < this._acceptanceCriteria.length) {
            this._acceptanceCriteria[payload.index].completed = payload.completed;

            if (this._reviewReport) {
                await this._storage.updateReviewReport(this._reviewReport.id, {
                    acceptanceCriteria: this._acceptanceCriteria as any
                });
            }
        }
    }

    private async _handleRefresh(): Promise<void> {
        if (this._reviewReport) {
            const report = await this._storage.getReviewReportById(this._reviewReport.id);
            if (report) {
                this.setReviewData(report);
            }
        }
    }

    private async _handleExport(): Promise<void> {
        if (!this._reviewReport) {
            vscode.window.showInformationMessage('暂无评审报告可导出');
            return;
        }

        const report = this._reviewReport;
        let content = '# 评审报告\n\n';
        content += `生成时间：${new Date(report.createdAt).toLocaleString()}\n\n`;

        if (report.qualityScore !== undefined) {
            content += `## 质量评分\n\n${report.qualityScore}/100\n\n`;
        }

        if (report.rewriteSuggestions && report.rewriteSuggestions.length > 0) {
            content += '## 改写建议\n\n';
            report.rewriteSuggestions.forEach((s, i) => {
                content += `${i + 1}. ${s}\n`;
            });
            content += '\n';
        }

        if (this._acceptanceCriteria.length > 0) {
            content += '## 验收标准\n\n';
            this._acceptanceCriteria.forEach((c, i) => {
                content += `- [${c.completed ? 'x' : ' '}] ${c.text}\n`;
            });
        }

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`review-report-${report.id}.md`),
            filters: {
                'Markdown': ['md'],
                'Text': ['txt']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(content, 'utf-8')
            );
            vscode.window.showInformationMessage('评审报告已导出');
        }
    }

    private async _handleGenerateFromInput(payload: { content: string }): Promise<void> {
        if (!payload.content || !payload.content.trim()) {
            return;
        }

        await this.generateReview(payload.content, 'input-' + Date.now());
    }

    private async _generateQualityScore(content: string): Promise<number> {
        const providers = this._aiService.getAvailableProviders();
        if (providers.length === 0) {
            return this._calculateBasicScore(content);
        }

        try {
            const prompt = `请对以下回答进行质量评分，范围 0-100 分。
请从准确性、完整性、清晰度、逻辑性四个维度评估。
请只返回一个数字分数，不要返回其他内容。

回答内容：
${content}

分数：`;

            const messages: types.Message[] = [
                { id: 'q1', role: 'user', content: prompt, timestamp: 0 }
            ];

            const result = await this._aiService.chat(providers[0], messages);
            const match = result.match(/(\d{1,3})/);
            if (match) {
                const score = parseInt(match[1], 10);
                return Math.min(100, Math.max(0, score));
            }

            return this._calculateBasicScore(content);
        } catch {
            return this._calculateBasicScore(content);
        }
    }

    private _calculateBasicScore(content: string): number {
        const length = content.length;
        if (length < 50) {
            return 40;
        }
        if (length < 200) {
            return 60;
        }
        if (length < 500) {
            return 75;
        }
        return 85;
    }

    private async _generateRewriteSuggestions(content: string): Promise<string[]> {
        const providers = this._aiService.getAvailableProviders();
        if (providers.length === 0) {
            return this._getDefaultSuggestions(content);
        }

        try {
            const prompt = `请对以下回答提出 3-5 条改写建议，每条建议简短明确。
请以 JSON 数组格式返回，例如：["建议1", "建议2", "建议3"]

回答内容：
${content}

改写建议：`;

            const messages: types.Message[] = [
                { id: 's1', role: 'user', content: prompt, timestamp: 0 }
            ];

            const result = await this._aiService.chat(providers[0], messages);
            const jsonMatch = result.match(/\[[\s\S]*\]/);

            if (jsonMatch) {
                try {
                    const suggestions = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(suggestions) && suggestions.length > 0) {
                        return suggestions.slice(0, 5);
                    }
                } catch {
                    // fall through
                }
            }

            return this._getDefaultSuggestions(content);
        } catch {
            return this._getDefaultSuggestions(content);
        }
    }

    private _getDefaultSuggestions(content: string): string[] {
        const suggestions: string[] = [];

        if (content.length < 100) {
            suggestions.push('回答内容较为简略，建议补充更多细节');
        }

        if (!/[。！？\.!?]/.test(content.slice(-10))) {
            suggestions.push('回答结构不够完整，建议完善结尾部分');
        }

        suggestions.push('建议使用更清晰的分点表述，提升可读性');
        suggestions.push('可以考虑添加具体示例来增强说服力');

        return suggestions;
    }

    private async _extractAcceptanceCriteria(content: string): Promise<string[]> {
        const providers = this._aiService.getAvailableProviders();
        if (providers.length === 0) {
            return this._getDefaultCriteria(content);
        }

        try {
            const prompt = `请从以下回答中提取 3-5 条验收标准，每条标准应该是可验证的具体要求。
请以 JSON 数组格式返回，例如：["标准1", "标准2", "标准3"]

回答内容：
${content}

验收标准：`;

            const messages: types.Message[] = [
                { id: 'c1', role: 'user', content: prompt, timestamp: 0 }
            ];

            const result = await this._aiService.chat(providers[0], messages);
            const jsonMatch = result.match(/\[[\s\S]*\]/);

            if (jsonMatch) {
                try {
                    const criteria = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(criteria) && criteria.length > 0) {
                        return criteria.slice(0, 5);
                    }
                } catch {
                    // fall through
                }
            }

            return this._getDefaultCriteria(content);
        } catch {
            return this._getDefaultCriteria(content);
        }
    }

    private _getDefaultCriteria(content: string): string[] {
        return [
            '回答准确回应了用户的问题',
            '回答内容完整，没有遗漏关键信息',
            '回答逻辑清晰，易于理解',
            '回答语言表达通顺，没有明显错误'
        ];
    }

    private _sendToWebview(type: string, payload: any): void {
        if (this._view) {
            this._view.webview.postMessage({ type, payload });
        }
    }
}
