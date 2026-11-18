/**
 * PDF text and metadata extraction over the vendored pdf.js engine.
 *
 * The engine is loaded lazily from `vendor/pdf/` (pdf.js 6.3.289, Apache-2.0,
 * see `vendor/pdf/LICENSE`) on the Host's own event loop, so a paper is read
 * exactly once when it is added and its plain text is cached on disk.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const vendor = path.join(here, '..', 'vendor', 'pdf')

/** Cached engine promise, so repeated extractions share one module evaluation. */
let enginePromise

/**
 * Load the vendored pdf.js engine with a file-based worker source.
 * @returns the engine module.
 */
function engine() {
  if (enginePromise === undefined) {
    enginePromise = import(pathToFileURL(path.join(vendor, 'pdf.mjs')).href).then((module) => {
      module.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(vendor, 'pdf.worker.mjs')).href
      return module
    })
  }
  return enginePromise
}

/** Replace the ligatures and soft hyphens academic PDFs commonly carry. */
const LIGATURES = [
  [/\uFB00/g, 'ff'], [/\uFB01/g, 'fi'], [/\uFB02/g, 'fl'], [/\uFB03/g, 'ffi'],
  [/\uFB04/g, 'ffl'], [/\uFB05/g, 'st'], [/\uFB06/g, 'st'], [/\u00AD/g, ''],
]

/**
 * Turn one page's text items into readable plain text.
 * @param items - pdf.js text-content items.
 * @returns the page text.
 */
function pageText(items) {
  let out = ''
  for (const item of items) {
    if (typeof item.str !== 'string') continue
    out += item.str
    if (item.hasEOL) out += '\n'
    else if (item.str.length > 0 && !/\s$/.test(item.str)) out += ' '
  }
  let text = out.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ')
  for (const [pattern, replacement] of LIGATURES) text = text.replace(pattern, replacement)
  return text.trim()
}

/**
 * Read one PDF's metadata through the engine.
 * @param doc - an open pdf.js document.
 * @returns title, authors, and subject when the document declares them.
 */
async function documentMetadata(doc) {
  try {
    const { info } = await doc.getMetadata()
    const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')
    return { title: clean(info?.Title), author: clean(info?.Author), subject: clean(info?.Subject) }
  } catch {
    return { title: '', author: '', subject: '' }
  }
}

/**
 * Extract metadata and plain text from PDF bytes.
 * @param bytes - complete PDF file bytes.
 * @param options - page cap and optional cancellation signal.
 * @returns page count, metadata, and the extracted text with page markers.
 */
export async function extractPdf(bytes, options = {}) {
  const maxPages = Number.isInteger(options.maxPages) && options.maxPages > 0 ? options.maxPages : 80
  const pdfjs = await engine()
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
    // Text extraction needs no canvas, fonts, or rendering surfaces.
    disableAutoFetch: true,
    disableStream: true,
  })
  let doc
  try {
    doc = await task.promise
    const metadata = await documentMetadata(doc)
    const pageCount = doc.numPages
    const limit = Math.min(pageCount, maxPages)
    const pages = []
    for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
      if (options.signal?.aborted === true) throw new Error('extraction aborted')
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push({ page: pageNumber, text: pageText(content.items) })
      page.cleanup()
    }
    const text = pages
      .filter((page) => page.text.length > 0)
      .map((page) => `[第 ${page.page} 页]\n${page.text}`)
      .join('\n\n')
    return { pageCount, extractedPages: limit, truncatedPages: pageCount > limit, metadata, text }
  } finally {
    try {
      if (doc !== undefined) await doc.destroy()
      else await task.destroy()
    } catch {
      // Destroying a failed load is best effort.
    }
  }
}

/**
 * Read a small PDF file's first characters without full extraction, used only
 * to confirm a download really is a PDF.
 * @param bytes - candidate bytes.
 * @returns whether the bytes carry the PDF signature.
 */
export function looksLikePdf(bytes) {
  if (bytes === undefined || bytes === null) return false
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (view.length < 5) return false
  const signature = String.fromCharCode(view[0], view[1], view[2], view[3], view[4])
  return signature === '%PDF-'
}

/**
 * Extract one page's text items with normalized geometry, so the browser can
 * lay an invisible selectable text layer over the rendered page image.
 *
 * @param bytes - complete PDF bytes.
 * @param pageNumber - 1-based page number; clamped into the document.
 * @returns page box, item count, and items in normalized page coordinates.
 */
export async function extractPageLayout(bytes, pageNumber) {
  const pdfjs = await engine()
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
    disableAutoFetch: true,
    disableStream: true,
  })
  let doc
  try {
    doc = await task.promise
    const page = await doc.getPage(Math.min(Math.max(1, pageNumber), doc.numPages))
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items = []
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue
      const text = item.str
      if (text.trim() === '') continue
      const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0]
      const size = Math.abs(item.height ?? Math.hypot(transform[2], transform[3])) || 10
      items.push({
        s: text,
        // Normalized to the page box: x from the left, y from the top.
        x: transform[4] / viewport.width,
        y: 1 - transform[5] / viewport.height,
        w: Math.max(0, (item.width ?? 0)) / viewport.width,
        h: size / viewport.height,
      })
    }
    return { pageCount: doc.numPages, page: pageNumber, width: viewport.width, height: viewport.height, items }
  } finally {
    try {
      if (doc !== undefined) await doc.destroy()
      else await task.destroy()
    } catch {
      // Destroying a failed load is best effort.
    }
  }
}
