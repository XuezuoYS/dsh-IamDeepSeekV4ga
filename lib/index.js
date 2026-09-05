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
 * Adapted for DeepSeek Harness dsh-v0.1.3-alpha.1:
 *
 *   - `@deepseek-ai/dsh-settings` no longer exports the standalone
 *     `installSettingsSection` / `settingsNamespace` helpers; the settings
 *     seam is now the `ctx.settings` service (`SettingsProvider`), so the
 *     plugin registers its namespace through
 *     `ctx.inject(['settings'], sctx => sctx.settings.installSection(...))`.
 *   - The setting `enablePromptInjection` defaults to `true` and is shown in
 *     the browser's 设置 → 插件 → 插件配置 page as "plugin-iam-deepseek-v4ga:
 *     插件开关".
 *   - When the setting is `true` (the default), the rule block is registered
 *     through `ctx.systemPrompt.section(...)` on every round's request.
 *   - When the setting is `false`, the plugin performs no action at all: it
 *     neither registers nor retains a prompt section.
 *
 * `SettingsProvider.installSection` provides the canonical optional-settings
 * wiring:
 *   - while a settings service is mounted, the resolved namespace is the
 *     source of truth (schema default -> composition `base` -> user layer);
 *   - if no settings service is mounted, the composition row config remains
 *     the source, so the plugin still works in a minimal deployment.
 */

import z from '@deepseek-ai/schemastery'

export const name = 'iam-deepseek-v4ga'

/** The prompt registry this plugin contributes to (hard dependency). */
export const inject = ['systemPrompt']

/**
 * Lowercase kebab-case settings namespace owned by this plugin. It is what the
 * browser half uses as the `settings.plugin.item` key and what `ctx.settings`
 * records in the user settings document.
 */
const SETTINGS_NS = 'iam-deepseek-v4ga'

/** Schema for the plugin-owned settings section. */
const SETTINGS_SCHEMA = z.object({
  enablePromptInjection: z.boolean().default(true),
})

/** The exact rule block injected at the top of every request's system prompt. */
const DEFAULT_IMPORTANT_RULES =
  'You are a helpful software engineer assistant. **When you thought, use English and start with `We need` or `I\'m`**.'
const SECTION_NAME = 'iam-deepseek:important-rules'

/**
 * Default section order: one less than the harness identity's central order
 * (`HARNESS_IDENTITY` = -1000), so the rule block stays the very first thing
 * in the assembled prompt, as the plugin has always promised.
 */
const DEFAULT_SECTION_ORDER = -1001

/**
 * Plugin entry.
 *
 * @param ctx - the Cordis context this plugin is mounted on. Because this
 *   plugin declares `inject: ['systemPrompt']`, Cordis guarantees the
 *   service is ACTIVE before `apply` runs.
 * @param config - optional row configuration:
 *   - `enablePromptInjection`: disables the injection entirely when `false`
 *     (default `true`), exposed as the "开启提示词注入" setting;
 *   - `enabled`: legacy alias for `enablePromptInjection`;
 *   - `order`: section order; default -1001 (directly before the harness
 *     identity at -1000);
 *   - `text`: custom rule text replacing the default [IMPORTANT] block.
 */
export function apply(ctx, config = {}) {
  const entry = {
    enablePromptInjection:
      config.enablePromptInjection !== false && config.enabled !== false,
  }

  const order =
    typeof config.order === 'number' && Number.isFinite(config.order)
      ? config.order
      : DEFAULT_SECTION_ORDER
  const text =
    typeof config.text === 'string' && config.text.length > 0
      ? config.text
      : DEFAULT_IMPORTANT_RULES

  // Resolved settings source. Starts at the composition row config and is
  // replaced by the settings scope when a settings provider is mounted.
  let source = () => entry
  let sectionDisposer = null

  const sync = () => {
    if (source().enablePromptInjection !== false) {
      if (sectionDisposer === null) {
        sectionDisposer = ctx.systemPrompt.section({
          name: SECTION_NAME,
          order,
          text,
        })
      }
    } else {
      if (sectionDisposer !== null) {
        sectionDisposer()
        sectionDisposer = null
      }
    }
  }

  // Optional settings wiring: while `ctx.settings` exists, the namespace is
  // registered with the composition entry as its base layer and this plugin
  // follows the resolved value; when no settings provider is mounted, the
  // composition entry stays the source and the plugin keeps working.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, SETTINGS_NS, SETTINGS_SCHEMA, entry, {
      setSource: (current) => {
        source = current
      },
      onChange: sync,
    })
  })

  // Ensure the initial state is applied even when no settings provider is
  // mounted (in that case the `ctx.inject` callback never runs).
  sync()

  // Own the section registration; dispose it when the plugin is unloaded.
  ctx.effect(
    () => () => {
      if (sectionDisposer !== null) {
        sectionDisposer()
        sectionDisposer = null
      }
    },
    'iam-deepseek-v4ga: section()',
  )
}
