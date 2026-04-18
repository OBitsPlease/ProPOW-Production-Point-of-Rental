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

// Download a file following redirects
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const https = require('https')
    const file = fs.createWriteStream(dest)
    const cleanup = () => { try { fs.unlinkSync(dest) } catch (_) {} }

    const doGet = (urlStr) => {
      https.get(urlStr, { timeout: 30000 }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          res.resume()
          return doGet(res.headers.location)
        }
        if (res.statusCode !== 200) {
          file.close(); cleanup()
          return reject(new Error(`HTTP ${res.statusCode} downloading cloudflared`))
        }
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', (e) => { file.close(); cleanup(); reject(e) })
      }).on('error', (e) => { file.close(); cleanup(); reject(e) })
    }
    doGet(url)
  })
}

// Ensure cloudflared binary is ready to execute — async so we can download if needed
async function prepareCloudflaredBin() {
  const isWin = process.platform === 'win32'
  const ext = isWin ? '.exe' : ''
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const platform = isWin ? 'windows' : 'darwin'
  const bundledName = `cloudflared-${platform}-${arch}${ext}`

  const cacheDir = path.join(app.getPath('userData'), 'bin')
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
  const cachePath = path.join(cacheDir, bundledName)

  const unblock = (p) => {
    if (isWin) {
      // Remove Zone.Identifier ADS so Windows SmartScreen doesn't block execution
      try {
        require('child_process').execFileSync(
          'powershell',
          ['-NoProfile', '-NonInteractive', '-Command', `Unblock-File -LiteralPath "${p}"`],
          { stdio: 'ignore', timeout: 15000 }
        )
      } catch (_) {}
    } else {
      try { fs.chmodSync(p, 0o755) } catch (_) {}
      try { require('child_process').execFileSync('xattr', ['-d', 'com.apple.quarantine', p], { stdio: 'ignore' }) } catch (_) {}
    }
  }

  // 1. Already cached in userData — just unblock and return
  if (fs.existsSync(cachePath)) {
    unblock(cachePath)
    return cachePath
  }

  // 2. Try bundled binary shipped in resources/bin
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, 'bin', bundledName)
    : path.join(__dirname, '../../assets/bin', bundledName)

  if (fs.existsSync(bundledPath)) {
    try {
      fs.copyFileSync(bundledPath, cachePath)
      unblock(cachePath)
      console.log('[cloudflared] Using bundled binary:', cachePath)
      return cachePath
    } catch (e) {
      console.warn('[cloudflared] Could not copy bundled binary:', e.message)
      try { fs.unlinkSync(cachePath) } catch (_) {}
    }
  }

  // 3. Download directly from GitHub releases
  const dlUrl = `https://github.com/cloudflare/cloudflared/releases/latest/download/${bundledName}`
  console.log('[cloudflared] Downloading from', dlUrl)
  try {
    await downloadFile(dlUrl, cachePath)
    unblock(cachePath)
    console.log('[cloudflared] Download complete:', cachePath)
    return cachePath
  } catch (e) {
    console.error('[cloudflared] Download failed:', e.message)
    return null
  }
}

// Spawn cloudflared and wire up stdout/stderr to capture the tunnel URL
let _tunnelBin = null
let _tunnelUrlFile = null
let _tunnelRestarting = false

function spawnTunnel(bin, urlFile) {
  _tunnelBin = bin
  _tunnelUrlFile = urlFile
  cloudflaredProcess = spawn(bin, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${HTTP_PORT}`], {
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
    // Auto-restart unless the app is quitting or we already scheduled a restart
    if (!_tunnelRestarting && _tunnelBin && !app.isQuitting) {
      _tunnelRestarting = true
      console.log('[cloudflared] Will restart in 3 seconds...')
      setTimeout(() => {
        _tunnelRestarting = false
        if (_tunnelBin && !app.isQuitting) {
          console.log('[cloudflared] Restarting...')
          spawnTunnel(_tunnelBin, _tunnelUrlFile)
        }
      }, 3000)
    }
  })
}

// Install cloudflared via Homebrew silently in the background, then launch tunnel (macOS only)
function installViaBrewThenLaunch(urlFile) {
  console.log('[cloudflared] Attempting silent brew install...')
  const brewBin = fs.existsSync('/opt/homebrew/bin/brew')
    ? '/opt/homebrew/bin/brew'
    : fs.existsSync('/usr/local/bin/brew')
      ? '/usr/local/bin/brew'
      : 'brew'

  const brew = spawn(brewBin, ['install', 'cloudflared'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOMEBREW_NO_AUTO_UPDATE: '1', HOMEBREW_NO_ANALYTICS: '1' },
  })
  brew.on('error', (err) => { console.warn('[cloudflared] brew install failed:', err.message) })
  brew.on('exit', async (code) => {
    if (code === 0) {
      console.log('[cloudflared] brew install succeeded, starting tunnel...')
      const bin = await prepareCloudflaredBin()
      if (bin) spawnTunnel(bin, urlFile)
    } else {
      console.warn('[cloudflared] brew install exited with code', code)
    }
  })
}

async function startCloudflaredTunnel() {
  const urlFile = path.join(app.getPath('userData'), 'remote-access.txt')
  const bin = await prepareCloudflaredBin()

  if (bin) {
    spawnTunnel(bin, urlFile)
  } else if (process.platform === 'darwin') {
    // prepareCloudflaredBin already tried download; try brew as last resort
    console.log('[cloudflared] Trying brew as last resort...')
    installViaBrewThenLaunch(urlFile)
  } else {
    console.warn('[cloudflared] Could not obtain cloudflared binary on this platform')
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
  // dist/ is unpacked from asar so Node's plain fs can serve it over HTTP.
  // Try app.asar.unpacked first (asarUnpack configured), fall back to getAppPath.
  let distDir
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist')
    distDir = fs.existsSync(unpacked) ? unpacked : path.join(app.getAppPath(), 'dist')
  } else {
    distDir = path.join(__dirname, '../../dist')
  }
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
  app.isQuitting = true
  _tunnelBin = null
  if (cloudflaredProcess) {
    cloudflaredProcess.kill()
    cloudflaredProcess = null
  }
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }
})

