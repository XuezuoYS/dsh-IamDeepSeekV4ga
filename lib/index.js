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
 * Adapted for DeepSeek Harness 0.1.1-rc.2:
 *   - The plugin now exposes a real, plugin-owned settings namespace through
 *     `@deepseek-ai/dsh-settings` (`ctx.settings`). The setting
 *     `enablePromptInjection` defaults to `true` and is shown in the browser's
 *     Plugins → 插件配置 page as "开启提示词注入".
 *   - When the setting is `true` (the default), the rule block is registered
 *     through `ctx.systemPrompt.section(...)` on every round's request.
 *   - When the setting is `false`, the plugin performs no action at all: it
 *     neither registers nor retains a prompt section.
 *
 * `installSettingsSection` provides the canonical optional-settings wiring:
 *   - while a settings service is mounted, the resolved namespace is the
 *     source of truth (schema default -> composition `base` -> user layer);
 *   - if no settings service is mounted, the composition row config remains
 *     the source, so the plugin still works in a minimal deployment.
 */

import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

export const name = 'iam-deepseek-v4ga'

/** The prompt registry this plugin contributes to (hard dependency). */
export const inject = ['systemPrompt']

/**
 * Lowercase kebab-case settings namespace owned by this plugin. It is what the
 * browser half uses as the `settings.plugin.item` key and what `ctx.settings`
 * records in the user settings document.
 */
const SETTINGS_NS = settingsNamespace('iam-deepseek-v4ga')

/** Schema for the plugin-owned settings section. */
const SETTINGS_SCHEMA = z.object({
  enablePromptInjection: z.boolean().default(true),
})

/** The exact rule block injected at the top of every request's system prompt. */
const DEFAULT_IMPORTANT_RULES =
  'You are a helpful software engineer assistant. **When you thought, use English and start with `We need` or `I\'m`**.'
const SECTION_NAME = 'iam-deepseek:important-rules'

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
 *   - `order`: section order; default -1000 (before the harness identity at -100);
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
      : -1000
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

  installSettingsSection(ctx, SETTINGS_NS, SETTINGS_SCHEMA, entry, {
    setSource: (current) => {
      source = current
    },
    onChange: sync,
  })

  // Ensure the initial state is applied even when no settings provider is
  // mounted (in that case `installSettingsSection` never runs its hooks).
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
