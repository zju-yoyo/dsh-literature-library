/**
 * 文献阅读与管理 Client half.
 *
 * Registers a sidebar launcher and one frame-wide workspace: library browsing,
 * the original pages with a selectable text layer, cached text, translation,
 * summaries, and grounded Q&A over the Host half's `/api/literature` endpoints.
 * Plain JavaScript with `React.createElement`, loaded through the page module
 * loader.
 */
window.__ModuleLoader__.load({
  id: 'dsh-literature-library',
  factory(require) {
    const React = require('react')
    const { createElement: h, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    /** Locale namespace used by every string in this file. */
    const NS = 'literatureLibrary'

    /** Chinese and English dictionaries; the host locale service picks by active locale. */
    const DICT = {
      zh: {
        title: '文献阅读',
        launcher: '文献库',
        close: '关闭',
        refresh: '刷新文献库',
        tabLibrary: '文献库',
        tabDiscover: '查找文献',
        filterAll: '全部',
        statusUnread: '未读',
        statusReading: '在读',
        statusRead: '已读',
        starredOnly: '星标',
        librarySearch: '在库内搜索标题、作者、标签…',
        uploadPdf: '上传 PDF',
        uploading: '上传中…',
        emptyLibrary: '文献库还是空的',
        emptyLibraryHint: '在「查找文献」里检索 arXiv，或用「上传 PDF」加入本地文件。',
        noMatch: '没有匹配的文献',
        noMatchHint: '换一个关键词或筛选条件试试。',
        selectPaper: '从左侧选择一篇文献开始阅读',
        selectPaperHint: '也可以切到「查找文献」检索新的论文。',
        goDiscover: '去查找文献',
        discoverTitle: '查找文献',
        discoverHint: '检索 arXiv 与 Crossref 的元数据，找到后一键入库。',
        searchPlaceholder: '输入主题、标题或作者，例如 selective state space models',
        sourceArxiv: 'arXiv',
        sourceCrossref: 'Crossref',
        sourceAll: '全部来源',
        search: '检索',
        searching: '检索中…',
        noResults: '没有找到匹配的文献',
        addToLibrary: '加入文献库',
        adding: '下载并解析中…',
        inLibrary: '已在库中',
        openPaper: '阅读',
        addByReference: '按链接 / 编号添加',
        referencePlaceholder: 'arXiv 编号或链接、DOI、PDF 链接',
        add: '添加',
        selectHint: '选中原文任意文字即可翻译或提问',
        text: '文本',
        translate: '翻译',
        summarize: '总结',
        ask: '提问',
        retry: '重试',
        loading: '加载中…',
        noPdf: '这篇文献还没有保存的 PDF',
        noPdfHint: '可以上传本地 PDF，或按链接重新添加这篇文献。',
        noText: '还没有提取正文',
        noTextHint: '如果 PDF 已保存，可以重新提取正文。',
        extractText: '提取正文',
        extracting: '提取中…',
        loadMore: '加载更多',
        pageCount: '共 {count} 页',
        zoomIn: '放大',
        zoomOut: '缩小',
        rendering: '正在渲染…',
        quality: '清晰度',
        qualityStandard: '标准',
        qualityHigh: '高清',
        qualityMax: '超清',
        pageRenderFailed: '这一页渲染失败',
        translateTargetZh: '译为中文',
        translateTargetEn: '译为英文',
        translateHint: '在下方粘贴或输入要翻译的片段；留空则翻译全文（最多 20000 字符）。',
        translatePlaceholder: '选择要翻译的文本（可留空）',
        translating: '翻译中…',
        summaryStructured: '结构化总结',
        summaryBrief: '简要总结',
        summarizing: '总结中…',
        askHint: '基于这篇文献的正文回答；正文未涉及的内容会明确说明。',
        askPlaceholder: '就这篇文献提问，例如：它和 Transformer 的主要区别是什么？',
        askEmpty: '输入问题后按 Ctrl+Enter 发送。',
        send: '发送',
        thinking: '思考中…',
        copy: '复制',
        copied: '已复制',
        remove: '删除',
        removeConfirm: '确认删除',
        removeCancel: '取消',
        rename: '重命名',
        renameTitle: '输入新的文献标题',
        status: '阅读状态',
        tags: '标签',
        tagsHint: '回车添加，点击标签可删除',
        notes: '笔记',
        notesPlaceholder: '阅读笔记（停止输入后自动保存）',
        saving: '保存中…',
        abstract: '摘要',
        meta: '出处',
        etal: ' 等',
        aiUnavailable: '未配置默认模型，翻译/总结/提问不可用',
        modelLabel: '模型：{model}',
        dismiss: '知道了',
        deleteFailed: '删除失败',
        addFailed: '添加失败',
        uploadFailed: '上传失败',
        textFailed: '读取正文失败',
        emptyAi: '结果会显示在这里。',
        noticeAdded: '已加入文献库，可切到「文献库」阅读。',
      },
      en: {
        title: 'Literature library',
        launcher: 'Library',
        close: 'Close',
        refresh: 'Refresh library',
        tabLibrary: 'Library',
        tabDiscover: 'Find papers',
        filterAll: 'All',
        statusUnread: 'Unread',
        statusReading: 'Reading',
        statusRead: 'Read',
        starredOnly: 'Starred',
        librarySearch: 'Search titles, authors, tags…',
        uploadPdf: 'Upload PDF',
        uploading: 'Uploading…',
        emptyLibrary: 'Your library is empty',
        emptyLibraryHint: 'Search arXiv under “Find papers”, or upload a local PDF.',
        noMatch: 'No matching papers',
        noMatchHint: 'Try another keyword or filter.',
        selectPaper: 'Pick a paper on the left to start reading',
        selectPaperHint: 'Or switch to “Find papers” to search for a new one.',
        goDiscover: 'Find papers',
        discoverTitle: 'Find papers',
        discoverHint: 'Search arXiv and Crossref metadata, then add a result in one click.',
        searchPlaceholder: 'Topic, title, or author — e.g. selective state space models',
        sourceArxiv: 'arXiv',
        sourceCrossref: 'Crossref',
        sourceAll: 'All sources',
        search: 'Search',
        searching: 'Searching…',
        noResults: 'No matching papers',
        addToLibrary: 'Add to library',
        adding: 'Downloading and parsing…',
        inLibrary: 'In library',
        openPaper: 'Read',
        addByReference: 'Add by link or identifier',
        referencePlaceholder: 'arXiv id or link, DOI, or PDF URL',
        add: 'Add',
        selectHint: 'Select any text on the page to translate or ask',
        text: 'Text',
        translate: 'Translate',
        summarize: 'Summarize',
        ask: 'Ask',
        retry: 'Retry',
        loading: 'Loading…',
        noPdf: 'This paper has no stored PDF',
        noPdfHint: 'Upload a local PDF, or add the paper again with a PDF link.',
        noText: 'No text extracted yet',
        noTextHint: 'If the PDF is stored, you can extract the text again.',
        extractText: 'Extract text',
        extracting: 'Extracting…',
        loadMore: 'Load more',
        pageCount: '{count} pages',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        rendering: 'Rendering…',
        quality: 'Quality',
        qualityStandard: 'Standard',
        qualityHigh: 'High',
        qualityMax: 'Max',
        pageRenderFailed: 'This page failed to render',
        translateTargetZh: 'Into Chinese',
        translateTargetEn: 'Into English',
        translateHint: 'Paste a passage below; leave it empty to translate the full text (up to 20000 characters).',
        translatePlaceholder: 'Text to translate (optional)',
        translating: 'Translating…',
        summaryStructured: 'Structured summary',
        summaryBrief: 'Brief summary',
        summarizing: 'Summarizing…',
        askHint: 'Answers are grounded in this paper’s text; anything outside it is called out.',
        askPlaceholder: 'Ask about this paper — e.g. how does it differ from the Transformer?',
        askEmpty: 'Type a question and press Ctrl+Enter to send.',
        send: 'Send',
        thinking: 'Thinking…',
        copy: 'Copy',
        copied: 'Copied',
        remove: 'Delete',
        removeConfirm: 'Confirm delete',
        removeCancel: 'Cancel',
        rename: 'Rename',
        renameTitle: 'Enter a new paper title',
        status: 'Status',
        tags: 'Tags',
        tagsHint: 'Press Enter to add; click a tag to remove it',
        notes: 'Notes',
        notesPlaceholder: 'Reading notes (saved automatically after typing stops)',
        saving: 'Saving…',
        abstract: 'Abstract',
        meta: 'Source',
        etal: ' et al.',
        aiUnavailable: 'No default model configured, so translation, summaries, and Q&A are unavailable',
        modelLabel: 'Model: {model}',
        dismiss: 'Dismiss',
        deleteFailed: 'Delete failed',
        addFailed: 'Add failed',
        uploadFailed: 'Upload failed',
        textFailed: 'Reading the text failed',
        emptyAi: 'Results appear here.',
        noticeAdded: 'Added to the library — open it under “Library”.',
      },
    }

    /** Active translate function; rebound to the locale service during apply. */
    let t = (key) => DICT.zh[key] ?? key

    /** Base URL of this bundle's Host endpoints, resolved against the page. */
    function apiBase() {
      return new URL('api/literature/', document.baseURI)
    }

    /**
     * Call one Host action with a deadline.
     * @param action - action name.
     * @param payload - extra JSON fields.
     * @param options - optional cancellation signal and deadline.
     * @returns the action value.
     */
    async function call(action, payload, options = {}) {
      const timeoutMs = options.timeoutMs ?? 120_000
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('请求超时')), timeoutMs)
      const forwardAbort = () => controller.abort(options.signal?.reason)
      if (options.signal !== undefined) {
        if (options.signal.aborted) controller.abort(options.signal.reason)
        else options.signal.addEventListener('abort', forwardAbort, { once: true })
      }
      try {
        const response = await fetch(new URL('action', apiBase()).href, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
          signal: controller.signal,
        })
        let body
        try {
          body = await response.json()
        } catch {
          throw new Error(`HTTP ${response.status}`)
        }
        if (body?.ok !== true) throw new Error(body?.error ?? `HTTP ${response.status}`)
        return body.value
      } finally {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', forwardAbort)
      }
    }

    /** Workspace state shared by the launcher and the frame-wide panel. */
    const store = {
      open: false,
      mode: 'library',
      paperId: null,
      papers: [],
      summary: null,
      ai: { available: false, model: '', reason: '' },
      loaded: false,
      error: '',
      notice: '',
    }

    const listeners = new Set()

    /** Snapshot counter; the store object is mutated in place. */
    let revision = 0

    /** Re-render every subscribed component. */
    function emit() {
      revision += 1
      for (const listener of [...listeners]) listener()
    }

    /**
     * Merge a state patch and repaint.
     * @param patch - partial state.
     */
    function setState(patch) {
      Object.assign(store, patch)
      emit()
    }

    /**
     * Subscribe one component to store revisions.
     * @param listener - change callback.
     * @returns the unsubscribe function.
     */
    function subscribeStore(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }

    /** Read the current revision snapshot. */
    function readRevision() {
      return revision
    }

    /** Subscribe to workspace state in a component. */
    function useStore() {
      useSyncExternalStore(subscribeStore, readRevision, readRevision)
      return store
    }

    /**
     * Load the full library state and repaint.
     * @param quiet - suppress the error banner when the refresh fails.
     * @returns nothing.
     */
    async function reloadLibrary(quiet = false) {
      try {
        const value = await call('state', {}, { timeoutMs: 30_000 })
        setState({ papers: value.papers, summary: value.summary, ai: value.ai, loaded: true, error: '' })
      } catch (error) {
        if (!quiet) setState({ error: error instanceof Error ? error.message : String(error) })
      }
    }

    /**
     * Replace or insert one paper in the cached list.
     * @param paper - wire paper record.
     */
    function upsertPaper(paper) {
      const exists = store.papers.some((entry) => entry.id === paper.id)
      const papers = exists
        ? store.papers.map((entry) => (entry.id === paper.id ? paper : entry))
        : [paper, ...store.papers]
      const byStatus = { unread: 0, reading: 0, read: 0 }
      let textChars = 0
      for (const entry of papers) {
        byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1
        textChars += entry.textChars ?? 0
      }
      setState({
        papers,
        summary: { ...(store.summary ?? {}), total: papers.length, byStatus, textChars },
      })
    }

    /**
     * Remove one paper from the cached list.
     * @param id - paper id.
     */
    function dropPaper(id) {
      setState({ papers: store.papers.filter((entry) => entry.id !== id), paperId: store.paperId === id ? null : store.paperId })
    }

    /** Open the workspace. */
    function openWorkspace() {
      setState({ open: true, error: '', notice: '' })
      if (!store.loaded) void reloadLibrary()
    }

    /** Close the workspace. */
    function closeWorkspace() {
      setState({ open: false })
    }

    /**
     * Report one non-fatal outcome in the workspace banner.
     * @param message - the message.
     */
    function pushNotice(message) {
      setState({ notice: message })
    }

    /** Small inline icon paths, drawn with currentColor. */
    const ICONS = {
      library: 'M5 4h3v16H5zM10.5 4h3v16h-3zM16 4.4l2.9 15.7-2.96.55L13.05 4.95z',
      search: 'M10.5 4a6.5 6.5 0 1 0 3.98 11.64l4.19 4.19 1.41-1.41-4.19-4.19A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
      close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
      star: 'M12 3.6l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z',
      upload: 'M11 4h2v9.2l3.3-3.3 1.4 1.4L12 17l-5.7-5.7 1.4-1.4L11 13.2zM5 18h14v2H5z',
      trash: 'M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 12H7zM10 10v8h1.5v-8zm3 0v8h1.5v-8z',
      spark: 'M12 2.5l1.7 5.6 5.8 1.6-4.4 3.8 1 5.8-4.1-3.1-4.85 2.4 1.1-5.8L3.5 9.9l5.8-1.5z',
      chevron: 'M8.6 5.6 15 12l-6.4 6.4-1.4-1.4 5-5-5-5z',
      book: 'M4 4h7a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2H4zm16 0h-4a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2H20z',
    }

    /**
     * Render one inline icon.
     * @param props - icon name and pixel size.
     * @returns the svg element.
     */
    function Icon({ name, size = 16 }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block', fill: 'currentColor', flex: 'none' },
      }, h('path', { d: ICONS[name] ?? ICONS.book }))
    }

    /** Toolbar button used across the workspace. */
    function ActionButton({ onClick, children, title, disabled = false, tone = 'quiet', type = 'button' }) {
      return h('button', {
        type,
        title: title ?? undefined,
        'aria-label': title ?? undefined,
        disabled,
        onClick,
        className: `lit-btn lit-btn-${tone}`,
      }, children)
    }

    /** One header segment button. */
    function Segment({ active, onClick, children }) {
      return h('button', {
        type: 'button',
        className: `lit-segment${active ? ' is-active' : ''}`,
        'aria-pressed': active,
        onClick,
      }, children)
    }

    /**
     * Whether an Enter key event is committing an IME composition.
     * @param event - React keyboard event.
     * @returns true when the key belongs to the IME, not the field.
     */
    function isImeComposing(event) {
      return event.nativeEvent?.isComposing === true || event.keyCode === 229
    }

    /**
     * Upload one local PDF through the Host upload route.
     * @param file - chosen file.
     * @param select - open the stored paper afterwards.
     * @returns nothing.
     */
    async function uploadPaper(file, select) {
      if (file === undefined || file === null) return
      try {
        const response = await fetch(new URL(`upload?name=${encodeURIComponent(file.name)}`, apiBase()).href, {
          method: 'POST',
          body: file,
        })
        const body = await response.json()
        if (body?.ok !== true) throw new Error(body?.error ?? `HTTP ${response.status}`)
        upsertPaper(body.value.paper)
        const warnings = body.value.warnings ?? []
        if (warnings.length > 0) pushNotice(warnings.join('；'))
        if (select === true) setState({ paperId: body.value.paper.id, mode: 'library' })
      } catch (error) {
        setState({ error: `${t('uploadFailed')}：${error instanceof Error ? error.message : String(error)}` })
      }
    }

    /** Sidebar-foot launcher that opens the workspace. */
    function FooterAction(props) {
      const wide = props?.wide === true
      return h('button', {
        type: 'button',
        className: 'lit-launcher',
        title: t('launcher'),
        'aria-label': t('launcher'),
        onClick: openWorkspace,
      }, h(Icon, { name: 'library', size: 18 }), wide ? h('span', { className: 'lit-launcher-label' }, t('launcher')) : null)
    }

    /** One library row. */
    function PaperRow({ paper, active, onOpen }) {
      const statusText = paper.status === 'read' ? t('statusRead') : paper.status === 'reading' ? t('statusReading') : t('statusUnread')
      const authors = paper.authors.length === 0 ? '' : paper.authors.slice(0, 3).join(', ')
      return h('button', {
        type: 'button',
        className: `lit-row${active ? ' is-active' : ''}`,
        onClick: onOpen,
      },
      h('span', { className: `lit-dot lit-dot-${paper.status}` }),
      h('span', { className: 'lit-row-body' },
        h('span', { className: 'lit-row-title' }, paper.starred ? '★ ' : '', paper.title),
        h('span', { className: 'lit-row-meta' }, [authors, paper.year === null ? '' : String(paper.year)].filter(Boolean).join(' · ') || t('meta')),
        h('span', { className: 'lit-row-tags' },
          h('span', { className: `lit-pill lit-pill-${paper.status}` }, statusText),
          paper.hasText ? h('span', { className: 'lit-pill' }, t('text')) : null,
          ...paper.tags.slice(0, 2).map((tag) => h('span', { key: tag, className: 'lit-pill' }, tag)))),
      )
    }

    /** Library column: filters, search, upload, and the row list. */
    function LibraryColumn({ onPick }) {
      const state = useStore()
      const [query, setQuery] = useState('')
      const [filter, setFilter] = useState('all')
      const fileRef = useRef(null)
      const [uploading, setUploading] = useState(false)

      const papers = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return state.papers.filter((paper) => {
          if (filter === 'starred' && !paper.starred) return false
          if (filter === 'unread' && paper.status !== 'unread') return false
          if (filter === 'reading' && paper.status !== 'reading') return false
          if (filter === 'read' && paper.status !== 'read') return false
          if (needle === '') return true
          return `${paper.title} ${paper.authors.join(' ')} ${paper.tags.join(' ')} ${paper.abstract}`.toLowerCase().includes(needle)
        })
      }, [state.papers, query, filter])

      const upload = useCallback(async (file) => {
        setUploading(true)
        try {
          await uploadPaper(file, true)
        } finally {
          setUploading(false)
          if (fileRef.current !== null) fileRef.current.value = ''
        }
      }, [])

      const emptyMessage = state.papers.length === 0
        ? h('div', { className: 'lit-empty' }, h('strong', null, t('emptyLibrary')), h('p', null, t('emptyLibraryHint')))
        : h('div', { className: 'lit-empty' }, h('strong', null, t('noMatch')), h('p', null, t('noMatchHint')))

      return h('div', { className: 'lit-column lit-column-library' },
        h('div', { className: 'lit-column-head' },
          h('div', { className: 'lit-search' },
            h('span', { className: 'lit-search-icon' }, h(Icon, { name: 'search', size: 14 })),
            h('input', {
              className: 'lit-input lit-input-search',
              value: query,
              placeholder: t('librarySearch'),
              onChange: (event) => setQuery(event.target.value),
            })),
          h('div', { className: 'lit-filter-row' },
            ...[['all', t('filterAll')], ['unread', t('statusUnread')], ['reading', t('statusReading')], ['read', t('statusRead')], ['starred', t('starredOnly')]]
              .map(([key, label]) => h('button', {
                key,
                type: 'button',
                className: `lit-chip${filter === key ? ' is-active' : ''}`,
                'aria-pressed': filter === key,
                onClick: () => setFilter(key),
              }, label)),
            h('button', {
              type: 'button',
              className: 'lit-chip lit-chip-action',
              title: t('uploadPdf'),
              disabled: uploading,
              onClick: () => fileRef.current?.click(),
            }, h(Icon, { name: 'upload', size: 13 }), uploading ? t('uploading') : t('uploadPdf')),
            h('input', {
              ref: fileRef,
              type: 'file',
              accept: 'application/pdf,.pdf',
              style: { display: 'none' },
              onChange: (event) => void upload(event.target.files?.[0]),
            }))),
        h('div', { className: 'lit-list' },
          papers.length === 0 ? emptyMessage : papers.map((paper) => h(PaperRow, {
            key: paper.id,
            paper,
            active: state.paperId === paper.id,
            onOpen: () => onPick(paper.id),
          }))))
    }

    /**
     * One original-page image with an invisible selectable text layer.
     * @param props - paper, page number, display width, density, and selection callback.
     * @returns the page element.
     */
    function PageImage({ paper, pageNumber, width, dpi, onSelectText }) {
      const [state, setState] = useState('loading')
      const [ratio, setRatio] = useState(1.414)
      const [attempt, setAttempt] = useState(0)
      const [items, setItems] = useState([])
      const [failure, setFailure] = useState('')
      const query = `id=${encodeURIComponent(paper.id)}&page=${pageNumber}&dpi=${dpi}${attempt === 0 ? '' : `&attempt=${attempt}`}`
      const url = new URL(`page?${query}`, apiBase()).href

      useEffect(() => {
        let cancelled = false
        const load = async () => {
          try {
            const response = await fetch(new URL(`pagetext?id=${encodeURIComponent(paper.id)}&page=${pageNumber}`, apiBase()).href)
            const body = await response.json()
            if (cancelled || body?.ok !== true) return
            setItems(Array.isArray(body.value.items) ? body.value.items : [])
          } catch {
            // A missing text layer only disables selection on this page.
          }
        }
        void load()
        return () => { cancelled = true }
      }, [paper.id, pageNumber])

      const displayHeight = width * ratio
      return h('div', {
        className: 'lit-pdf-page',
        style: { width: `${Math.round(width)}px`, height: `${Math.round(displayHeight)}px` },
      },
      state === 'error'
        ? h('div', { className: 'lit-pdf-page-failed' },
          h('span', null, t('pageRenderFailed')),
          failure === '' ? null : h('span', { className: 'lit-pdf-page-failed-detail' }, failure),
          h(ActionButton, { onClick: () => { setState('loading'); setFailure(''); setAttempt((value) => value + 1) } }, t('retry')))
        : h('img', {
          src: url,
          alt: `${paper.title} — ${pageNumber}`,
          loading: pageNumber <= 3 ? 'eager' : 'lazy',
          decoding: 'async',
          className: 'lit-pdf-image',
          style: { visibility: state === 'ready' ? 'visible' : 'hidden' },
          onLoad: (event) => {
            const image = event.currentTarget
            if (image.naturalWidth > 0) setRatio(image.naturalHeight / image.naturalWidth)
            setState('ready')
          },
          onError: () => {
            setState('error')
            void (async () => {
              try {
                const response = await fetch(url)
                const text = (await response.text()).trim().slice(0, 300)
                setFailure(text)
              } catch {
                // The failure text is a diagnostic extra.
              }
            })()
          },
        }),
      state === 'ready'
        ? h('div', {
          className: 'lit-text-layer',
          onMouseUp: (event) => {
            const selection = window.getSelection()
            const text = selection === null ? '' : selection.toString().replace(/\s+/g, ' ').trim()
            if (text.length >= 2) onSelectText(text, pageNumber, event)
          },
        }, items.map((item, index) => h('span', {
          key: index,
          className: 'lit-text-item',
          style: {
            left: `${item.x * 100}%`,
            top: `${(item.y - item.h) * 100}%`,
            fontSize: `${Math.max(4, item.h * displayHeight)}px`,
          },
        }, item.s)))
        : null,
      state === 'loading' ? h('div', { className: 'lit-pdf-page-loading' }, t('rendering')) : null,
      h('span', { className: 'lit-pdf-page-number' }, String(pageNumber)))
    }

    /** Original-page pane: Host-rendered page images with zoom and density choice. */
    function PdfPane({ paper, onSelectText }) {
      const hostRef = useRef(null)
      const [zoom, setZoom] = useState(1)
      const [width, setWidth] = useState(760)
      const [dpi, setDpi] = useState(160)
      const pageCount = Math.max(1, paper.pageCount > 0 ? paper.pageCount : 1)

      useEffect(() => {
        const host = hostRef.current
        if (host === null) return undefined
        const update = () => setWidth(Math.max(320, Math.min(1400, host.clientWidth - 36)))
        update()
        const observer = new ResizeObserver(update)
        observer.observe(host)
        return () => observer.disconnect()
      }, [])

      const pageWidth = width * zoom
      return h('div', { className: 'lit-pane lit-pane-pdf' },
        h('div', { className: 'lit-pdf-toolbar' },
          h(ActionButton, { onClick: () => setZoom((value) => Math.max(0.5, value - 0.15)), title: t('zoomOut') }, '−'),
          h('span', { className: 'lit-pdf-zoom' }, `${Math.round(zoom * 100)}%`),
          h(ActionButton, { onClick: () => setZoom((value) => Math.min(3, value + 0.15)), title: t('zoomIn') }, '+'),
          h('span', { className: 'lit-pdf-count' }, t('pageCount', { count: pageCount })),
          h('span', { style: { flex: 1 } }),
          h('span', { className: 'lit-hint lit-select-hint' }, t('selectHint')),
          h('select', {
            className: 'lit-select lit-select-sm',
            value: String(dpi),
            title: t('quality'),
            onChange: (event) => setDpi(Number(event.target.value)),
          },
          h('option', { value: '160' }, t('qualityStandard')),
          h('option', { value: '200' }, t('qualityHigh')),
          h('option', { value: '240' }, t('qualityMax')))),
        h('div', { className: 'lit-pdf-scroll', 'data-lit-scroll': 'true', ref: hostRef },
          h('div', { className: 'lit-pdf-pages' },
            Array.from({ length: pageCount }, (_, index) => h(PageImage, {
              key: `${paper.id}-${index + 1}-${dpi}`,
              paper,
              pageNumber: index + 1,
              width: pageWidth,
              dpi,
              onSelectText,
            })))))
    }

    /** Cached extracted text with incremental loading. */
    function TextPane({ paper }) {
      const [text, setText] = useState('')
      const [total, setTotal] = useState(0)
      const [cursor, setCursor] = useState(0)
      const [status, setStatus] = useState('loading')
      const [error, setError] = useState('')

      const load = useCallback(async (offset) => {
        setStatus('loading')
        try {
          const value = await call('text', { id: paper.id, offset, length: 8000 }, { timeoutMs: 60_000 })
          setText((current) => (offset === 0 ? value.text : `${current}\n\n${value.text}`))
          setTotal(value.total)
          setCursor(offset + value.text.length)
          setStatus('ready')
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          setStatus('error')
        }
      }, [paper.id])

      useEffect(() => { void load(0) }, [load])

      const extract = useCallback(async () => {
        setStatus('loading')
        try {
          const value = await call('extract', { id: paper.id }, { timeoutMs: 180_000 })
          upsertPaper(value.paper)
          await load(0)
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          setStatus('error')
        }
      }, [paper.id, load])

      if (paper.hasPdf !== true) {
        return h('div', { className: 'lit-pane' }, h(MissingPdf, { paper }))
      }

      if (status === 'error') {
        return h('div', { className: 'lit-pane' },
          h('div', { className: 'lit-placeholder' },
            h('strong', null, t('textFailed')),
            h('p', null, error),
            h('div', { className: 'lit-placeholder-actions' },
              h(ActionButton, { onClick: () => void extract() }, t('extractText')),
              h(ActionButton, { onClick: () => void load(0) }, t('retry')))))
      }

      return h('div', { className: 'lit-pane lit-pane-text' },
        h('div', { className: 'lit-text-meta' }, `${Math.min(cursor, total)} / ${total}`, cursor < total
          ? h(ActionButton, { onClick: () => void load(cursor), disabled: status === 'loading' }, t('loadMore'))
          : null),
        status === 'loading' && text === ''
          ? h('div', { className: 'lit-placeholder' }, t('loading'))
          : h('pre', { className: 'lit-text' }, text))
    }

    /** Empty state for a paper without a stored PDF, with a real upload control. */
    function MissingPdf({ paper }) {
      const fileRef = useRef(null)
      const [busy, setBusy] = useState(false)
      const upload = useCallback(async (file) => {
        setBusy(true)
        try {
          await uploadPaper(file, false)
          if (store.paperId === paper.id) void reloadLibrary(true)
        } finally {
          setBusy(false)
          if (fileRef.current !== null) fileRef.current.value = ''
        }
      }, [paper.id])
      return h('div', { className: 'lit-placeholder' },
        h(Icon, { name: 'book', size: 22 }),
        h('strong', null, t('noPdf')),
        h('p', null, t('noPdfHint')),
        h('div', { className: 'lit-placeholder-actions' },
          h(ActionButton, { tone: 'primary', disabled: busy, onClick: () => fileRef.current?.click() }, busy ? t('uploading') : t('uploadPdf')),
          h('input', {
            ref: fileRef,
            type: 'file',
            accept: 'application/pdf,.pdf',
            style: { display: 'none' },
            onChange: (event) => void upload(event.target.files?.[0]),
          })))
    }

    /** Cached AI results and drafts so switching tabs and papers keeps them. */
    const aiCache = new Map()

    /**
     * Read one cached AI entry.
     * @param key - cache key.
     * @returns the cached value or undefined.
     */
    function aiCached(key) {
      return aiCache.get(key)
    }

    /**
     * Merge into one cached AI entry and repaint.
     * @param key - cache key.
     * @param patch - partial entry.
     */
    function aiStore(key, patch) {
      aiCache.set(key, { ...(aiCache.get(key) ?? {}), ...patch })
      emit()
    }

    /** Translation tab. */
    function TranslatePane({ paper }) {
      const key = `translate:${paper.id}`
      const cached = aiCached(key) ?? {}
      const state = useStore()
      const draft = cached.draft ?? ''
      const target = cached.target ?? 'zh'
      const { available, model, reason } = state.ai

      const run = useCallback(async () => {
        aiStore(key, { status: 'loading', error: '' })
        try {
          const value = await call('translate', {
            id: paper.id,
            text: (aiCached(key)?.draft ?? '').trim(),
            target: aiCached(key)?.target ?? 'zh',
          }, { timeoutMs: 240_000 })
          aiStore(key, { status: 'ready', result: value.text })
        } catch (failure) {
          aiStore(key, { status: 'error', error: failure instanceof Error ? failure.message : String(failure) })
        }
      }, [key, paper.id])

      useEffect(() => {
        if (cached.autoRun !== true) return
        aiStore(key, { autoRun: false })
        void run()
      }, [cached.autoRun, run, key])

      if (!available) return h(AiUnavailable, { reason })

      return h('div', { className: 'lit-pane' },
        h('div', { className: 'lit-ai-toolbar' },
          h(ActionButton, { tone: 'primary', onClick: () => void run(), disabled: cached.status === 'loading' }, cached.status === 'loading' ? t('translating') : t('translate')),
          h(ActionButton, { tone: target === 'zh' ? 'selected' : 'quiet', onClick: () => aiStore(key, { target: 'zh' }) }, t('translateTargetZh')),
          h(ActionButton, { tone: target === 'en' ? 'selected' : 'quiet', onClick: () => aiStore(key, { target: 'en' }) }, t('translateTargetEn')),
          h('span', { className: 'lit-ai-model' }, model === '' ? '' : t('modelLabel', { model }))),
        h('p', { className: 'lit-hint' }, t('translateHint')),
        h('textarea', {
          className: 'lit-textarea',
          rows: 4,
          value: draft,
          placeholder: t('translatePlaceholder'),
          onChange: (event) => aiStore(key, { draft: event.target.value }),
        }),
        h(AiOutput, { state: cached, empty: t('emptyAi') }))
    }

    /** Summary tab. */
    function SummarizePane({ paper }) {
      const key = `summarize:${paper.id}`
      const cached = aiCached(key) ?? {}
      const state = useStore()
      const { available, model, reason } = state.ai

      const run = useCallback(async (detail) => {
        aiStore(key, { status: 'loading', error: '', detail })
        try {
          const value = await call('summarize', { id: paper.id, detail }, { timeoutMs: 240_000 })
          aiStore(key, { status: 'ready', result: value.text, detail })
        } catch (failure) {
          aiStore(key, { status: 'error', error: failure instanceof Error ? failure.message : String(failure) })
        }
      }, [key, paper.id])

      if (!available) return h(AiUnavailable, { reason })

      return h('div', { className: 'lit-pane' },
        h('div', { className: 'lit-ai-toolbar' },
          h(ActionButton, {
            tone: 'primary',
            disabled: cached.status === 'loading',
            onClick: () => void run('structured'),
          }, cached.status === 'loading' ? t('summarizing') : t('summaryStructured')),
          h(ActionButton, { disabled: cached.status === 'loading', onClick: () => void run('brief') }, t('summaryBrief')),
          h('span', { className: 'lit-ai-model' }, model === '' ? '' : t('modelLabel', { model }))),
        h('p', { className: 'lit-hint' }, citationOf(paper)),
        h(AiOutput, { state: cached, empty: t('emptyAi') }))
    }

    /** Grounded Q&A tab. */
    function AskPane({ paper }) {
      const key = `ask:${paper.id}`
      const cached = aiCached(key) ?? {}
      const state = useStore()
      const question = cached.question ?? ''
      const chatRef = useRef(null)
      const history = cached.history ?? []
      const pending = cached.pending === true
      const { available, model, reason } = state.ai

      useEffect(() => {
        const element = chatRef.current
        if (element !== null) element.scrollTop = element.scrollHeight
      }, [history.length, pending])

      const send = useCallback(async () => {
        const asked = (aiCached(key)?.question ?? '').trim()
        if (asked === '' || aiCached(key)?.pending === true) return
        const nextHistory = [...(aiCached(key)?.history ?? []), { role: 'user', content: asked }]
        aiStore(key, { history: nextHistory, pending: true, error: '', question: '' })
        try {
          const value = await call('ask', { id: paper.id, question: asked, history: nextHistory.slice(-7, -1) }, { timeoutMs: 240_000 })
          const current = aiCached(key)?.history ?? nextHistory
          aiStore(key, { history: [...current.filter((turn) => turn.failed !== true), { role: 'assistant', content: value.answer }], pending: false })
        } catch (failure) {
          aiStore(key, { history: [...nextHistory.slice(0, -1), { role: 'user', content: asked, failed: true }], error: failure instanceof Error ? failure.message : String(failure), pending: false })
        }
      }, [key, paper.id])

      useEffect(() => {
        if (cached.autoSend !== true) return
        aiStore(key, { autoSend: false })
        void send()
      }, [cached.autoSend, send, key])

      if (!available) return h(AiUnavailable, { reason })

      return h('div', { className: 'lit-pane lit-pane-ask' },
        h('div', { className: 'lit-ai-toolbar' },
          h('span', { className: 'lit-hint' }, t('askHint')),
          h('span', { className: 'lit-ai-model' }, model === '' ? '' : t('modelLabel', { model }))),
        h('div', { className: 'lit-chat', ref: chatRef, 'aria-live': 'polite' },
          history.length === 0 ? h('div', { className: 'lit-placeholder' }, t('askEmpty')) : null,
          history.map((turn, index) => h('div', {
            key: `${index}-${turn.role}`,
            className: `lit-turn lit-turn-${turn.role}`,
          }, h('div', { className: `lit-turn-body${turn.failed === true ? ' is-failed' : ''}` }, turn.content))),
          pending ? h('div', { className: 'lit-turn lit-turn-assistant' }, h('div', { className: 'lit-turn-body' }, t('thinking'))) : null,
          cached.error ? h('div', { className: 'lit-inline-error' }, cached.error) : null),
        h('div', { className: 'lit-ask-input' },
          h('textarea', {
            className: 'lit-textarea lit-textarea-ask',
            rows: 2,
            value: question,
            placeholder: t('askPlaceholder'),
            onChange: (event) => aiStore(key, { question: event.target.value }),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !isImeComposing(event)) void send()
            },
          }),
          h(ActionButton, { tone: 'primary', onClick: () => void send(), disabled: pending || question.trim() === '' }, t('send'))))
    }

    /** Shared "no model configured" note, including the Host's reason. */
    function AiUnavailable({ reason }) {
      return h('div', { className: 'lit-placeholder lit-placeholder-error' },
        h(Icon, { name: 'spark', size: 22 }),
        h('p', null, reason === undefined || reason === '' ? t('aiUnavailable') : `${t('aiUnavailable')}（${reason}）`))
    }

    /** Render one AI result body with copy support. */
    function AiOutput({ state, empty }) {
      const [copied, setCopied] = useState(false)
      const timerRef = useRef(null)
      useEffect(() => () => { if (timerRef.current !== null) clearTimeout(timerRef.current) }, [])
      if (state.status === 'error') return h('div', { className: 'lit-inline-error' }, state.error)
      if (state.status === 'loading') return h('div', { className: 'lit-placeholder' }, t('loading'))
      if (state.result === undefined || state.result === '') return h('div', { className: 'lit-placeholder' }, empty)
      return h('div', { className: 'lit-ai-output' },
        h('div', { className: 'lit-ai-output-head' },
          h(ActionButton, {
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(state.result)
                setCopied(true)
                timerRef.current = setTimeout(() => setCopied(false), 1500)
              } catch {
                setCopied(false)
              }
            },
          }, copied ? t('copied') : t('copy'))),
        h('div', { className: 'lit-ai-output-body' }, state.result))
    }

    /**
     * One-line citation for a paper.
     * @param paper - wire record.
     * @returns the line.
     */
    function citationOf(paper) {
      const authors = paper.authors.length === 0 ? '' : `${paper.authors.slice(0, 4).join(', ')}${paper.authors.length > 4 ? t('etal') : ''}`
      return [authors, paper.year === null ? '' : String(paper.year), paper.venue].filter(Boolean).join(' · ')
    }

    /** Status selector, tags, notes, rename, and delete controls for one paper. */
    function PaperMeta({ paper }) {
      const [notes, setNotes] = useState(paper.notes ?? '')
      const [tagDraft, setTagDraft] = useState('')
      const [saving, setSaving] = useState(false)
      const [confirming, setConfirming] = useState(false)
      const dirtyRef = useRef(false)

      useEffect(() => {
        setNotes(paper.notes ?? '')
        dirtyRef.current = false
      }, [paper.id, paper.notes])

      useEffect(() => {
        if (!dirtyRef.current) return undefined
        const timer = setTimeout(async () => {
          dirtyRef.current = false
          try {
            const value = await call('update', { id: paper.id, patch: { notes } }, { timeoutMs: 30_000 })
            upsertPaper(value.paper)
          } catch (failure) {
            setState({ error: failure instanceof Error ? failure.message : String(failure) })
          }
        }, 1200)
        return () => clearTimeout(timer)
      }, [notes, paper.id])

      const update = useCallback(async (patch) => {
        setSaving(true)
        try {
          const value = await call('update', { id: paper.id, patch }, { timeoutMs: 30_000 })
          upsertPaper(value.paper)
        } catch (failure) {
          setState({ error: failure instanceof Error ? failure.message : String(failure) })
        } finally {
          setSaving(false)
        }
      }, [paper.id])

      const remove = useCallback(async () => {
        try {
          await call('remove', { id: paper.id }, { timeoutMs: 30_000 })
          dropPaper(paper.id)
          aiCache.delete(`translate:${paper.id}`)
          aiCache.delete(`summarize:${paper.id}`)
          aiCache.delete(`ask:${paper.id}`)
        } catch (failure) {
          setState({ error: `${t('deleteFailed')}：${failure instanceof Error ? failure.message : String(failure)}` })
        }
      }, [paper.id])

      return h('div', { className: 'lit-meta' },
        h('div', { className: 'lit-meta-row' },
          h('span', { className: 'lit-meta-label' }, t('status')),
          ...[['unread', t('statusUnread')], ['reading', t('statusReading')], ['read', t('statusRead')]].map(([key, label]) => h('button', {
            key,
            type: 'button',
            className: `lit-chip${paper.status === key ? ' is-active' : ''}`,
            'aria-pressed': paper.status === key,
            onClick: () => void update({ status: key }),
          }, label)),
          h('span', { style: { flex: 1 } }),
          h(ActionButton, {
            tone: paper.starred ? 'selected' : 'quiet',
            title: t('starredOnly'),
            onClick: () => void update({ starred: !paper.starred }),
          }, h(Icon, { name: 'star', size: 14 })),
          h(ActionButton, {
            title: t('rename'),
            onClick: () => {
              const next = window.prompt(t('renameTitle'), paper.title)
              if (typeof next === 'string' && next.trim() !== '' && next.trim() !== paper.title) void update({ title: next.trim() })
            },
          }, 'Aa'),
          confirming
            ? h('span', { className: 'lit-confirm' },
              h(ActionButton, { tone: 'danger', onClick: () => void remove() }, t('removeConfirm')),
              h(ActionButton, { onClick: () => setConfirming(false) }, t('removeCancel')))
            : h(ActionButton, { title: t('remove'), onClick: () => setConfirming(true) }, h(Icon, { name: 'trash', size: 14 }))),
        saving ? h('span', { className: 'lit-hint' }, t('saving')) : null,
        h('div', { className: 'lit-meta-row' },
          h('span', { className: 'lit-meta-label', title: t('tagsHint') }, t('tags')),
          ...paper.tags.map((tag) => h('button', {
            key: tag,
            type: 'button',
            className: 'lit-pill lit-pill-button',
            title: t('tagsHint'),
            onClick: () => void update({ tags: paper.tags.filter((entry) => entry !== tag) }),
          }, `${tag} ×`)),
          h('input', {
            className: 'lit-input lit-input-tag',
            value: tagDraft,
            placeholder: '+',
            onChange: (event) => setTagDraft(event.target.value),
            onKeyDown: (event) => {
              if (event.key !== 'Enter' || isImeComposing(event)) return
              const tag = tagDraft.trim()
              if (tag === '') return
              setTagDraft('')
              if (!paper.tags.includes(tag)) void update({ tags: [...paper.tags, tag] })
            },
          })),
        h('details', { className: 'lit-notes' },
          h('summary', null, t('notes')),
          h('textarea', {
            className: 'lit-textarea',
            rows: 4,
            value: notes,
            placeholder: t('notesPlaceholder'),
            onChange: (event) => {
              setNotes(event.target.value)
              dirtyRef.current = true
            },
          })))
    }

    /** Detail pane: metadata header, split reader, and the side assistant. */
    function PaperDetail({ paper }) {
      const [tab, setTab] = useState('translate')
      const [selection, setSelection] = useState(null)
      useEffect(() => {
        setTab('translate')
        setSelection(null)
      }, [paper.id])

      const translateKey = `translate:${paper.id}`
      const askKey = `ask:${paper.id}`

      const onSelectText = useCallback((text, pageNumber, event) => {
        setSelection({ text, page: pageNumber, x: event.clientX, y: event.clientY })
      }, [])

      const translateSelection = useCallback(() => {
        if (selection === null) return
        aiStore(translateKey, { draft: selection.text, autoRun: true })
        setTab('translate')
        setSelection(null)
      }, [selection, translateKey])

      const askSelection = useCallback(() => {
        if (selection === null) return
        aiStore(askKey, { question: `请解释这段内容并说明它在文中的含义：\n"""${selection.text}"""`, autoSend: true })
        setTab('ask')
        setSelection(null)
      }, [selection, askKey])

      const copySelection = useCallback(async () => {
        if (selection === null) return
        try {
          await navigator.clipboard.writeText(selection.text)
        } catch {
          // Clipboard rejection leaves the selection in place.
        }
        setSelection(null)
      }, [selection])

      const tabs = [
        ['text', t('text')],
        ['translate', t('translate')],
        ['summarize', t('summarize')],
        ['ask', t('ask')],
      ]
      const panes = [
        ['text', () => h(TextPane, { paper })],
        ['translate', () => h(TranslatePane, { paper })],
        ['summarize', () => h(SummarizePane, { paper })],
        ['ask', () => h(AskPane, { paper })],
      ]
      return h('div', { className: 'lit-detail' },
        h('div', { className: 'lit-detail-head' },
          h('h2', { className: 'lit-title' }, paper.starred ? '★ ' : '', paper.title),
          h('p', { className: 'lit-cite' }, citationOf(paper)),
          paper.abstract === '' ? null : h('details', { className: 'lit-abstract-box' },
            h('summary', null, t('abstract')),
            h('p', { className: 'lit-abstract' }, paper.abstract)),
          h(PaperMeta, { paper })),
        h('div', { className: 'lit-reader' },
          h('div', { className: 'lit-reader-main' },
            paper.hasPdf ? h(PdfPane, { paper, onSelectText }) : h('div', { className: 'lit-pane' }, h(MissingPdf, { paper }))),
          h('div', { className: 'lit-reader-side' },
            h('div', { className: 'lit-tabs', role: 'tablist' },
              ...tabs.map(([key, label]) => h('button', {
                key,
                type: 'button',
                role: 'tab',
                'aria-selected': tab === key,
                className: `lit-tab${tab === key ? ' is-active' : ''}`,
                onClick: () => setTab(key),
              }, label))),
            h('div', { className: 'lit-tab-body' },
              ...panes.map(([key, render]) => h('div', {
                key,
                className: 'lit-tab-pane',
                hidden: tab !== key,
              }, render()))))),
        selection === null ? null : h('div', {
          className: 'lit-selbar',
          style: { left: `${selection.x}px`, top: `${Math.max(12, selection.y - 52)}px` },
        },
        h(ActionButton, { tone: 'primary', onClick: translateSelection }, t('translate')),
        h(ActionButton, { onClick: askSelection }, t('ask')),
        h(ActionButton, { onClick: () => void copySelection() }, t('copy')),
        h(ActionButton, { title: t('close'), onClick: () => setSelection(null) }, h(Icon, { name: 'close', size: 12 }))))
    }

    /** Discovery pane: metadata search and one-click add. */
    function DiscoverPane({ onOpen }) {
      const [query, setQuery] = useState('')
      const [source, setSource] = useState('arxiv')
      const [status, setStatus] = useState('idle')
      const [results, setResults] = useState([])
      const [failures, setFailures] = useState([])
      const [error, setError] = useState('')
      const [busyKey, setBusyKey] = useState('')
      const [reference, setReference] = useState('')
      const [addedKeys, setAddedKeys] = useState(() => new Set())
      const state = useStore()

      const libraryKeys = useMemo(() => {
        const keys = new Set()
        for (const paper of state.papers) {
          if (paper.arxivId !== '') keys.add(`arxiv:${paper.arxivId.replace(/v\d+$/i, '')}`)
          if (paper.doi !== '') keys.add(`doi:${paper.doi.toLowerCase()}`)
        }
        return keys
      }, [state.papers])

      /**
       * Whether one discovery result is already stored.
       * @param result - search result.
       * @returns true when the library holds it.
       */
      function stored(result) {
        if (addedKeys.has(result.key)) return true
        if (result.arxivId !== '') return libraryKeys.has(`arxiv:${result.arxivId.replace(/v\d+$/i, '')}`)
        if (result.doi !== '') return libraryKeys.has(`doi:${result.doi.toLowerCase()}`)
        return libraryKeys.has(result.key)
      }

      const search = useCallback(async () => {
        const text = query.trim()
        if (text === '') return
        setStatus('loading')
        setError('')
        try {
          const value = await call('search', { query: text, source, limit: 8 }, { timeoutMs: 60_000 })
          setResults(value.results)
          setFailures(value.failures ?? [])
          setStatus('ready')
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          setStatus('error')
        }
      }, [query, source])

      const add = useCallback(async (candidate) => {
        setBusyKey(candidate.key)
        try {
          const value = await call('add', { candidate }, { timeoutMs: 220_000 })
          upsertPaper(value.paper)
          setAddedKeys((current) => new Set(current).add(candidate.key))
          if ((value.warnings ?? []).length > 0) pushNotice(value.warnings.join('；'))
          else pushNotice(t('noticeAdded'))
          void reloadLibrary(true)
        } catch (failure) {
          setState({ error: `${t('addFailed')}：${failure instanceof Error ? failure.message : String(failure)}` })
        } finally {
          setBusyKey('')
        }
      }, [])

      const addReference = useCallback(async () => {
        const text = reference.trim()
        if (text === '') return
        setBusyKey('reference')
        try {
          const value = await call('add', { reference: text }, { timeoutMs: 220_000 })
          upsertPaper(value.paper)
          setReference('')
          if ((value.warnings ?? []).length > 0) pushNotice(value.warnings.join('；'))
          else pushNotice(t('noticeAdded'))
          void reloadLibrary(true)
        } catch (failure) {
          setState({ error: `${t('addFailed')}：${failure instanceof Error ? failure.message : String(failure)}` })
        } finally {
          setBusyKey('')
        }
      }, [reference])

      /** Find the stored paper matching one result, when there is one. */
      function storedPaper(result) {
        return state.papers.find((entry) => {
          if (result.arxivId !== '' && entry.arxivId !== '') return entry.arxivId.replace(/v\d+$/i, '') === result.arxivId.replace(/v\d+$/i, '')
          if (result.doi !== '' && entry.doi !== '') return entry.doi.toLowerCase() === result.doi.toLowerCase()
          return false
        })
      }

      return h('div', { className: 'lit-discover' },
        h('div', { className: 'lit-discover-head' },
          h('h2', { className: 'lit-discover-title' }, t('discoverTitle')),
          h('p', { className: 'lit-hint' }, t('discoverHint'))),
        h('div', { className: 'lit-search-row' },
          h('input', {
            className: 'lit-input lit-input-search lit-input-lg',
            value: query,
            placeholder: t('searchPlaceholder'),
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter' && !isImeComposing(event)) void search() },
          }),
          h('select', {
            className: 'lit-select',
            value: source,
            onChange: (event) => setSource(event.target.value),
          },
          h('option', { value: 'arxiv' }, t('sourceArxiv')),
          h('option', { value: 'crossref' }, t('sourceCrossref')),
          h('option', { value: 'all' }, t('sourceAll'))),
          h(ActionButton, { tone: 'primary', onClick: () => void search(), disabled: status === 'loading' }, status === 'loading' ? t('searching') : t('search'))),
        h('div', { className: 'lit-reference-row' },
          h('span', { className: 'lit-meta-label' }, t('addByReference')),
          h('input', {
            className: 'lit-input',
            value: reference,
            placeholder: t('referencePlaceholder'),
            onChange: (event) => setReference(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter' && !isImeComposing(event)) void addReference() },
          }),
          h(ActionButton, { onClick: () => void addReference(), disabled: busyKey === 'reference' }, busyKey === 'reference' ? t('adding') : t('add'))),
        error === '' ? null : h('div', { className: 'lit-inline-error' }, error),
        ...failures.map((failure) => h('div', { key: failure.source, className: 'lit-inline-warn' }, `${failure.source}: ${failure.message}`)),
        status === 'idle' ? null : h('div', { className: 'lit-results' },
          results.length === 0 && status === 'ready' ? h('div', { className: 'lit-placeholder' }, t('noResults')) : null,
          results.map((result) => {
            const inLibrary = stored(result)
            return h('article', { key: result.key, className: 'lit-result' },
              h('div', { className: 'lit-result-main' },
                h('h3', { className: 'lit-result-title' }, result.title),
                h('p', { className: 'lit-result-meta' }, [result.authors.slice(0, 4).join(', '), result.year === null ? '' : String(result.year), result.venue, result.arxivId === '' ? '' : `arXiv:${result.arxivId}`].filter(Boolean).join(' · ')),
                result.abstract === '' ? null : h('p', { className: 'lit-result-abstract' }, result.abstract.slice(0, 320))),
              h('div', { className: 'lit-result-actions' },
                inLibrary
                  ? h(ActionButton, {
                    onClick: () => {
                      const paper = storedPaper(result)
                      if (paper !== undefined) onOpen(paper.id)
                    },
                  }, t('openPaper'))
                  : h(ActionButton, {
                    tone: 'primary',
                    disabled: busyKey === result.key,
                    onClick: () => void add(result),
                  }, busyKey === result.key ? t('adding') : t('addToLibrary'))))
          })))
    }

    /** The frame-wide workspace overlay. */
    function Workspace() {
      const state = useStore()
      const panelRef = useRef(null)

      useEffect(() => {
        if (!state.open) return undefined
        panelRef.current?.focus()
        const onKey = (event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          closeWorkspace()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [state.open])

      if (!state.open) return null
      const paper = state.papers.find((entry) => entry.id === state.paperId)

      return h('div', {
        className: 'lit-root',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('title'),
        onClick: (event) => { if (event.target === event.currentTarget) closeWorkspace() },
      },
      h('div', { className: 'lit-panel', ref: panelRef, tabIndex: -1 },
        h('header', { className: 'lit-header' },
          h('span', { className: 'lit-brand' }, h(Icon, { name: 'library', size: 18 }), h('span', null, t('title'))),
          h('div', { className: 'lit-mode-switch' },
            h(Segment, { active: state.mode === 'library', onClick: () => setState({ mode: 'library' }) }, t('tabLibrary')),
            h(Segment, { active: state.mode === 'discover', onClick: () => setState({ mode: 'discover' }) }, t('tabDiscover'))),
          h('span', { className: 'lit-header-stat' }, state.summary === null
            ? ''
            : `${state.summary.total} · ${t('statusUnread')} ${state.summary.byStatus?.unread ?? 0} · ${t('statusReading')} ${state.summary.byStatus?.reading ?? 0}`),
          h('span', { style: { flex: 1 } }),
          state.ai?.available === false ? h('span', { className: 'lit-warn', title: state.ai.reason }, t('aiUnavailable')) : null,
          h(ActionButton, { title: t('refresh'), onClick: () => void reloadLibrary() }, '↻'),
          h(ActionButton, { title: t('close'), onClick: closeWorkspace }, h(Icon, { name: 'close', size: 16 }))),
        state.error === '' ? null : h('div', { className: 'lit-banner' },
          h('span', null, state.error),
          h(ActionButton, { tone: 'quiet', onClick: () => setState({ error: '' }) }, t('dismiss'))),
        state.notice === '' ? null : h('div', { className: 'lit-banner lit-banner-notice' },
          h('span', null, state.notice),
          h(ActionButton, { tone: 'quiet', onClick: () => setState({ notice: '' }) }, t('dismiss'))),
        state.mode === 'library'
          ? h('div', { className: 'lit-body' },
            h(LibraryColumn, { onPick: (id) => setState({ paperId: id }) }),
            h('div', { className: 'lit-main' },
              paper === undefined
                ? h('div', { className: 'lit-placeholder lit-placeholder-large' },
                  h(Icon, { name: state.papers.length === 0 ? 'book' : 'chevron', size: 28 }),
                  h('strong', null, state.papers.length === 0 ? t('emptyLibrary') : t('selectPaper')),
                  h('p', null, state.papers.length === 0 ? t('emptyLibraryHint') : t('selectPaperHint')),
                  state.papers.length === 0 ? h(ActionButton, { tone: 'primary', onClick: () => setState({ mode: 'discover' }) }, t('goDiscover')) : null)
                : h(PaperDetail, { paper })))
          : h('div', { className: 'lit-main lit-main-discover' },
            h(DiscoverPane, { onOpen: (id) => setState({ paperId: id, mode: 'library' }) }))))
    }

    /** Stylesheet installed once with the Client run. */
    const CSS = `
.lit-launcher{display:flex;align-items:center;gap:8px;width:100%;height:34px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;text-align:left}
.lit-launcher:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lit-launcher-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lit-root{position:fixed;inset:var(--dsh-frame-chrome-top,0px) 0 0;display:flex;align-items:center;justify-content:center;padding:max(24px,var(--dsh-frame-overlay-top,24px)) 24px;box-sizing:border-box;background:color-mix(in srgb,var(--dsw-alias-bg-base) 62%,transparent);backdrop-filter:blur(3px);pointer-events:auto;z-index:40;font-size:13px;color:var(--dsw-alias-label-primary)}
.lit-panel{display:flex;flex-direction:column;width:min(1440px,100%);height:min(880px,100%);overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 18px 60px rgb(0 0 0/.28);outline:none}
.lit-header{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);flex-wrap:wrap}
.lit-brand{display:flex;align-items:center;gap:8px;font-weight:600}
.lit-mode-switch{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-base)}
.lit-segment{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;padding:4px 12px;border-radius:6px;cursor:pointer}
.lit-segment.is-active{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgb(0 0 0/.12)}
.lit-header-stat{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;font-size:12px}
.lit-warn{color:var(--dsw-alias-state-warn-primary);font-size:12px}
.lit-banner{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:8px 14px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);border-bottom:1px solid var(--dsw-alias-border-l1)}
.lit-banner-notice{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);color:var(--dsw-alias-label-primary)}
.lit-body{display:flex;min-height:0;flex:1}
.lit-column{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.lit-column-library{width:300px;flex:none}
.lit-column-head{display:flex;flex-direction:column;gap:8px;padding:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.lit-search{position:relative;display:flex;align-items:center}
.lit-search-icon{position:absolute;left:9px;color:var(--dsw-alias-label-secondary);pointer-events:none}
.lit-input{width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}
.lit-input:focus{border-color:var(--dsw-alias-brand-primary)}
.lit-input-search{padding-left:28px}
.lit-input-lg{padding:9px 12px}
.lit-input-tag{width:70px;padding:3px 6px;font-size:12px}
.lit-select{padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.lit-select-sm{padding:3px 6px;font-size:12px}
.lit-filter-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.lit-chip{padding:2px 9px;border:1px solid transparent;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.lit-chip.is-active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.lit-chip-action{display:flex;align-items:center;gap:4px;margin-left:auto}
.lit-list{flex:1;min-height:0;overflow:auto;padding:6px}
.lit-row{display:flex;gap:9px;width:100%;padding:9px 10px;border:1px solid transparent;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.lit-row:hover{background:var(--dsw-alias-bg-layer-2)}
.lit-row.is-active{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.lit-dot{width:7px;height:7px;margin-top:6px;border-radius:50%;flex:none;background:var(--dsw-alias-state-idle-primary)}
.lit-dot-reading{background:var(--dsw-alias-state-warn-primary)}
.lit-dot-read{background:var(--dsw-alias-state-success-primary)}
.lit-row-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.lit-row-title{font-weight:550;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lit-row-meta{color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lit-row-tags{display:flex;gap:4px;flex-wrap:wrap}
.lit-pill{padding:0 7px;border-radius:999px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;border:1px solid var(--dsw-alias-border-l1)}
.lit-pill-button{cursor:pointer;font:inherit;font-size:11px}
.lit-pill-button:hover{color:var(--dsw-alias-state-error-primary)}
.lit-main{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column}
.lit-main-discover{overflow:auto;padding:16px 20px}
.lit-empty{padding:18px 12px;color:var(--dsw-alias-label-secondary)}
.lit-empty strong{display:block;margin-bottom:6px;color:var(--dsw-alias-label-primary)}
.lit-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px;color:var(--dsw-alias-label-secondary);text-align:center}
.lit-placeholder strong{color:var(--dsw-alias-label-primary);font-size:14px}
.lit-placeholder-large{flex:1}
.lit-placeholder-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.lit-placeholder-error{color:var(--dsw-alias-state-error-primary)}
.lit-detail{display:flex;flex-direction:column;min-height:0;flex:1}
.lit-detail-head{display:flex;flex-direction:column;gap:6px;padding:14px 18px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.lit-title{margin:0;font-size:17px;line-height:1.35}
.lit-cite{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.lit-abstract-box summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px}
.lit-abstract{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;max-height:120px;overflow:auto}
.lit-meta{display:flex;flex-direction:column;gap:6px;margin-top:4px}
.lit-meta-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.lit-meta-label{color:var(--dsw-alias-label-secondary);font-size:12px;margin-right:2px}
.lit-confirm{display:inline-flex;align-items:center;gap:6px}
.lit-notes summary{cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px}
.lit-tabs{display:flex;gap:2px;padding:6px 14px 0;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.lit-tab{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;padding:7px 12px;cursor:pointer}
.lit-tab.is-active{border-bottom-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.lit-tab-body{display:flex;flex:1;min-height:0}
.lit-tab-pane{display:flex;flex-direction:column;flex:1;min-height:0}
.lit-tab-pane[hidden]{display:none}
.lit-reader{display:flex;flex:1;min-height:0}
.lit-reader-main{display:flex;flex:1;min-width:0;min-height:0;flex-direction:column;border-right:1px solid var(--dsw-alias-border-l1)}
.lit-reader-side{display:flex;width:380px;flex:none;min-height:0;flex-direction:column;background:var(--dsw-alias-bg-layer-1)}
.lit-selbar{position:fixed;z-index:60;display:flex;align-items:center;gap:4px;padding:5px 6px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 8px 24px rgb(0 0 0/.24);transform:translateX(-50%)}
.lit-text-layer{position:absolute;inset:0;overflow:hidden;cursor:text}
.lit-text-item{position:absolute;color:transparent;white-space:pre;line-height:1;transform-origin:0 0;cursor:text;user-select:text}
.lit-text-layer ::selection{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 38%,transparent);color:transparent}
.lit-pane{display:flex;flex-direction:column;flex:1;min-height:0;padding:12px 16px;gap:10px;overflow:auto}
.lit-pane-pdf{padding:0}
.lit-pane-ask{padding-bottom:10px}
.lit-pane-text .lit-text{margin:0;flex:1;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.65;color:var(--dsw-alias-label-primary)}
.lit-text-meta{display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-secondary);font-size:12px}
.lit-pdf-toolbar{display:flex;align-items:center;gap:6px;padding:7px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.lit-pdf-zoom,.lit-pdf-count{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.lit-select-hint{font-size:11px}
.lit-pdf-scroll{flex:1;min-height:0;overflow:auto;padding:16px;background:var(--dsw-alias-bg-base)}
.lit-pdf-pages{display:flex;flex-direction:column;align-items:center;gap:14px;min-width:max-content}
.lit-pdf-page{position:relative;border-radius:4px;overflow:hidden;box-shadow:0 2px 10px rgb(0 0 0/.18);background:#fff;flex:none}
.lit-pdf-image{display:block;width:100%;height:auto}
.lit-pdf-page-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px}
.lit-pdf-page-number{position:absolute;right:6px;bottom:6px;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 72%,transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.lit-pdf-page-failed{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;padding:16px;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);font-size:12px;text-align:center}
.lit-pdf-page-failed-detail{color:var(--dsw-alias-label-secondary);font-size:11px;max-width:80%;word-break:break-word}
.lit-ai-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lit-ai-model{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:12px}
.lit-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5}
.lit-textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.55;resize:vertical;outline:none}
.lit-textarea:focus{border-color:var(--dsw-alias-brand-primary)}
.lit-textarea-ask{flex:1}
.lit-ask-input{display:flex;align-items:flex-end;gap:8px}
.lit-ai-output{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2);padding:10px 12px;min-height:0;flex:1;overflow:auto}
.lit-ai-output-head{display:flex;align-items:center;gap:8px}
.lit-ai-output-head .lit-btn{margin-left:auto}
.lit-ai-output-body{white-space:pre-wrap;line-height:1.7;font-size:13px}
.lit-chat{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;overflow:auto;padding:4px 2px}
.lit-turn{display:flex}
.lit-turn-user{justify-content:flex-end}
.lit-turn-body{padding:8px 12px;border-radius:10px;line-height:1.65;font-size:13px;white-space:pre-wrap;max-width:88%}
.lit-turn-user .lit-turn-body{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent);color:var(--dsw-alias-label-primary)}
.lit-turn-assistant .lit-turn-body{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1)}
.lit-turn-body.is-failed{opacity:.65;text-decoration:line-through}
.lit-inline-error{padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px}
.lit-inline-warn{padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent);color:var(--dsw-alias-state-warn-primary);font-size:12px}
.lit-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;line-height:20px}
.lit-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.lit-btn:disabled{opacity:.55;cursor:default}
.lit-btn-primary{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.lit-btn-primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent)}
.lit-btn-danger{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.lit-btn-selected{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}
.lit-btn-quiet{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.lit-btn-quiet:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.lit-discover{display:flex;flex-direction:column;gap:12px}
.lit-discover-head{display:flex;flex-direction:column;gap:4px}
.lit-discover-title{margin:0;font-size:16px}
.lit-search-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lit-reference-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:760px}
.lit-results{display:flex;flex-direction:column;gap:8px}
.lit-result{display:flex;gap:14px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
.lit-result-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.lit-result-title{margin:0;font-size:14px;line-height:1.4}
.lit-result-meta{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.lit-result-abstract{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}
.lit-result-actions{display:flex;align-items:flex-start}
@media (max-width:1100px){.lit-reader-side{width:340px}}
@media (max-width:900px){.lit-column-library{width:260px}.lit-panel{width:100%;height:100%}.lit-root{padding:8px}.lit-reader{flex-direction:column}.lit-reader-main{border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1)}.lit-reader-side{width:auto;height:46%;border-top:0}}
`

    return {
      /** Client services this half reads; Cordis activates it once they exist. */
      inject: ['slots', 'locale'],
      /** Mount the launcher, the workspace, and their resources. */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICT), 'literature-library: dictionaries')
        t = ctx.locale.bind(NS)
        ctx.effect(() => {
          const element = document.createElement('style')
          element.setAttribute('data-literature-library', '')
          element.textContent = CSS
          document.head.appendChild(element)
          return () => element.remove()
        }, 'literature-library: stylesheet')
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'literature-library',
          order: 20,
          label: () => t('launcher'),
        }, FooterAction))
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'literature-library',
          order: 20,
          label: () => t('title'),
        }, Workspace))
        return undefined
      },
    }
  },
})
