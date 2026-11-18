/**
 * Browser-facing HTTP surface: one JSON action endpoint, one PDF endpoint, and
 * one upload endpoint. Every route is registered on the Host connection layer,
 * so the existing browser authentication applies. The vendored pdf.js engine is
 * served separately by a prefix route in `index.js`.
 */
import { readPageLayout, renderPaperPage } from './pages.js'
import { clampInteger, jsonAnswer, textAnswer } from './util.js'

/** JSON action endpoint used by the workspace UI. */
export const ACTION_PATH = '/api/literature/action'

/** One stored paper's PDF bytes. */
export const FILE_PATH = '/api/literature/file'

/** One rasterized original page image. */
export const PAGE_PATH = '/api/literature/page'

/** One page's selectable text layer geometry. */
export const PAGETEXT_PATH = '/api/literature/pagetext'

/** One uploaded PDF's bytes. */
export const UPLOAD_PATH = '/api/literature/upload'

/** Largest accepted action body. */
const MAX_ACTION_BYTES = 512 * 1024

/**
 * Read a request body with a byte cap.
 * @param request - Fetch request.
 * @param maxBytes - largest accepted body.
 * @returns the bytes, or undefined when the body is too large or unreadable.
 */
async function readBoundedBody(request, maxBytes) {
  if (request.body === null) return new Uint8Array(0)
  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      try {
        await reader.cancel()
      } catch {
        // Cancelling an oversized body is best effort.
      }
      return undefined
    }
    chunks.push(value)
  }
  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return joined
}

/**
 * Build the literature HTTP handlers.
 * @param services - library, ai, and plugin config.
 * @returns one async handler per registered route.
 */
export function createLiteratureRoutes(services) {
  const { library, ai, config, officeKit } = services

  /**
   * Shape one paper for the browser.
   * @param paper - library record.
   * @returns the wire record.
   */
  const wirePaper = (paper) => ({
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    venue: paper.venue,
    abstract: paper.abstract,
    doi: paper.doi,
    arxivId: paper.arxivId,
    url: paper.url,
    pdfUrl: paper.pdfUrl,
    source: paper.source,
    addedAt: paper.addedAt,
    updatedAt: paper.updatedAt,
    status: paper.status,
    tags: paper.tags,
    notes: paper.notes,
    starred: paper.starred,
    pageCount: paper.pageCount,
    textChars: paper.textChars,
    textPages: paper.textPages,
    textTruncated: paper.textTruncated,
    hasPdf: paper.hasPdf,
    hasText: paper.hasText,
  })

  /**
   * Shape one discovery result for the browser.
   * @param result - normalized search result.
   * @returns the wire record.
   */
  const wireResult = (result) => ({ ...result })

  /**
   * Dispatch one UI action.
   * @param action - action name.
   * @param body - request payload.
   * @param signal - request cancellation.
   * @returns the action value, or a failure message.
   */
  async function dispatch(action, body, signal) {
    switch (action) {
      case 'state': {
        const papers = library.list()
        return {
          papers: papers.map(wirePaper),
          summary: library.summary(),
          ai: ai.status(),
          config: { language: config.language, dataDirHint: config.dataDir },
        }
      }
      case 'search': {
        const outcome = await library.search(body.query, { source: body.source, limit: body.limit, signal })
        return { results: outcome.results.map(wireResult), failures: outcome.failures }
      }
      case 'add': {
        if (typeof body.reference === 'string' && body.reference.trim() !== '') {
          const outcome = await library.addFromReference(body.reference, { tags: body.tags, signal })
          if (outcome.error !== undefined) return { error: outcome.error }
          return { paper: wirePaper(outcome.paper), duplicate: outcome.duplicate === true, warnings: outcome.warnings ?? [] }
        }
        if (body.candidate !== null && typeof body.candidate === 'object') {
          const outcome = await library.addFromCandidate(body.candidate, { tags: body.tags, signal })
          if (outcome.error !== undefined) return { error: outcome.error }
          return { paper: wirePaper(outcome.paper), duplicate: outcome.duplicate === true, warnings: outcome.warnings ?? [] }
        }
        return { error: '缺少要添加的文献信息' }
      }
      case 'text': {
        const outcome = library.readText(body.id, body.offset, body.length)
        if (outcome.error !== undefined) return { error: outcome.error }
        return { text: outcome.text, offset: outcome.offset, total: outcome.total, paper: wirePaper(outcome.paper) }
      }
      case 'extract': {
        const outcome = await library.extractText(body.id, signal)
        if (outcome.error !== undefined) return { error: outcome.error }
        return { paper: wirePaper(outcome.paper) }
      }
      case 'update': {
        const outcome = library.update(body.id, body.patch ?? {})
        if (outcome.error !== undefined) return { error: outcome.error }
        return { paper: wirePaper(outcome.paper) }
      }
      case 'remove': {
        return library.remove(body.id)
      }
      case 'translate': {
        const paper = library.get(body.id)
        if (paper === undefined) return { error: '文献不存在' }
        const text = await ai.translate(paper, body.text, body.target, signal)
        return { text }
      }
      case 'summarize': {
        const paper = library.get(body.id)
        if (paper === undefined) return { error: '文献不存在' }
        const text = await ai.summarize(paper, body.detail, signal)
        return { text }
      }
      case 'ask': {
        const paper = library.get(body.id)
        if (paper === undefined) return { error: '文献不存在' }
        const answer = await ai.ask(paper, body.question, body.history, signal)
        return { answer }
      }
      case 'aiStatus': {
        return ai.status()
      }
      default:
        return { error: `未知操作：${String(action)}` }
    }
  }

  return {
    /**
     * Handle one JSON action.
     * @param request - Fetch request with a JSON body.
     * @returns one envelope response.
     */
    async action(request) {
      if (request.method !== 'POST') return jsonAnswer({ ok: false, error: '只接受 POST' }, 405)
      const bytes = await readBoundedBody(request, MAX_ACTION_BYTES)
      if (bytes === undefined) return jsonAnswer({ ok: false, error: '请求体过大' }, 413)
      let body
      try {
        body = JSON.parse(new TextDecoder().decode(bytes))
      } catch {
        return jsonAnswer({ ok: false, error: '请求体不是合法 JSON' }, 400)
      }
      if (body === null || typeof body !== 'object' || typeof body.action !== 'string') {
        return jsonAnswer({ ok: false, error: '缺少 action' }, 400)
      }
      try {
        const value = await dispatch(body.action, body, request.signal)
        if (value !== null && typeof value === 'object' && typeof value.error === 'string') {
          return jsonAnswer({ ok: false, error: value.error })
        }
        return jsonAnswer({ ok: true, value })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (request.signal.aborted) return jsonAnswer({ ok: false, error: '请求已取消' }, 499)
        return jsonAnswer({ ok: false, error: message })
      }
    },

    /**
     * Serve one stored PDF.
     * @param request - Fetch request with the paper id in `?id=`.
     * @returns the PDF bytes or a failure response.
     */
    async file(request) {
      const url = new URL(request.url)
      const id = url.searchParams.get('id') ?? ''
      const paper = library.get(id)
      if (paper === undefined) return textAnswer('文献不存在', 404)
      const bytes = library.pdf(id)
      if (bytes === undefined) return textAnswer('该文献没有存储的 PDF', 404)
      return new Response(bytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-length': String(bytes.length),
          'content-disposition': `inline; filename="paper.pdf"`,
          'cache-control': 'private, max-age=300',
        },
      })
    },

    /**
     * Serve one rasterized original page.
     * @param request - Fetch request with `id`, `page`, and optional `dpi`.
     * @returns the PNG bytes or a failure response.
     */
    async page(request) {
      const url = new URL(request.url)
      const id = url.searchParams.get('id') ?? ''
      const page = Number(url.searchParams.get('page') ?? '1')
      const dpi = Number(url.searchParams.get('dpi') ?? '120')
      const rendered = await renderPaperPage({
        officeKit,
        library,
        config,
        id,
        page: Number.isFinite(page) ? page : 1,
        dpi: Number.isFinite(dpi) ? dpi : 120,
        signal: request.signal,
      })
      if (rendered.error !== undefined) return textAnswer(rendered.error, 503)
      return new Response(rendered.png, {
        headers: {
          'content-type': 'image/png',
          'content-length': String(rendered.png.length),
          'cache-control': 'private, max-age=3600',
        },
      })
    },

    /**
     * Serve one page's selectable text layer geometry.
     * @param request - Fetch request with `id` and `page`.
     * @returns the layout envelope.
     */
    async pageText(request) {
      const url = new URL(request.url)
      const id = url.searchParams.get('id') ?? ''
      const page = Number(url.searchParams.get('page') ?? '1')
      const outcome = await readPageLayout({ library, config, id, page: Number.isFinite(page) ? page : 1 })
      if (outcome.error !== undefined) return jsonAnswer({ ok: false, error: outcome.error }, 503)
      return jsonAnswer({ ok: true, value: outcome.layout })
    },

    /**
     * Store one uploaded PDF.
     * @param request - Fetch request whose body is the file.
     * @returns the stored paper or a failure envelope.
     */
    async upload(request) {
      if (request.method !== 'POST') return jsonAnswer({ ok: false, error: '只接受 POST' }, 405)
      const url = new URL(request.url)
      const filename = url.searchParams.get('name') ?? 'upload.pdf'
      const bytes = await readBoundedBody(request, config.maxPdfBytes)
      if (bytes === undefined) return jsonAnswer({ ok: false, error: `PDF 超过大小上限（${Math.round(config.maxPdfBytes / 1024 / 1024)} MB）` }, 413)
      try {
        const outcome = await library.addFromBytes(bytes, filename, { signal: request.signal })
        if (outcome.error !== undefined) return jsonAnswer({ ok: false, error: outcome.error })
        return jsonAnswer({ ok: true, value: { paper: wirePaper(outcome.paper), warnings: outcome.warnings ?? [] } })
      } catch (error) {
        return jsonAnswer({ ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },

    /**
     * Expose the byte limit so the browser can reject a file early.
     * @returns the largest accepted upload size.
     */
    maxUploadBytes() {
      return clampInteger(config.maxPdfBytes, 1024 * 1024, 512 * 1024 * 1024, 40 * 1024 * 1024)
    },
  }
}
