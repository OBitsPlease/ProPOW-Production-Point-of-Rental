const path = require('path')
const fs = require('fs')
const { getDb } = require('./db')
let chokidarWatcher = null
let mainWindowRef = null

function registerIpcHandlers(ipcMain, dialog, shell, win) {
  mainWindowRef = win

  ipcMain.handle('trucks:getAll', () => getDb().trucks.getAll())

  ipcMain.handle('trucks:save', (_, truck) => {
    const db = getDb()
    if (truck.id) {
      const idx = db.data.trucks.findIndex(t => t.id === truck.id)
      if (idx !== -1) db.data.trucks[idx] = { ...db.data.trucks[idx], ...truck }
      db.save()
      return truck.id
    } else {
      const id = db.nextId('trucks')
      db.data.trucks.push({ id, name: truck.name, length: truck.length, width: truck.width,
        height: truck.height, max_weight: truck.max_weight, unit: truck.unit || 'in', notes: truck.notes || '' })
      db.save()
      return id
    }
  })

  ipcMain.handle('trucks:delete', (_, id) => {
    const db = getDb()
    db.data.trucks = db.data.trucks.filter(t => t.id !== id)
    db.save()
    return true
  })

  ipcMain.handle('departments:getAll', () => getDb().departments.getAll())

  ipcMain.handle('departments:save', (_, dept) => {
    const db = getDb()
    if (dept.id) {
      const idx = db.data.departments.findIndex(d => d.id === dept.id)
      if (idx !== -1) db.data.departments[idx] = { ...db.data.departments[idx], ...dept }
      db.save()
      return dept.id
    } else {
      const id = db.nextId('departments')
      db.data.departments.push({ id, name: dept.name, color: dept.color || '#4f8ef7' })
      db.save()
      return id
    }
  })

  ipcMain.handle('departments:delete', (_, id) => {
    const db = getDb()
    db.data.departments = db.data.departments.filter(d => d.id !== id)
    db.save()
    return true
  })

  ipcMain.handle('items:getAll', () => getDb().items.getAll())

  ipcMain.handle('items:save', (_, item) => {
    const db = getDb()
    if (item.id) {
      const idx = db.data.items.findIndex(i => i.id === item.id)
      if (idx !== -1) db.data.items[idx] = { ...db.data.items[idx], ...item, department_id: item.department_id ? parseInt(item.department_id) : null }
      db.save()
      return item.id
    } else {
      const id = db.nextId('items')
      db.data.items.push({
        id, name: item.name, sku: item.sku || '',
        department_id: item.department_id ? parseInt(item.department_id) : null,
        length: item.length, width: item.width, height: item.height,
        weight: item.weight || 0, quantity: item.quantity || 1,
        can_rotate_lr:        item.can_rotate_lr        !== undefined ? item.can_rotate_lr        : 1,
        can_tip_side:         item.can_tip_side         !== undefined ? item.can_tip_side         : 1,
        can_flip:             item.can_flip             !== undefined ? item.can_flip             : 1,
        can_stack_on_others:  item.can_stack_on_others  !== undefined ? item.can_stack_on_others  : 1,
        allow_stacking_on_top:item.allow_stacking_on_top!== undefined ? item.allow_stacking_on_top: 1,
        max_stack_weight:     item.max_stack_weight     || 0,
        notes: item.notes || ''
      })
      db.save()
      return id
    }
  })

  ipcMain.handle('items:delete', (_, id) => {
    const db = getDb()
    db.data.items = db.data.items.filter(i => i.id !== id)
    db.save()
    return true
  })

  ipcMain.handle('items:clear', () => {
    const db = getDb()
    db.data.items = []
    db.save()
    return true
  })

  ipcMain.handle('plans:getAll', () => getDb().plans.getAll())

  ipcMain.handle('plans:get', (_, id) => {
    const db = getDb()
    const plan = db.data.plans.find(p => p.id === id)
    if (!plan) return null
    const truck = db.data.trucks.find(t => t.id === plan.truck_id) || {}
    return {
      ...plan, truck_name: truck.name, truck_length: truck.length,
      truck_width: truck.width, truck_height: truck.height,
      truck_max_weight: truck.max_weight, truck_unit: truck.unit
    }
  })

  ipcMain.handle('plans:save', (_, plan) => {
    const db = getDb()
    const now = new Date().toISOString()
    if (plan.id) {
      const idx = db.data.plans.findIndex(p => p.id === plan.id)
      if (idx !== -1) db.data.plans[idx] = { ...db.data.plans[idx], ...plan, updated_at: now }
      db.save()
      return plan.id
    } else {
      const id = db.nextId('plans')
      db.data.plans.push({
        id, name: plan.name, truck_id: plan.truck_id,
        result_json: plan.result_json, utilization: plan.utilization,
        total_weight: plan.total_weight, created_at: now, updated_at: now
      })
      db.save()
      return id
    }
  })

  ipcMain.handle('plans:delete', (_, id) => {
    const db = getDb()
    db.data.plans = db.data.plans.filter(p => p.id !== id)
    db.save()
    return true
  })

  ipcMain.handle('plans:deleteAll', () => {
    const db = getDb()
    db.data.plans = []
    db.save()
    return true
  })

  ipcMain.handle('items:deleteAll', () => {
    const db = getDb()
    db.data.items = []
    db.save()
    return true
  })

  ipcMain.handle('import:excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Items from Excel',
      filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return null
    const XLSX = require('xlsx')
    const wb = XLSX.readFile(filePaths[0])
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(ws, { defval: '' })
  })

  ipcMain.handle('import:inventory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import from Inventory App (JSON/CSV)',
      filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return null
    return parseInventoryFile(filePaths[0])
  })

  ipcMain.handle('watch:setFolder', (_, folderPath) => {
    const db = getDb()
    db.data.settings.watch_folder = folderPath
    db.save()
    startWatcher(folderPath)
    return true
  })

  ipcMain.handle('watch:getFolder', () => {
    return getDb().data.settings.watch_folder || null
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('export:pdf', async (_, planId) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Load Plan PDF',
      defaultPath: 'load-plan-' + planId + '.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return null
    return filePath
  })

  // RePack Presets — stored in userData/repacks/
  const repPath = () => {
    const { app } = require('electron')
    const p = require('path').join(app.getPath('userData'), 'repacks')
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    return p
  }

  ipcMain.handle('repack:list', () => {
    const dir = repPath()
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.truckpack'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
          return { filename: f, name: data.name, savedAt: data.savedAt, truck: data.truck?.name }
        } catch(e) { return null }
      }).filter(Boolean)
  })

  ipcMain.handle('repack:save', (_, { name, data }) => {
    const filename = name.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_') + '.truckpack'
    const filePath = path.join(repPath(), filename)
    fs.writeFileSync(filePath, JSON.stringify({ ...data, type: 'repack', name, savedAt: new Date().toISOString() }, null, 2))
    return filename
  })

  ipcMain.handle('repack:load', (_, filename) => {
    const filePath = path.join(repPath(), filename)
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  })

  ipcMain.handle('repack:delete', (_, filename) => {
    const filePath = path.join(repPath(), filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return true
  })

  ipcMain.handle('file:saveAs', async (_, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Pack File',
      defaultPath: (data.name || 'pack').replace(/[^a-z0-9_\s]/gi, '_') + '.truckpack',
      filters: [{ name: 'Truck Pack File', extensions: ['truckpack'] }]
    })
    if (canceled || !filePath) return null
    fs.writeFileSync(filePath, JSON.stringify({ ...data, type: 'savefile', savedAt: new Date().toISOString() }, null, 2))
    return filePath
  })

  ipcMain.handle('file:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Pack File',
      filters: [{ name: 'Truck Pack File', extensions: ['truckpack'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths.length) return null
    return JSON.parse(fs.readFileSync(filePaths[0], 'utf8'))
  })

  ipcMain.handle('file:openFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Pack Files Folder',
      filters: [{ name: 'Truck Pack File', extensions: ['truckpack'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (canceled || !filePaths.length) return []
    return filePaths.map(fp => {
      try { return { filePath: fp, ...JSON.parse(fs.readFileSync(fp, 'utf8')) } } catch(e) { return null }
    }).filter(Boolean)
  })
}

function parseInventoryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  try {
    if (ext === '.json') return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (ext === '.csv') {
      const XLSX = require('xlsx')
      const wb = XLSX.readFile(filePath)
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    }
  } catch (e) {
    return { error: e.message }
  }
  return null
}

function startWatcher(folderPath) {
  if (chokidarWatcher) chokidarWatcher.close()
  const chokidar = require('chokidar')
  chokidarWatcher = chokidar.watch(folderPath, {
    ignored: /[/\\]\./,
    persistent: true,
    ignoreInitial: true,
  })
  chokidarWatcher.on('add', (filePath) => {
    if (!['.json', '.csv'].includes(path.extname(filePath).toLowerCase())) return
    try {
      const importedData = parseInventoryFile(filePath)
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('inventory:imported', { data: importedData, filePath })
      }
    } catch (e) {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('inventory:error', e.message)
      }
    }
  })
}

module.exports = { registerIpcHandlers }
