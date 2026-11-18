/**
 * Small shared helpers for the literature bundle: identifiers, bounded text,
 * tolerant JSON reads, atomic writes, and Fetch-shaped answers.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Mint one collision-resistant record id.
 * @param prefix - short kind marker.
 * @returns the id, safe in a URL query.
 */
export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(4).toString('hex')}`
}

/**
 * Clamp a number into an inclusive range, dropping non-finite input.
 * @param value - candidate number.
 * @param min - inclusive lower bound.
 * @param max - inclusive upper bound.
 * @param fallback - value used when the candidate is not a finite number.
 * @returns the clamped integer.
 */
export function clampInteger(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

/**
 * Shorten text with an explicit marker the model can see.
 * @param text - source text.
 * @param max - largest accepted length in characters.
 * @param notice - marker appended when the text was shortened.
 * @returns the original or shortened text.
 */
export function truncateText(text, max, notice = '\n\n[...正文已截断，仅保留前部分内容]') {
  if (typeof text !== 'string') return ''
  if (text.length <= max) return text
  return text.slice(0, max) + notice
}

/**
 * Collapse whitespace and strip a length bound, for one-line record fields.
 * @param value - candidate text.
 * @param max - largest accepted length.
 * @returns cleaned text.
 */
export function cleanLine(value, max = 500) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Decode the XML/HTML entities academic metadata feeds actually use. */
export function decodeEntities(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/**
 * Reduce JATS or HTML markup to words.
 * @param value - markup-bearing string.
 * @returns plain text.
 */
export function stripMarkup(value) {
  if (typeof value !== 'string') return ''
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Normalize a DOI to its bare lowercase form.
 * @param value - DOI text, DOI URL, or empty.
 * @returns the bare DOI, or an empty string.
 */
export function normalizeDoi(value) {
  if (typeof value !== 'string') return ''
  const match = value.trim().match(/10\.\d{4,9}\/[^\s"'<>]+/i)
  return match === null ? '' : match[0].toLowerCase().replace(/[.,;)]+$/, '')
}

/**
 * Normalize an arXiv identifier to its bare form.
 * @param value - identifier text, arXiv URL, or empty.
 * @returns the bare identifier (with version when given), or an empty string.
 */
export function normalizeArxivId(value) {
  if (typeof value !== 'string') return ''
  const match = value.trim().match(/(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(v\d+)?/i)
  return match === null ? '' : `${match[1]}${match[2] ?? ''}`
}

/**
 * Read a JSON file, treating any failure as absent data.
 * @param file - absolute file path.
 * @returns parsed value or undefined.
 */
export function readJsonFile(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

/**
 * Write JSON through a temporary sibling and a rename, creating its directory.
 * @param file - absolute file path.
 * @param value - JSON-serializable value.
 */
export function writeJsonFile(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8')
  renameSync(temporary, file)
}

/**
 * Write bytes through a temporary sibling and a rename, creating its directory.
 * @param file - absolute file path.
 * @param bytes - file bytes.
 */
export function writeBytesFile(file, bytes) {
  mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, bytes)
  renameSync(temporary, file)
}

/**
 * Read file bytes, treating any failure as absent.
 * @param file - absolute file path.
 * @returns the bytes or undefined.
 */
export function readBytesFile(file) {
  try {
    if (!existsSync(file)) return undefined
    return readFileSync(file)
  } catch {
    return undefined
  }
}

/**
 * Write text through a temporary sibling and a rename, creating its directory.
 * @param file - absolute file path.
 * @param text - UTF-8 text.
 */
export function writeTextFile(file, text) {
  mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, text, 'utf8')
  renameSync(temporary, file)
}

/**
 * Read a UTF-8 text file, treating any failure as absent.
 * @param file - absolute file path.
 * @returns the text or undefined.
 */
export function readTextFile(file) {
  try {
    if (!existsSync(file)) return undefined
    return readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Build one JSON Fetch answer.
 * @param value - JSON body.
 * @param status - HTTP status.
 * @returns the response.
 */
export function jsonAnswer(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Build one plain-text Fetch answer.
 * @param text - body text.
 * @param status - HTTP status.
 * @returns the response.
 */
export function textAnswer(text, status = 200) {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * Read a Fetch answer's failure text without letting a broken body escape.
 * @param response - the response.
 * @returns a short reason.
 */
export async function describeHttpFailure(response) {
  let detail = ''
  try {
    detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 200)
  } catch {
    detail = ''
  }
  return `HTTP ${response.status}${detail === '' ? '' : `: ${detail}`}`
}

/**
 * Fetch with a deadline and a caller signal, returning the response.
 * @param url - absolute URL.
 * @param options - headers, method, body, and timeout.
 * @returns the response.
 */
export async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('request timed out')), timeoutMs)
  const forwardAbort = () => controller.abort(new Error('request aborted'))
  if (options.signal !== undefined) {
    if (options.signal.aborted) controller.abort(new Error('request aborted'))
    else options.signal.addEventListener('abort', forwardAbort, { once: true })
  }
  try {
    return await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      redirect: 'follow',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}

/**
 * Describe an http(s) URL's host, refusing schemes the bundle will not fetch.
 * @param value - candidate URL.
 * @returns the parsed URL, or undefined.
 */
export function parseHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url
  } catch {
    return undefined
  }
}
