/**
 * 文献阅读与管理 (literature reading and management) Host half.
 *
 * Owns the on-disk library (metadata, PDFs, cached text), public literature
 * metadata search, PDF text extraction, model-backed translation/summary/Q&A,
 * the browser JSON/PDF endpoints, and the matching agent tools. The Client half
 * in `client.js` renders the workspace.
 */
import os from 'node:os'
import path from 'node:path'
import { LiteratureAi } from './lib/ai.js'
import { LiteratureLibrary } from './lib/library.js'
import { ACTION_PATH, FILE_PATH, PAGETEXT_PATH, PAGE_PATH, UPLOAD_PATH, createLiteratureRoutes } from './lib/route.js'
import { LibraryStore } from './lib/store.js'
import { registerLiteratureTools } from './lib/tools.js'
import { clampInteger } from './lib/util.js'

/** Cordis plugin name used in diagnostics. */
export const name = 'literature-library'

/** The bundle needs the connection carrier and the tool registry. */
export const inject = ['connection', 'tools']

/**
 * Discover the profile's data home.
 * @returns the absolute data directory for this plugin.
 */
function defaultDataDir() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : path.join(os.homedir(), '.dsh')
  return path.join(home, 'literature')
}

/**
 * Apply defaults and bounds to the plugin row config.
 * @param raw - config from cordis.patch.yml, already schema-validated when the schema loaded.
 * @returns the resolved config.
 */
function resolveConfig(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const dataDir = typeof source.dataDir === 'string' && source.dataDir.trim() !== '' ? path.resolve(source.dataDir.trim()) : defaultDataDir()
  return {
    dataDir,
    language: source.language === 'en' ? 'en' : 'zh',
    provider: typeof source.provider === 'string' ? source.provider.trim() : '',
    model: typeof source.model === 'string' ? source.model.trim() : '',
    maxPdfBytes: clampInteger(source.maxPdfBytes, 1024 * 1024, 200 * 1024 * 1024, 40 * 1024 * 1024),
    maxTextPages: clampInteger(source.maxTextPages, 1, 500, 80),
    maxPromptChars: clampInteger(source.maxPromptChars, 4000, 300_000, 60_000),
    searchMaxResults: clampInteger(source.searchMaxResults, 1, 25, 8),
  }
}

/**
 * Plugin configuration, exposed so Plugin Manager can edit the row.
 * The schema module is imported dynamically: a bundle must stay loadable even
 * when the optional settings dependency is unavailable.
 */
export let Config
try {
  const schemaModule = await import('@deepseek-ai/schemastery')
  const Schema = schemaModule.default ?? schemaModule.Schema
  if (typeof Schema?.object === 'function') {
    Config = Schema.object({
      dataDir: Schema.string().default('')
        .description('文献库数据目录（PDF 与索引）；留空则使用 <DSH_HOME>/literature。'),
      language: Schema.string().default('zh')
        .description('翻译与总结的目标语言：zh 或 en。'),
      provider: Schema.string().default('')
        .description('可选：模型 provider；留空则跟随当前默认模型。'),
      model: Schema.string().default('')
        .description('可选：模型名；与 provider 同时填写才生效。'),
      maxPdfBytes: Schema.natural().default(40 * 1024 * 1024)
        .description('单个 PDF 的大小上限（字节）。'),
      maxTextPages: Schema.natural().default(80)
        .description('每篇文献最多提取多少页正文。'),
      maxPromptChars: Schema.natural().default(60000)
        .description('送入模型的正文字符上限。'),
      searchMaxResults: Schema.natural().default(8)
        .description('每次检索返回的条数上限。'),
    })
  }
} catch {
  Config = undefined
}

/**
 * Mount the library, its routes, and its agent tools.
 * @param ctx - Host plugin context.
 * @param rawConfig - the row's config from the composition.
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  const store = new LibraryStore(config.dataDir)
  store.load()
  const library = new LiteratureLibrary(store, config)
  const ai = new LiteratureAi(ctx, config, library)
  const officeKit = ctx.get('officeKit')
  const routes = createLiteratureRoutes({ library, ai, config, officeKit })

  ctx.effect(() => ctx.connection.fetch.register({
    path: ACTION_PATH,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => routes.action(request),
  }), 'literature-library: action route')

  ctx.effect(() => ctx.connection.fetch.register({
    path: FILE_PATH,
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: (request) => routes.file(request),
  }), 'literature-library: pdf route')

  ctx.effect(() => ctx.connection.fetch.register({
    path: PAGE_PATH,
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: (request) => routes.page(request),
  }), 'literature-library: page route')

  ctx.effect(() => ctx.connection.fetch.register({
    path: PAGETEXT_PATH,
    methods: ['GET', 'HEAD'],
    requestBody: 'buffered',
    fetch: (request) => routes.pageText(request),
  }), 'literature-library: page text route')

  ctx.effect(() => ctx.connection.fetch.register({
    path: UPLOAD_PATH,
    methods: ['POST'],
    requestBody: 'streaming',
    fetch: (request) => routes.upload(request),
  }), 'literature-library: upload route')

  registerLiteratureTools(ctx, { library, ai, config })

  ctx.logger?.info?.(`literature-library: ${store.list().length} papers in ${config.dataDir}`)

  return () => {
    store.save()
  }
}
