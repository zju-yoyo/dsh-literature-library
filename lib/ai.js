/**
 * Model-backed reading assistance: translation, summaries, and grounded Q&A.
 *
 * Calls go through the Host `llm` service with the Agent's default model
 * selection, so this bundle inherits the profile's provider, credentials, and
 * account rather than storing its own. The paper text is sent to that provider
 * only for the operation the user asks for.
 */
import { truncateText } from './util.js'

/** Per-operation output budgets. */
const MAX_OUTPUT_TOKENS = { translate: 4096, summarize: 4096, ask: 3072 }

/** Language names used in prompts. */
const LANGUAGE_NAMES = { zh: '简体中文', en: 'English' }

/**
 * Describe a paper for a prompt header.
 * @param paper - library record.
 * @returns a compact citation line.
 */
function citationLine(paper) {
  const authors = paper.authors.length === 0 ? '' : `作者：${paper.authors.slice(0, 6).join('、')}${paper.authors.length > 6 ? ' 等' : ''}\n`
  const year = paper.year === null ? '' : `${paper.year}`
  return `标题：${paper.title}\n${authors}${year === '' ? '' : `年份：${year}\n`}${paper.venue === '' ? '' : `来源：${paper.venue}\n`}${paper.arxivId === '' ? '' : `arXiv：${paper.arxivId}\n`}${paper.doi === '' ? '' : `DOI：${paper.doi}\n`}`
}

/** Model-backed reading assistant for one library. */
export class LiteratureAi {
  /**
   * @param ctx - Host plugin context.
   * @param config - resolved plugin config.
   * @param library - the literature operations that supply paper text.
   */
  constructor(ctx, config, library) {
    this.ctx = ctx
    this.config = config
    this.library = library
  }

  /**
   * Resolve the provider and model this bundle calls.
   * @returns the route and where it came from.
   */
  resolveRoute() {
    if (this.config.provider !== '' && this.config.model !== '') {
      return { provider: this.config.provider, model: this.config.model, source: 'config' }
    }
    const selection = this.ctx.get('agentDefaultModel')?.currentSelection?.()
    if (selection !== undefined && typeof selection.provider === 'string' && typeof selection.model === 'string') {
      return { provider: selection.provider, model: selection.model, source: 'default-model' }
    }
    return undefined
  }

  /**
   * Whether model calls are possible right now.
   * @returns the route availability and the model name for the UI.
   */
  status() {
    const llm = this.ctx.get('llm')
    const route = this.resolveRoute()
    if (llm === undefined || route === undefined) {
      return { available: false, provider: '', model: '', reason: llm === undefined ? '当前环境没有模型服务' : '未配置默认模型' }
    }
    return { available: true, provider: route.provider, model: route.model, source: route.source, reason: '' }
  }

  /**
   * Translate one text into the configured target language.
   * @param paper - the paper the text belongs to.
   * @param text - text to translate; the whole paper when omitted.
   * @param target - `zh`, `en`, or `auto` for the plugin's language.
   * @param signal - caller cancellation.
   * @returns the translation.
   */
  async translate(paper, text, target, signal) {
    const language = target === 'en' ? 'en' : target === 'auto' || target === undefined ? this.config.language : 'zh'
    const languageName = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.zh
    const sourceText = typeof text === 'string' && text.trim() !== ''
      ? truncateText(text.trim(), 12_000)
      : truncateText(this.library.promptText(paper.id) ?? paper.abstract, 20_000)
    if (sourceText.trim() === '') throw new Error('没有可翻译的正文，请先下载 PDF 或提取正文')
    const prompt = [
      `把下面的学术文献内容翻译成${languageName}。`,
      '要求：保留术语准确性，公式与引用标号保持原样，不要添加解释、不要总结、不要输出原文。',
      '',
      sourceText,
    ].join('\n')
    return await this.complete({
      system: `你是专业的学术文献译者，擅长计算机科学与跨学科论文的${languageName}翻译。你只输出译文。`,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      maxTokens: MAX_OUTPUT_TOKENS.translate,
      signal,
    })
  }

  /**
   * Summarize one paper.
   * @param paper - library record.
   * @param detail - `brief` (one paragraph) or `structured` (sections).
   * @param signal - caller cancellation.
   * @returns the summary.
   */
  async summarize(paper, detail, signal) {
    const body = this.library.promptText(paper.id)
    const source = body ?? `（仅摘要可用）\n${paper.abstract}`
    if (source.trim() === '') throw new Error('没有可总结的内容，请先下载 PDF 或提取正文')
    const languageName = LANGUAGE_NAMES[this.config.language] ?? LANGUAGE_NAMES.zh
    const shape = detail === 'brief'
      ? '用一段 150–250 字的文字概括这篇论文。'
      : [
        '按以下小标题输出，每节 2–4 句话：',
        '1. 研究问题',
        '2. 方法与模型',
        '3. 主要贡献',
        '4. 实验与结论',
        '5. 局限与可借鉴之处',
      ].join('\n')
    const prompt = [
      `请阅读下面这篇学术文献并用${languageName}总结。${shape}`,
      '要求：忠实于原文，不虚构数据；无法从正文确认的内容标注“原文未提及”。',
      '',
      citationLine(paper),
      '正文：',
      source,
    ].join('\n')
    return await this.complete({
      system: `你是严谨的学术文献分析助手，用${languageName}输出结构化的论文总结。`,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      maxTokens: MAX_OUTPUT_TOKENS.summarize,
      signal,
    })
  }

  /**
   * Answer a question grounded in one paper.
   * @param paper - library record.
   * @param question - user question.
   * @param history - prior turns as `{role, content}` entries.
   * @param signal - caller cancellation.
   * @returns the answer.
   */
  async ask(paper, question, history, signal) {
    const asked = typeof question === 'string' ? question.trim() : ''
    if (asked === '') throw new Error('请输入问题')
    const body = this.library.promptText(paper.id)
    const source = body ?? `（仅摘要可用）\n${paper.abstract}`
    if (source.trim() === '') throw new Error('没有可用的正文，请先下载 PDF 或提取正文')
    const languageName = LANGUAGE_NAMES[this.config.language] ?? LANGUAGE_NAMES.zh
    const system = [
      `你是学术文献问答助手，只能依据下面这篇论文的内容回答，用${languageName}作答。`,
      '规则：优先引用原文关键句并说明它出现在哪一节或哪一页；论文没有覆盖的内容直接说“本文未涉及”，不要编造。',
      '',
      citationLine(paper),
      '正文：',
      source,
    ].join('\n')
    // Prior turns ride the user message as a transcript: a bare assistant
    // message would lack the provider/replay metadata the model layer requires.
    const earlier = (Array.isArray(history) ? history.slice(-6) : [])
      .map((turn) => {
        const content = typeof turn?.content === 'string' ? turn.content.slice(0, 4000).trim() : ''
        if (content === '') return ''
        return `${turn?.role === 'assistant' ? '助手' : '用户'}：${content}`
      })
      .filter((line) => line !== '')
      .join('\n')
    const prompt = earlier === ''
      ? asked
      : `此前的对话：\n${earlier}\n\n现在的问题：${asked}`
    const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
    return await this.complete({ system, messages, maxTokens: MAX_OUTPUT_TOKENS.ask, signal })
  }

  /**
   * Run one model call and collect its text.
   * @param request - system text, messages, output budget, and cancellation.
   * @returns the assistant text.
   */
  async complete(request) {
    const llm = this.ctx.get('llm')
    if (llm === undefined) throw new Error('当前环境没有可用的模型服务')
    const route = this.resolveRoute()
    if (route === undefined) throw new Error('未配置默认模型：请在“设置 → 模型”里选择默认模型，或在本插件配置中指定 provider 与 model')
    let text = ''
    let failure
    try {
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        system: request.system,
        messages: request.messages,
        maxTokens: request.maxTokens,
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        signal: request.signal,
      })
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') text += chunk.text
        else if (chunk.type === 'finish') {
          if (chunk.reason.kind === 'error') failure = chunk.reason.failure?.message ?? '模型调用失败'
          else if (chunk.reason.kind === 'aborted') failure = '模型调用已取消'
        }
      }
    } catch (error) {
      throw new Error(this.explain(error))
    }
    if (failure !== undefined) throw new Error(failure)
    const trimmed = text.trim()
    if (trimmed === '') throw new Error('模型没有返回内容，请重试')
    return trimmed
  }

  /**
   * Turn a provider failure into a readable sentence.
   * @param error - thrown value.
   * @returns the message.
   */
  explain(error) {
    if (error instanceof Error) {
      const code = typeof error.code === 'string' ? `${error.code}: ` : ''
      return `模型调用失败（${code}${error.message}）`
    }
    return `模型调用失败（${String(error)}）`
  }
}
