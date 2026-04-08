console.log('process.type:', process.type)
console.log('process.versions.electron:', process.versions?.electron)

// Try to get electron via its compiled-in module path
const Module = require('module')
const originalResolve = Module._resolveFilename
console.log('builtinModules includes electron?', require('module').builtinModules.includes('electron'))

// Try direct path into Electron framework
try {
  const api = process.electronBinding('app')
  console.log('electronBinding app:', typeof api)
} catch(e) {
  console.log('electronBinding failed:', e.message)
}

setTimeout(() => process.exit(0), 500)
