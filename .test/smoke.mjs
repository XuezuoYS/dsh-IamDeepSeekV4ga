/**
 * Harness smoke test for dsh-plugin-iam-deepseek-v4ga against deepseek-harness
 * dsh-v0.1.3-alpha.1 (the checkout at D:\Programs\.RunOnSource\deepseek-harness).
 *
 * Boots a minimal Cordis tree: settings-file provider + SystemPrompt + the
 * plugin, then asserts:
 *   1. the plugin module imports (the startup failure under test),
 *   2. the settings namespace resolves to the composition entry,
 *   3. the [IMPORTANT] section is registered at assembly and sits at the top,
 *   4. an in-process settings write disables the section live,
 *   5. the no-settings-provider fallback still registers the section.
 *
 * usage: node .test/smoke.mjs            (set DSH_HARNESS_ROOT to point elsewhere)
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.DSH_HARNESS_ROOT ?? 'D:/Programs/.RunOnSource/deepseek-harness'
const url = path => pathToFileURL(`${ROOT}/${path}`).href

const { Context } = await import(url('vendor/cordis/lib/index.js'))
const { default: SystemPrompt } = await import(url('packages/core/system-prompt/lib/index.js'))
const { FileSettingsProvider } = await import(url('packages/settings/settings-file/lib/index.js'))
import * as iam from '../lib/index.js'

const DEFAULT_IMPORTANT_RULES =
  'You are a helpful software engineer assistant. **When you thought, use English and start with `We need` or `I\'m`**.'
const SECTION_NAME = 'iam-deepseek:important-rules'

/** Apply/reload-friendly wait: let child fibers (ctx.inject) run. */
const settle = () => new Promise(resolve => setImmediate(resolve))

async function assembleSectionNames(ctx) {
  const assembly = await ctx.systemPrompt.assemble()
  return assembly.sections.map(section => section.name)
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
}

// ── Scenario 1: settings provider mounted ────────────────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), 'dsh-iam-smoke-'))
  const settingsPath = join(dir, 'settings.yaml')
  try {
    const ctx = new Context()
    await ctx.plugin(FileSettingsProvider, { path: settingsPath, watch: false })
    await ctx.plugin(SystemPrompt, {})
    await ctx.plugin(iam, { enablePromptInjection: true })
    await settle()

    // 2. namespace resolved from composition entry
    const resolved = ctx.settings.get('iam-deepseek-v4ga')
    assert(resolved?.enablePromptInjection === true, `settings namespace resolved=${JSON.stringify(resolved)}`)

    // 3. section registered, and first (before every harness-own section)
    const assembly = await ctx.systemPrompt.assemble()
    const expected = { name: SECTION_NAME, text: DEFAULT_IMPORTANT_RULES }
    const found = assembly.sections.find(section => section.name === SECTION_NAME)
    assert(found !== undefined, 'section not present in assembly')
    assert(found.text === DEFAULT_IMPORTANT_RULES, `section text mismatch: ${JSON.stringify(found)}`)
    assert(assembly.sections[0].name === SECTION_NAME, `section is not at the top: ${assembly.sections.map(s => s.name).join(', ')}`)

    // 4. live disable via settings write
    await ctx.settings.update('iam-deepseek-v4ga', { enablePromptInjection: false })
    await settle()
    const names = await assembleSectionNames(ctx)
    assert(!names.includes(SECTION_NAME), `disabled but section still present: ${names.join(', ')}`)

    // 4b. re-enable restores the section
    await ctx.settings.update('iam-deepseek-v4ga', { enablePromptInjection: true })
    await settle()
    const names2 = await assembleSectionNames(ctx)
    assert(names2.includes(SECTION_NAME), `re-enabled but section missing: ${names2.join(', ')}`)

    console.log('[ok] scenario 1: mounted settings provider (register, top placement, live toggle)')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ── Scenario 2: no settings provider (minimal deployment fallback) ───────────
{
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(iam, { enablePromptInjection: false })
  await settle()

  const names = await assembleSectionNames(ctx)
  assert(!names.includes(SECTION_NAME), `disabled entry leaks a section: ${names.join(', ')}`)

  const ctx2 = new Context()
  await ctx2.plugin(SystemPrompt, {})
  await ctx2.plugin(iam, {})
  await settle()
  const names2 = await assembleSectionNames(ctx2)
  assert(names2.includes(SECTION_NAME), `entry-default section missing: ${names2.join(', ')}`)
  assert(names2[0] === SECTION_NAME, `entry-default section not at the top: ${names2.join(', ')}`)

  console.log('[ok] scenario 2: no settings provider (entry fallback, disabled entry)')
}

console.log('ALL SMOKE CHECKS PASSED')
