/**
 * Verification plugin for the isolated profile boot test: waits for the
 * loader tree to settle, re-reads the current user settings document, then
 * assembles the system prompt and writes /proves one marker file proving the
 * iam-deepseek-v4ga plugin's section placement (or its absence when disabled).
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

export const name = 'iam-verify'

export const inject = ['systemPrompt', 'settings']

export function apply(ctx) {
  const marker = join(process.env.DSH_HOME, 'verify-result.json')
  void ctx.loader.await().then(async () => {
    // The plugin fiber has settled; give its ctx.inject sub-fiber a tick.
    await new Promise(resolve => setTimeout(resolve, 100))
    const assembly = await ctx.systemPrompt.assemble()
    const names = assembly.sections.map(section => section.name)
    const section = assembly.sections.find(candidate => candidate.name === 'iam-deepseek:important-rules')
    const setting = ctx.settings.get('iam-deepseek-v4ga')
    writeFileSync(marker, JSON.stringify({
      sectionNames: names,
      sectionText: section === undefined ? null : section.text,
      setting,
      pluginLoaded: true,
    }, null, 2))
  })
  // keep the process alive like any surface plugin
  void ctx.loader.await()
}
