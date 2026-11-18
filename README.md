# dsh-literature-library

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that
turns DSH into a paper reader: search arXiv and Crossref, keep a local library,
read the original pages side by side with translation, summaries, and grounded
Q&A — plus matching agent tools so the chat can do the same work.

[![check](https://github.com/zju-yoyo/dsh-literature-library/actions/workflows/check.yml/badge.svg)](https://github.com/zju-yoyo/dsh-literature-library/actions/workflows/check.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![The literature workspace: library column, original page, and AI result](docs/preview.svg)

## Features

- **Find papers** — search arXiv and Crossref metadata, add a result in one
  click, or add by arXiv id/link, DOI, PDF URL, or a local PDF upload.
- **Read the original** — split-pane reader renders each page, with zoom and
  standard/high/max density, cached locally after the first render.
- **Select to translate** — drag-select any text on a page: a small toolbar
  appears with 翻译 (translate), 提问 (ask), and 复制 (copy). Translation starts
  immediately; asking about a passage switches to the Q&A pane.
- **Translate / summarize / ask** — side panel with 文本 (full extracted text),
  翻译, 总结 (structured or brief), and 提问 (answers cite page/section; the
  model is told to say "本文未涉及" rather than invent).
- **Manage the library** — reading status (unread/reading/read), star, tags,
  notes (autosaved), rename, delete, in-library search and filters.
- **Agent tools** — the same operations are exposed to the model, so you can ask
  in chat: `literature_search`, `literature_add`, `literature_list`,
  `literature_read`, `literature_summarize`, `literature_ask`,
  `literature_update`.

## Requirements

- DSH with the Web UI (Desktop app or `dsh web`). The plugin registers a sidebar
  launcher and a frame-wide workspace, and serves its own HTTP routes.
- The profile's document engine (`officeKit`, bundled with DSH) for page
  rendering. Without it the text and AI features still work; only 原文 is
  unavailable.
- A configured default model (or an explicit `provider`/`model` in the plugin
  row) for translation, summaries, and Q&A.
- Network access for arXiv/Crossref search and PDF downloads.

Tested with DSH `0.2.2-rc.3` (Desktop app, Windows) and the `desktop` profile.

## Install

### From the Plugins page (recommended)

1. Open **Settings → Plugins**.
2. Choose **Add plugin** and enter the repository spec:
   - `https://github.com/zju-yoyo/dsh-literature-library`, or
   - `github:zju-yoyo/dsh-literature-library`
3. Enable the `dsh-literature-library` bundle if it is not enabled yet.
4. Open **文献库 / Library** at the sidebar foot.

Git installs are pinned to the resolved commit; use the Plugins page's update
action (or remove and re-add) to move to a newer commit.

### From the CLI (installs the package only)

```bash
dsh plugin --profile <profile> add github:zju-yoyo/dsh-literature-library
```

Then enable the bundle on the **Plugins** page — the CLI forwards to pnpm and
does not change bundle selection.

### Local development checkout

Copy or clone this directory anywhere, then add that absolute directory as a
plugin (local directory installs are linked, not copied):

```bash
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-literature-library
```

## Usage

1. Click **文献库** at the sidebar foot to open the workspace.
2. **查找文献** — type a topic, pick arXiv / Crossref, press 检索. Use
   **加入文献库** on a result, or **按链接 / 编号添加** for a DOI or PDF URL.
3. Pick a paper on the left. The right pane defaults to 翻译; switch between
   **文本 / 翻译 / 总结 / 提问**.
4. Drag-select text on a page to translate or ask about that passage.
5. Under the title, set status, add/remove tags (click a tag to remove), write
   notes, rename, or delete.

Chat tools mirror the UI; for example:

```text
用 literature_search 找一下 "selective state space models" 的最新工作，
把最相关的一篇加入文献库，然后总结它的方法。
```

## Configuration

The bundle inserts one Loader row. Override its `config` in the profile's
`cordis.patch.yml` (Settings → Plugins for bundle selection; this file for
values), then reload the plugin:

```yaml
- id: literature-library
  name: dsh-literature-library
  config:
    language: zh
    maxTextPages: 80
```

| Field | Default | Meaning |
| --- | --- | --- |
| `dataDir` | `<DSH_HOME>/literature` | Library, PDF, text, geometry, and page-image cache |
| `language` | `zh` | Target language for translation and summaries (`zh`/`en`) |
| `provider`, `model` | profile default model | Explicit model route for the AI actions |
| `maxPdfBytes` | `41943040` (40 MB) | Largest accepted PDF |
| `maxTextPages` | `80` | Pages extracted per paper |
| `maxPromptChars` | `60000` | Paper text sent to the model per request |
| `searchMaxResults` | `8` | Results per search source |

The bundle ships no Config schema, so the Plugin Manager row editor shows no
fields; edit the row config directly.

## Data and privacy

- The library, PDFs, extracted text, text-layer geometry, and rendered pages are
  stored in `<DSH_HOME>/literature` (`~/.dsh/literature` by default) — never in
  this repository and never in your workspace.
- Translation, summaries, and Q&A send the paper text or only the selected
  passage to the model selected in DSH. Nothing else leaves the machine.
- Search queries go to `export.arxiv.org` and `api.crossref.org`; PDFs come from
  the paper's public link. Page rendering is local.
- Disabling or removing the plugin removes its UI and tools but keeps the stored
  library on disk; delete the data directory to reclaim the space.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| No 文献库 button in the sidebar | The bundle is installed but not enabled; enable it on the Plugins page, then reload the page once. |
| 原文 pages stay blank or show a render error | The profile has no document engine (`officeKit`), or the engine rejected the page. The failure line under the page carries the reason; retry, or lower the density. |
| First page takes a few seconds | Page images are rendered on demand by the local engine, then cached under `pages/`. Later visits are instant. |
| 翻译/总结/提问 unavailable | No default model is configured. Pick one under Settings → Models, or set `provider`/`model` in the row config. |
| PDF download warning on add | The public PDF link needed a login or the page changed. Upload the PDF locally instead. |
| Search returns nothing for a phrase | arXiv phrase search is exact; try fewer words, or switch the source to Crossref. |

## Development

No build step: the plugin is plain ESM. `index.js` is the Host half, `client.js`
is the browser half, and `lib/` holds the shared operations.

```bash
node scripts/check.mjs   # imports every module, validates manifest/locales/assets
```

`scripts/check.mjs` has no dependencies and runs in CI
([.github/workflows/check.yml](.github/workflows/check.yml)). Host code changes
need a plugin reload (toggle it on the Plugins page); Client changes reach an
open page through DSH client HMR.

Layout:

```text
index.js            Host plugin: routes, tools, config, library wiring
client.js           Browser plugin: launcher, workspace, reader, AI panes
lib/                store, search, pdf text, page rendering, LLM, routes, tools
vendor/pdf/         pdf.js 6.3.289 (Apache-2.0) used for text extraction
locale/             Plugin Manager titles/descriptions (zh, en)
docs/               Detail document and feature illustration
scripts/check.mjs   Dependency-free repository check
```

## Release checklist

This repository is published at
<https://github.com/zju-yoyo/dsh-literature-library>. To cut a release:

```bash
node scripts/check.mjs
npm version minor          # or edit package.json + CHANGELOG.md by hand
git push && git push --tags
```

Forks that publish under another account should update `homepage`,
`repository`, and `bugs` in `package.json`, the CI badge URL above, and the
install specs in this README.

Optional npm release: the package has no runtime dependencies, so `npm publish`
works after choosing a name that is free on npm. Users can then install
`dsh-literature-library@0.2.0` by name instead of by git URL.

## 中文简介

把 DSH 变成文献阅读器：在侧边栏底部打开「文献库」，检索 arXiv / Crossref、
按链接或编号入库、分屏阅读原文；选中原文任意文字即可翻译或提问，右侧提供
文本 / 翻译 / 总结 / 提问；支持阅读状态、标签、笔记与库内搜索，并把这些操作
同时暴露为 Agent 工具。数据保存在 `<DSH_HOME>/literature`。安装：设置 →
插件 → 添加插件，填入本仓库的 GitHub 地址即可。

## License

MIT — see [LICENSE](LICENSE). Vendored pdf.js is Apache-2.0; see
[THIRD-PARTY.md](THIRD-PARTY.md).
