import * as vscode from 'vscode';
import { StorageService } from './services/storage';
import { AIService } from './services/aiService';
import * as types from './types';
import { PromptFilesProvider } from './views/promptFilesView';
import { SamplesProvider } from './views/samplesView';
import { VariablesProvider } from './views/variablesView';
import { FavoritesProvider } from './views/favoritesView';
import { ChatViewProvider } from './views/chatView';
import { CompareViewProvider } from './views/compareView';
import { ReviewViewProvider } from './views/reviewView';

let storageService: StorageService;
let aiService: AIService;
let chatViewProvider: ChatViewProvider;
let compareViewProvider: CompareViewProvider;
let reviewViewProvider: ReviewViewProvider;
let promptFilesProvider: PromptFilesProvider;
let samplesProvider: SamplesProvider;
let variablesProvider: VariablesProvider;
let favoritesProvider: FavoritesProvider;

export function activate(context: vscode.ExtensionContext): void {
    storageService = new StorageService();
    aiService = createAIService();

    chatViewProvider = new ChatViewProvider(context.extensionUri, storageService, aiService);
    compareViewProvider = new CompareViewProvider(context.extensionUri, storageService, aiService);
    reviewViewProvider = new ReviewViewProvider(context.extensionUri, storageService, aiService);
    promptFilesProvider = new PromptFilesProvider(storageService);
    samplesProvider = new SamplesProvider(storageService);
    variablesProvider = new VariablesProvider(storageService);
    favoritesProvider = new FavoritesProvider(storageService);

    registerViews(context);
    registerCommands(context);
    registerEventListeners(context);
}

export function deactivate(): void {
}

function createAIService(): AIService {
    const config = vscode.workspace.getConfiguration('aiStudio');
    const providers: types.AIProviderConfig[] = [];

    const openaiKey = config.get<string>('providers.openai.apiKey', '');
    if (openaiKey) {
        providers.push({
            type: 'openai',
            name: 'OpenAI',
            apiKey: openaiKey,
            baseUrl: config.get<string>('providers.openai.baseUrl', 'https://api.openai.com/v1'),
            model: config.get<string>('defaultModel', 'gpt-3.5-turbo'),
            enabled: true
        });
    }

    const anthropicKey = config.get<string>('providers.anthropic.apiKey', '');
    if (anthropicKey) {
        providers.push({
            type: 'anthropic',
            name: 'Anthropic',
            apiKey: anthropicKey,
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-3-sonnet-20240229',
            enabled: true
        });
    }

    const ollamaBaseUrl = config.get<string>('providers.ollama.baseUrl', '');
    if (ollamaBaseUrl) {
        providers.push({
            type: 'ollama',
            name: 'Ollama',
            baseUrl: ollamaBaseUrl,
            model: config.get<string>('providers.ollama.model', 'llama2'),
            enabled: true
        });
    }

    return new AIService(providers);
}

function registerViews(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatViewProvider.viewType,
            chatViewProvider
        )
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            CompareViewProvider.viewType,
            compareViewProvider
        )
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ReviewViewProvider.viewType,
            reviewViewProvider
        )
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'aiStudio.promptFilesView',
            promptFilesProvider
        )
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'aiStudio.samplesView',
            samplesProvider
        )
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'aiStudio.variablesView',
            variablesProvider
        )
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'aiStudio.favoritesView',
            favoritesProvider
        )
    );
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.askSelection', handleAskSelection)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.newPrompt', handleNewPrompt)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.savePromptVersion', handleSavePromptVersion)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.rollbackPrompt', handleRollbackPrompt)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.insertVariable', handleInsertVariable)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.runCompare', handleRunCompare)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.rateResponse', handleRateResponse)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.markHallucination', handleMarkHallucination)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.generateRewrite', handleGenerateRewrite)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.extractAcceptance', handleExtractAcceptance)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.addSnippet', handleAddSnippet)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.searchHistory', handleSearchHistory)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.exportTestRecords', handleExportTestRecords)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.shareTemplate', handleShareTemplate)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.addSample', handleAddSample)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.addToFavorites', handleAddToFavorites)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aiStudio.generateReview', handleGenerateReview)
    );
}

function registerEventListeners(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('aiStudio')) {
                storageService.refreshDataDirectory();
                refreshAllViews();
            }
        })
    );
}

function refreshAllViews(): void {
    promptFilesProvider.refresh();
    samplesProvider.refresh();
    variablesProvider.refresh();
    favoritesProvider.refresh();
}

async function handleAskSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开编辑器');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText.trim()) {
        vscode.window.showWarningMessage('请先选中要提问的文本');
        return;
    }

    await chatViewProvider.askWithSelection(selectedText);
}

async function handleNewPrompt(): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: '请输入提示词名称',
        placeHolder: '例如：产品需求分析助手'
    });

    if (!name) {
        return;
    }

    const description = await vscode.window.showInputBox({
        prompt: '请输入提示词描述（可选）',
        placeHolder: '简要描述这个提示词的用途'
    });

    const tagsInput = await vscode.window.showInputBox({
        prompt: '请输入标签，用逗号分隔（可选）',
        placeHolder: '例如：产品,需求分析'
    });

    const tags = tagsInput
        ? tagsInput.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    const prompt = await storageService.createPrompt({
        name,
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined
    });

    const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: `# ${name}\n\n${description || ''}\n\n---\n\n在此输入提示词内容...\n`
    });

    await vscode.window.showTextDocument(doc);

    promptFilesProvider.refresh();
    vscode.window.showInformationMessage(`提示词「${name}」已创建`);
}

async function handleSavePromptVersion(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开编辑器');
        return;
    }

    const content = editor.document.getText();

    const promptName = await vscode.window.showInputBox({
        prompt: '请输入提示词名称以保存版本',
        placeHolder: '选择或输入提示词名称'
    });

    if (!promptName) {
        return;
    }

    const prompts = await storageService.getPrompts();
    let prompt = prompts.find(p => p.name === promptName);

    if (!prompt) {
        const create = await vscode.window.showWarningMessage(
            `提示词「${promptName}」不存在，是否创建？`,
            '创建',
            '取消'
        );

        if (create !== '创建') {
            return;
        }

        prompt = await storageService.createPrompt({
            name: promptName
        });
    }

    const note = await vscode.window.showInputBox({
        prompt: '请输入版本备注（可选）',
        placeHolder: '例如：优化了需求分析部分'
    });

    const version = await storageService.addPromptVersion(
        prompt.id,
        content,
        note || undefined
    );

    if (version) {
        promptFilesProvider.refresh();
        vscode.window.showInformationMessage(
            `已保存版本 v${version.version} 到「${promptName}」`
        );
    }
}

async function handleRollbackPrompt(): Promise<void> {
    const prompts = await storageService.getPrompts();
    if (prompts.length === 0) {
        vscode.window.showInformationMessage('暂无提示词');
        return;
    }

    const promptItems = prompts.map(p => ({
        label: p.name,
        description: `当前 v${p.currentVersion}，共 ${p.versions.length} 个版本`,
        promptId: p.id
    }));

    const selectedPrompt = await vscode.window.showQuickPick(promptItems, {
        placeHolder: '选择要回滚的提示词'
    });

    if (!selectedPrompt) {
        return;
    }

    const prompt = await storageService.getPromptById(selectedPrompt.promptId);
    if (!prompt || prompt.versions.length === 0) {
        vscode.window.showInformationMessage('该提示词暂无历史版本');
        return;
    }

    const versionItems = [...prompt.versions]
        .sort((a, b) => b.version - a.version)
        .map(v => ({
            label: `v${v.version}`,
            description: v.note || new Date(v.createdAt).toLocaleString(),
            detail: v.version === prompt.currentVersion ? '（当前版本）' : '',
            versionId: v.id
        }));

    const selectedVersion = await vscode.window.showQuickPick(versionItems, {
        placeHolder: '选择要回滚到的版本'
    });

    if (!selectedVersion) {
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `确定要回滚到版本 ${selectedVersion.label} 吗？`,
        '确定回滚',
        '取消'
    );

    if (confirm !== '确定回滚') {
        return;
    }

    const updated = await storageService.rollbackPromptVersion(
        prompt.id,
        selectedVersion.versionId
    );

    if (updated) {
        const currentVersion = updated.versions.find(
            v => v.version === updated.currentVersion
        );
        if (currentVersion) {
            const doc = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: currentVersion.content
            });
            await vscode.window.showTextDocument(doc);
        }

        promptFilesProvider.refresh();
        vscode.window.showInformationMessage(
            `已回滚到版本 ${selectedVersion.label}`
        );
    }
}

async function handleInsertVariable(): Promise<void> {
    const variables = await storageService.getVariables();
    if (variables.length === 0) {
        const create = await vscode.window.showWarningMessage(
            '暂无变量，是否创建一个？',
            '创建变量',
            '取消'
        );

        if (create === '创建变量') {
            await handleCreateVariable();
        }
        return;
    }

    const items = variables.map(v => ({
        label: v.name,
        description: `${v.type}${v.defaultValue ? ' = ' + v.defaultValue : ''}`,
        detail: v.description,
        variable: v
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择要插入的变量'
    });

    if (!selected) {
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const snippet = `{{${selected.variable.name}}}`;
        editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, snippet);
        });
    }
}

async function handleCreateVariable(): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: '请输入变量名称',
        placeHolder: '例如：productName'
    });

    if (!name) {
        return;
    }

    const typeOptions: { label: string; value: types.Variable['type'] }[] = [
        { label: '字符串', value: 'string' },
        { label: '数字', value: 'number' },
        { label: '布尔', value: 'boolean' },
        { label: '选择', value: 'select' }
    ];

    const typePick = await vscode.window.showQuickPick(typeOptions, {
        placeHolder: '选择变量类型'
    });

    if (!typePick) {
        return;
    }

    const defaultValue = await vscode.window.showInputBox({
        prompt: '请输入默认值（可选）',
        placeHolder: '默认值'
    });

    const description = await vscode.window.showInputBox({
        prompt: '请输入变量描述（可选）',
        placeHolder: '简要描述这个变量的用途'
    });

    let options: string[] | undefined;
    if (typePick.value === 'select') {
        const optionsInput = await vscode.window.showInputBox({
            prompt: '请输入选项，用逗号分隔',
            placeHolder: '例如：选项1,选项2,选项3'
        });
        options = optionsInput
            ? optionsInput.split(',').map(o => o.trim()).filter(Boolean)
            : undefined;
    }

    await storageService.createVariable({
        name,
        type: typePick.value,
        defaultValue: defaultValue || undefined,
        description: description || undefined,
        options
    });

    variablesProvider.refresh();
    vscode.window.showInformationMessage(`变量「${name}」已创建`);
}

async function handleRunCompare(): Promise<void> {
    const providers = aiService.getAvailableProviders();
    if (providers.length === 0) {
        vscode.window.showWarningMessage('请先在设置中配置 AI 提供商');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    let promptContent = '';

    if (editor) {
        promptContent = editor.document.getText();
    }

    if (!promptContent.trim()) {
        const input = await vscode.window.showInputBox({
            prompt: '请输入要对比测试的提示词内容',
            placeHolder: '输入提示词...'
        });
        if (!input) {
            return;
        }
        promptContent = input;
    }

    const modelConfigs: { provider: string; model: string }[] = [];
    for (const provider of providers) {
        const config = vscode.workspace.getConfiguration('aiStudio');
        let model = config.get<string>('defaultModel', 'gpt-3.5-turbo');
        if (provider === 'Ollama') {
            model = config.get<string>('providers.ollama.model', 'llama2');
        }
        modelConfigs.push({ provider, model });
    }

    await vscode.commands.executeCommand('aiStudio.compareView.focus');

    compareViewProvider.runComparison(
        promptContent,
        modelConfigs
    );
}

async function handleRateResponse(): Promise<void> {
    vscode.window.showInformationMessage('请在聊天或对比视图中点击评分按钮');
}

async function handleMarkHallucination(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开编辑器');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText.trim()) {
        vscode.window.showWarningMessage('请先选中要标记为幻觉的文本');
        return;
    }

    const reason = await vscode.window.showInputBox({
        prompt: '请输入标记为幻觉的原因（可选）',
        placeHolder: '例如：与事实不符'
    });

    vscode.window.showInformationMessage(
        `已标记「${selectedText.slice(0, 20)}...」为幻觉点`
    );
}

async function handleGenerateRewrite(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开编辑器');
        return;
    }

    const content = editor.document.getText();
    if (!content.trim()) {
        vscode.window.showWarningMessage('文档内容为空');
        return;
    }

    await vscode.commands.executeCommand('aiStudio.reviewView.focus');
    reviewViewProvider.generateReview(content, 'editor-content');
}

async function handleExtractAcceptance(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开编辑器');
        return;
    }

    const content = editor.document.getText();
    if (!content.trim()) {
        vscode.window.showWarningMessage('文档内容为空');
        return;
    }

    await vscode.commands.executeCommand('aiStudio.reviewView.focus');
    reviewViewProvider.generateReview(content, 'editor-content');
}

async function handleAddSnippet(): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: '请输入片段名称',
        placeHolder: '例如：需求分析模板'
    });

    if (!name) {
        return;
    }

    const category = await vscode.window.showInputBox({
        prompt: '请输入分类',
        placeHolder: '例如：需求分析',
        value: '常用'
    });

    const content = await vscode.window.showInputBox({
        prompt: '请输入片段内容',
        placeHolder: '输入常用提示词片段...'
    });

    if (!content) {
        return;
    }

    await storageService.createSnippet({
        name,
        category: category || '常用',
        content
    });

    favoritesProvider.refresh();
    vscode.window.showInformationMessage(`片段「${name}」已创建`);
}

async function handleSearchHistory(): Promise<void> {
    const query = await vscode.window.showInputBox({
        prompt: '搜索历史记录',
        placeHolder: '输入关键词搜索...'
    });

    if (!query) {
        return;
    }

    const conversations = await storageService.getConversations();
    const prompts = await storageService.getPrompts();
    const snippets = await storageService.getSnippets();

    const results: { label: string; description: string; detail?: string }[] = [];

    for (const conv of conversations) {
        if (conv.title.includes(query) ||
            conv.messages.some(m => m.content.includes(query))) {
            results.push({
                label: `💬 ${conv.title}`,
                description: '对话',
                detail: conv.messages.length + ' 条消息'
            });
        }
    }

    for (const prompt of prompts) {
        if (prompt.name.includes(query) ||
            prompt.description?.includes(query) ||
            prompt.versions.some(v => v.content.includes(query))) {
            results.push({
                label: `📄 ${prompt.name}`,
                description: '提示词',
                detail: prompt.description
            });
        }
    }

    for (const snippet of snippets) {
        if (snippet.name.includes(query) ||
            snippet.content.includes(query) ||
            snippet.category.includes(query)) {
            results.push({
                label: `📝 ${snippet.name}`,
                description: `片段 - ${snippet.category}`,
                detail: snippet.content.slice(0, 50)
            });
        }
    }

    if (results.length === 0) {
        vscode.window.showInformationMessage(`未找到与「${query}」相关的记录`);
        return;
    }

    const selected = await vscode.window.showQuickPick(results, {
        placeHolder: `找到 ${results.length} 条结果`
    });

    if (selected) {
        vscode.window.showInformationMessage(`已选择：${selected.label}`);
    }
}

async function handleExportTestRecords(): Promise<void> {
    const compareResults = await storageService.getCompareResults();
    const reviewReports = await storageService.getReviewReports();

    if (compareResults.length === 0 && reviewReports.length === 0) {
        vscode.window.showInformationMessage('暂无测试记录可导出');
        return;
    }

    let content = '# AI 助手测试记录\n\n';
    content += `导出时间：${new Date().toLocaleString()}\n\n`;

    if (compareResults.length > 0) {
        content += `## 对比测试记录（共 ${compareResults.length} 条）\n\n`;
        for (const result of compareResults) {
            content += `### 对比测试 ${result.id}\n\n`;
            content += `- 时间：${new Date(result.createdAt).toLocaleString()}\n`;
            content += `- 响应数量：${result.responses.length}\n\n`;
            for (const resp of result.responses) {
                content += `#### ${resp.model} (${resp.provider})\n\n`;
                content += `评分：${resp.rating || '未评分'}\n\n`;
                content += `${resp.content}\n\n`;
            }
        }
    }

    if (reviewReports.length > 0) {
        content += `## 评审报告（共 ${reviewReports.length} 条）\n\n`;
        for (const report of reviewReports) {
            content += `### 评审报告 ${report.id}\n\n`;
            content += `- 时间：${new Date(report.createdAt).toLocaleString()}\n`;
            if (report.qualityScore !== undefined) {
                content += `- 质量评分：${report.qualityScore}/100\n`;
            }
            content += '\n';
        }
    }

    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`ai-test-records-${Date.now()}.md`),
        filters: {
            'Markdown': ['md'],
            'JSON': ['json']
        }
    });

    if (uri) {
        await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from(content, 'utf-8')
        );
        vscode.window.showInformationMessage('测试记录已导出');
    }
}

async function handleShareTemplate(): Promise<void> {
    const prompts = await storageService.getPrompts();
    if (prompts.length === 0) {
        vscode.window.showInformationMessage('暂无提示词可分享');
        return;
    }

    const items = prompts.map(p => ({
        label: p.name,
        description: p.description || '',
        promptId: p.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择要分享的提示词模板'
    });

    if (!selected) {
        return;
    }

    const prompt = await storageService.getPromptById(selected.promptId);
    if (!prompt) {
        return;
    }

    const currentVersion = prompt.versions.find(
        v => v.version === prompt.currentVersion
    );

    const template = {
        name: prompt.name,
        description: prompt.description,
        tags: prompt.tags,
        version: prompt.currentVersion,
        content: currentVersion?.content || '',
        exportedAt: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(template, null, 2);

    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${prompt.name}-template.json`),
        filters: {
            'JSON': ['json']
        }
    });

    if (uri) {
        await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from(jsonContent, 'utf-8')
        );
        vscode.window.showInformationMessage(
            `模板「${prompt.name}」已导出，可分享给他人`
        );
    }
}

async function handleAddSample(): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: '请输入样例名称',
        placeHolder: '例如：电商产品需求'
    });

    if (!name) {
        return;
    }

    const content = await vscode.window.showInputBox({
        prompt: '请输入样例输入内容',
        placeHolder: '输入测试用的样例内容...'
    });

    if (!content) {
        return;
    }

    const prompts = await storageService.getPrompts();
    let promptId: string | undefined;

    if (prompts.length > 0) {
        const items = [
            { label: '不关联提示词', promptId: '' },
            ...prompts.map(p => ({
                label: p.name,
                promptId: p.id
            }))
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择关联的提示词（可选）'
        });

        if (selected && selected.promptId) {
            promptId = selected.promptId;
        }
    }

    await storageService.createSample({
        name,
        content,
        promptId
    });

    samplesProvider.refresh();
    vscode.window.showInformationMessage(`样例「${name}」已添加`);
}

async function handleAddToFavorites(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('请先打开编辑器');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText.trim()) {
        vscode.window.showWarningMessage('请先选中要收藏的文本');
        return;
    }

    const name = await vscode.window.showInputBox({
        prompt: '请输入收藏名称',
        placeHolder: '例如：重要需求片段'
    });

    if (!name) {
        return;
    }

    const note = await vscode.window.showInputBox({
        prompt: '请输入备注（可选）',
        placeHolder: '添加备注说明...'
    });

    const typeOptions: { label: string; value: types.FavoriteItem['type'] }[] = [
        { label: '片段', value: 'snippet' },
        { label: '提示词', value: 'prompt' },
        { label: '样例', value: 'sample' },
        { label: '对话', value: 'conversation' }
    ];

    const typePick = await vscode.window.showQuickPick(typeOptions, {
        placeHolder: '选择收藏类型'
    });

    if (!typePick) {
        return;
    }

    await storageService.createFavorite({
        type: typePick.value,
        targetId: `fav-${Date.now()}`,
        name,
        note: note || undefined
    });

    if (typePick.value === 'snippet') {
        await storageService.createSnippet({
            name,
            category: '收藏',
            content: selectedText
        });
    }

    favoritesProvider.refresh();
    vscode.window.showInformationMessage(`已添加到收藏：${name}`);
}

async function handleGenerateReview(payload: { messageId: string; content: string }): Promise<void> {
    await reviewViewProvider.generateReview(payload.content, payload.messageId);
}
