/**
 * IMPORTANT Rules — a DeepSeek Harness (Cordis) plugin.
 *
 * Injects a fixed "[IMPORTANT]" rule block at the very TOP of the system
 * prompt of every model request (each turn's / each agent step's request).
 * The block constrains the model's chain of thought (CoT):
 *
 *   - reasoning & CoT must be expressed in English;
 *   - the entire chain of thought MUST start with "I'm";
 *   - the reasoning MUST NOT contain the phrase "Let me" — it is always
 *     replaced with "I am" / "I will";
 *   - no duplicate requests; proceed directly to divergence;
 *   - prefer direct, objective verbs such as "I need", "I will", "I can".
 *
 * Mechanics (verified against the harness source):
 *   - `systemPrompt.section({ name, order, text })` registers an ordered
 *     prompt section. Sections are concatenated in ascending `order`;
 *     `-100` is the harness identity, `0` the deployment persona, tool
 *     guidance lives at 100–199, so a very negative order places this
 *     section at the very top of the assembled system prompt
 *     (`assemble()` -> `renderPrompt()` -> `GenerateOptions.system`).
 *     The assembly runs before every model step, so the block reaches the
 *     system of EVERY round's request (main agent + subagents).
 *   - `inject: ['systemPrompt']` is REQUIRED. Without it the plugin mounts
 *     immediately, `ctx.get('systemPrompt')` (strict mode) returns
 *     `undefined` until the providing fiber is ACTIVE, and the registration
 *     silently never happens even though the plugin shows as mounted. The
 *     inject declaration makes Cordis hold this fiber PENDING until the
 *     service is ready, exactly like the official `@deepseek-ai/dsh-persona`.
 *   - The registration is wrapped in `ctx.effect(...)`, so the section is
 *     removed again when this plugin is stopped, updated, or unloaded.
 */

export const name = 'iam-deepseek-v4ga'

/** The prompt registry this plugin contributes to (hard dependency). */
export const inject = ['systemPrompt']

/** The exact rule block injected at the top of every request's system prompt. */
const DEFAULT_IMPORTANT_RULES = `# [IMPORTANT]
- Think (reasoning & CoT) should be expressed in English.
- Your entire chain of thought (reasoning & CoT) **MUST** start with \`I'm\` .
- Your entire reasoning (CoT) **MUST NOT** contain or use the phrase "Let me".
- Prohibit duplicate requests. Proceed directly to divergence.
- The wording of the reasoning (CoT) tends to use direct and objective verbs such as "I need", "I will", and "I can".
## You must replace all the "Let me" with "I am" and "I will".`

/**
 * Plugin entry.
 *
 * @param ctx - the Cordis context this plugin is mounted on. Because this
 *   plugin declares `inject: ['systemPrompt']`, Cordis guarantees the
 *   service is ACTIVE before `apply` runs, so `ctx.systemPrompt` is safe to
 *   use directly (no `ctx.get()` + `undefined` guard needed).
 * @param config - optional row configuration:
 *   - `enabled`: false disables the injection entirely (default true).
 *   - `order`:   section order; default -1000 (before the harness identity at -100).
 *   - `text`:    custom rule text replacing the default [IMPORTANT] block.
 */
export function apply(ctx, config = {}) {
  if (config.enabled === false) return

  const order = typeof config.order === 'number' && Number.isFinite(config.order)
    ? config.order
    : -1000
  const text = typeof config.text === 'string' && config.text.length > 0
    ? config.text
    : DEFAULT_IMPORTANT_RULES

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'iam-deepseek:important-rules',
    order,
    text
  }), 'iam-deepseek-v4ga: section()')
}
