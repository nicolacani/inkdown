// A compact find/replace extension for TipTap based on ProseMirror decorations.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const searchKey = new PluginKey('searchHighlight');

export function findMatches(doc, term, caseSensitive) {
  const results = [];
  if (!term) return results;
  const needle = caseSensitive ? term : term.toLowerCase();
  const len = term.length;
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = caseSensitive ? node.text : node.text.toLowerCase();
    let idx = 0;
    while ((idx = hay.indexOf(needle, idx)) !== -1) {
      results.push({ from: pos + idx, to: pos + idx + len });
      idx += len;
    }
  });
  return results;
}

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addStorage() {
    return { term: '', caseSensitive: false, matches: [], index: -1 };
  },

  addProseMirrorPlugins() {
    const extension = this;
    return [
      new Plugin({
        key: searchKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old) {
            const meta = tr.getMeta(searchKey);
            const st = extension.storage;
            if (!meta && !tr.docChanged) {
              return old.map(tr.mapping, tr.doc);
            }
            const matches = findMatches(tr.doc, st.term, st.caseSensitive);
            st.matches = matches;
            if (matches.length === 0) st.index = -1;
            else if (st.index < 0 || st.index >= matches.length) st.index = 0;
            const decos = matches.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                class: i === st.index ? 'search-match search-current' : 'search-match',
              })
            );
            return DecorationSet.create(tr.doc, decos);
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state);
          },
        },
      }),
    ];
  },
});
