import * as vscode from 'vscode';
import { ViewType, Message, CompareResult, ReviewReport } from '../types';

export function escapeHtml(text: string): string {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
        return '刚刚';
    }
    if (diff < 3600000) {
        return `${Math.floor(diff / 60000)} 分钟前`;
    }
    if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)} 小时前`;
    }
    if (diff < 604800000) {
        return `${Math.floor(diff / 86400000)} 天前`;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (year === now.getFullYear()) {
        return `${month}-${day} ${hours}:${minutes}`;
    }
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export interface WebviewOptions {
    viewType: ViewType;
    title: string;
    data?: any;
}

export function getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    options: WebviewOptions
): string {
    const { viewType, title, data = {} } = options;

    const nonce = generateId();
    const initialData = JSON.stringify(data);

    const cspSource = webview.cspSource;

    const styles = getStyles();
    const script = getScript(viewType);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${cspSource} 'nonce-${nonce}';
                   script-src 'nonce-${nonce}';
                   img-src ${cspSource} https: data:;
                   font-src ${cspSource};
                   connect-src ${cspSource};">
    <title>${escapeHtml(title)}</title>
    <style nonce="${nonce}">
${styles}
    </style>
</head>
<body>
    <div id="app" class="app-container">
        ${getViewContent(viewType)}
    </div>
    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();
            const initialData = ${initialData};
${script}
        })();
    </script>
</body>
</html>`;
}

function getStyles(): string {
    return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --bg-primary: #1e1e1e;
    --bg-secondary: #252526;
    --bg-tertiary: #2d2d30;
    --bg-hover: #37373d;
    --bg-active: #094771;
    --text-primary: #cccccc;
    --text-secondary: #858585;
    --text-muted: #6e6e6e;
    --border-color: #3c3c3c;
    --accent-color: #007acc;
    --accent-hover: #1997e6;
    --success-color: #4ec9b0;
    --warning-color: #dcdcaa;
    --error-color: #f14c4c;
    --info-color: #3794ff;
    --user-message-bg: #094771;
    --assistant-message-bg: #252526;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    --radius: 6px;
    --radius-sm: 4px;
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 24px;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
    background-color: var(--bg-primary);
    overflow: hidden;
}

.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
}

.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}

.header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}

.header-actions {
    display: flex;
    gap: var(--spacing-sm);
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    font-size: 12px;
    font-family: inherit;
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
}

.btn:hover {
    background-color: var(--bg-hover);
    border-color: var(--accent-color);
}

.btn:active {
    background-color: var(--bg-active);
}

.btn-primary {
    background-color: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
}

.btn-primary:hover {
    background-color: var(--accent-hover);
    border-color: var(--accent-hover);
}

.btn-icon {
    padding: 6px;
    width: 28px;
    height: 28px;
}

.content {
    flex: 1;
    overflow: hidden;
    position: relative;
}

.scrollable {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}

.scrollable::-webkit-scrollbar {
    width: 10px;
}

.scrollable::-webkit-scrollbar-track {
    background: var(--bg-primary);
}

.scrollable::-webkit-scrollbar-thumb {
    background-color: var(--bg-tertiary);
    border-radius: 5px;
    border: 2px solid var(--bg-primary);
}

.scrollable::-webkit-scrollbar-thumb:hover {
    background-color: var(--bg-hover);
}

.chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.message-list {
    flex: 1;
    padding: var(--spacing-lg);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
}

.message {
    display: flex;
    gap: var(--spacing-md);
    max-width: 100%;
}

.message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
}

.message.user .message-avatar {
    background-color: var(--accent-color);
    color: white;
    order: 2;
}

.message.assistant .message-avatar {
    background-color: var(--success-color);
    color: #1e1e1e;
}

.message-content {
    flex: 1;
    min-width: 0;
}

.message.user {
    flex-direction: row-reverse;
}

.message-bubble {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius);
    max-width: 100%;
    word-wrap: break-word;
    white-space: pre-wrap;
    line-height: 1.6;
}

.message.user .message-bubble {
    background-color: var(--user-message-bg);
    border-bottom-right-radius: 2px;
}

.message.assistant .message-bubble {
    background-color: var(--assistant-message-bg);
    border: 1px solid var(--border-color);
    border-bottom-left-radius: 2px;
}

.message-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
}

.message.user .message-meta {
    justify-content: flex-end;
}

.message-actions {
    display: flex;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-sm);
    opacity: 0;
    transition: opacity 0.2s ease;
}

.message:hover .message-actions {
    opacity: 1;
}

.message-action-btn {
    padding: 2px 8px;
    font-size: 11px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    color: var(--text-secondary);
    cursor: pointer;
}

.message-action-btn:hover {
    color: var(--text-primary);
    border-color: var(--accent-color);
}

.input-area {
    padding: var(--spacing-md) var(--spacing-lg);
    background-color: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
}

.input-wrapper {
    display: flex;
    gap: var(--spacing-sm);
    align-items: flex-end;
}

.input-textarea {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 13px;
    font-family: inherit;
    color: var(--text-primary);
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    resize: none;
    outline: none;
    line-height: 1.5;
}

.input-textarea:focus {
    border-color: var(--accent-color);
}

.send-btn {
    height: 40px;
    padding: 0 var(--spacing-lg);
}

.compare-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.compare-header {
    padding: var(--spacing-md) var(--spacing-lg);
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
}

.compare-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: var(--spacing-sm);
}

.compare-meta {
    font-size: 12px;
    color: var(--text-secondary);
}

.compare-content {
    flex: 1;
    display: flex;
    gap: 1px;
    background-color: var(--border-color);
    overflow: hidden;
}

.compare-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-primary);
    min-width: 0;
}

.compare-panel-header {
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
}

.compare-panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
}

.compare-panel-meta {
    font-size: 11px;
    color: var(--text-muted);
}

.compare-panel-body {
    flex: 1;
    padding: var(--spacing-md);
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 13px;
    line-height: 1.6;
}

.compare-panel-footer {
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
}

.rating-stars {
    display: flex;
    gap: 2px;
}

.star {
    cursor: pointer;
    font-size: 14px;
    color: var(--text-muted);
    transition: color 0.15s ease;
}

.star.active {
    color: var(--warning-color);
}

.star:hover {
    color: var(--warning-color);
}

.hallucination-item {
    padding: var(--spacing-sm) var(--spacing-md);
    margin: var(--spacing-xs) 0;
    background-color: rgba(241, 76, 76, 0.1);
    border-left: 3px solid var(--error-color);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: 12px;
}

.hallucination-text {
    color: var(--error-color);
    font-weight: 500;
}

.hallucination-reason {
    color: var(--text-secondary);
    margin-top: 2px;
}

.review-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.review-content {
    flex: 1;
    padding: var(--spacing-lg);
    overflow-y: auto;
}

.review-section {
    margin-bottom: var(--spacing-xl);
}

.review-section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
}

.review-section-icon {
    color: var(--accent-color);
}

.quality-score {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    background-color: var(--bg-secondary);
    border-radius: var(--radius);
    margin-bottom: var(--spacing-lg);
}

.score-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    background: conic-gradient(var(--success-color) var(--score-percent, 80%), var(--bg-tertiary) 0);
}

.score-circle::before {
    content: '';
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background-color: var(--bg-secondary);
    position: absolute;
}

.score-value {
    position: relative;
    z-index: 1;
}

.score-info {
    flex: 1;
}

.score-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
}

.score-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--success-color);
}

.suggestion-list,
.criteria-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.suggestion-item,
.criteria-item {
    padding: var(--spacing-md);
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    transition: all 0.15s ease;
}

.suggestion-item:hover,
.criteria-item:hover {
    border-color: var(--accent-color);
    background-color: var(--bg-tertiary);
}

.criteria-item {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
}

.criteria-checkbox {
    width: 16px;
    height: 16px;
    margin-top: 2px;
    flex-shrink: 0;
    cursor: pointer;
    accent-color: var(--accent-color);
}

.criteria-text {
    flex: 1;
    font-size: 13px;
    line-height: 1.5;
}

.criteria-item.completed .criteria-text {
    text-decoration: line-through;
    color: var(--text-muted);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--text-muted);
}

.empty-state-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
}

.empty-state-text {
    font-size: 14px;
    margin-bottom: var(--spacing-sm);
}

.empty-state-hint {
    font-size: 12px;
    color: var(--text-muted);
}

.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-md);
    color: var(--text-secondary);
}

.loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.badge {
    display: inline-block;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 10px;
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
}

.badge-success {
    background-color: rgba(78, 201, 176, 0.2);
    color: var(--success-color);
}

.badge-warning {
    background-color: rgba(220, 220, 170, 0.2);
    color: var(--warning-color);
}

.badge-error {
    background-color: rgba(241, 76, 76, 0.2);
    color: var(--error-color);
}

.badge-info {
    background-color: rgba(55, 148, 255, 0.2);
    color: var(--info-color);
}

.divider {
    height: 1px;
    background-color: var(--border-color);
    margin: var(--spacing-md) 0;
}

.code-block {
    background-color: var(--bg-tertiary);
    padding: var(--spacing-md);
    border-radius: var(--radius);
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    overflow-x: auto;
    margin: var(--spacing-sm) 0;
}

.inline-code {
    background-color: var(--bg-tertiary);
    padding: 1px 6px;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    color: var(--warning-color);
}
`;
}

function getViewContent(viewType: ViewType): string {
    switch (viewType) {
        case 'chat':
            return getChatViewContent();
        case 'compare':
            return getCompareViewContent();
        case 'review':
            return getReviewViewContent();
        default:
            return '<div class="empty-state">未知视图类型</div>';
    }
}

function getChatViewContent(): string {
    return `
    <div class="chat-container">
        <div class="header">
            <div class="header-title">AI 对话</div>
            <div class="header-actions">
                <button class="btn btn-icon" id="clearBtn" title="清空对话">
                    <span>🗑</span>
                </button>
                <button class="btn btn-icon" id="settingsBtn" title="设置">
                    <span>⚙</span>
                </button>
            </div>
        </div>
        <div class="message-list scrollable" id="messageList">
            <div class="empty-state" id="emptyState">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-text">开始一段对话</div>
                <div class="empty-state-hint">在下方输入框中输入消息开始</div>
            </div>
        </div>
        <div class="input-area">
            <div class="input-wrapper">
                <textarea class="input-textarea" id="messageInput" placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"></textarea>
                <button class="btn btn-primary send-btn" id="sendBtn">发送</button>
            </div>
        </div>
    </div>
    `;
}

function getCompareViewContent(): string {
    return `
    <div class="compare-container">
        <div class="compare-header">
            <div class="compare-title" id="compareTitle">对比运行</div>
            <div class="compare-meta" id="compareMeta">选择模型进行对比测试</div>
        </div>
        <div class="compare-content" id="compareContent">
            <div class="empty-state" style="flex: 1;">
                <div class="empty-state-icon">🔄</div>
                <div class="empty-state-text">暂无对比数据</div>
                <div class="empty-state-hint">运行对比测试后查看结果</div>
            </div>
        </div>
    </div>
    `;
}

function getReviewViewContent(): string {
    return `
    <div class="review-container">
        <div class="header">
            <div class="header-title">评审报告</div>
            <div class="header-actions">
                <button class="btn btn-icon" id="refreshBtn" title="刷新">
                    <span>🔄</span>
                </button>
                <button class="btn btn-icon" id="exportBtn" title="导出">
                    <span>📥</span>
                </button>
            </div>
        </div>
        <div class="review-content scrollable" id="reviewContent">
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">暂无评审报告</div>
                <div class="empty-state-hint">对回答进行评审后查看报告</div>
            </div>
        </div>
    </div>
    `;
}

function getScript(viewType: ViewType): string {
    const baseScript = getBaseScript();
    const viewScript = getViewScript(viewType);

    return `
            ${baseScript}
            ${viewScript}
    `;
}

function getBaseScript(): string {
    return `
            function escapeHtml(text) {
                var div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }

            function generateId() {
                return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            }

            function formatTime(timestamp) {
                var date = new Date(timestamp);
                var now = new Date();
                var diff = now.getTime() - date.getTime();

                if (diff < 60000) { return '刚刚'; }
                if (diff < 3600000) { return Math.floor(diff / 60000) + ' 分钟前'; }
                if (diff < 86400000) { return Math.floor(diff / 3600000) + ' 小时前'; }
                if (diff < 604800000) { return Math.floor(diff / 86400000) + ' 天前'; }

                var year = date.getFullYear();
                var month = String(date.getMonth() + 1).padStart(2, '0');
                var day = String(date.getDate()).padStart(2, '0');
                var hours = String(date.getHours()).padStart(2, '0');
                var minutes = String(date.getMinutes()).padStart(2, '0');

                if (year === now.getFullYear()) {
                    return month + '-' + day + ' ' + hours + ':' + minutes;
                }
                return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
            }

            function postMessage(type, payload) {
                vscode.postMessage({ type: type, payload: payload });
            }

            window.addEventListener('message', function(event) {
                var message = event.data;
                if (message && message.type) {
                    handleMessage(message.type, message.payload);
                }
            });

            function handleMessage(type, payload) {
                var handler = messageHandlers[type];
                if (typeof handler === 'function') {
                    handler(payload);
                }
            }

            var messageHandlers = {};
    `;
}

function getViewScript(viewType: ViewType): string {
    switch (viewType) {
        case 'chat':
            return getChatScript();
        case 'compare':
            return getCompareScript();
        case 'review':
            return getReviewScript();
        default:
            return '';
    }
}

function getChatScript(): string {
    return `
            var messageList = document.getElementById('messageList');
            var messageInput = document.getElementById('messageInput');
            var sendBtn = document.getElementById('sendBtn');
            var clearBtn = document.getElementById('clearBtn');
            var settingsBtn = document.getElementById('settingsBtn');
            var emptyState = document.getElementById('emptyState');

            var messages = initialData.messages || [];

            function renderMessages() {
                if (messages.length === 0) {
                    emptyState.style.display = 'flex';
                    messageList.innerHTML = '';
                    messageList.appendChild(emptyState);
                    return;
                }

                emptyState.style.display = 'none';
                var html = '';
                for (var i = 0; i < messages.length; i++) {
                    html += renderMessage(messages[i]);
                }
                messageList.innerHTML = html;
                messageList.scrollTop = messageList.scrollHeight;
            }

            function renderMessage(msg) {
                var role = msg.role === 'user' ? 'user' : 'assistant';
                var avatarText = msg.role === 'user' ? '我' : 'AI';
                var timeStr = formatTime(msg.timestamp);
                var metaText = '';
                if (msg.model) {
                    metaText = '<span class="badge badge-info">' + escapeHtml(msg.model) + '</span>';
                }

                var actions = '';
                if (msg.role === 'assistant') {
                    actions = \`
                        <div class="message-actions">
                            <button class="message-action-btn" data-action="copy" data-id="\${msg.id}">复制</button>
                            <button class="message-action-btn" data-action="rate" data-id="\${msg.id}">评分</button>
                            <button class="message-action-btn" data-action="review" data-id="\${msg.id}">评审</button>
                        </div>
                    \`;
                }

                return \`
                    <div class="message \${role}" data-id="\${msg.id}">
                        <div class="message-avatar">\${avatarText}</div>
                        <div class="message-content">
                            <div class="message-bubble">\${escapeHtml(msg.content)}</div>
                            <div class="message-meta">
                                \${metaText}
                                <span>\${timeStr}</span>
                            </div>
                            \${actions}
                        </div>
                    </div>
                \`;
            }

            function sendMessage() {
                var content = messageInput.value.trim();
                if (!content) { return; }

                var userMessage = {
                    id: generateId(),
                    role: 'user',
                    content: content,
                    timestamp: Date.now()
                };
                messages.push(userMessage);
                renderMessages();

                messageInput.value = '';
                messageInput.style.height = 'auto';

                postMessage('chat:send', { content: content });
            }

            function clearMessages() {
                messages = [];
                renderMessages();
                postMessage('chat:clear', {});
            }

            sendBtn.addEventListener('click', sendMessage);

            messageInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            clearBtn.addEventListener('click', function() {
                if (confirm('确定要清空所有对话吗？')) {
                    clearMessages();
                }
            });

            settingsBtn.addEventListener('click', function() {
                postMessage('chat:settings', {});
            });

            messageList.addEventListener('click', function(e) {
                var target = e.target;
                if (target.classList.contains('message-action-btn')) {
                    var action = target.dataset.action;
                    var messageId = target.dataset.id;
                    handleMessageAction(action, messageId);
                }
            });

            function handleMessageAction(action, messageId) {
                switch (action) {
                    case 'copy':
                        var msg = messages.find(function(m) { return m.id === messageId; });
                        if (msg) {
                            navigator.clipboard.writeText(msg.content).then(function() {
                                postMessage('chat:copied', { messageId: messageId });
                            });
                        }
                        break;
                    case 'rate':
                        postMessage('chat:rate', { messageId: messageId });
                        break;
                    case 'review':
                        postMessage('chat:review', { messageId: messageId });
                        break;
                }
            }

            messageHandlers['chat:response'] = function(payload) {
                var responseMessage = {
                    id: payload.id || generateId(),
                    role: 'assistant',
                    content: payload.content,
                    timestamp: Date.now(),
                    model: payload.model,
                    provider: payload.provider
                };
                messages.push(responseMessage);
                renderMessages();
            };

            messageHandlers['chat:stream'] = function(payload) {
                var lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant' && payload.isStreaming) {
                    lastMessage.content += payload.delta || '';
                    renderMessages();
                } else {
                    var newMessage = {
                        id: payload.id || generateId(),
                        role: 'assistant',
                        content: payload.delta || '',
                        timestamp: Date.now(),
                        model: payload.model,
                        provider: payload.provider
                    };
                    messages.push(newMessage);
                    renderMessages();
                }
            };

            messageHandlers['chat:setMessages'] = function(payload) {
                messages = payload.messages || [];
                renderMessages();
            };

            renderMessages();
    `;
}

function getCompareScript(): string {
    return `
            var compareContent = document.getElementById('compareContent');
            var compareTitle = document.getElementById('compareTitle');
            var compareMeta = document.getElementById('compareMeta');

            var compareData = initialData;

            function renderCompare() {
                if (!compareData || !compareData.responses || compareData.responses.length === 0) {
                    compareContent.innerHTML = \`
                        <div class="empty-state" style="flex: 1;">
                            <div class="empty-state-icon">🔄</div>
                            <div class="empty-state-text">暂无对比数据</div>
                            <div class="empty-state-hint">运行对比测试后查看结果</div>
                        </div>
                    \`;
                    return;
                }

                compareTitle.textContent = compareData.title || '对比运行';
                compareMeta.textContent = compareData.sampleName || '对比 ' + compareData.responses.length + ' 个模型的回答';

                var panelsHtml = '';
                for (var i = 0; i < compareData.responses.length; i++) {
                    var response = compareData.responses[i];
                    panelsHtml += renderComparePanel(response, i);
                }

                compareContent.innerHTML = panelsHtml;
                bindCompareEvents();
            }

            function renderComparePanel(response, index) {
                var durationText = response.duration ? (response.duration / 1000).toFixed(2) + ' 秒' : '';
                var tokensText = response.tokens ? response.tokens + ' tokens' : '';
                var metaText = [durationText, tokensText].filter(Boolean).join(' · ');

                var starsHtml = '';
                for (var i = 1; i <= 5; i++) {
                    starsHtml += \`<span class="star \${i <= (response.rating || 0) ? 'active' : ''}" data-rating="\${i}">★</span>\`;
                }

                var hallucinationsHtml = '';
                if (response.hallucinations && response.hallucinations.length > 0) {
                    hallucinationsHtml = '<div class="hallucination-section" style="margin-top: 12px;">';
                    hallucinationsHtml += '<div style="font-size: 12px; font-weight: 600; color: var(--error-color); margin-bottom: 8px;">';
                    hallucinationsHtml += '⚠ 检测到 ' + response.hallucinations.length + ' 个可能的幻觉点';
                    hallucinationsHtml += '</div>';
                    for (var i = 0; i < response.hallucinations.length; i++) {
                        var h = response.hallucinations[i];
                        hallucinationsHtml += \`
                            <div class="hallucination-item">
                                <div class="hallucination-text">\${escapeHtml(h.text)}</div>
                                \${h.reason ? '<div class="hallucination-reason">' + escapeHtml(h.reason) + '</div>' : ''}
                            </div>
                        \`;
                    }
                    hallucinationsHtml += '</div>';
                }

                return \`
                    <div class="compare-panel" data-id="\${response.id || 'resp-' + index}">
                        <div class="compare-panel-header">
                            <div class="compare-panel-title">\${escapeHtml(response.model)}</div>
                            <div class="compare-panel-meta">\${escapeHtml(response.provider || '')}</div>
                        </div>
                        <div class="compare-panel-body">\${escapeHtml(response.content)}</div>
                        \${hallucinationsHtml}
                        <div class="compare-panel-footer">
                            <div class="rating-stars" data-response-id="\${response.id || 'resp-' + index}">
                                \${starsHtml}
                            </div>
                            <div class="compare-panel-meta">\${escapeHtml(metaText)}</div>
                        </div>
                    </div>
                \`;
            }

            function bindCompareEvents() {
                var ratingStars = document.querySelectorAll('.rating-stars');
                ratingStars.forEach(function(container) {
                    var stars = container.querySelectorAll('.star');
                    stars.forEach(function(star) {
                        star.addEventListener('click', function() {
                            var rating = parseInt(this.dataset.rating);
                            var responseId = container.dataset.responseId;
                            handleRating(responseId, rating);
                        });

                        star.addEventListener('mouseenter', function() {
                            var rating = parseInt(this.dataset.rating);
                            stars.forEach(function(s, idx) {
                                if (idx < rating) {
                                    s.classList.add('active');
                                } else {
                                    s.classList.remove('active');
                                }
                            });
                        });
                    });

                    container.addEventListener('mouseleave', function() {
                        var currentRating = 0;
                        if (compareData && compareData.responses) {
                            var responseId = container.dataset.responseId;
                            var response = compareData.responses.find(function(r) { return r.id === responseId; });
                            if (response) {
                                currentRating = response.rating || 0;
                            }
                        }
                        stars.forEach(function(s, idx) {
                            if (idx < currentRating) {
                                s.classList.add('active');
                            } else {
                                s.classList.remove('active');
                            }
                        });
                    });
                });
            }

            function handleRating(responseId, rating) {
                if (compareData && compareData.responses) {
                    var response = compareData.responses.find(function(r) { return r.id === responseId; });
                    if (response) {
                        response.rating = rating;
                    }
                }
                renderCompare();
                postMessage('compare:rate', { responseId: responseId, rating: rating });
            }

            messageHandlers['compare:setData'] = function(payload) {
                compareData = payload;
                renderCompare();
            };

            messageHandlers['compare:updateResponse'] = function(payload) {
                if (compareData && compareData.responses) {
                    var index = compareData.responses.findIndex(function(r) { return r.id === payload.id; });
                    if (index !== -1) {
                        compareData.responses[index] = Object.assign({}, compareData.responses[index], payload);
                    } else {
                        compareData.responses.push(payload);
                    }
                    renderCompare();
                }
            };

            renderCompare();
    `;
}

function getReviewScript(): string {
    return `
            var reviewContent = document.getElementById('reviewContent');
            var refreshBtn = document.getElementById('refreshBtn');
            var exportBtn = document.getElementById('exportBtn');

            var reviewData = initialData;

            function renderReview() {
                if (!reviewData || (!reviewData.rewriteSuggestions && !reviewData.acceptanceCriteria && reviewData.qualityScore === undefined)) {
                    reviewContent.innerHTML = \`
                        <div class="empty-state">
                            <div class="empty-state-icon">📋</div>
                            <div class="empty-state-text">暂无评审报告</div>
                            <div class="empty-state-hint">对回答进行评审后查看报告</div>
                        </div>
                    \`;
                    return;
                }

                var html = '';

                if (reviewData.qualityScore !== undefined) {
                    var scorePercent = Math.min(100, Math.max(0, reviewData.qualityScore));
                    html += \`
                        <div class="quality-score">
                            <div class="score-circle" style="--score-percent: \${scorePercent}%;">
                                <span class="score-value">\${Math.round(scorePercent)}</span>
                            </div>
                            <div class="score-info">
                                <div class="score-label">质量评分</div>
                                <div class="score-text">\${getScoreText(scorePercent)}</div>
                            </div>
                        </div>
                    \`;
                }

                if (reviewData.rewriteSuggestions && reviewData.rewriteSuggestions.length > 0) {
                    html += '<div class="review-section">';
                    html += '<div class="review-section-title"><span class="review-section-icon">✏️</span>改写建议</div>';
                    html += '<div class="suggestion-list">';
                    for (var i = 0; i < reviewData.rewriteSuggestions.length; i++) {
                        html += '<div class="suggestion-item">' + escapeHtml(reviewData.rewriteSuggestions[i]) + '</div>';
                    }
                    html += '</div></div>';
                }

                if (reviewData.acceptanceCriteria && reviewData.acceptanceCriteria.length > 0) {
                    html += '<div class="review-section">';
                    html += '<div class="review-section-title"><span class="review-section-icon">✅</span>验收标准</div>';
                    html += '<div class="criteria-list">';
                    for (var j = 0; j < reviewData.acceptanceCriteria.length; j++) {
                        var criteria = reviewData.acceptanceCriteria[j];
                        var isCompleted = criteria.completed || false;
                        var text = typeof criteria === 'string' ? criteria : criteria.text;
                        html += \`
                            <div class="criteria-item \${isCompleted ? 'completed' : ''}">
                                <input type="checkbox" class="criteria-checkbox" \${isCompleted ? 'checked' : ''} data-index="\${j}">
                                <div class="criteria-text">\${escapeHtml(text)}</div>
                            </div>
                        \`;
                    }
                    html += '</div></div>';
                }

                reviewContent.innerHTML = html;
                bindReviewEvents();
            }

            function getScoreText(score) {
                if (score >= 90) { return '优秀'; }
                if (score >= 80) { return '良好'; }
                if (score >= 70) { return '一般'; }
                if (score >= 60) { return '及格'; }
                return '不及格';
            }

            function bindReviewEvents() {
                var checkboxes = document.querySelectorAll('.criteria-checkbox');
                checkboxes.forEach(function(checkbox) {
                    checkbox.addEventListener('change', function() {
                        var index = parseInt(this.dataset.index);
                        toggleCriteria(index, this.checked);
                    });
                });
            }

            function toggleCriteria(index, checked) {
                if (reviewData && reviewData.acceptanceCriteria) {
                    var criteria = reviewData.acceptanceCriteria[index];
                    if (typeof criteria === 'string') {
                        reviewData.acceptanceCriteria[index] = {
                            text: criteria,
                            completed: checked
                        };
                    } else {
                        criteria.completed = checked;
                    }
                    postMessage('review:toggleCriteria', { index: index, completed: checked });
                }
                renderReview();
            }

            refreshBtn.addEventListener('click', function() {
                postMessage('review:refresh', {});
            });

            exportBtn.addEventListener('click', function() {
                postMessage('review:export', {});
            });

            messageHandlers['review:setData'] = function(payload) {
                reviewData = payload;
                renderReview();
            };

            messageHandlers['review:updateScore'] = function(payload) {
                if (reviewData) {
                    reviewData.qualityScore = payload.score;
                    renderReview();
                }
            };

            messageHandlers['review:updateSuggestions'] = function(payload) {
                if (reviewData) {
                    reviewData.rewriteSuggestions = payload.suggestions || [];
                    renderReview();
                }
            };

            messageHandlers['review:updateCriteria'] = function(payload) {
                if (reviewData) {
                    reviewData.acceptanceCriteria = payload.criteria || [];
                    renderReview();
                }
            };

            renderReview();
    `;
}
