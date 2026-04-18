const { app, BrowserWindow, protocol, ipcMain, dialog, shell, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn } = require('child_process')
const { autoUpdater } = require('electron-updater')
const { setupDatabase } = require('./db')
const { registerIpcHandlers } = require('./ipc-handlers')
const { startHttpServer, PORT: HTTP_PORT } = require('./http-server')

let cloudflaredProcess = null
let httpServer = null
let currentTunnelUrl = null

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
    splashWindow.loadFile(path.join(__dirname, 'splash.html'))
    splashWindow.on('closed', () => { splashWindow = null })
  }

  // ── Main window (hidden until content is ready) ────────────────────────────
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'ProPOR+',
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

// ── Cloudflare Tunnel ─────────────────────────────────────────────────────────
function findCloudflared() {
  // 1. Prefer bundled binary shipped with the app.
  //    On Windows the installer extracts to Program Files which may be read-only,
  //    so we copy the binary to userData on first use so it can always be executed.
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const ext  = process.platform === 'win32' ? '.exe' : ''
  const platform = process.platform === 'win32' ? 'windows' : 'darwin'
  const bundledName = `cloudflared-${platform}-${arch}${ext}`

  const sourcePath = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', bundledName)
    : path.join(__dirname, '../../assets/bin', bundledName)

  if (fs.existsSync(sourcePath)) {
    // On Windows: copy to userData so the binary is always writable/executable
    if (process.platform === 'win32') {
      try {
        const destDir = path.join(app.getPath('userData'), 'bin')
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
        const destPath = path.join(destDir, bundledName)
        if (!fs.existsSync(destPath)) fs.copyFileSync(sourcePath, destPath)
        return destPath
      } catch (e) {
        console.warn('[cloudflared] Could not copy binary to userData:', e.message)
        return sourcePath
      }
    }
    // macOS/Linux: ensure executable, strip quarantine
    try { fs.chmodSync(sourcePath, 0o755) } catch (_) {}
    try { require('child_process').execFileSync('xattr', ['-d', 'com.apple.quarantine', sourcePath], { stdio: 'ignore' }) } catch (_) {}
    return sourcePath
  }

  // 2. System installs (Homebrew / PATH)
  for (const c of ['/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared', '/usr/bin/cloudflared', 'cloudflared']) {
    if (c.startsWith('/') && !fs.existsSync(c)) continue
    return c
  }
  return null
}

// Spawn cloudflared and wire up stdout/stderr to capture the tunnel URL
function spawnTunnel(bin, urlFile) {
  cloudflaredProcess = spawn(bin, ['tunnel', '--url', `http://localhost:${HTTP_PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let tunnelUrl = null
  const urlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

  const onData = (data) => {
    const text = data.toString()
    const match = text.match(urlRegex)
    if (match && !tunnelUrl) {
      tunnelUrl = match[0]
      currentTunnelUrl = tunnelUrl
      console.log('[cloudflared] Tunnel URL:', tunnelUrl)
      const content = [
        'ProPOR+ Remote Access',
        '======================',
        '',
        'Your app is accessible at:',
        '',
        '  ' + tunnelUrl,
        '',
        'Share this URL with anyone who needs access.',
        'This URL changes each time the app is launched.',
        '',
        'Note: File attachments, Excel import/export, and PDF export',
        'are only available on the master computer.',
        '',
        'Generated: ' + new Date().toLocaleString(),
      ].join('\n')
      fs.writeFileSync(urlFile, content, 'utf8')
      shell.openPath(urlFile)
      // Notify renderer (Settings page) so it can display the URL live
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tunnel:urlReady', tunnelUrl)
      }
    }
  }

  cloudflaredProcess.stdout.on('data', onData)
  cloudflaredProcess.stderr.on('data', onData)
  cloudflaredProcess.on('error', (err) => {
    console.error('[cloudflared] Spawn error:', err.message)
    cloudflaredProcess = null
  })
  cloudflaredProcess.on('exit', (code) => {
    console.log('[cloudflared] Exited with code', code)
    cloudflaredProcess = null
  })
}

// Install cloudflared via Homebrew silently in the background, then launch tunnel
function installViaBrewThenLaunch(urlFile) {
  console.log('[cloudflared] Attempting silent brew install...')

  // Find brew executable
  const brewBin = fs.existsSync('/opt/homebrew/bin/brew')
    ? '/opt/homebrew/bin/brew'
    : fs.existsSync('/usr/local/bin/brew')
      ? '/usr/local/bin/brew'
      : 'brew'

  const brew = spawn(brewBin, ['install', 'cloudflared'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_ANALYTICS: '1' },
  })

  brew.on('error', (err) => {
    console.warn('[cloudflared] brew install failed:', err.message)
  })

  brew.on('exit', (code) => {
    if (code === 0) {
      console.log('[cloudflared] brew install succeeded, starting tunnel...')
      const bin = findCloudflared()
      if (bin) spawnTunnel(bin, urlFile)
    } else {
      console.warn('[cloudflared] brew install exited with code', code)
    }
  })
}

function startCloudflaredTunnel() {
  const urlFile = path.join(app.getPath('userData'), 'remote-access.txt')
  const bin = findCloudflared()

  if (bin) {
    console.log('[cloudflared] Using binary:', bin)
    spawnTunnel(bin, urlFile)
  } else if (process.platform === 'darwin') {
    // No binary found — try installing via Homebrew silently
    console.log('[cloudflared] Binary not found, trying brew install...')
    installViaBrewThenLaunch(urlFile)
  } else {
    console.warn('[cloudflared] No binary found and auto-install not supported on this platform')
  }
}

app.whenReady().then(async () => {
  setupDatabase()
  registerIpcHandlers(ipcMain, dialog, shell, mainWindow)

  // Sync handler: renderer can request the app version
  ipcMain.on('app:getVersion', (e) => { e.returnValue = app.getVersion() })

  // Tunnel URL — renderer can poll for the current URL
  ipcMain.handle('tunnel:getUrl', () => currentTunnelUrl || null)

  // ── Custom app:// protocol — serves splash.png without any file:// URL ─────
  const splashImgPath = app.isPackaged
    ? path.join(process.resourcesPath, 'splash.png')
    : path.join(__dirname, '../../assets/splash.png')
  protocol.handle('app', (request) => {
    if (new URL(request.url).hostname === 'splash-bg') {
      try {
        const data = fs.readFileSync(splashImgPath)
        return new Response(data, { headers: { 'content-type': 'image/png' } })
      } catch (e) {
        return new Response('Not found', { status: 404 })
      }
    }
    return new Response('Not found', { status: 404 })
  })

  const isDev = await createWindow()

  // ── Start local HTTP server (serves dist/ + REST API for browser access) ────
  const distDir = app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'dist')
    : path.join(__dirname, '../../dist')
  httpServer = startHttpServer(distDir)

  // ── Start Cloudflare Quick Tunnel ────────────────────────────────────────────
  // Give the HTTP server a moment to bind before connecting the tunnel
  setTimeout(startCloudflaredTunnel, 1500)

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

app.on('will-quit', () => {
  if (cloudflaredProcess) {
    cloudflaredProcess.kill()
    cloudflaredProcess = null
  }
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }
})

