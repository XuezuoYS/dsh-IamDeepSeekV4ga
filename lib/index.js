/**
 * I'm Thinking Rules — a DeepSeek Harness (Cordis) plugin.
 *
 * Registers a global prompt section at the very top of the system prompt of
 * every model request. The section constrains the model's chain of thought:
 *
 *   1. the entire reasoning block must be written in English,
 *      even when the user writes in another language;
 *   2. the FIRST word of the whole chain of thought must be "I'm";
 *   3. "I'm" phrasing is preferred over "Let me" / "Let's" throughout.
 *
 * Mechanics (verified against the harness source):
 *   - `systemPrompt.section({ name, order, text })` registers an ordered
 *     prompt section. Sections are concatenated in ascending `order`;
 *     `-100` is the harness identity, `0` the deployment persona, so a very
 *     negative order places this section at the very top of the assembled
 *     system prompt (`assemble()` -> `renderPrompt()` -> `GenerateOptions.system`).
 *   - The registration is wrapped in `ctx.effect(...)`, so the section is
 *     removed again when this plugin is stopped, updated, or unloaded.
 */

export const name = 'iam-deepseek-v4ga'

const DEFAULT_THINKING_RULES = [
  'THINKING LANGUAGE AND STYLE RULES:',
  '',
  '1. Write your entire chain of thought (reasoning) exclusively in English. Never reason in any other language, even when the user writes in another language.',
  '2. The first word of the whole chain-of-thought block must always be "I\'m" — begin your thinking with "I\'m ...", e.g. "I\'m analyzing...", "I\'m checking...".',
  '3. Throughout your reasoning, strongly prefer "I\'m" phrasing over "Let me" or "Let\'s" openings, e.g. prefer "I\'m inspecting the files..." over "Let me inspect the files...".'
].join('\n')

/**
 * Plugin entry.
 *
 * @param ctx - the Cordis context this plugin is mounted on.
 * @param config - optional row configuration:
 *   - `enabled`: false disables the injection entirely (default true).
 *   - `order`:   section order; default -1000 (before the harness identity at -100).
 *   - `text`:    custom rules text replacing the default block.
 */
export function apply(ctx, config = {}) {
  if (config.enabled === false) return

  const order = typeof config.order === 'number' && Number.isFinite(config.order)
    ? config.order
    : -1000
  const text = typeof config.text === 'string' && config.text.length > 0
    ? config.text
    : DEFAULT_THINKING_RULES

  ctx.effect(() => {
    const systemPrompt = ctx.get('systemPrompt')
    if (systemPrompt === undefined) return
    return systemPrompt.section({
      name: 'iam-deepseek:thinking-rules',
      order,
      text
    })
  })
}
