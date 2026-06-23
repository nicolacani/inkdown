// Dev-only: render dist and export a PDF to verify printToPDF + print CSS.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
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

  const data = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0.6, bottom: 0.6, left: 0.7, right: 0.7 },
  });
  fs.writeFileSync('/tmp/inkdown-test.pdf', data);

  const head = data.slice(0, 5).toString('latin1');
  console.log('PDF_TEST ' + JSON.stringify({ header: head, bytes: data.length }));
  app.quit();
});
