import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import { basicSetup } from 'codemirror';
import { sql, SQLite } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * CodeMirror wrapper. `value` seeds the document; further edits are pushed up
 * through onChange rather than re-syncing, so the cursor never jumps.
 * Changing `docKey` (i.e. switching problems) resets the document.
 */
export default function SqlEditor({ value, onChange, onRun, docKey }) {
  const host = useRef(null);
  const view = useRef(null);
  const handlers = useRef({ onChange, onRun });
  handlers.current = { onChange, onRun };

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        autocompletion({ override: [] }),
        sql({ dialect: SQLite, upperCaseKeywords: true }),
        oneDark,
        keymap.of([
          {
            key: 'Ctrl-Enter',
            mac: 'Cmd-Enter',
            run: () => {
              handlers.current.onRun?.();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString());
        }),
        EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
      ],
    });

    view.current = new EditorView({ state, parent: host.current });

    const hostEl = host.current;
    const onKeyDown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        const v = view.current;
        if (v) {
          const pos = v.state.selection.main.from;
          v.dispatch({
            changes: { from: pos, insert: '  ' },
            selection: { anchor: pos + 2 },
          });
        }
      }
    };
    hostEl.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      hostEl.removeEventListener('keydown', onKeyDown, { capture: true });
      view.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  return <div className="editor" ref={host} />;
}
