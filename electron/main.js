'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

/** @type {BrowserWindow | null} */
let mainWindow = null;

// ---------------------------------------------------------------------------
// Persisted window bounds
// ---------------------------------------------------------------------------

const statePath = path.join(app.getPath('userData'), 'window-state.json');
let saveBoundsTimer = null;

function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (b && typeof b.width === 'number' && typeof b.height === 'number') return b;
  } catch { /* no saved state */ }
  return null;
}

function saveBounds() {
  if (!mainWindow || mainWindow.isFullScreen() || mainWindow.isMinimized()) return;
  try {
    fs.writeFileSync(statePath, JSON.stringify(mainWindow.getBounds()));
  } catch { /* ignore */ }
}

function scheduleSaveBounds() {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(saveBounds, 400);
}

// File path queued from "open with" before the window is ready.
let pendingOpenPath = null;

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow() {
  const saved = loadBounds();
  mainWindow = new BrowserWindow({
    width: saved ? saved.width : 1040,
    height: saved ? saved.height : 760,
    ...(saved && typeof saved.x === 'number' ? { x: saved.x, y: saved.y } : {}),
    minWidth: 640,
    minHeight: 480,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 22 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1e1b' : '#faf9f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (pendingOpenPath) {
      openPathInRenderer(pendingOpenPath);
      pendingOpenPath = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('resize', scheduleSaveBounds);
  mainWindow.on('move', scheduleSaveBounds);

  // Intercept close to offer saving unsaved changes.
  mainWindow.on('close', async (e) => {
    saveBounds();
    if (mainWindow && mainWindow.__forceClose) return;
    e.preventDefault();
    const ok = await maybeSaveBeforeClosing();
    if (ok) {
      mainWindow.__forceClose = true;
      mainWindow.close();
    }
  });

  // Open external links in the default browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// ---------------------------------------------------------------------------
// Renderer helpers (the main process queries renderer state via JS eval)
// ---------------------------------------------------------------------------

async function rendererState() {
  if (!mainWindow) return { dirty: false, path: null, markdown: '' };
  try {
    return await mainWindow.webContents.executeJavaScript(
      '({ dirty: !!window.__isDirty, path: window.__currentPath || null, markdown: (window.__getMarkdown ? window.__getMarkdown() : "") })'
    );
  } catch {
    return { dirty: false, path: null, markdown: '' };
  }
}

function openPathInRenderer(filePath) {
  if (!mainWindow) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    mainWindow.webContents.send('open-path', { path: filePath, content });
    app.addRecentDocument(filePath);
  } catch (err) {
    dialog.showErrorBox('Impossibile aprire il file', String(err && err.message || err));
  }
}

/** Returns true if it is safe to proceed (saved or discarded), false to cancel. */
async function maybeSaveBeforeClosing() {
  const state = await rendererState();
  if (!state.dirty) return true;

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Salva', 'Non salvare', 'Annulla'],
    defaultId: 0,
    cancelId: 2,
    message: 'Vuoi salvare le modifiche?',
    detail: state.path
      ? `Le modifiche a "${path.basename(state.path)}" andranno perse se non le salvi.`
      : 'Le modifiche al documento andranno perse se non le salvi.',
  });

  if (response === 2) return false; // Cancel
  if (response === 1) return true; // Don't save
  // Save
  const saved = await doSave(false);
  return saved;
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

async function doOpen() {
  if (!mainWindow) return;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Apri un file Markdown',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx', 'txt'] },
      { name: 'Tutti i file', extensions: ['*'] },
    ],
  });
  if (canceled || !filePaths.length) return;
  openPathInRenderer(filePaths[0]);
}

/** Save to the current path, or prompt for a location. Returns true if saved. */
async function doSave(forceDialog) {
  const state = await rendererState();
  let targetPath = state.path;

  if (forceDialog || !targetPath) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Salva il documento',
      defaultPath: targetPath || 'Senza titolo.md',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    if (canceled || !filePath) return false;
    targetPath = filePath;
  }

  try {
    const data = state.markdown.endsWith('\n') ? state.markdown : state.markdown + '\n';
    fs.writeFileSync(targetPath, data, 'utf8');
    app.addRecentDocument(targetPath);
    mainWindow.webContents.send('saved', { path: targetPath });
    return true;
  } catch (err) {
    dialog.showErrorBox('Impossibile salvare il file', String(err && err.message || err));
    return false;
  }
}

async function doExportPDF() {
  if (!mainWindow) return;
  const state = await rendererState();
  const defaultPath = state.path
    ? state.path.replace(/\.[^./]+$/, '') + '.pdf'
    : 'Documento.pdf';

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Esporta in PDF',
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return;

  try {
    const data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.7, right: 0.7 },
    });
    fs.writeFileSync(filePath, data);
    shell.showItemInFolder(filePath);
  } catch (err) {
    dialog.showErrorBox('Esportazione non riuscita', String((err && err.message) || err));
  }
}

function newDocument() {
  if (mainWindow) mainWindow.webContents.send('menu', 'new');
}

function sendFormat(cmd) {
  if (mainWindow) mainWindow.webContents.send('menu', cmd);
}

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about', label: 'Informazioni su Inkdown' },
            { type: 'separator' },
            { role: 'hide', label: 'Nascondi Inkdown' },
            { role: 'hideOthers', label: 'Nascondi altre' },
            { role: 'unhide', label: 'Mostra tutte' },
            { type: 'separator' },
            { role: 'quit', label: 'Esci da Inkdown' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'Nuovo', accelerator: 'CmdOrCtrl+N', click: newDocument },
        { label: 'Apri…', accelerator: 'CmdOrCtrl+O', click: doOpen },
        {
          role: 'recentDocuments',
          label: 'Apri recenti',
          submenu: [{ role: 'clearRecentDocuments', label: 'Svuota recenti' }],
        },
        { type: 'separator' },
        { label: 'Salva', accelerator: 'CmdOrCtrl+S', click: () => doSave(false) },
        { label: 'Salva con nome…', accelerator: 'Shift+CmdOrCtrl+S', click: () => doSave(true) },
        { type: 'separator' },
        { label: 'Esporta in PDF…', accelerator: 'CmdOrCtrl+P', click: doExportPDF },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Chiudi finestra' } : { role: 'quit', label: 'Esci' },
      ],
    },
    {
      label: 'Modifica',
      submenu: [
        { label: 'Annulla', accelerator: 'CmdOrCtrl+Z', click: () => sendFormat('undo') },
        { label: 'Ripeti', accelerator: 'Shift+CmdOrCtrl+Z', click: () => sendFormat('redo') },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'pasteAndMatchStyle', label: 'Incolla senza formato' },
        { role: 'selectAll', label: 'Seleziona tutto' },
        { type: 'separator' },
        { label: 'Trova e sostituisci…', accelerator: 'CmdOrCtrl+F', click: () => sendFormat('find') },
      ],
    },
    {
      label: 'Formato',
      submenu: [
        { label: 'Grassetto', accelerator: 'CmdOrCtrl+B', click: () => sendFormat('bold') },
        { label: 'Corsivo', accelerator: 'CmdOrCtrl+I', click: () => sendFormat('italic') },
        { label: 'Sottolineato', accelerator: 'CmdOrCtrl+U', click: () => sendFormat('underline') },
        { label: 'Barrato', accelerator: 'Shift+CmdOrCtrl+X', click: () => sendFormat('strike') },
        { label: 'Codice', accelerator: 'CmdOrCtrl+E', click: () => sendFormat('code') },
        { label: 'Evidenzia', accelerator: 'Shift+CmdOrCtrl+H', click: () => sendFormat('highlight') },
        { type: 'separator' },
        { label: 'Titolo 1', accelerator: 'CmdOrCtrl+1', click: () => sendFormat('h1') },
        { label: 'Titolo 2', accelerator: 'CmdOrCtrl+2', click: () => sendFormat('h2') },
        { label: 'Titolo 3', accelerator: 'CmdOrCtrl+3', click: () => sendFormat('h3') },
        { label: 'Corpo del testo', accelerator: 'CmdOrCtrl+Alt+0', click: () => sendFormat('paragraph') },
        { type: 'separator' },
        { label: 'Elenco puntato', accelerator: 'Shift+CmdOrCtrl+8', click: () => sendFormat('bulletList') },
        { label: 'Elenco numerato', accelerator: 'Shift+CmdOrCtrl+7', click: () => sendFormat('orderedList') },
        { label: 'Elenco di attività', accelerator: 'Shift+CmdOrCtrl+9', click: () => sendFormat('taskList') },
        { label: 'Citazione', accelerator: 'Shift+CmdOrCtrl+B', click: () => sendFormat('blockquote') },
        { label: 'Blocco di codice', accelerator: 'Shift+CmdOrCtrl+C', click: () => sendFormat('codeBlock') },
        { label: 'Linea orizzontale', click: () => sendFormat('hr') },
        { type: 'separator' },
        { label: 'Inserisci link…', accelerator: 'CmdOrCtrl+K', click: () => sendFormat('link') },
      ],
    },
    {
      label: 'Vista',
      submenu: [
        { label: 'Aumenta dimensione testo', accelerator: 'CmdOrCtrl+Plus', click: () => sendFormat('fontUp') },
        { label: 'Riduci dimensione testo', accelerator: 'CmdOrCtrl+-', click: () => sendFormat('fontDown') },
        { label: 'Dimensione predefinita', accelerator: 'CmdOrCtrl+0', click: () => sendFormat('fontReset') },
        { type: 'separator' },
        { label: 'Tema chiaro/scuro', accelerator: 'Shift+CmdOrCtrl+L', click: () => sendFormat('toggleTheme') },
        { label: 'Carattere serif/sans', accelerator: 'Shift+CmdOrCtrl+F', click: () => sendFormat('toggleFont') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' },
        ...(isDev ? [{ role: 'toggleDevTools', label: 'Strumenti sviluppatore' }, { role: 'reload', label: 'Ricarica' }] : []),
      ],
    },
    {
      role: 'window',
      label: 'Finestra',
      submenu: [
        { role: 'minimize', label: 'Riduci a icona' },
        { role: 'zoom', label: 'Zoom' },
        { role: 'front', label: 'Porta tutto in primo piano' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC from renderer
// ---------------------------------------------------------------------------

ipcMain.handle('app:open', () => doOpen());
ipcMain.handle('app:save', () => doSave(false));
ipcMain.handle('app:saveAs', () => doSave(true));

ipcMain.handle('app:confirmDiscard', async () => {
  const state = await rendererState();
  if (!state.dirty) return true;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Salva', 'Non salvare', 'Annulla'],
    defaultId: 0,
    cancelId: 2,
    message: 'Vuoi salvare le modifiche prima di continuare?',
    detail: 'Le modifiche non salvate andranno perse.',
  });
  if (response === 2) return false;
  if (response === 1) return true;
  return await doSave(false);
});

ipcMain.on('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text || ''));
});

ipcMain.on('title:update', (_e, title) => {
  if (mainWindow) mainWindow.setTitle(title || 'Inkdown');
});

ipcMain.on('document:represented', (_e, filePath) => {
  if (mainWindow && process.platform === 'darwin') {
    mainWindow.setRepresentedFilename(filePath || '');
    mainWindow.setDocumentEdited(false);
  }
});

ipcMain.on('document:edited', (_e, edited) => {
  if (mainWindow && process.platform === 'darwin') {
    mainWindow.setDocumentEdited(!!edited);
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// macOS "Open With" / double-click on a file.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    openPathInRenderer(filePath);
  } else {
    pendingOpenPath = filePath;
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const fileArg = argv.find((a) => /\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(a));
    if (fileArg && fs.existsSync(fileArg)) openPathInRenderer(fileArg);
  });

  app.whenReady().then(() => {
    // Pick up a file passed as a CLI argument (e.g. opened from Finder on first launch).
    const fileArg = process.argv.find((a) => /\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(a));
    if (fileArg && fs.existsSync(fileArg)) pendingOpenPath = fileArg;

    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
