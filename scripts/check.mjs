#!/usr/bin/env node
/**
 * Dependency-free repository check for dsh-literature-library.
 *
 * It imports every runtime module (so a syntax or top-level error fails here),
 * verifies the bundle manifest against the Loader row, and validates the locale
 * and artwork resources the Plugin Manager reads without activating the plugin.
 *
 * Usage: node scripts/check.mjs
 */
import { readFileSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const notes = []

/**
 * Record one failed assertion.
 * @param message - what failed.
 */
function fail(message) {
  failures.push(message)
}

/**
 * Read and parse one JSON file.
 * @param path - absolute path.
 * @returns the parsed value.
 */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Verify the manifest and the Loader patch agree with this repository. */
function checkManifest() {
  const manifest = readJson(join(root, 'package.json'))
  if (manifest.type !== 'module') fail('package.json: "type" must be "module"')
  if (typeof manifest.name !== 'string' || !/^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/.test(manifest.name)) {
    fail('package.json: "name" is not a valid package name')
  }
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') fail('package.json: dsh.bundle.patch must be ./cordis.patch.yml')
  if (manifest.dsh?.client?.platform !== 'web') fail('package.json: dsh.client.platform must be "web"')
  for (const subpath of ['.', './client', './icon']) {
    if (typeof manifest.exports?.[subpath] !== 'string') fail(`package.json: exports["${subpath}"] is missing`)
  }
  if (manifest.exports?.['./locale/*.json'] !== './locale/*.json') fail('package.json: exports["./locale/*.json"] is missing')
  const files = Array.isArray(manifest.files) ? manifest.files : []
  for (const expected of ['index.js', 'client.js', 'lib', 'vendor/pdf', 'cordis.patch.yml', 'locale/*.json', 'docs', 'icon.svg']) {
    if (!files.includes(expected)) fail(`package.json: files[] must include "${expected}"`)
  }
  if (manifest.scripts?.check !== 'node scripts/check.mjs') fail('package.json: scripts.check must run scripts/check.mjs')
  notes.push(`manifest: ${manifest.name}@${manifest.version}`)

  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  const rowName = /name:\s*'([^']+)'/.exec(patch)?.[1] ?? ''
  if (rowName !== manifest.name) fail(`cordis.patch.yml: inserted row name "${rowName}" must equal the package name`)
  if (!/^- insert:/m.test(patch)) fail('cordis.patch.yml: must be a top-level insert list')
  notes.push(`patch row: ${rowName}`)
}

/** Import every runtime module and check the plugin faces it exports. */
async function checkModules() {
  const manifest = readJson(join(root, 'package.json'))

  // The Client half registers itself through the page module loader; capture
  // that registration instead of touching the DOM.
  const registered = []
  globalThis.window = {
    __ModuleLoader__: {
      load(definition) {
        registered.push(definition)
      },
    },
  }
  try {
    const client = await import(pathToFileURL(join(root, 'client.js')).href)
    if (registered.length !== 1) fail(`client.js: must call window.__ModuleLoader__.load exactly once (saw ${registered.length})`)
    const definition = registered[0]
    if (definition?.id !== manifest.name) fail(`client.js: loader id "${String(definition?.id)}" must equal the package name`)
    const reactStub = {
      createElement() {},
      useCallback() {},
      useEffect() {},
      useMemo() {},
      useRef() {},
      useState() {},
      useSyncExternalStore() {},
    }
    const plugin = definition?.factory?.((name) => {
      if (name !== 'react') throw new Error(`client.js: unexpected require("${name}")`)
      return reactStub
    })
    if (typeof plugin?.apply !== 'function') fail('client.js: factory must return an object with apply()')
    const inject = Array.isArray(plugin?.inject) ? plugin.inject : []
    for (const service of ['slots', 'locale']) {
      if (!inject.includes(service)) fail(`client.js: plugin.inject must declare "${service}"`)
    }
    void client
    notes.push('client half: loader registration ok')
  } finally {
    delete globalThis.window
  }

  const host = await import(pathToFileURL(join(root, 'index.js')).href)
  if (typeof host.apply !== 'function') fail('index.js: must export apply()')
  if (!Array.isArray(host.inject) || !host.inject.includes('connection') || !host.inject.includes('tools')) {
    fail('index.js: must inject the connection and tools services')
  }
  notes.push(`host half: apply() + inject ${JSON.stringify(host.inject)}`)

  const libDir = join(root, 'lib')
  for (const name of await readdir(libDir)) {
    if (!name.endsWith('.js')) continue
    await import(pathToFileURL(join(libDir, name)).href)
  }
  notes.push('lib modules: imported')
}

/** Validate the display resources the Plugin Manager renders without activation. */
function checkResources() {
  const icon = join(root, 'icon.svg')
  const iconBytes = statSync(icon).size
  if (iconBytes > 256 * 1024) fail(`icon.svg: ${iconBytes} bytes exceeds the 256 KiB icon limit`)
  const iconText = readFileSync(icon, 'utf8')
  if (/<script|<foreignObject|<text\b|<image\b/i.test(iconText)) fail('icon.svg: must not contain script, foreignObject, text, or image elements')
  if (!/width="36"\s+height="36"/.test(iconText)) fail('icon.svg: expected a 36x36 viewBox artwork')

  const preview = join(root, 'docs', 'preview.svg')
  const previewBytes = statSync(preview).size
  if (previewBytes > 1024 * 1024) fail(`docs/preview.svg: ${previewBytes} bytes exceeds the 1 MiB recommendation`)
  if (/<script|<foreignObject/i.test(readFileSync(preview, 'utf8'))) fail('docs/preview.svg: must not contain script or foreignObject')

  for (const locale of ['en', 'zh']) {
    const dictionary = readJson(join(root, 'locale', `${locale}.json`))
    for (const key of ['title', 'description', 'detail']) {
      if (typeof dictionary.meta?.[key] !== 'string' || dictionary.meta[key] === '') fail(`locale/${locale}.json: meta.${key} is missing`)
    }
    const detail = join(root, dictionary.meta.detail)
    try {
      if (statSync(detail).size === 0) fail(`locale/${locale}.json: meta.detail document is empty`)
    } catch {
      fail(`locale/${locale}.json: meta.detail target "${dictionary.meta.detail}" does not exist`)
    }
  }
  notes.push('display resources: icon, preview, locales ok')

  for (const file of ['pdf.mjs', 'pdf.worker.mjs', 'LICENSE']) {
    try {
      if (statSync(join(root, 'vendor', 'pdf', file)).size === 0) fail(`vendor/pdf/${file}: empty file`)
    } catch {
      fail(`vendor/pdf/${file}: missing (required for text extraction)`)
    }
  }
  notes.push('vendored pdf.js: present')
}

for (const check of [checkManifest, checkModules, checkResources]) {
  try {
    await check()
  } catch (error) {
    fail(`${check.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

for (const note of notes) console.log(`ok  ${note}`)
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exitCode = 1
} else {
  console.log(`\nAll checks passed for ${relative(process.cwd(), root) || '.'}.`)
}
