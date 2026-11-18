/**
 * Literature discovery over public, keyless metadata services: the arXiv Atom
 * API and Crossref's REST API. Both are fetched from the Host, so the browser
 * never talks to a third party directly.
 */
import { cleanLine, decodeEntities, describeHttpFailure, fetchWithTimeout, normalizeArxivId, normalizeDoi, stripMarkup } from './util.js'

/** Metadata used by the search list and by adding a paper. */
export const SOURCES = ['arxiv', 'crossref']

/**
 * Build one discovery result.
 * @param fields - result fields.
 * @returns a normalized search result.
 */
function makeResult(fields) {
  const arxivId = fields.arxivId ?? ''
  const doi = fields.doi ?? ''
  const key = arxivId !== '' ? `arxiv:${arxivId}` : doi !== '' ? `doi:${doi}` : `title:${cleanLine(fields.title, 200).toLowerCase()}`
  return {
    key,
    source: fields.source,
    title: cleanLine(fields.title, 400) || '未命名文献',
    authors: (fields.authors ?? []).map((author) => cleanLine(author, 120)).filter(Boolean).slice(0, 40),
    year: Number.isInteger(fields.year) ? fields.year : null,
    venue: cleanLine(fields.venue, 200),
    abstract: typeof fields.abstract === 'string' ? fields.abstract.slice(0, 6000) : '',
    doi,
    arxivId,
    url: fields.url ?? '',
    pdfUrl: fields.pdfUrl ?? '',
    type: fields.type ?? 'article',
  }
}

/**
 * Read one Atom element's text.
 * @param xml - the entry fragment.
 * @param name - element name, including any namespace prefix.
 * @returns decoded text.
 */
function atomText(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return match === null ? '' : decodeEntities(match[1]).replace(/\s+/g, ' ').trim()
}

/**
 * Parse an arXiv Atom feed into normalized results.
 * @param xml - feed XML.
 * @returns results in feed order.
 */
function parseArxivFeed(xml) {
  const results = []
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
  for (const entry of entries) {
    const rawId = atomText(entry, 'id')
    const arxivId = normalizeArxivId(rawId)
    const title = atomText(entry, 'title')
    const abstract = atomText(entry, 'summary')
    const published = atomText(entry, 'published')
    const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)]
      .map((match) => decodeEntities(match[1]).replace(/\s+/g, ' ').trim())
    const primary = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/)
    const doi = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/)
    const year = published === '' ? null : Number.parseInt(published.slice(0, 4), 10)
    if (arxivId === '' || title === '') continue
    results.push(makeResult({
      source: 'arxiv',
      title,
      authors,
      year: Number.isInteger(year) ? year : null,
      venue: primary === null ? 'arXiv' : `arXiv · ${primary[1]}`,
      abstract,
      doi: doi === null ? '' : normalizeDoi(decodeEntities(doi[1])),
      arxivId,
      url: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
      type: 'preprint',
    }))
  }
  return results
}

/**
 * Build one arXiv `search_query` value: a quoted phrase first, which the API
 * ranks far better than bare terms.
 * @param text - free-text query.
 * @returns the query expression.
 */
function arxivPhraseQuery(text) {
  return `all:${encodeURIComponent(`"${text.replace(/"/g, '')}"`)}`
}

/**
 * Build a conjunction of single terms, used when the phrase finds nothing.
 * @param text - free-text query.
 * @returns the query expression.
 */
function arxivTermQuery(text) {
  const terms = text.split(/\s+/).filter(Boolean).slice(0, 8)
  return terms.map((term) => `all:${encodeURIComponent(term)}`).join('+AND+')
}

/**
 * Ask one arXiv query and parse its feed.
 * @param searchQuery - encoded `search_query` expression.
 * @param limit - maximum results.
 * @param signal - caller cancellation.
 * @returns normalized results.
 */
async function arxivRequest(searchQuery, limit, signal) {
  const url = `https://export.arxiv.org/api/query?search_query=${searchQuery}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`
  const response = await fetchWithTimeout(url, { signal, timeoutMs: 20_000, headers: { accept: 'application/atom+xml' } })
  if (!response.ok) throw new Error(`arXiv 查询失败（${await describeHttpFailure(response)}）`)
  return parseArxivFeed(await response.text())
}

/**
 * Run one arXiv metadata query.
 * @param query - free-text query.
 * @param limit - maximum results.
 * @param signal - caller cancellation.
 * @returns normalized results.
 */
export async function searchArxiv(query, limit, signal) {
  const text = cleanLine(query, 400)
  if (text === '') return []
  const phrase = await arxivRequest(arxivPhraseQuery(text), limit, signal)
  if (phrase.length > 0) return phrase
  return await arxivRequest(arxivTermQuery(text), limit, signal)
}

/**
 * Read one arXiv record by identifier.
 * @param arxivId - identifier with or without a version suffix.
 * @param signal - caller cancellation.
 * @returns the record, or undefined.
 */
export async function fetchArxivRecord(arxivId, signal) {
  const id = normalizeArxivId(arxivId)
  if (id === '') return undefined
  const url = new URL('https://export.arxiv.org/api/query')
  url.searchParams.set('id_list', id)
  url.searchParams.set('max_results', '1')
  const response = await fetchWithTimeout(url, { signal, timeoutMs: 20_000, headers: { accept: 'application/atom+xml' } })
  if (!response.ok) throw new Error(`arXiv 查询失败（${await describeHttpFailure(response)}）`)
  return parseArxivFeed(await response.text())[0]
}

/**
 * Run one Crossref bibliographic query.
 * @param query - free-text query.
 * @param limit - maximum results.
 * @param signal - caller cancellation.
 * @returns normalized results.
 */
export async function searchCrossref(query, limit, signal) {
  const text = cleanLine(query, 400)
  if (text === '') return []
  const url = new URL('https://api.crossref.org/works')
  url.searchParams.set('query.bibliographic', text)
  url.searchParams.set('rows', String(limit))
  url.searchParams.set('select', 'DOI,title,author,issued,container-title,abstract,URL,type')
  const response = await fetchWithTimeout(url, {
    signal,
    timeoutMs: 20_000,
    headers: { accept: 'application/json', 'user-agent': 'dsh-literature-library/1.0 (mailto:literature@example.invalid)' },
  })
  if (!response.ok) throw new Error(`Crossref 查询失败（${await describeHttpFailure(response)}）`)
  const body = await response.json()
  const items = Array.isArray(body?.message?.items) ? body.message.items : []
  return items.map((item) => {
    const doi = normalizeDoi(item?.DOI ?? '')
    const published = item?.issued?.['date-parts']?.[0]?.[0]
    const authors = Array.isArray(item?.author)
      ? item.author.map((author) => cleanLine([author?.given, author?.family].filter(Boolean).join(' '), 120)).filter(Boolean)
      : []
    return makeResult({
      source: 'crossref',
      title: Array.isArray(item?.title) ? item.title[0] : item?.title,
      authors,
      year: Number.isInteger(published) ? published : null,
      venue: Array.isArray(item?.['container-title']) ? item['container-title'][0] : '',
      abstract: stripMarkup(item?.abstract ?? ''),
      doi,
      arxivId: '',
      url: typeof item?.URL === 'string' ? item.URL : doi === '' ? '' : `https://doi.org/${doi}`,
      pdfUrl: '',
      type: cleanLine(item?.type ?? '', 60) || 'article',
    })
  })
}

/**
 * Search every requested source and merge results, dropping duplicates by DOI
 * or normalized title while keeping source order.
 * @param query - free-text query.
 * @param options - sources, limit, and cancellation.
 * @returns merged results plus per-source failures.
 */
export async function searchLiterature(query, options = {}) {
  const sources = Array.isArray(options.sources) && options.sources.length > 0 ? options.sources : ['arxiv']
  const limit = options.limit ?? 8
  const collected = []
  const failures = []
  for (const source of sources) {
    try {
      const results = source === 'crossref'
        ? await searchCrossref(query, limit, options.signal)
        : await searchArxiv(query, limit, options.signal)
      collected.push(...results)
    } catch (error) {
      failures.push({ source, message: error instanceof Error ? error.message : String(error) })
    }
  }
  const seen = new Set()
  const results = []
  for (const result of collected) {
    const identity = result.doi !== '' ? `doi:${result.doi}` : result.arxivId !== '' ? `arxiv:${result.arxivId}` : result.key
    if (seen.has(identity)) continue
    seen.add(identity)
    results.push(result)
  }
  return { results: results.slice(0, limit * sources.length), failures, sources }
}

/**
 * Turn a user-provided link or identifier into a discovery result.
 * @param input - arXiv link or id, DOI link or DOI, or a direct PDF link.
 * @param signal - caller cancellation.
 * @returns the result, or a failure message.
 */
export async function resolveReference(input, signal) {
  const text = typeof input === 'string' ? input.trim() : ''
  if (text === '') return { error: '请输入 arXiv 链接/编号、DOI 或 PDF 链接' }
  const doi = normalizeDoi(text)
  if (doi !== '' && !text.toLowerCase().includes('arxiv')) {
    const found = await searchCrossref(doi, 3, signal)
    const match = found.find((result) => result.doi === doi) ?? found[0]
    if (match !== undefined) return { result: { ...match, doi, url: `https://doi.org/${doi}` } }
    return { result: makeResult({ source: 'crossref', title: doi, doi, url: `https://doi.org/${doi}` }) }
  }
  const arxivId = normalizeArxivId(text)
  if (arxivId !== '') {
    const record = await fetchArxivRecord(arxivId, signal)
    if (record !== undefined) return { result: record }
    return { error: `arXiv 未找到 ${arxivId}` }
  }
  if (/^https?:\/\//i.test(text)) {
    return { result: makeResult({ source: 'url', title: text.split('/').pop() ?? text, url: text, pdfUrl: /\.pdf(\?|$)/i.test(text) ? text : '' }) }
  }
  return { error: '无法识别该链接或编号' }
}
