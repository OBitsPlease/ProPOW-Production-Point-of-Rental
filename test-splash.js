/**
 * test-splash.js — Local splash screen preview (no build needed)
 * Run with:  npx electron test-splash.js
 *
 * Simulates EXACTLY what the packaged app does:
 *  - reads assets/splash.png from disk
 *  - converts to base64 data URL
 *  - injects it into splash.html via executeJavaScript
 * If this looks correct on Mac, it will work on Windows too.
 */
const { app, BrowserWindow, screen } = require('electron')
const path = require('path')
const fs = require('fs')

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().bounds
  const win = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, resizable: false, alwaysOnTop: true,
    backgroundColor: '#0a0a14',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  win.loadFile(path.join(__dirname, 'src/main/splash.html'))

  win.webContents.once('did-finish-load', () => {
    try {
      const imgPath = path.join(__dirname, 'assets/splash.png')
      const data = fs.readFileSync(imgPath)
      const dataUrl = 'data:image/png;base64,' + data.toString('base64')
      win.webContents.executeJavaScript(`setSplashBg(${JSON.stringify(dataUrl)})`)
      console.log('✓ splash.png loaded and injected successfully')
    } catch (e) {
      console.error('✗ Failed to load splash.png:', e.message)
    }
  })

  setTimeout(() => app.quit(), 9000)
})
