/**
 * test-splash.js — Local splash screen preview (no build needed)
 * Run with:  npx electron test-splash.js
 *
 * Simulates EXACTLY what the packaged app does:
 *  - registers app:// protocol to serve splash.png
 *  - loads splash.html which uses app://splash-bg as background
 * If this looks correct on Mac, it will work on Windows too.
 */
const { app, BrowserWindow, protocol, screen } = require('electron')
const path = require('path')
const fs = require('fs')

app.whenReady().then(() => {
  const splashImgPath = path.join(__dirname, 'assets/splash.png')
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

  const { width, height } = screen.getPrimaryDisplay().bounds
  const win = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, resizable: false, alwaysOnTop: true,
    backgroundColor: '#0a0a14',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  win.loadFile(path.join(__dirname, 'src/main/splash.html'))
  win.webContents.once('did-finish-load', () => console.log('✓ splash loaded'))

  setTimeout(() => app.quit(), 9000)
})
