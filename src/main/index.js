const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const http = require('http')
const { autoUpdater } = require('electron-updater')
const { setupDatabase } = require('./db')
const { registerIpcHandlers } = require('./ipc-handlers')

let mainWindow

// Auto-detect dev mode: try connecting to Vite dev server
function checkViteRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5173', (res) => {
      resolve(res.statusCode < 500)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => { req.destroy(); resolve(false) })
  })
}

async function createWindow() {
  const isDev = await checkViteRunning()

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    icon: path.join(__dirname, '../../assets/installer/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  setupDatabase()
  registerIpcHandlers(ipcMain, dialog, shell, mainWindow)

  // Sync handler: renderer can request the app version
  ipcMain.on('app:getVersion', (e) => { e.returnValue = app.getVersion() })

  createWindow()

  // Auto-updater setup (runs after window is created)
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null // silence to avoid noise in prod

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('updater:update-available', info)
  })
  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('updater:not-available')
  })
  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) mainWindow.webContents.send('updater:progress', progress)
  })
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('updater:downloaded', info)
  })
  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('updater:error', err.message)
  })

  // IPC: manual check
  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      if (mainWindow) mainWindow.webContents.send('updater:error', e.message)
    }
  })

  // IPC: download update
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (e) {
      if (mainWindow) mainWindow.webContents.send('updater:error', e.message)
    }
  })

  // IPC: quit and install
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  // Auto-check on startup (renderer tells us whether auto-update is enabled)
  ipcMain.handle('updater:startAutoCheck', async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      // Silently ignore auto-check failures
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

