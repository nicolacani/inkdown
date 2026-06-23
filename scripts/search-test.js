// Dev-only: exercise find & replace headlessly.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const result = await win.webContents.executeJavaScript(`(function(){
    const out = {};
    window.__editor.commands.setContent('alpha beta alpha gamma alpha', false);
    window.__search.doFind('alpha');
    out.found = window.__search.store().matches.length;            // expect 3
    window.__search.store().caseSensitive = true;
    window.__search.doFind('ALPHA');
    out.caseSensitiveZero = window.__search.store().matches.length; // expect 0
    window.__search.store().caseSensitive = false;
    window.__search.doFind('alpha');
    document.querySelector('#replace-input').value = 'X';
    window.__search.replaceAll();
    out.afterReplace = window.__getMarkdown();                     // expect "X beta X gamma X"
    out.remaining = window.__search.store().matches.length;        // expect 0
    return out;
  })()`);

  console.log('SEARCH_TEST ' + JSON.stringify(result));
  app.quit();
});
