/**
 * The on-disk文献库: one JSON record per library, plus one PDF and one cached
 * plain-text file per paper. Writes are atomic and synchronous; a literature
 * library is small enough that read-modify-write per mutation is cheaper than
 * a journal.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { cleanLine, newId, readBytesFile, readJsonFile, readTextFile, writeBytesFile, writeJsonFile, writeTextFile } from './util.js'

/** Record statuses a paper can carry. */
export const STATUSES = ['unread', 'reading', 'read']

/** Current library file version. */
const LIBRARY_VERSION = 1

/**
 * Coerce one stored record into the current paper shape.
 * @param value - stored candidate.
 * @returns a complete paper record, or undefined when unusable.
 */
function normalizePaper(value) {
  if (value === null || typeof value !== 'object') return undefined
  const id = typeof value.id === 'string' && /^p_[A-Za-z0-9]+$/.test(value.id) ? value.id : undefined
  if (id === undefined) return undefined
  const status = STATUSES.includes(value.status) ? value.status : 'unread'
  return {
    id,
    title: cleanLine(value.title, 400) || '未命名文献',
    authors: Array.isArray(value.authors) ? value.authors.map((author) => cleanLine(author, 120)).filter(Boolean).slice(0, 40) : [],
    year: Number.isInteger(value.year) ? value.year : null,
    venue: cleanLine(value.venue, 200),
    abstract: typeof value.abstract === 'string' ? value.abstract.slice(0, 12_000) : '',
    doi: cleanLine(value.doi, 200),
    arxivId: cleanLine(value.arxivId, 40),
    url: cleanLine(value.url, 1000),
    pdfUrl: cleanLine(value.pdfUrl, 1000),
    source: cleanLine(value.source, 40) || 'manual',
    addedAt: typeof value.addedAt === 'string' ? value.addedAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    status,
    tags: Array.isArray(value.tags) ? value.tags.map((tag) => cleanLine(tag, 40)).filter(Boolean).slice(0, 20) : [],
    notes: typeof value.notes === 'string' ? value.notes.slice(0, 20_000) : '',
    starred: value.starred === true,
    pageCount: Number.isInteger(value.pageCount) ? value.pageCount : 0,
    textChars: Number.isInteger(value.textChars) ? value.textChars : 0,
    textPages: Number.isInteger(value.textPages) ? value.textPages : 0,
    textTruncated: value.textTruncated === true,
    hasPdf: false,
    hasText: false,
  }
}

/** The literature library store. */
export class LibraryStore {
  /**
   * @param dataDir - absolute directory holding the library and its files.
   */
  constructor(dataDir) {
    this.dataDir = dataDir
    this.libraryFile = path.join(dataDir, 'library.json')
    this.pdfDir = path.join(dataDir, 'pdfs')
    this.textDir = path.join(dataDir, 'texts')
    this.papers = new Map()
    this.loaded = false
  }

  /** Create the data directories. */
  ensureDirectories() {
    mkdirSync(this.pdfDir, { recursive: true })
    mkdirSync(this.textDir, { recursive: true })
  }

  /** Load the library file once, tolerating a missing or damaged file. */
  load() {
    if (this.loaded) return
    this.ensureDirectories()
    const stored = readJsonFile(this.libraryFile)
    const records = Array.isArray(stored?.papers) ? stored.papers : []
    for (const record of records) {
      const paper = normalizePaper(record)
      if (paper === undefined) continue
      paper.hasPdf = existsSync(this.pdfPath(paper.id))
      paper.hasText = existsSync(this.textPath(paper.id))
      this.papers.set(paper.id, paper)
    }
    this.loaded = true
  }

  /** Persist the complete library. */
  save() {
    const papers = [...this.papers.values()].sort((left, right) => right.addedAt.localeCompare(left.addedAt))
    writeJsonFile(this.libraryFile, { version: LIBRARY_VERSION, savedAt: new Date().toISOString(), papers })
  }

  /**
   * Absolute path of one paper's PDF.
   * @param id - paper id.
   * @returns the path.
   */
  pdfPath(id) {
    return path.join(this.pdfDir, `${id}.pdf`)
  }

  /**
   * Absolute path of one paper's cached text.
   * @param id - paper id.
   * @returns the path.
   */
  textPath(id) {
    return path.join(this.textDir, `${id}.txt`)
  }

  /**
   * List papers, newest first.
   * @returns detached paper records.
   */
  list() {
    this.load()
    return [...this.papers.values()].sort((left, right) => right.addedAt.localeCompare(left.addedAt))
  }

  /**
   * Read one paper.
   * @param id - paper id.
   * @returns the paper, or undefined.
   */
  get(id) {
    this.load()
    return this.papers.get(id)
  }

  /**
   * Insert or replace one paper and persist.
   * @param paper - complete paper record.
   * @returns the stored paper.
   */
  put(paper) {
    this.load()
    const next = { ...paper, updatedAt: new Date().toISOString() }
    this.papers.set(next.id, next)
    this.save()
    return next
  }

  /**
   * Mint one empty paper record.
   * @param fields - initial fields.
   * @returns the record, not yet stored.
   */
  create(fields) {
    const now = new Date().toISOString()
    return normalizePaper({
      id: newId('p'),
      addedAt: now,
      updatedAt: now,
      status: 'unread',
      ...fields,
    })
  }

  /**
   * Store one paper's PDF bytes.
   * @param id - paper id.
   * @param bytes - PDF bytes.
   * @returns the byte count.
   */
  writePdf(id, bytes) {
    this.ensureDirectories()
    writeBytesFile(this.pdfPath(id), bytes)
    const paper = this.get(id)
    if (paper !== undefined) {
      paper.hasPdf = true
      this.save()
    }
    return bytes.length
  }

  /**
   * Read one paper's PDF bytes.
   * @param id - paper id.
   * @returns the bytes, or undefined when no PDF is stored.
   */
  readPdf(id) {
    return readBytesFile(this.pdfPath(id))
  }

  /**
   * Store one paper's extracted text.
   * @param id - paper id.
   * @param text - plain text.
   * @returns the character count.
   */
  writeText(id, text) {
    this.ensureDirectories()
    writeTextFile(this.textPath(id), text)
    const paper = this.get(id)
    if (paper !== undefined) {
      paper.hasText = text.length > 0
      paper.textChars = text.length
      this.save()
    }
    return text.length
  }

  /**
   * Read one paper's extracted text.
   * @param id - paper id.
   * @returns the text, or undefined when extraction never ran.
   */
  readText(id) {
    return readTextFile(this.textPath(id))
  }

  /**
   * Delete one paper and its files.
   * @param id - paper id.
   * @returns whether the record existed.
   */
  remove(id) {
    this.load()
    const existed = this.papers.delete(id)
    for (const file of [this.pdfPath(id), this.textPath(id)]) {
      try {
        rmSync(file, { force: true })
      } catch {
        // Removing a partially written file is best effort.
      }
    }
    if (existed) this.save()
    return existed
  }

  /**
   * Find an existing record matching a candidate identity.
   * @param identity - DOI, arXiv id, or normalized title.
   * @returns the matching paper, or undefined.
   */
  findDuplicate(identity) {
    const { doi = '', arxivId = '', title = '' } = identity
    const normalizedTitle = normalizeTitle(title)
    for (const paper of this.list()) {
      if (doi !== '' && paper.doi !== '' && paper.doi.toLowerCase() === doi.toLowerCase()) return paper
      if (arxivId !== '' && paper.arxivId !== '' && stripVersion(paper.arxivId) === stripVersion(arxivId)) return paper
      if (normalizedTitle !== '' && normalizeTitle(paper.title) === normalizedTitle) return paper
    }
    return undefined
  }

  /**
   * Report library totals for the workspace header.
   * @returns counts by status and storage size.
   */
  summary() {
    const papers = this.list()
    const byStatus = { unread: 0, reading: 0, read: 0 }
    let textChars = 0
    let pdfBytes = 0
    for (const paper of papers) {
      byStatus[paper.status] = (byStatus[paper.status] ?? 0) + 1
      textChars += paper.textChars
      try {
        const size = statSync(this.pdfPath(paper.id)).size
        pdfBytes += size
      } catch {
        // A missing PDF contributes nothing.
      }
    }
    return { total: papers.length, byStatus, textChars, pdfBytes }
  }
}

/**
 * Normalize a title for duplicate detection.
 * @param title - title text.
 * @returns lowercase alphanumeric-only title.
 */
function normalizeTitle(title) {
  return cleanLine(title, 400).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
}

/**
 * Drop an arXiv version suffix.
 * @param value - arXiv identifier.
 * @returns the identifier without `vN`.
 */
function stripVersion(value) {
  return value.replace(/v\d+$/i, '')
}

// Re-exported for callers that shape records before `create`.
export { normalizePaper }
