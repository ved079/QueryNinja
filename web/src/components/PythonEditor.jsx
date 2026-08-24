import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

export default function PythonEditor({ value, onChange, onRun, onSubmit, docKey }) {
  const host = useRef(null);
  const view = useRef(null);
  const handlers = useRef({ onChange, onRun, onSubmit });
  handlers.current = { onChange, onRun, onSubmit };

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        python(),
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
          {
            key: 'Ctrl-Shift-Enter',
            mac: 'Cmd-Shift-Enter',
            run: () => {
              handlers.current.onSubmit?.();
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
            changes: { from: pos, insert: '    ' },
            selection: { anchor: pos + 4 },
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
