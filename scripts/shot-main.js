// Dev-only: render dist/index.html and capture the page to PNGs (light + dark).
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await wait(1800);

  await win.webContents.executeJavaScript(
    "document.documentElement.setAttribute('data-theme','light')"
  );
  await wait(300);
  fs.writeFileSync('/tmp/inkdown-light.png', (await win.webContents.capturePage()).toPNG());

  // Find bar with matches highlighted (light theme).
  await win.webContents.executeJavaScript(
    "document.documentElement.setAttribute('data-theme','light');" +
    "document.querySelector('#findbar').classList.add('show');" +
    "document.querySelector('#find-input').value='Markdown';" +
    "window.__search.doFind('Markdown');" +
    "document.querySelector('#find-count').textContent=(window.__search.store().index+1)+'/'+window.__search.store().matches.length;"
  );
  await wait(400);
  fs.writeFileSync('/tmp/inkdown-find.png', (await win.webContents.capturePage()).toPNG());

  // Settings panel (light theme).
  await win.webContents.executeJavaScript(
    "document.querySelector('#findbar').classList.remove('show');" +
    "window.__search.doFind('');" +
    "document.documentElement.setAttribute('data-theme','light');" +
    "document.querySelector('#settings-overlay').classList.add('show');"
  );
  await wait(350);
  fs.writeFileSync('/tmp/inkdown-settings.png', (await win.webContents.capturePage()).toPNG());

  await win.webContents.executeJavaScript(
    "document.querySelector('#settings-overlay').classList.remove('show');" +
    "document.documentElement.setAttribute('data-theme','dark')"
  );
  await wait(300);
  fs.writeFileSync('/tmp/inkdown-dark.png', (await win.webContents.capturePage()).toPNG());

  console.log('shots written');
  app.quit();
});
