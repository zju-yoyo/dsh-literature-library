/**
 * Agent-facing tools over the same literature operations the workspace uses.
 * Each tool declares a raw JSON Schema (arguments and canonical output) and a
 * pure renderer, so Chat shows a compact result while the UI remains the rich
 * surface.
 */

/**
 * Render one model-facing text block list.
 * @param text - text content.
 * @returns content blocks.
 */
function textBlock(text) {
  return [{ type: 'text', text }]
}

/**
 * Format a citation line for tool output.
 * @param paper - library record or search result.
 * @returns one line.
 */
function citation(paper) {
  const authors = Array.isArray(paper.authors) && paper.authors.length > 0 ? paper.authors.slice(0, 4).join(', ') : '未知作者'
  const year = Number.isInteger(paper.year) ? paper.year : ''
  return `${paper.title} — ${authors}${year === '' ? '' : ` (${year})`}`
}

/**
 * Register the literature tools.
 * @param ctx - Host plugin context with `tools`.
 * @param services - library, ai, and config.
 * @returns nothing; registrations are effects owned by the plugin context.
 */
export function registerLiteratureTools(ctx, services) {
  const { library, ai, config } = services

  const tools = [
    {
      name: 'literature_search',
      description: 'Search arXiv and Crossref for papers on a topic. Returns titles, authors, years, and identifiers; use literature_add with an arXiv id or link to save one to the library.',
      timeoutMs: 60_000,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search text, e.g. "selective state space models".' },
          source: { type: 'string', enum: ['arxiv', 'crossref', 'all'], description: 'Metadata service to query; defaults to arxiv.' },
          limit: { type: 'number', description: `Maximum results per source (default ${config.searchMaxResults}).` },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['results', 'failures'],
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['key', 'title', 'authors', 'arxivId', 'doi', 'url', 'hasPdf'],
                properties: {
                  key: { type: 'string' },
                  title: { type: 'string' },
                  authors: { type: 'array', items: { type: 'string' } },
                  year: { type: 'number' },
                  venue: { type: 'string' },
                  abstract: { type: 'string' },
                  arxivId: { type: 'string' },
                  doi: { type: 'string' },
                  url: { type: 'string' },
                  hasPdf: { type: 'boolean' },
                },
              },
            },
            failures: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (args, value) => {
          if (value.results.length === 0) return textBlock(`没有找到“${args.query}”相关文献。`)
          const lines = value.results.map((result, index) => `${index + 1}. ${citation(result)}${result.arxivId === '' ? '' : ` · arXiv:${result.arxivId}`}${result.hasPdf ? ' · 可下载 PDF' : ''}`)
          return textBlock([`“${args.query}”的检索结果：`, ...lines, ...value.failures.map((failure) => `注意：${failure}`)].join('\n'))
        },
      },
      async execute(args, exec) {
        const outcome = await library.search(args.query, { source: args.source, limit: args.limit, signal: exec.signal })
        return {
          results: outcome.results.map((result) => ({
            key: result.key,
            title: result.title,
            authors: result.authors,
            ...(result.year === null ? {} : { year: result.year }),
            venue: result.venue,
            abstract: result.abstract.slice(0, 1200),
            arxivId: result.arxivId,
            doi: result.doi,
            url: result.url,
            hasPdf: result.pdfUrl !== '' || result.arxivId !== '',
          })),
          failures: outcome.failures.map((failure) => `${failure.source}: ${failure.message}`),
        }
      },
    },
    {
      name: 'literature_add',
      description: 'Add a paper to the reading library. Accepts an arXiv id/link, a DOI, or a direct PDF URL; the PDF is downloaded and its text extracted for later reading and Q&A.',
      timeoutMs: 180_000,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['reference'],
        properties: {
          reference: { type: 'string', description: 'arXiv id ("2312.00752"), arXiv link, DOI ("10.1371/journal.pone.0000308"), or PDF URL.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags for the new entry.' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'id', 'title', 'duplicate', 'warnings'],
          properties: {
            ok: { type: 'boolean' },
            id: { type: 'string' },
            title: { type: 'string' },
            duplicate: { type: 'boolean' },
            hasText: { type: 'boolean' },
            warnings: { type: 'array', items: { type: 'string' } },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => {
          if (!value.ok) return textBlock(`添加失败：${value.error}`)
          const notes = [value.duplicate ? '该文献已在库中。' : '已加入文献库。']
          if (value.hasText) notes.push('正文已提取，可直接提问或总结。')
          for (const warning of value.warnings) notes.push(`注意：${warning}`)
          return textBlock(`${value.title}\n${notes.join('\n')}`)
        },
      },
      async execute(args, exec) {
        const outcome = await library.addFromReference(args.reference, { tags: args.tags, signal: exec.signal })
        if (outcome.error !== undefined) return { ok: false, id: '', title: '', duplicate: false, warnings: [], error: outcome.error }
        return {
          ok: true,
          id: outcome.paper.id,
          title: outcome.paper.title,
          duplicate: outcome.duplicate === true,
          hasText: outcome.paper.hasText === true,
          warnings: outcome.warnings ?? [],
        }
      },
    },
    {
      name: 'literature_list',
      description: 'List entries in the reading library, optionally filtered by free text, reading status, or tag.',
      timeoutMs: 20_000,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', description: 'Free text matched against title, authors, abstract, tags, and notes.' },
          status: { type: 'string', enum: ['unread', 'reading', 'read'], description: 'Reading status filter.' },
          tag: { type: 'string', description: 'Tag filter.' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['total', 'papers'],
          properties: {
            total: { type: 'number' },
            papers: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'title', 'status', 'hasText', 'tags'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  authors: { type: 'array', items: { type: 'string' } },
                  year: { type: 'number' },
                  status: { type: 'string' },
                  hasText: { type: 'boolean' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        render: (_args, value) => {
          if (value.total === 0) return textBlock('文献库是空的。可以先用 literature_search 查找，再用 literature_add 添加。')
          const lines = value.papers.map((paper) => `- [${paper.id}] ${citation(paper)} · ${paper.status}${paper.hasText ? ' · 有正文' : ' · 无正文'}`)
          return textBlock(`文献库共 ${value.total} 篇：\n${lines.join('\n')}`)
        },
      },
      async execute(args) {
        const papers = library.list({ query: args.query, status: args.status, tag: args.tag })
        return {
          total: papers.length,
          papers: papers.slice(0, 40).map((paper) => ({
            id: paper.id,
            title: paper.title,
            authors: paper.authors.slice(0, 4),
            ...(paper.year === null ? {} : { year: paper.year }),
            status: paper.status,
            hasText: paper.hasText,
            tags: paper.tags,
          })),
        }
      },
    },
    {
      name: 'literature_read',
      description: 'Read a slice of an entry\'s extracted full text by id. Use offset to continue past the returned range.',
      timeoutMs: 30_000,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Paper id from literature_list or literature_add.' },
          offset: { type: 'number', description: 'First character to return (default 0).' },
          length: { type: 'number', description: 'Characters to return (default 8000, max 40000).' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'text'],
          properties: {
            ok: { type: 'boolean' },
            title: { type: 'string' },
            text: { type: 'string' },
            offset: { type: 'number' },
            total: { type: 'number' },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => {
          if (!value.ok) return textBlock(`读取失败：${value.error}`)
          const range = `字符 ${value.offset}–${value.offset + value.text.length} / ${value.total}`
          return textBlock(`《${value.title}》（${range}）\n\n${value.text}`)
        },
      },
      async execute(args) {
        const outcome = library.readText(args.id, args.offset, args.length)
        if (outcome.error !== undefined) return { ok: false, text: '', error: outcome.error }
        return { ok: true, title: outcome.paper.title, text: outcome.text, offset: outcome.offset, total: outcome.total }
      },
    },
    {
      name: 'literature_summarize',
      description: 'Summarize one library paper with the configured model, using its extracted full text when available.',
      timeoutMs: 180_000,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Paper id.' },
          detail: { type: 'string', enum: ['structured', 'brief'], description: 'Structured sections (default) or one short paragraph.' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'summary'],
          properties: {
            ok: { type: 'boolean' },
            title: { type: 'string' },
            summary: { type: 'string' },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => textBlock(value.ok ? `《${value.title}》总结：\n\n${value.summary}` : `总结失败：${value.error}`),
      },
      async execute(args, exec) {
        const paper = library.get(args.id)
        if (paper === undefined) return { ok: false, summary: '', error: '文献不存在' }
        try {
          const summary = await ai.summarize(paper, args.detail, exec.signal)
          return { ok: true, title: paper.title, summary }
        } catch (error) {
          return { ok: false, summary: '', error: error instanceof Error ? error.message : String(error) }
        }
      },
    },
    {
      name: 'literature_ask',
      description: 'Answer a question grounded in one library paper, citing its extracted full text.',
      timeoutMs: 180_000,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'question'],
        properties: {
          id: { type: 'string', description: 'Paper id.' },
          question: { type: 'string', description: 'The question to answer from this paper.' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'answer'],
          properties: {
            ok: { type: 'boolean' },
            title: { type: 'string' },
            answer: { type: 'string' },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => textBlock(value.ok ? `《${value.title}》\n\n${value.answer}` : `提问失败：${value.error}`),
      },
      async execute(args, exec) {
        const paper = library.get(args.id)
        if (paper === undefined) return { ok: false, answer: '', error: '文献不存在' }
        try {
          const answer = await ai.ask(paper, args.question, [], exec.signal)
          return { ok: true, title: paper.title, answer }
        } catch (error) {
          return { ok: false, answer: '', error: error instanceof Error ? error.message : String(error) }
        }
      },
    },
    {
      name: 'literature_update',
      description: 'Update one library entry: reading status, tags, notes, starred flag, or remove it from the library.',
      timeoutMs: 20_000,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Paper id.' },
          status: { type: 'string', enum: ['unread', 'reading', 'read'], description: 'New reading status.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Replacement tag list.' },
          notes: { type: 'string', description: 'Replacement reading notes.' },
          starred: { type: 'boolean', description: 'Star or unstar the entry.' },
          remove: { type: 'boolean', description: 'Delete the entry and its stored PDF/text.' },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok', 'removed', 'title'],
          properties: {
            ok: { type: 'boolean' },
            removed: { type: 'boolean' },
            title: { type: 'string' },
            error: { type: 'string' },
          },
        },
        render: (_args, value) => textBlock(value.ok ? (value.removed ? `已删除《${value.title}》。` : `已更新《${value.title}》。`) : `更新失败：${value.error}`),
      },
      async execute(args) {
        const paper = library.get(args.id)
        if (paper === undefined) return { ok: false, removed: false, title: '', error: '文献不存在' }
        if (args.remove === true) {
          library.remove(args.id)
          return { ok: true, removed: true, title: paper.title }
        }
        const outcome = library.update(args.id, { status: args.status, tags: args.tags, notes: args.notes, starred: args.starred })
        if (outcome.error !== undefined) return { ok: false, removed: false, title: paper.title, error: outcome.error }
        return { ok: true, removed: false, title: outcome.paper.title }
      },
    },
  ]


  for (const tool of tools) {
    ctx.effect(() => ctx.tools.register(tool), `literature-library: tool ${tool.name}`)
  }
}
