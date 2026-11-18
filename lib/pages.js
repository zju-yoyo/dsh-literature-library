/**
 * Original-page rendering for the browser reader.
 *
 * The desktop page is served from a custom application scheme, where dynamic
 * module imports (a browser pdf.js) do not load, so pages are rasterized on the
 * Host through the `officeKit` service instead and cached as PNG files next to
 * the library. Text selection remains available through the extracted-text tab.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { extractPageLayout } from './pdf.js'
import { clampInteger, readJsonFile, writeJsonFile } from './util.js'

/** Rendering density range for a cached page image. */
const MIN_DPI = 72
const MAX_DPI = 240

/** Per-page render admission, so one paper never floods the office engine. */
const inflight = new Map()

/**
 * Render one page of a stored paper to PNG, caching the result on disk.
 *
 * @param options - office kit, library, config, paper id, page, and density.
 * @returns the PNG bytes, page count, and dimensions.
 */
export async function renderPaperPage(options) {
  const { officeKit, library, config, page, dpi: requestedDpi, signal } = options
  const paper = library.get(options.id)
  if (paper === undefined) return { error: '文献不存在' }
  if (officeKit === undefined) return { error: '当前环境不支持原文渲染（缺少文档引擎）' }
  const bytes = library.pdf(paper.id)
  if (bytes === undefined) return { error: '该文献没有保存的 PDF' }
  const dpi = clampInteger(requestedDpi, MIN_DPI, MAX_DPI, 120)
  const total = Math.max(1, paper.pageCount > 0 ? paper.pageCount : 1)
  const pageNumber = clampInteger(page, 1, Math.max(1, total + 200), 1)
  const cacheDir = path.join(config.dataDir, 'pages', paper.id)
  const cacheFile = path.join(cacheDir, `p${pageNumber}@${dpi}.png`)

  if (existsSync(cacheFile)) {
    const cached = readFileSync(cacheFile)
    return { png: cached, page: pageNumber, dpi, pageCount: total, cached: true }
  }

  const key = `${paper.id}:${pageNumber}:${dpi}`
  const existing = inflight.get(key)
  if (existing !== undefined) return await existing

  const run = (async () => {
    const source = {
      key: `literature:${paper.id}:${bytes.length}`,
      version: String(bytes.length),
      bytes: bytes.length,
      read: async () => ({ bytes, version: String(bytes.length) }),
    }
    const result = await officeKit.renderImages({
      extension: 'pdf',
      source,
      pages: [pageNumber],
      dpi,
      maxImages: 1,
      maxPixels: 16_000_000,
      maxDimension: 5000,
      maxBytes: 24_000_000,
    })
    const image = result.images[0]
    if (image === undefined) return { error: `第 ${pageNumber} 页没有渲染结果` }
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(cacheFile, image.png)
    return {
      png: image.png,
      page: pageNumber,
      dpi,
      pageCount: Math.max(total, Number.isInteger(result.pageCount) ? result.pageCount : 0),
      width: image.width,
      height: image.height,
      cached: false,
    }
  })()
  inflight.set(key, run)
  try {
    return await run
  } catch (error) {
    const code = error !== null && typeof error === 'object' && typeof error.code === 'string' ? `${error.code}: ` : ''
    return { error: `原文渲染失败（${code}${error instanceof Error ? error.message : String(error)}）` }
  } finally {
    inflight.delete(key)
    if (signal?.aborted === true) {
      // Cancellation is advisory: the engine finishes the page it started.
    }
  }
}

/**
 * Remove every cached page image of one paper.
 * @param dataDir - library data directory.
 * @param paperId - paper id.
 */
export function dropCachedPages(dataDir, paperId) {
  try {
    rmSync(path.join(dataDir, 'pages', paperId), { recursive: true, force: true })
  } catch {
    // Removing an absent cache is best effort.
  }
}

/**
 * Read one page's selectable text layer geometry, cached beside the page image.
 *
 * @param options - library, config, paper id, and page number.
 * @returns normalized text items plus the page box, or a failure message.
 */
export async function readPageLayout(options) {
  const { library, config, page } = options
  const paper = library.get(options.id)
  if (paper === undefined) return { error: '文献不存在' }
  const bytes = library.pdf(paper.id)
  if (bytes === undefined) return { error: '该文献没有保存的 PDF' }
  const pageNumber = clampInteger(page, 1, Math.max(1, paper.pageCount > 0 ? paper.pageCount : 1) + 200, 1)
  const cacheDir = path.join(config.dataDir, 'pages', paper.id)
  const cacheFile = path.join(cacheDir, `p${pageNumber}.items.json`)
  const cached = readJsonFile(cacheFile)
  if (cached !== undefined && Array.isArray(cached.items)) return { layout: cached, cached: true }
  try {
    const layout = await extractPageLayout(bytes, pageNumber)
    mkdirSync(cacheDir, { recursive: true })
    writeJsonFile(cacheFile, layout)
    return { layout, cached: false }
  } catch (error) {
    return { error: `文字层提取失败：${error instanceof Error ? error.message : String(error)}` }
  }
}
