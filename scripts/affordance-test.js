// Dev-only: verify clipboard copy IPC works.
const { app, BrowserWindow, clipboard, ipcMain } = require('electron');
const path = require('path');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Mirror the handler registered in electron/main.js so the renderer->IPC path is exercised.
ipcMain.on('clipboard:write', (_e, text) => clipboard.writeText(String(text || '')));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
    },
  });
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await wait(1500);

  clipboard.writeText('before');
  await win.webContents.executeJavaScript("window.inkdown.copyText('hello-123')");
  await wait(250);

  console.log('AFF_TEST ' + JSON.stringify({ clip: clipboard.readText() })); // expect hello-123
  app.quit();
});
