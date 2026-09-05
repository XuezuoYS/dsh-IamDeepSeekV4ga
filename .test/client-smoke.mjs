/**
 * Client-half smoke test: evaluate the plugin's prebuilt client bundle
 * (lib/client.js) exactly like the web shell does (window.__ModuleLoader__
 * handoff + factory(require)), then apply it on a real Cordis context with a
 * slots stub that mirrors the SlotRegistry contract the web shell implements
 * (declaration-aware inject, keyed register, entries) and a stub
 * settingsScope — asserting the modern settings.plugin.item contract:
 * inject face hooks + setEnabled, useCard snapshot store, live writes.
 *
 * usage: node .test/client-smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.env.DSH_HARNESS_ROOT ?? 'D:/Programs/.RunOnSource/deepseek-harness'
const { Context } = await import(pathToFileURL(`${ROOT}/vendor/cordis/lib/index.js`).href)

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'lib', 'client.js')

// ── Minimal slots stub honoring the modern SlotCore contract ────────────────
class SlotsStub {
  constructor() {
    this.records = new Map() // key -> { spec, entries: [] }
    this.declSet = new Set()
  }
  declare(key, spec) {
    if (this.records.has(key)) throw new Error(`slot "${key}" already declared`)
    this.records.set(key, { spec, entries: [] })
    this.declSet.add(key)
  }
  register(options, component) {
    const rec = this.records.get(options.name)
    if (!rec) throw new Error(`slot "${options.name}" is not declared`)
    if (options.key === undefined) throw new Error('keyed slot requires options.key')
    if (rec.entries.some(entry => entry.options.key === options.key)) {
      throw new Error(`keyed slot "${options.name}" already has key "${options.key}"`)
    }
    const entry = { component, options: { key: options.key }, inject: options.inject }
    rec.entries.push(entry)
    return () => { rec.entries = rec.entries.filter(candidate => candidate !== entry) }
  }
  entries(key) {
    return this.records.get(key)?.entries ?? []
  }
  inject(key, callback) {
    // Declaration-aware: run now when declared, else when declared later.
    // Cordis effects run generator callbacks to completion; mirror that.
    const run = () => {
      if (!this.declSet.has(key)) return
      const result = callback()
      if (result !== null && typeof result.next === 'function') {
        for (let step = result.next(); !step.done; step = result.next()) {
          // yielded disposers are kept by the real effect runner; draining suffices here
        }
      }
    }
    if (this.declSet.has(key)) run()
    return () => {}
  }
}

/** Load the plugin bundle through the window.__ModuleLoader__ handoff. */
let registration
globalThis.window = {
  __ModuleLoader__: { load(next) { registration = next }, mode: 'live' },
}
await import(pathToFileURL(bundlePath).href)
if (registration === undefined) throw new Error('bundle did not call window.__ModuleLoader__.load')
const exports = registration.factory((spec) => {
  if (spec !== 'react') throw new Error(`unexpected require("${spec}")`)
  return { createElement: (...args) => ({ __react: args }) }
})
if (typeof exports.apply !== 'function' || !Array.isArray(exports.inject)) {
  throw new Error(`bundle exports malformed: ${JSON.stringify(Object.keys(exports))}`)
}

// ── Fake settingsScope service: one bound namespace with a live snapshot ────
const listeners = new Set()
let enabled = true
const scope = {
  getSnapshot: () => ({
    status: 'ready',
    writable: true,
    value: { enablePromptInjection: enabled },
    revision: 1,
  }),
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
  set: (field, value) => {
    if (field !== 'enablePromptInjection') throw new Error(`unexpected set("${field}")`)
    enabled = value
    for (const fn of [...listeners]) fn()
    return Promise.resolve()
  },
}
const settingsScope = {
  bind: (spec) => {
    if (spec.namespace !== 'iam-deepseek-v4ga') throw new Error(`unexpected bind(${JSON.stringify(spec)})`)
    return scope
  },
}

const ctx = new Context()
ctx.provide('settingsScope', settingsScope)
const slots = new SlotsStub()
ctx.provide('slots', slots)
// The owner chain the web shell declares (section -> tab -> keyed item).
slots.declare('settings.plugin.item', { kind: 'keyed', scope: 'root' })

await ctx.plugin(exports)
await new Promise(resolve => setImmediate(resolve))

// The card must be registered under the namespace key with a live inject face
const entries = slots.entries('settings.plugin.item')
const entry = entries.find(candidate => candidate.options.key === 'iam-deepseek-v4ga')
if (entry === undefined) throw new Error('card not registered into settings.plugin.item')
if (typeof entry.inject !== 'function') throw new Error('card registration lost its inject face')

const face = entry.inject()
if (typeof face.setEnabled !== 'function') throw new Error('inject face lost setEnabled')
if (typeof face.hooks?.card?.getSnapshot !== 'function' || typeof face.hooks?.card?.subscribe !== 'function') {
  throw new Error('inject face lost the card snapshot store')
}

// Card snapshot semantics: ready + enabled
const snapshot = face.hooks.card.getSnapshot()
if (JSON.stringify(snapshot) !== JSON.stringify({
  available: true, writable: true, enabled: true,
})) throw new Error(`unexpected card snapshot: ${JSON.stringify(snapshot)}`)

// Live write: flip, then verify the store reflects it
await face.setEnabled(false)
const after = face.hooks.card.getSnapshot()
if (after.enabled !== false) throw new Error(`setEnabled did not propagate: ${JSON.stringify(after)}`)

console.log('[ok] client bundle: __ModuleLoader__ contract, inject face, useCard store, setEnabled write')
