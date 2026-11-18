/**
 * The literature operations shared by the workspace UI and the agent tools:
 * search, add (metadata-only, arXiv/PDF download, or an uploaded file), read,
 * annotate, and remove. One implementation serves both callers.
 */
import path from 'node:path'
import { dropCachedPages } from './pages.js'
import { extractPdf, looksLikePdf } from './pdf.js'
import { resolveReference, searchLiterature } from './search.js'
import { clampInteger, cleanLine, describeHttpFailure, fetchWithTimeout, normalizeArxivId, normalizeDoi, parseHttpUrl, truncateText } from './util.js'

/** Statuses accepted by an update. */
const UPDATABLE_STATUS = new Set(['unread', 'reading', 'read'])

/**
 * Download one PDF, enforcing the configured byte cap.
 * @param url - http(s) URL.
 * @param maxBytes - largest accepted file.
 * @param signal - caller cancellation.
 * @returns the bytes, or a failure message.
 */
async function downloadPdf(url, maxBytes, signal) {
  const target = parseHttpUrl(url)
  if (target === undefined) return { error: '下载地址不是 http(s) 链接' }
  let response
  try {
    response = await fetchWithTimeout(target, {
      signal,
      timeoutMs: 60_000,
      headers: { accept: 'application/pdf,*/*', 'user-agent': 'dsh-literature-library/1.0' },
    })
  } catch (error) {
    return { error: `下载失败：${error instanceof Error ? error.message : String(error)}` }
  }
  if (!response.ok) return { error: `下载失败（${await describeHttpFailure(response)}）` }
  const declared = Number(response.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) return { error: `PDF 超过大小上限（${Math.round(maxBytes / 1024 / 1024)} MB）` }
  let bytes
  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    return { error: `读取响应失败：${error instanceof Error ? error.message : String(error)}` }
  }
  if (bytes.length > maxBytes) return { error: `PDF 超过大小上限（${Math.round(maxBytes / 1024 / 1024)} MB）` }
  if (!looksLikePdf(bytes)) return { error: '下载内容不是 PDF（可能需要登录或页面已改版）' }
  return { bytes }
}

/** Field limits applied before a record is stored. */
const MAX_TAGS = 20

/**
 * Literature operations bound to one store, one AI helper, and the plugin config.
 */
export class LiteratureLibrary {
  /**
   * @param store - the on-disk library.
   * @param config - resolved plugin config.
   */
  constructor(store, config) {
    this.store = store
    this.config = config
  }

  /**
   * Search public metadata services.
   * @param query - free-text query.
   * @param options - source choice, limit, and cancellation.
   * @returns results plus per-source failures.
   */
  async search(query, options = {}) {
    const source = options.source ?? 'arxiv'
    const sources = source === 'all' ? ['arxiv', 'crossref'] : source === 'crossref' ? ['crossref'] : ['arxiv']
    const limit = clampInteger(options.limit, 1, 25, this.config.searchMaxResults)
    return await searchLiterature(query, { sources, limit, signal: options.signal })
  }

  /**
   * List library entries with optional filters.
   * @param filter - query text, status, and tag.
   * @returns matching paper records.
   */
  list(filter = {}) {
    const query = cleanLine(filter.query ?? '', 200).toLowerCase()
    const status = typeof filter.status === 'string' && UPDATABLE_STATUS.has(filter.status) ? filter.status : ''
    const tag = cleanLine(filter.tag ?? '', 40).toLowerCase()
    return this.store.list().filter((paper) => {
      if (status !== '' && paper.status !== status) return false
      if (tag !== '' && !paper.tags.some((entry) => entry.toLowerCase() === tag)) return false
      if (query === '') return true
      const haystack = `${paper.title}\n${paper.authors.join(' ')}\n${paper.venue}\n${paper.abstract}\n${paper.tags.join(' ')}\n${paper.notes}`.toLowerCase()
      return haystack.includes(query)
    })
  }

  /**
   * Read one entry.
   * @param id - paper id.
   * @returns the paper, or a failure message.
   */
  get(id) {
    const paper = this.store.get(id)
    return paper ?? undefined
  }

  /**
   * Extract text for one stored PDF and persist it.
   * @param id - paper id.
   * @param signal - caller cancellation.
   * @returns extraction outcome.
   */
  async extractText(id, signal) {
    const paper = this.store.get(id)
    if (paper === undefined) return { error: '文献不存在' }
    const bytes = this.store.readPdf(id)
    if (bytes === undefined) return { error: '该文献没有已下载的 PDF' }
    try {
      const result = await extractPdf(bytes, { maxPages: this.config.maxTextPages, signal })
      this.store.writeText(id, result.text)
      const updated = { ...paper, pageCount: result.pageCount, textPages: result.extractedPages, textTruncated: result.truncatedPages, textChars: result.text.length }
      this.store.put(updated)
      return { paper: updated, textChars: result.text.length, pageCount: result.pageCount }
    } catch (error) {
      return { error: `PDF 文本提取失败：${error instanceof Error ? error.message : String(error)}` }
    }
  }

  /**
   * Add one discovery result, downloading its PDF when a link is known.
   * @param candidate - normalized search result.
   * @param options - tags and cancellation.
   * @returns the stored paper, or a failure message.
   */
  async addFromCandidate(candidate, options = {}) {
    const arxivId = normalizeArxivId(candidate?.arxivId ?? '') || normalizeArxivId(candidate?.url ?? '')
    const doi = normalizeDoi(candidate?.doi ?? '') || normalizeDoi(candidate?.url ?? '')
    const title = cleanLine(candidate?.title ?? '', 400)
    const duplicate = this.store.findDuplicate({ doi, arxivId, title })
    if (duplicate !== undefined) return { paper: duplicate, duplicate: true }

    const pdfUrl = typeof candidate?.pdfUrl === 'string' && candidate.pdfUrl !== ''
      ? candidate.pdfUrl
      : arxivId !== '' ? `https://arxiv.org/pdf/${arxivId}` : ''
    const paper = this.store.create({
      title: title || '未命名文献',
      authors: Array.isArray(candidate?.authors) ? candidate.authors : [],
      year: Number.isInteger(candidate?.year) ? candidate.year : null,
      venue: cleanLine(candidate?.venue ?? '', 200),
      abstract: typeof candidate?.abstract === 'string' ? candidate.abstract : '',
      doi,
      arxivId,
      url: cleanLine(candidate?.url ?? '', 1000),
      pdfUrl,
      source: cleanLine(candidate?.source ?? 'search', 40),
      tags: (Array.isArray(options.tags) ? options.tags : []).map((tag) => cleanLine(tag, 40)).filter(Boolean).slice(0, MAX_TAGS),
    })

    const warnings = []
    if (pdfUrl !== '') {
      const download = await downloadPdf(pdfUrl, this.config.maxPdfBytes, options.signal)
      if (download.error !== undefined) {
        warnings.push(download.error)
      } else {
        this.store.put(paper)
        this.store.writePdf(paper.id, download.bytes)
        const extracted = await this.extractText(paper.id, options.signal)
        if (extracted.error !== undefined) warnings.push(extracted.error)
        const stored = this.store.get(paper.id)
        return { paper: stored ?? paper, warnings, duplicate: false }
      }
    }
    this.store.put(paper)
    return { paper: this.store.get(paper.id) ?? paper, warnings, duplicate: false }
  }

  /**
   * Add an arXiv identifier or DOI through the metadata services.
   * @param reference - arXiv link/id, DOI, or PDF link.
   * @param options - tags and cancellation.
   * @returns the stored paper, or a failure message.
   */
  async addFromReference(reference, options = {}) {
    const resolved = await resolveReference(reference, options.signal)
    if (resolved.error !== undefined) return { error: resolved.error }
    return await this.addFromCandidate(resolved.result, options)
  }

  /**
   * Add one uploaded PDF.
   * @param bytes - PDF bytes.
   * @param filename - original file name, used as the title fallback.
   * @param options - tags and cancellation.
   * @returns the stored paper, or a failure message.
   */
  async addFromBytes(bytes, filename, options = {}) {
    if (!looksLikePdf(bytes)) return { error: '文件不是有效的 PDF' }
    if (bytes.length > this.config.maxPdfBytes) return { error: `PDF 超过大小上限（${Math.round(this.config.maxPdfBytes / 1024 / 1024)} MB）` }
    const stem = cleanLine(path.basename(filename ?? 'upload.pdf').replace(/\.pdf$/i, ''), 300) || '未命名文献'
    const paper = this.store.create({ title: stem, source: 'upload', tags: (Array.isArray(options.tags) ? options.tags : []).slice(0, MAX_TAGS) })
    this.store.put(paper)
    this.store.writePdf(paper.id, bytes)
    const warnings = []
    try {
      const result = await extractPdf(bytes, { maxPages: this.config.maxTextPages, signal: options.signal })
      this.store.writeText(paper.id, result.text)
      const metadata = result.metadata
      const title = metadata.title !== '' && metadata.title.length >= 8 ? metadata.title : stem
      const authors = metadata.author === '' ? [] : metadata.author.split(/[;,]| and /).map((author) => author.trim()).filter(Boolean)
      this.store.put({
        ...this.store.get(paper.id),
        title,
        authors: authors.slice(0, 40),
        pageCount: result.pageCount,
        textPages: result.extractedPages,
        textTruncated: result.truncatedPages,
        textChars: result.text.length,
      })
    } catch (error) {
      warnings.push(`PDF 文本提取失败：${error instanceof Error ? error.message : String(error)}`)
    }
    return { paper: this.store.get(paper.id) ?? paper, warnings, duplicate: false }
  }

  /**
   * Update one entry's annotations.
   * @param id - paper id.
   * @param patch - status, tags, notes, starred.
   * @returns the updated paper, or a failure message.
   */
  update(id, patch = {}) {
    const paper = this.store.get(id)
    if (paper === undefined) return { error: '文献不存在' }
    const next = { ...paper }
    if (typeof patch.status === 'string' && UPDATABLE_STATUS.has(patch.status)) next.status = patch.status
    if (Array.isArray(patch.tags)) next.tags = patch.tags.map((tag) => cleanLine(tag, 40)).filter(Boolean).slice(0, MAX_TAGS)
    if (typeof patch.notes === 'string') next.notes = patch.notes.slice(0, 20_000)
    if (typeof patch.starred === 'boolean') next.starred = patch.starred
    if (typeof patch.title === 'string' && cleanLine(patch.title, 400) !== '') next.title = cleanLine(patch.title, 400)
    return { paper: this.store.put(next) }
  }

  /**
   * Remove one entry, its files, and its rendered page cache.
   * @param id - paper id.
   * @returns whether the record existed.
   */
  remove(id) {
    const removed = this.store.remove(id)
    dropCachedPages(this.config.dataDir, id)
    return { removed }
  }

  /**
   * Read a bounded slice of one paper's cached text.
   * @param id - paper id.
   * @param offset - first character.
   * @param length - maximum characters.
   * @returns the slice plus totals, or a failure message.
   */
  readText(id, offset = 0, length = 8000) {
    const paper = this.store.get(id)
    if (paper === undefined) return { error: '文献不存在' }
    const text = this.store.readText(id)
    if (text === undefined) return { error: '该文献还没有提取正文（请先下载 PDF）' }
    const start = clampInteger(offset, 0, Math.max(0, text.length - 1), 0)
    const size = clampInteger(length, 200, 40_000, 8000)
    const slice = text.slice(start, start + size)
    return { text: slice, offset: start, total: text.length, paper }
  }

  /**
   * Full text for an AI prompt, bounded by the prompt budget.
   * @param id - paper id.
   * @returns the text or undefined.
   */
  promptText(id) {
    const text = this.store.readText(id)
    if (text === undefined) return undefined
    return truncateText(text, this.config.maxPromptChars)
  }

  /**
   * Read one paper's stored PDF bytes.
   * @param id - paper id.
   * @returns the bytes or undefined.
   */
  pdf(id) {
    return this.store.readPdf(id)
  }

  /**
   * Library totals.
   * @returns the store summary.
   */
  summary() {
    return this.store.summary()
  }
}
