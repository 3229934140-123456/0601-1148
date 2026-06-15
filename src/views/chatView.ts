import * as vscode from 'vscode';
import * as types from '../types';
import { StorageService } from '../services/storage';
import { AIService } from '../services/aiService';
import { getHtmlForWebview } from '../utils/webviewUtils';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiStudio.chatView';

    private _view?: vscode.WebviewView;
    private _conversation?: types.Conversation;
    private _extensionUri: vscode.Uri;
    private _storage: StorageService;
    private _aiService: AIService;
    private _isStreaming: boolean = false;
    private _currentAssistantMessageId?: string;

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

    public async sendMessage(content: string): Promise<void> {
        if (!this._view || this._isStreaming) {
            return;
        }

        if (!this._conversation) {
            await this._createNewConversation();
        }

        if (!this._conversation) {
            return;
        }

        const userMessage: Omit<types.Message, 'id' | 'timestamp'> = {
            role: 'user',
            content
        };

        const savedUserMessage = await this._storage.addMessage(
            this._conversation.id,
            userMessage
        );

        if (!savedUserMessage) {
            return;
        }

        this._conversation.messages = [savedUserMessage];
        this._currentAssistantMessageId = undefined;
        this._sendToWebview('chat:setMessages', { messages: [savedUserMessage] });

        await this._streamResponse(content);
    }

    public async clearChat(): Promise<void> {
        if (this._conversation) {
            await this._storage.deleteConversation(this._conversation.id);
        }
        this._conversation = undefined;
        this._currentAssistantMessageId = undefined;
        if (this._view) {
            this._sendToWebview('chat:setMessages', { messages: [] });
        }
    }

    public async setConversation(conversation: types.Conversation): Promise<void> {
        this._conversation = conversation;
        this._currentAssistantMessageId = undefined;
        if (this._view) {
            this._sendToWebview('chat:setMessages', {
                messages: conversation.messages
            });
        }
    }

    public async askWithSelection(selectedText: string): Promise<void> {
        if (!this._view) {
            await vscode.commands.executeCommand('aiStudio.chatView.focus');
        }

        const question = `请帮我分析以下内容：\n\n${selectedText}`;
        await this.sendMessage(question);
    }

    private _getLastAssistantMessage(): types.Message | undefined {
        if (!this._conversation) {
            return undefined;
        }
        return [...this._conversation.messages]
            .reverse()
            .find(m => m.role === 'assistant');
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return getHtmlForWebview(webview, this._extensionUri, {
            viewType: 'chat',
            title: 'AI 对话',
            data: {
                messages: this._conversation?.messages || []
            }
        });
    }

    private _setUpMessageHandler(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'chat:send':
                    await this._handleSendMessage(message.payload);
                    break;
                case 'chat:clear':
                    await this.clearChat();
                    break;
                case 'chat:copy':
                    await this._handleCopy(message.payload);
                    break;
                case 'chat:rate':
                    await this._handleRate(message.payload);
                    break;
                case 'chat:review':
                    await this._handleReview(message.payload);
                    break;
                case 'chat:settings':
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'aiStudio');
                    break;
            }
        });
    }

    private async _handleSendMessage(payload: { content: string }): Promise<void> {
        if (this._isStreaming) {
            return;
        }
        await this.sendMessage(payload.content);
    }

    private async _handleCopy(payload: { messageId: string }): Promise<void> {
        const message = this._conversation?.messages.find(m => m.id === payload.messageId);
        if (message) {
            await vscode.env.clipboard.writeText(message.content);
            vscode.window.showInformationMessage('已复制到剪贴板');
        }
    }

    private async _handleRate(payload: { messageId: string }): Promise<void> {
        const assistantMessage = this._getLastAssistantMessage();
        if (!assistantMessage) {
            vscode.window.showWarningMessage('没有可评分的 AI 回答');
            return;
        }

        const ratingOptions = [
            { label: '⭐ 1 星 - 很差', value: 1 },
            { label: '⭐⭐ 2 星 - 较差', value: 2 },
            { label: '⭐⭐⭐ 3 星 - 一般', value: 3 },
            { label: '⭐⭐⭐⭐ 4 星 - 较好', value: 4 },
            { label: '⭐⭐⭐⭐⭐ 5 星 - 很好', value: 5 }
        ];

        const selected = await vscode.window.showQuickPick(ratingOptions, {
            placeHolder: `请为这条回答评分（ID: ${assistantMessage.id.slice(0, 8)}）`
        });

        if (selected) {
            (assistantMessage as any).rating = selected.value;
            await this._storage.updateConversation(this._conversation!.id, {
                messages: this._conversation!.messages
            });
            vscode.window.showInformationMessage(`已评分：${selected.value} 星`);
        }
    }

    private async _handleReview(payload: { messageId: string }): Promise<void> {
        const assistantMessage = this._getLastAssistantMessage();
        if (!assistantMessage) {
            vscode.window.showWarningMessage('没有可评审的 AI 回答');
            return;
        }

        await vscode.commands.executeCommand('aiStudio.reviewView.focus');
        await vscode.commands.executeCommand('aiStudio.generateReview', {
            messageId: assistantMessage.id,
            content: assistantMessage.content
        });
    }

    private async _createNewConversation(): Promise<void> {
        const newConv = await this._storage.createConversation({
            title: '新对话'
        });
        this._conversation = newConv;
    }

    private async _streamResponse(userContent: string): Promise<void> {
        if (!this._conversation) {
            return;
        }

        this._isStreaming = true;
        this._currentAssistantMessageId = undefined;

        const config = vscode.workspace.getConfiguration('aiStudio');
        const defaultProvider = config.get<string>('defaultProvider', '');
        const defaultModel = config.get<string>('defaultModel', 'gpt-3.5-turbo');
        const temperature = config.get<number>('temperature', 0.7);

        const providers = this._aiService.getAvailableProviders();
        const providerName = providers.length > 0 ? providers[0] : defaultProvider;

        if (!providerName) {
            vscode.window.showErrorMessage('未配置可用的 AI 提供商');
            this._isStreaming = false;
            return;
        }

        let fullContent = '';
        let streamingMessageId = 'streaming-' + Date.now();

        try {
            const messages: types.Message[] = [
                { id: '', role: 'user' as const, content: userContent, timestamp: 0 }
            ];

            await this._aiService.streamChat(
                providerName,
                messages,
                {
                    model: defaultModel,
                    temperature
                },
                (chunk) => {
                    if (chunk.done || !this._view) {
                        return;
                    }

                    fullContent += chunk.content;

                    const isFirstChunk = fullContent.length === chunk.content.length;
                    this._sendToWebview('chat:stream', {
                        id: streamingMessageId,
                        delta: chunk.content,
                        isStreaming: !isFirstChunk,
                        model: defaultModel,
                        provider: providerName
                    });
                }
            );

            if (fullContent && this._conversation) {
                const assistantMessage: Omit<types.Message, 'id' | 'timestamp'> = {
                    role: 'assistant',
                    content: fullContent,
                    model: defaultModel,
                    provider: providerName
                };

                const savedMessage = await this._storage.addMessage(
                    this._conversation.id,
                    assistantMessage
                );

                if (savedMessage) {
                    this._currentAssistantMessageId = savedMessage.id;
                    this._conversation.messages = [
                        this._conversation.messages[0],
                        savedMessage
                    ];
                    this._sendToWebview('chat:setMessages', {
                        messages: this._conversation.messages
                    });
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`AI 响应失败：${errorMessage}`);

            if (this._conversation) {
                const errorMsg: Omit<types.Message, 'id' | 'timestamp'> = {
                    role: 'assistant',
                    content: `抱歉，发生了错误：${errorMessage}`
                };

                const savedMessage = await this._storage.addMessage(
                    this._conversation.id,
                    errorMsg
                );

                if (savedMessage) {
                    this._conversation.messages = [
                        this._conversation.messages[0],
                        savedMessage
                    ];
                    this._sendToWebview('chat:setMessages', {
                        messages: this._conversation.messages
                    });
                }
            }
        } finally {
            this._isStreaming = false;
        }
    }

    private _sendToWebview(type: string, payload: any): void {
        if (this._view) {
            this._view.webview.postMessage({ type, payload });
        }
    }
}
