// Dev-only: round-trip a representative Markdown document through the editor.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SAMPLE = [
  '# Titolo principale',
  '',
  'Paragrafo con **grassetto**, *corsivo*, ~~barrato~~, `codice` e [link](https://example.com).',
  '',
  '## Sottotitolo',
  '',
  '- uno',
  '- due',
  '    - annidato',
  '',
  '1. primo',
  '2. secondo',
  '',
  '- [ ] da fare',
  '- [x] fatto',
  '',
  '> Una citazione su',
  '> due righe.',
  '',
  '```js',
  'const a = 1;',
  'console.log(a);',
  '```',
  '',
  '| Colonna A | Colonna B |',
  '| --- | --- |',
  '| 1 | 2 |',
  '',
  '---',
  '',
].join('\n');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
    },
  });
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await wait(1600);

  const out = await win.webContents.executeJavaScript(
    `(function(){ window.__editor.commands.setContent(${JSON.stringify(SAMPLE)}, false); return window.__getMarkdown(); })()`
  );
  fs.writeFileSync('/tmp/rt-in.md', SAMPLE);
  fs.writeFileSync('/tmp/rt-out.md', out);

  const hl = await win.webContents.executeJavaScript(
    `(function(){ window.__editor.commands.setContent('parola', false); window.__editor.chain().selectAll().toggleHighlight().run(); return window.__getMarkdown(); })()`
  );
  fs.writeFileSync('/tmp/rt-hl.md', hl);

  const ul = await win.webContents.executeJavaScript(
    `(function(){ window.__editor.commands.setContent('parola', false); window.__editor.chain().selectAll().toggleUnderline().run(); return window.__getMarkdown(); })()`
  );
  fs.writeFileSync('/tmp/rt-ul.md', ul);

  console.log('roundtrip done');
  app.quit();
});
