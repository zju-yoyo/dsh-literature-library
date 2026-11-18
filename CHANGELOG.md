# Changelog

## 0.2.0 — first public release

- Literature library with arXiv and Crossref search, one-click add, and
  add-by-identifier / local PDF upload.
- Split-pane reader: original pages on the left, 文本 / 翻译 / 总结 / 提问 on the
  right.
- Selectable text layer over original pages, with a selection toolbar that
  translates the passage, asks about it, or copies it.
- Host-rendered pages with standard / high / max density and a local page cache.
- Page-anchored Q&A that cites sections, refuses to answer outside the paper,
  and keeps multi-turn context.
- Reading status, stars, tags, autosaved notes, rename, delete, and in-library
  search.
- Agent tools over the same library: `literature_search`, `literature_add`,
  `literature_list`, `literature_read`, `literature_summarize`,
  `literature_ask`, `literature_update`.
- Loopback-only browser endpoints under `/api/literature` with the existing
  connection authentication, plus a dependency-free repository check for CI.
