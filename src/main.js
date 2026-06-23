import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';
import { SearchHighlight, searchKey } from './search.js';

const lowlight = createLowlight(common);

// ---------------------------------------------------------------------------
// Document state
// ---------------------------------------------------------------------------

let currentPath = null;
let savedMarkdown = '';
let loading = false;

const STORE = {
  theme: 'inkdown.theme',
  font: 'inkdown.font',
  scale: 'inkdown.scale',
};

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const editor = new Editor({
  element: document.querySelector('#editor'),
  autofocus: 'end',
  extensions: [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Underline,
    Highlight,
    Typography,
    Image.configure({ inline: false, allowBase64: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder: 'Inizia a scrivere…' }),
    SearchHighlight,
    Markdown.configure({
      html: true,
      tightLists: true,
      linkify: true,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ],
  onUpdate: () => {
    if (loading) return;
    refreshState();
  },
  onSelectionUpdate: () => updateToolbar(),
  onTransaction: () => updateToolbar(),
});

function getMarkdown() {
  return editor.storage.markdown.getMarkdown();
}

// Expose state for the main process (used for save / close prompts and tests).
window.__editor = editor;
window.__getMarkdown = getMarkdown;
window.__currentPath = currentPath;
window.__isDirty = false;

// ---------------------------------------------------------------------------
// State / UI sync
// ---------------------------------------------------------------------------

const els = {
  statusFile: document.querySelector('#status-file'),
  statusSaved: document.querySelector('#status-saved'),
  statusWords: document.querySelector('#status-words'),
  statusZoom: document.querySelector('#status-zoom'),
  blockStyle: document.querySelector('#block-style'),
};

function baseName(p) {
  if (!p) return null;
  const parts = p.split('/');
  return parts[parts.length - 1];
}

function refreshState() {
  const md = getMarkdown();
  const dirty = md !== savedMarkdown;

  window.__currentPath = currentPath;
  window.__isDirty = dirty;

  const name = baseName(currentPath) || 'Nuovo documento';
  els.statusFile.textContent = name;
  els.statusSaved.textContent = dirty ? '• modifiche non salvate' : currentPath ? 'salvato' : '';
  els.statusSaved.classList.toggle('dirty', dirty);

  const text = editor.getText().trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  els.statusWords.textContent = `${words} parol${words === 1 ? 'a' : 'e'} · ${chars} caratteri`;

  document.title = `${dirty ? '• ' : ''}${name} - Inkdown`;
  window.inkdown.setTitle(`${dirty ? '• ' : ''}${name}`);
  window.inkdown.setEdited(dirty);
  window.inkdown.setRepresentedFile(currentPath || '');
}

const TOOLBAR_STATE = [
  ['bold', () => editor.isActive('bold')],
  ['italic', () => editor.isActive('italic')],
  ['underline', () => editor.isActive('underline')],
  ['strike', () => editor.isActive('strike')],
  ['code', () => editor.isActive('code')],
  ['highlight', () => editor.isActive('highlight')],
  ['bulletList', () => editor.isActive('bulletList')],
  ['orderedList', () => editor.isActive('orderedList')],
  ['taskList', () => editor.isActive('taskList')],
  ['blockquote', () => editor.isActive('blockquote')],
  ['codeBlock', () => editor.isActive('codeBlock')],
  ['link', () => editor.isActive('link')],
];

function updateToolbar() {
  for (const [cmd, isActive] of TOOLBAR_STATE) {
    const btn = document.querySelector(`.tb-btn[data-cmd="${cmd}"]`);
    if (btn) btn.classList.toggle('is-active', isActive());
  }
  // Block style select
  let val = 'paragraph';
  for (let lvl = 1; lvl <= 4; lvl++) {
    if (editor.isActive('heading', { level: lvl })) { val = 'h' + lvl; break; }
  }
  if (els.blockStyle.value !== val) els.blockStyle.value = val;
}

// ---------------------------------------------------------------------------
// Document load / new
// ---------------------------------------------------------------------------

function loadDocument(content, path) {
  loading = true;
  editor.commands.setContent(content || '', false);
  loading = false;
  currentPath = path || null;
  // Baseline is what the editor round-trips, so normalisation isn't "dirty".
  savedMarkdown = getMarkdown();
  editor.commands.focus('start');
  editor.view.dom.scrollTop = 0;
  document.querySelector('#scroll').scrollTop = 0;
  refreshState();
  updateToolbar();
}

async function newDocument() {
  const ok = await window.inkdown.confirmDiscard();
  if (!ok) return;
  loadDocument('', null);
}

// ---------------------------------------------------------------------------
// View preferences (theme, font, scale)
// ---------------------------------------------------------------------------

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORE.theme, theme);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'light' ? 'dark' : 'light');
}

function applyDocFont(font) {
  document.documentElement.setAttribute('data-doc-font', font);
  localStorage.setItem(STORE.font, font);
}
function toggleFont() {
  const cur = document.documentElement.getAttribute('data-doc-font') || 'sans';
  applyDocFont(cur === 'sans' ? 'serif' : 'sans');
}

let scale = 1;
function applyScale(s) {
  scale = Math.min(1.8, Math.max(0.8, Math.round(s * 100) / 100));
  document.documentElement.style.setProperty('--doc-font-scale', String(scale));
  localStorage.setItem(STORE.scale, String(scale));
  if (els.statusZoom) els.statusZoom.textContent = Math.round(scale * 100) + '%';
}
function fontUp() { applyScale(scale + 0.1); }
function fontDown() { applyScale(scale - 0.1); }
function fontReset() { applyScale(1); }

function restorePrefs() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(localStorage.getItem(STORE.theme) || (prefersDark ? 'dark' : 'light'));
  applyDocFont(localStorage.getItem(STORE.font) || 'sans');
  applyScale(parseFloat(localStorage.getItem(STORE.scale)) || 1);
}

// ---------------------------------------------------------------------------
// Link popover
// ---------------------------------------------------------------------------

const linkPopover = document.createElement('div');
linkPopover.id = 'link-popover';
linkPopover.innerHTML = `
  <input type="text" placeholder="https://esempio.com" />
  <button data-act="apply">OK</button>
  <button class="ghost" data-act="remove">Rimuovi</button>`;
document.body.appendChild(linkPopover);
const linkInput = linkPopover.querySelector('input');

function openLinkPopover() {
  const prev = editor.getAttributes('link').href || '';
  linkInput.value = prev;

  const { from } = editor.state.selection;
  const coords = editor.view.coordsAtPos(from);
  linkPopover.classList.add('show');
  const rect = linkPopover.getBoundingClientRect();
  let left = coords.left;
  if (left + rect.width > window.innerWidth - 12) left = window.innerWidth - rect.width - 12;
  linkPopover.style.left = Math.max(12, left) + 'px';
  linkPopover.style.top = coords.bottom + 8 + 'px';
  linkInput.focus();
  linkInput.select();
}
function closeLinkPopover() { linkPopover.classList.remove('show'); editor.commands.focus(); }
function applyLink() {
  let url = linkInput.value.trim();
  if (!url) { editor.chain().focus().unsetLink().run(); closeLinkPopover(); return; }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('/') && !url.startsWith('#')) url = 'https://' + url;
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  closeLinkPopover();
}
linkPopover.addEventListener('click', (e) => {
  const act = e.target.getAttribute('data-act');
  if (act === 'apply') applyLink();
  else if (act === 'remove') { editor.chain().focus().unsetLink().run(); closeLinkPopover(); }
});
linkInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeLinkPopover(); }
});
document.addEventListener('mousedown', (e) => {
  if (linkPopover.classList.contains('show') && !linkPopover.contains(e.target)) {
    linkPopover.classList.remove('show');
  }
});

// ---------------------------------------------------------------------------
// Find & replace
// ---------------------------------------------------------------------------

const findbar = document.querySelector('#findbar');
const findInput = document.querySelector('#find-input');
const replaceInput = document.querySelector('#replace-input');
const findCount = document.querySelector('#find-count');
const findCaseBtn = document.querySelector('#find-case');

function searchStore() { return editor.storage.searchHighlight; }
function commitSearch() { editor.view.dispatch(editor.view.state.tr.setMeta(searchKey, true)); }

function updateFindCount() {
  const st = searchStore();
  findCount.textContent = st.matches.length ? `${st.index + 1}/${st.matches.length}` : '0/0';
}

function scrollToCurrent() {
  const st = searchStore();
  const m = st.matches[st.index];
  if (!m) return;
  const coords = editor.view.coordsAtPos(m.from);
  const scroller = document.querySelector('#scroll');
  const sr = scroller.getBoundingClientRect();
  if (coords.top < sr.top + 70 || coords.bottom > sr.bottom - 70) {
    scroller.scrollTo({
      top: scroller.scrollTop + coords.top - sr.top - scroller.clientHeight / 2,
      behavior: 'smooth',
    });
  }
}

function doFind(term) {
  const st = searchStore();
  st.term = term;
  st.index = term ? 0 : -1;
  commitSearch();
  updateFindCount();
  scrollToCurrent();
}

function stepFind(dir) {
  const st = searchStore();
  if (!st.matches.length) return;
  st.index = (st.index + dir + st.matches.length) % st.matches.length;
  commitSearch();
  updateFindCount();
  scrollToCurrent();
}

function openFind() {
  findbar.classList.add('show');
  findbar.setAttribute('aria-hidden', 'false');
  const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ');
  if (sel && sel.length > 0 && sel.length < 80) findInput.value = sel;
  findInput.focus();
  findInput.select();
  if (findInput.value) doFind(findInput.value);
}

function closeFind() {
  findbar.classList.remove('show');
  findbar.setAttribute('aria-hidden', 'true');
  const st = searchStore();
  st.term = '';
  st.index = -1;
  commitSearch();
  editor.commands.focus();
}

function replaceCurrent() {
  const st = searchStore();
  const m = st.matches[st.index];
  if (!m) return;
  const at = m.from;
  editor.chain().insertContentAt({ from: m.from, to: m.to }, replaceInput.value).run();
  // The doc changed, so matches were recomputed; aim the cursor at the next one.
  const idx = st.matches.findIndex((x) => x.from >= at);
  st.index = st.matches.length ? (idx === -1 ? 0 : idx) : -1;
  commitSearch();
  updateFindCount();
  scrollToCurrent();
}

function replaceAll() {
  const st = searchStore();
  if (!st.matches.length) return;
  const rep = replaceInput.value;
  const ordered = [...st.matches].sort((a, b) => b.from - a.from);
  let chain = editor.chain();
  ordered.forEach((m) => { chain = chain.insertContentAt({ from: m.from, to: m.to }, rep); });
  chain.run();
  doFind(st.term);
}

findInput.addEventListener('input', () => doFind(findInput.value));
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
});
replaceInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
});
document.querySelector('#find-next').addEventListener('click', () => stepFind(1));
document.querySelector('#find-prev').addEventListener('click', () => stepFind(-1));
document.querySelector('#find-close').addEventListener('click', closeFind);
document.querySelector('#replace-one').addEventListener('click', replaceCurrent);
document.querySelector('#replace-all').addEventListener('click', replaceAll);
findCaseBtn.addEventListener('click', () => {
  const st = searchStore();
  st.caseSensitive = !st.caseSensitive;
  findCaseBtn.classList.toggle('is-active', st.caseSensitive);
  doFind(findInput.value);
});

// Test hook.
window.__search = { doFind, stepFind, replaceCurrent, replaceAll, store: searchStore };

// ---------------------------------------------------------------------------
// Editor affordances: ⌘-click links, copy-code button
// ---------------------------------------------------------------------------

const editorRoot = document.querySelector('#editor');
const scroller = document.querySelector('#scroll');

// ⌘/Ctrl-click a link to open it in the default browser; hover shows the URL.
editorRoot.addEventListener('mouseover', (e) => {
  const a = e.target.closest && e.target.closest('a');
  if (a && a.getAttribute('href') && !a.title) {
    a.title = '⌘+clic per aprire: ' + a.getAttribute('href');
  }
});
editorRoot.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a');
  if (a && (e.metaKey || e.ctrlKey)) {
    const href = a.getAttribute('href');
    if (href) { e.preventDefault(); window.open(href, '_blank'); }
  }
});

// Floating "copy" button shown over the hovered code block.
const codeCopyBtn = document.createElement('button');
codeCopyBtn.id = 'code-copy';
codeCopyBtn.type = 'button';
codeCopyBtn.textContent = 'Copia';
document.body.appendChild(codeCopyBtn);
let hoveredPre = null;

function positionCopyBtn() {
  if (!hoveredPre) return;
  const r = hoveredPre.getBoundingClientRect();
  codeCopyBtn.style.top = r.top + 8 + 'px';
  codeCopyBtn.style.left = r.right - codeCopyBtn.offsetWidth - 10 + 'px';
}

scroller.addEventListener('mousemove', (e) => {
  const pre = e.target.closest && e.target.closest('pre');
  if (pre) {
    hoveredPre = pre;
    codeCopyBtn.classList.add('show');
    positionCopyBtn();
  } else {
    codeCopyBtn.classList.remove('show');
  }
});
scroller.addEventListener('scroll', () => {
  if (codeCopyBtn.classList.contains('show')) positionCopyBtn();
});
codeCopyBtn.addEventListener('click', () => {
  if (!hoveredPre) return;
  window.inkdown.copyText(hoveredPre.innerText.replace(/\n$/, ''));
  codeCopyBtn.textContent = 'Copiato!';
  codeCopyBtn.classList.add('done');
  setTimeout(() => { codeCopyBtn.textContent = 'Copia'; codeCopyBtn.classList.remove('done'); }, 1200);
});

// ---------------------------------------------------------------------------
// Command dispatch (shared by toolbar buttons and the application menu)
// ---------------------------------------------------------------------------

function run(cmd) {
  const c = () => editor.chain().focus();
  switch (cmd) {
    case 'bold': c().toggleBold().run(); break;
    case 'italic': c().toggleItalic().run(); break;
    case 'underline': c().toggleUnderline().run(); break;
    case 'strike': c().toggleStrike().run(); break;
    case 'code': c().toggleCode().run(); break;
    case 'highlight': c().toggleHighlight().run(); break;
    case 'bulletList': c().toggleBulletList().run(); break;
    case 'orderedList': c().toggleOrderedList().run(); break;
    case 'taskList': c().toggleTaskList().run(); break;
    case 'blockquote': c().toggleBlockquote().run(); break;
    case 'codeBlock': c().toggleCodeBlock().run(); break;
    case 'hr': c().setHorizontalRule().run(); break;
    case 'paragraph': c().setParagraph().run(); break;
    case 'h1': c().toggleHeading({ level: 1 }).run(); break;
    case 'h2': c().toggleHeading({ level: 2 }).run(); break;
    case 'h3': c().toggleHeading({ level: 3 }).run(); break;
    case 'h4': c().toggleHeading({ level: 4 }).run(); break;
    case 'link': openLinkPopover(); break;
    case 'undo': editor.chain().focus().undo().run(); break;
    case 'redo': editor.chain().focus().redo().run(); break;
    case 'fontUp': fontUp(); break;
    case 'fontDown': fontDown(); break;
    case 'fontReset': fontReset(); break;
    case 'toggleTheme': toggleTheme(); break;
    case 'toggleFont': toggleFont(); break;
    case 'find': openFind(); break;
    case 'new': newDocument(); break;
    default: break;
  }
}

// Toolbar buttons
document.querySelectorAll('.tb-btn[data-cmd]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    run(btn.getAttribute('data-cmd'));
  });
});

// Block style dropdown
els.blockStyle.addEventListener('change', () => {
  run(els.blockStyle.value);
  editor.commands.focus();
});

// ---------------------------------------------------------------------------
// IPC wiring with the main process
// ---------------------------------------------------------------------------

window.inkdown.onMenu((cmd) => run(cmd));

window.inkdown.onOpenPath(async ({ path, content }) => {
  // Don't silently discard unsaved work when opening another file.
  const ok = await window.inkdown.confirmDiscard();
  if (!ok) return;
  loadDocument(content, path);
});

window.inkdown.onSaved(({ path }) => {
  currentPath = path;
  savedMarkdown = getMarkdown();
  refreshState();
});

// Cmd+S / Cmd+O are also handled via the native menu, but wire the renderer
// keymap too so the editor responds even when the menu is unavailable.
window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  if (e.key === 's' && !e.shiftKey) { e.preventDefault(); window.inkdown.save(); }
  else if (e.key === 's' && e.shiftKey) { e.preventDefault(); window.inkdown.saveAs(); }
  else if (e.key === 'o') { e.preventDefault(); window.inkdown.open(); }
});

// Open files dropped onto the window.
window.addEventListener('dragover', (e) => { e.preventDefault(); });
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  if (/\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(file.name)) {
    const ok = await window.inkdown.confirmDiscard();
    if (!ok) return;
    const text = await file.text();
    loadDocument(text, window.inkdown.getDroppedFilePath(file));
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

restorePrefs();

// Friendly starter document so the first launch already looks good.
const WELCOME = `# Benvenuto in Inkdown

Un editor **Markdown** dall'aspetto curato. Scrivi qui come in un normale editor di testo: il *Markdown* viene formattato in tempo reale.

## Cosa puoi fare

- Metti in **grassetto** (⌘B), *corsivo* (⌘I) e ~~barrato~~
- Crea titoli di diverse dimensioni con il menù a tendina in alto a sinistra
- Aumenta o riduci la dimensione del testo con i pulsanti **A−/A+**
- Inserisci <mark>testo evidenziato</mark>, \`codice\` e [link](https://claude.ai) (⌘K)

> Tutto viene salvato come un normale file \`.md\`, leggibile ovunque.

### Elenco delle attività

- [x] Aprire un file Markdown
- [ ] Scrivere qualcosa di bello
- [ ] Salvare con ⌘S

\`\`\`js
// Anche il codice è formattato con i colori
function saluta(nome) {
  return \`Ciao, \${nome}!\`;
}
\`\`\`

Apri un tuo file con **⌘O** oppure trascinalo qui dentro. Buona scrittura ✦
`;

loadDocument(WELCOME, null);
savedMarkdown = getMarkdown(); // welcome doc starts "clean"
refreshState();
