const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')
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

  // ── Splash window ──────────────────────────────────────────────────────────
  // Full-screen splash using primary display dimensions.
  // No transparency — transparent windows break on many Windows GPU drivers.
  let splashWindow = null
  if (!isDev) {
    const { width, height } = screen.getPrimaryDisplay().bounds
    splashWindow = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#0a0a14',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
    const splashImgPath = app.isPackaged
      ? path.join(process.resourcesPath, 'splash.png')
      : path.join(__dirname, '../../assets/splash.png')
    splashWindow.loadFile(path.join(__dirname, 'splash.html'))
    splashWindow.webContents.once('did-finish-load', () => {
      try {
        const fs = require('fs')
        const data = fs.readFileSync(splashImgPath)
        const dataUrl = 'data:image/png;base64,' + data.toString('base64')
        splashWindow.webContents.executeJavaScript(`setSplashBg(${JSON.stringify(dataUrl)})`)
      } catch (e) { /* no background — still shows bar + credit */ }
    })
    splashWindow.on('closed', () => { splashWindow = null })
  }

  // ── Main window (hidden until content is ready) ────────────────────────────
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,               // keep hidden until ready-to-show fires
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

  // Show main window + close splash once the first frame has rendered.
  // Enforce a minimum of 7 s so the full progress bar animation plays.
  const splashStart = Date.now()
  const MIN_SPLASH_MS = 7000

  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - splashStart
    const delay = Math.max(0, MIN_SPLASH_MS - elapsed)
    setTimeout(() => {
      mainWindow.show()
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
      }
    }, delay)
  })

  mainWindow.on('closed', () => { mainWindow = null })

  return isDev
}

app.whenReady().then(async () => {
  setupDatabase()
  registerIpcHandlers(ipcMain, dialog, shell, mainWindow)

  // Sync handler: renderer can request the app version
  ipcMain.on('app:getVersion', (e) => { e.returnValue = app.getVersion() })

  const isDev = await createWindow()

  // Auto-updater setup — only in production builds; skip in dev
  if (!isDev) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = null

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
      // Provide a friendlier message for common network/config failures
      let msg = err.message || String(err)
      if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('net::ERR')) {
        msg = 'Cannot reach update server. Check your internet connection and try again.'
      } else if (msg.includes('404') || msg.includes('releases') || msg.includes('latest.yml')) {
        msg = 'No published releases found for this version channel. Updates will be available once a release is published.'
      }
      if (mainWindow) mainWindow.webContents.send('updater:error', msg)
    })

    ipcMain.handle('updater:check', async () => {
      try {
        await autoUpdater.checkForUpdates()
      } catch (e) {
        let msg = e.message || String(e)
        if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
          msg = 'Cannot reach update server. Check your internet connection and try again.'
        } else if (msg.includes('404') || msg.includes('latest.yml')) {
          msg = 'No published releases found. Updates will appear here when available.'
        }
        if (mainWindow) mainWindow.webContents.send('updater:error', msg)
      }
    })

    ipcMain.handle('updater:download', async () => {
      try {
        await autoUpdater.downloadUpdate()
      } catch (e) {
        if (mainWindow) mainWindow.webContents.send('updater:error', e.message)
      }
    })

    ipcMain.handle('updater:install', () => {
      autoUpdater.quitAndInstall()
    })

    ipcMain.handle('updater:startAutoCheck', async () => {
      try {
        await autoUpdater.checkForUpdates()
      } catch {
        // Silently ignore auto-check failures on startup
      }
    })
  } else {
    // In dev: register stub handlers so renderer doesn't get unhandled invoke errors
    for (const ch of ['updater:check', 'updater:download', 'updater:install', 'updater:startAutoCheck']) {
      ipcMain.handle(ch, () => {})
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

