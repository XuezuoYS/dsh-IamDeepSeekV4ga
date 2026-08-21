window.__ModuleLoader__.load({
  id: 'dsh-plugin-iam-deepseek-v4ga',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const react = require('react')

    /** Must match the Host-side settings namespace in lib/index.js. */
    const SETTINGS_NS = 'iam-deepseek-v4ga'

    /**
     * Minimal observable snapshot store over one settings scope. The slot
     * renderer synthesizes `useCard` from `getSnapshot`/`subscribe`, so the
     * card receives a live view of `enablePromptInjection`.
     */
    function createStore(scope) {
      let snapshot = read()
      const listeners = new Set()

      function read() {
        const s = scope.getSnapshot()
        return {
          available: s.status === 'ready',
          writable: s.writable === true,
          enabled: s.value?.enablePromptInjection === true,
        }
      }

      function emit() {
        for (const listener of listeners) listener()
      }

      const unsubscribe = scope.subscribe(() => {
        snapshot = read()
        emit()
      })

      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        async setEnabled(enabled) {
          await scope.set('enablePromptInjection', enabled)
          snapshot = read()
          emit()
        },
        dispose: unsubscribe,
      }
    }

    function SettingCard(props) {
      const state = props.useCard((value) => value)
      if (!state.available) return null

      return react.createElement(
        'li',
        {
          style: {
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 12,
            background: 'var(--dsw-alias-bg-layer-3)',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          },
        },
        react.createElement(
          'div',
          { style: { flex: 1, minWidth: 0 } },
          react.createElement(
            'div',
            {
              style: {
                color: 'var(--dsw-alias-label-primary)',
                fontWeight: 600,
                fontSize: 13,
                lineHeight: 1.5,
              },
            },
            '开启提示词注入',
          ),
          react.createElement(
            'div',
            {
              style: {
                color: 'var(--dsw-alias-label-tertiary)',
                fontSize: 12,
                lineHeight: 1.5,
                marginTop: 2,
              },
            },
            '开启后才会向每轮 system 中注入提示词；关闭后则完全无行动。',
          ),
        ),
        react.createElement('input', {
          type: 'checkbox',
          role: 'switch',
          checked: state.enabled,
          disabled: !state.writable,
          onChange: (event) => {
            props.setEnabled(event.target.checked)
          },
        }),
      )
    }

    const inject = ['slots', 'settingsScope']

    function apply(ctx) {
      const store = createStore(ctx.settingsScope.bind({ namespace: SETTINGS_NS }))

      ctx.effect(
        () => () => store.dispose(),
        'iam-deepseek-v4ga: settings scope',
      )

      ctx.slots.inject('settings.plugin.item', function* () {
        yield ctx.slots.register(
          {
            name: 'settings.plugin.item',
            key: SETTINGS_NS,
            inject: () => ({
              hooks: { card: store },
              setEnabled: (enabled) => store.setEnabled(enabled),
            }),
          },
          SettingCard,
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
