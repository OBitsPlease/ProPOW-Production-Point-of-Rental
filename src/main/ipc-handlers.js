const path = require('path')
const fs = require('fs')
const { getDb } = require('./db')
let mainWindowRef = null

function registerIpcHandlers(ipcMain, dialog, shell, win) {
  mainWindowRef = win

  // Native confirm dialog — fixes Electron focus bug caused by window.confirm()
  ipcMain.handle('dialog:confirm', async (_, { message, detail }) => {
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Cancel', 'OK'],
      defaultId: 1,
      cancelId: 0,
      message: message || 'Are you sure?',
      detail: detail || '',
    })
    return result.response === 1
  })

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
        id, name: item.name, sku: item.sku || '', barcode: item.barcode || '',
        serial: item.serial || '',
        department_id: item.department_id ? parseInt(item.department_id) : null,
        length: item.length, width: item.width, height: item.height,
        weight: item.weight || 0, quantity: item.quantity || 1,
        unique_serials: item.unique_serials || 0,
        unit_serials:   Array.isArray(item.unit_serials) ? item.unit_serials : [],
        can_rotate_lr:        item.can_rotate_lr        !== undefined ? item.can_rotate_lr        : 1,
        can_tip_side:         item.can_tip_side         !== undefined ? item.can_tip_side         : 1,
        can_flip:             item.can_flip             !== undefined ? item.can_flip             : 1,
        can_stack_on_others:  item.can_stack_on_others  !== undefined ? item.can_stack_on_others  : 1,
        allow_stacking_on_top:item.allow_stacking_on_top!== undefined ? item.allow_stacking_on_top: 1,
        max_stack_weight:     item.max_stack_weight     || 0,
        group_id: item.group_id || null,
        case_id: item.case_id || null,
        case_qty: item.case_qty || 1,
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

  // ── Events ────────────────────────────────────────────────────────────────────
  const eventsDir = () => {
    const { app } = require('electron')
    const p = require('path').join(app.getPath('userData'), 'event-files')
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    return p
  }

  ipcMain.handle('events:getAll', () => {
    const db = getDb()
    if (!db.data.events) db.data.events = []
    return db.events.getAll()
  })

  ipcMain.handle('events:get', (_, id) => {
    const db = getDb()
    if (!db.data.events) db.data.events = []
    return db.data.events.find(e => e.id === id) || null
  })

  ipcMain.handle('events:save', (_, event) => {
    const db = getDb()
    if (!db.data.events) db.data.events = []
    const now = new Date().toISOString()
    if (event.id) {
      const idx = db.data.events.findIndex(e => e.id === event.id)
      if (idx !== -1) db.data.events[idx] = { ...db.data.events[idx], ...event, updated_at: now }
      else db.data.events.push({ ...event, updated_at: now })
      db.save()
      return event.id
    } else {
      const id = db.nextId('events')
      db.data.events.push({
        id,
        name: event.name || 'New Event',
        client: event.client || '',
        event_date: event.event_date || '',
        load_in: event.load_in || '',
        load_out: event.load_out || '',
        status: event.status || 'upcoming',
        notes: event.notes || '',
        // Venue
        venue_name: event.venue_name || '',
        venue_address: event.venue_address || '',
        venue_city: event.venue_city || '',
        venue_state: event.venue_state || '',
        venue_contact_name: event.venue_contact_name || '',
        venue_contact_phone: event.venue_contact_phone || '',
        venue_contact_email: event.venue_contact_email || '',
        venue_notes: event.venue_notes || '',
        // Hotel
        hotel_name: event.hotel_name || '',
        hotel_address: event.hotel_address || '',
        hotel_checkin: event.hotel_checkin || '',
        hotel_checkout: event.hotel_checkout || '',
        hotel_confirmation: event.hotel_confirmation || '',
        hotel_notes: event.hotel_notes || '',
        // Crew
        crew: Array.isArray(event.crew) ? event.crew : [],
        // Gear list (items for this event with per-event qty)
        gear: Array.isArray(event.gear) ? event.gear : [],
        // Attached files (stored in userData/event-files/<id>/)
        files: Array.isArray(event.files) ? event.files : [],
        created_at: now,
        updated_at: now,
      })
      db.save()
      return id
    }
  })

  ipcMain.handle('events:delete', (_, id) => {
    const db = getDb()
    if (!db.data.events) db.data.events = []
    db.data.events = db.data.events.filter(e => e.id !== id)
    // Remove attached files dir
    const dir = path.join(eventsDir(), String(id))
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    db.save()
    return true
  })

  // ── Item Groups ───────────────────────────────────────────────────────────────
  ipcMain.handle('groups:getAll', () => {
    const db = getDb()
    if (!db.data.item_groups) db.data.item_groups = []
    return [...db.data.item_groups]
  })

  ipcMain.handle('groups:save', (_, group) => {
    const db = getDb()
    if (!db.data.item_groups) db.data.item_groups = []
    if (group.id) {
      const idx = db.data.item_groups.findIndex(g => g.id === group.id)
      if (idx !== -1) db.data.item_groups[idx] = { ...db.data.item_groups[idx], ...group }
      else db.data.item_groups.push(group)
    } else {
      const id = db.nextId('item_groups')
      db.data.item_groups.push({ id, name: group.name, color: group.color || '#4f8ef7', parent_id: group.parent_id || null })
    }
    db.save()
    return group.id || db.data.item_groups[db.data.item_groups.length - 1].id
  })

  ipcMain.handle('groups:delete', (_, id) => {
    const db = getDb()
    if (!db.data.item_groups) db.data.item_groups = []
    const toDelete = new Set([id])
    db.data.item_groups.filter(g => g.parent_id === id).forEach(g => toDelete.add(g.id))
    db.data.item_groups = db.data.item_groups.filter(g => !toDelete.has(g.id))
    db.data.items = db.data.items.map(i => toDelete.has(i.group_id) ? { ...i, group_id: null } : i)
    db.save()
    return true
  })

  // ── Address Book ──────────────────────────────────────────────────────────────
  ipcMain.handle('addressBook:getAll', (_, type) => {
    const db = getDb()
    if (!db.data.address_book) db.data.address_book = []
    return db.address_book.getAll(type)
  })

  ipcMain.handle('addressBook:save', (_, entry) => {
    const db = getDb()
    if (!db.data.address_book) db.data.address_book = []
    const now = new Date().toISOString()
    if (entry.id) {
      const idx = db.data.address_book.findIndex(e => e.id === entry.id)
      if (idx !== -1) db.data.address_book[idx] = { ...db.data.address_book[idx], ...entry, updated_at: now }
      else db.data.address_book.push({ ...entry, updated_at: now })
    } else {
      const max = db.data.address_book.reduce((m, e) => Math.max(m, e.id || 0), 0)
      const id = max + 1
      db.data.address_book.push({ ...entry, id, created_at: now, updated_at: now })
    }
    db.save()
    return entry.id || db.data.address_book[db.data.address_book.length - 1].id
  })

  ipcMain.handle('addressBook:delete', (_, id) => {
    const db = getDb()
    if (!db.data.address_book) db.data.address_book = []
    db.data.address_book = db.data.address_book.filter(e => e.id !== id)
    db.save()
    return true
  })

  // ── Repairs ───────────────────────────────────────────────────────────────────
  const repairsDir = () => {
    const { app } = require('electron')
    const p = path.join(app.getPath('userData'), 'repair-files')
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    return p
  }

  ipcMain.handle('repairs:getAll', () => {
    const db = getDb()
    if (!db.data.repairs) db.data.repairs = []
    return db.repairs.getAll()
  })

  ipcMain.handle('repairs:save', (_, repair) => {
    const db = getDb()
    if (!db.data.repairs) db.data.repairs = []
    const now = new Date().toISOString()
    if (repair.id) {
      const idx = db.data.repairs.findIndex(r => r.id === repair.id)
      if (idx !== -1) db.data.repairs[idx] = { ...db.data.repairs[idx], ...repair, updated_at: now }
      else db.data.repairs.push({ ...repair, updated_at: now, created_at: now })
      db.save()
      return repair.id
    } else {
      const id = db.nextId('repairs')
      db.data.repairs.push({
        id,
        asset_type: repair.asset_type || 'item',
        asset_id: repair.asset_id || null,
        asset_name: repair.asset_name || '',
        asset_sku: repair.asset_sku || '',
        asset_department: repair.asset_department || '',
        start_date: repair.start_date || '',
        end_date: repair.end_date || '',
        notes: repair.notes || '',
        technician: repair.technician || '',
        cost: repair.cost != null ? repair.cost : 0,
        files: [],
        created_at: now,
        updated_at: now,
      })
      db.save()
      return db.data.repairs[db.data.repairs.length - 1].id
    }
  })

  ipcMain.handle('repairs:delete', (_, id) => {
    const db = getDb()
    if (!db.data.repairs) db.data.repairs = []
    // Remove attached files
    const repair = db.data.repairs.find(r => r.id === id)
    if (repair && repair.files) {
      for (const f of repair.files) {
        if (f.path && fs.existsSync(f.path)) {
          try { fs.unlinkSync(f.path) } catch(e) {}
        }
      }
    }
    const dir = path.join(repairsDir(), String(id))
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    db.data.repairs = db.data.repairs.filter(r => r.id !== id)
    db.save()
    return true
  })

  ipcMain.handle('repairs:attachFile', async (_, repairId) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Attach Repair Image or Receipt',
      filters: [
        { name: 'Images & Documents', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'heic'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })
    if (canceled || !filePaths.length) return null
    const db = getDb()
    if (!db.data.repairs) return null
    const idx = db.data.repairs.findIndex(r => r.id === repairId)
    if (idx === -1) return null

    const dir = path.join(repairsDir(), String(repairId))
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const attached = []
    for (const src of filePaths) {
      const basename = path.basename(src)
      let dest = path.join(dir, basename)
      let n = 1
      while (fs.existsSync(dest)) {
        const ext = path.extname(basename)
        dest = path.join(dir, path.basename(basename, ext) + `_${n++}` + ext)
      }
      fs.copyFileSync(src, dest)
      const stat = fs.statSync(dest)
      const fileEntry = { name: path.basename(dest), path: dest, size: stat.size, added_at: new Date().toISOString() }
      if (!db.data.repairs[idx].files) db.data.repairs[idx].files = []
      db.data.repairs[idx].files.push(fileEntry)
      attached.push(fileEntry)
    }
    db.data.repairs[idx].updated_at = new Date().toISOString()
    db.save()
    return attached
  })

  ipcMain.handle('repairs:removeFile', (_, { repairId, fileName }) => {
    const db = getDb()
    if (!db.data.repairs) return false
    const idx = db.data.repairs.findIndex(r => r.id === repairId)
    if (idx === -1) return false
    const fileIdx = (db.data.repairs[idx].files || []).findIndex(f => f.name === fileName)
    if (fileIdx === -1) return false
    const filePath = db.data.repairs[idx].files[fileIdx].path
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath) } catch(e) {}
    }
    db.data.repairs[idx].files.splice(fileIdx, 1)
    db.data.repairs[idx].updated_at = new Date().toISOString()
    db.save()
    return true
  })

  ipcMain.handle('repairs:openFile', (_, filePath) => {
    shell.openPath(filePath)
    return true
  })

  // ── Cases ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('cases:getAll', () => {
    const db = getDb()
    if (!db.data.cases) db.data.cases = []
    return db.cases.getAll()
  })

  ipcMain.handle('cases:save', (_, c) => {
    const db = getDb()
    if (!db.data.cases) db.data.cases = []
    if (c.id) {
      const idx = db.data.cases.findIndex(x => x.id === c.id)
      if (idx !== -1) db.data.cases[idx] = { ...db.data.cases[idx], ...c }
      else db.data.cases.push(c)
    } else {
      const id = db.nextId('cases')
      db.data.cases.push({
        id,
        name: c.name,
        sku:   c.sku   || '',
        barcode: c.barcode || '',
        serial: c.serial || '',
        color: c.color || '#f59e0b',
        group_id: c.group_id || null,
        length: c.length || 24,
        width:  c.width  || 24,
        height: c.height || 24,
        weight: c.weight || 0,
        items: Array.isArray(c.items) ? c.items : [],
        can_rotate_lr:        c.can_rotate_lr        !== undefined ? c.can_rotate_lr        : 1,
        can_tip_side:         c.can_tip_side         !== undefined ? c.can_tip_side         : 1,
        can_flip:             c.can_flip             !== undefined ? c.can_flip             : 1,
        can_stack_on_others:  c.can_stack_on_others  !== undefined ? c.can_stack_on_others  : 1,
        allow_stacking_on_top:c.allow_stacking_on_top!== undefined ? c.allow_stacking_on_top: 1,
        max_stack_weight:     c.max_stack_weight     || 0,
        max_stack_qty:        c.max_stack_qty        || 0,
        notes: c.notes || '',
        created_at: new Date().toISOString(),
      })
    }
    db.save()
    return c.id || db.data.cases[db.data.cases.length - 1].id
  })

  ipcMain.handle('cases:delete', (_, id) => {
    const db = getDb()
    if (!db.data.cases) db.data.cases = []
    db.data.cases = db.data.cases.filter(c => c.id !== id)
    db.save()
    return true
  })

  // File attachments: copy file into userData/event-files/<eventId>/<filename>
  ipcMain.handle('events:attachFile', async (_, eventId) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Attach File to Event',
      properties: ['openFile', 'multiSelections'],
    })
    if (canceled || !filePaths.length) return null
    const db = getDb()
    if (!db.data.events) return null
    const idx = db.data.events.findIndex(e => e.id === eventId)
    if (idx === -1) return null

    const dir = path.join(eventsDir(), String(eventId))
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const attached = []
    for (const src of filePaths) {
      const basename = path.basename(src)
      // Avoid collisions
      let dest = path.join(dir, basename)
      let n = 1
      while (fs.existsSync(dest)) {
        const ext = path.extname(basename)
        dest = path.join(dir, path.basename(basename, ext) + `_${n++}` + ext)
      }
      fs.copyFileSync(src, dest)
      const stat = fs.statSync(dest)
      const fileEntry = { name: path.basename(dest), path: dest, size: stat.size, added_at: new Date().toISOString() }
      if (!db.data.events[idx].files) db.data.events[idx].files = []
      db.data.events[idx].files.push(fileEntry)
      attached.push(fileEntry)
    }
    db.data.events[idx].updated_at = new Date().toISOString()
    db.save()
    return attached
  })

  ipcMain.handle('events:removeFile', (_, { eventId, fileName }) => {
    const db = getDb()
    if (!db.data.events) return false
    const idx = db.data.events.findIndex(e => e.id === eventId)
    if (idx === -1) return false
    const fileIdx = (db.data.events[idx].files || []).findIndex(f => f.name === fileName)
    if (fileIdx === -1) return false
    const filePath = db.data.events[idx].files[fileIdx].path
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    db.data.events[idx].files.splice(fileIdx, 1)
    db.data.events[idx].updated_at = new Date().toISOString()
    db.save()
    return true
  })

  ipcMain.handle('events:openFile', (_, filePath) => {
    shell.openPath(filePath)
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
      title: 'Import Items & Cases from Excel',
      filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths.length) return null
    const XLSX = require('xlsx')
    const wb = XLSX.readFile(filePaths[0])
    // Support template with Items/Cases sheets, or fall back to first sheet as items
    const sheetNames = wb.SheetNames.map(n => n.trim().toLowerCase())
    const itemsSheetIdx = sheetNames.findIndex(n => n === 'items' || n === 'item')
    const casesSheetIdx = sheetNames.findIndex(n => n === 'cases' || n === 'case')

    if (itemsSheetIdx !== -1 || casesSheetIdx !== -1) {
      // Multi-sheet template format
      const itemRows = itemsSheetIdx !== -1 ? sheetToJsonSkipBlanks(wb.Sheets[wb.SheetNames[itemsSheetIdx]]) : []
      const caseRows = casesSheetIdx !== -1 ? sheetToJsonSkipBlanks(wb.Sheets[wb.SheetNames[casesSheetIdx]]) : []
      return { format: 'template', itemRows, caseRows }
    } else {
      // Legacy: single sheet — treat all as items
      const ws = wb.Sheets[wb.SheetNames[0]]
      return { format: 'legacy', itemRows: sheetToJsonSkipBlanks(ws), caseRows: [] }
    }
  })

  ipcMain.handle('export:template', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Import Template',
      defaultPath: 'propor-import-template.xlsx',
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    })
    if (canceled || !filePath) return null

    const XLSX = require('xlsx')
    const wb = XLSX.utils.book_new()

    // ── Items sheet ───────────────────────────────────────────────────
    const itemHeaders = [
      ['name', 'sku', 'barcode', 'serial', 'department', 'group', 'length', 'width', 'height',
       'weight', 'quantity', 'can_rotate_lr', 'can_tip_side', 'can_flip',
       'can_stack_on_others', 'allow_stacking_on_top', 'max_stack_qty', 'max_stack_weight', 'notes'],
      ['Example Mixer', 'MX-001', '012345678901', 'SN12345', 'Audio', 'Stage Rack',
       19, 14, 7, 22, 1, 1, 1, 1, 1, 1, 0, 50, 'Main FOH mixer'],
      ['Cable Snake', 'SN-050', '098765432109', '', 'Audio', '',
       24, 8, 8, 5, 4, 1, 1, 1, 1, 0, 0, 0, ''],
    ]
    const wsItems = XLSX.utils.aoa_to_sheet(itemHeaders)
    // Style the header row as bold by setting column widths
    wsItems['!cols'] = [
      { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 13 }, { wch: 12 }, { wch: 9 }, { wch: 18 }, { wch: 20 },
      { wch: 14 }, { wch: 16 }, { wch: 24 },
    ]
    XLSX.utils.book_append_sheet(wb, wsItems, 'Items')

    // ── Cases sheet ───────────────────────────────────────────────────
    const caseHeaders = [
      ['name', 'sku', 'barcode', 'serial', 'group', 'color', 'length', 'width', 'height',
       'weight', 'can_rotate_lr', 'can_tip_side', 'can_flip',
       'can_stack_on_others', 'allow_stacking_on_top', 'max_stack_weight', 'max_stack_qty', 'notes'],
      ['Audio Road Case', 'ARC-001', '012345678901', '', 'Audio Cases',
       '#4f8ef7', 24, 18, 20, 35, 1, 0, 0, 1, 1, 150, 2, 'Main audio case'],
      ['Video Pelican', 'VID-002', '098765432109', 'P9988', 'Video Cases',
       '#8b5cf6', 20, 16, 14, 18, 1, 0, 0, 1, 0, 0, 0, 'Camera & lenses'],
    ]
    const wsCases = XLSX.utils.aoa_to_sheet(caseHeaders)
    wsCases['!cols'] = [
      { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 13 }, { wch: 12 }, { wch: 9 }, { wch: 18 }, { wch: 20 },
      { wch: 16 }, { wch: 14 }, { wch: 24 },
    ]
    XLSX.utils.book_append_sheet(wb, wsCases, 'Cases')

    XLSX.writeFile(wb, filePath)
    return filePath
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
      .filter(f => f.endsWith('.propor'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
          return { filename: f, name: data.name, savedAt: data.savedAt, truck: data.truck?.name }
        } catch(e) { return null }
      }).filter(Boolean)
  })

  ipcMain.handle('repack:save', (_, { name, data }) => {
    const filename = name.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_') + '.propor'
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

  // Case Repacks — saved item layouts for individual cases (stored in DB)
  ipcMain.handle('case_repack:list', () => {
    const db = getDb()
    if (!db.data.case_repacks) db.data.case_repacks = []
    return [...db.data.case_repacks].sort((a, b) => a.name.localeCompare(b.name))
  })

  ipcMain.handle('case_repack:save', (_, { id, name, items }) => {
    const db = getDb()
    if (!db.data.case_repacks) db.data.case_repacks = []
    if (id) {
      const idx = db.data.case_repacks.findIndex(r => r.id === id)
      if (idx >= 0) {
        db.data.case_repacks[idx] = { ...db.data.case_repacks[idx], name, items, savedAt: new Date().toISOString() }
      }
    } else {
      const newId = db.data.case_repacks.length
        ? Math.max(...db.data.case_repacks.map(r => r.id)) + 1 : 1
      db.data.case_repacks.push({ id: newId, name, items, savedAt: new Date().toISOString() })
    }
    db.save()
    return db.data.case_repacks
  })

  ipcMain.handle('case_repack:delete', (_, id) => {
    const db = getDb()
    if (!db.data.case_repacks) { db.data.case_repacks = []; return true }
    db.data.case_repacks = db.data.case_repacks.filter(r => r.id !== id)
    db.save()
    return true
  })

  ipcMain.handle('file:saveAs', async (_, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Pack File',
      defaultPath: (data.name || 'pack').replace(/[^a-z0-9_\s]/gi, '_') + '.propor',
      filters: [{ name: 'ProPOR File', extensions: ['propor'] }]
    })
    if (canceled || !filePath) return null
    fs.writeFileSync(filePath, JSON.stringify({ ...data, type: 'savefile', savedAt: new Date().toISOString() }, null, 2))
    return filePath
  })

  ipcMain.handle('file:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Pack File',
      filters: [{ name: 'ProPOR File', extensions: ['propor'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths.length) return null
    return JSON.parse(fs.readFileSync(filePaths[0], 'utf8'))
  })

  ipcMain.handle('file:openFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Pack Files Folder',
      filters: [{ name: 'ProPOR File', extensions: ['propor'] }],
      properties: ['openFile', 'multiSelections']
    })
    if (canceled || !filePaths.length) return []
    return filePaths.map(fp => {
      try { return { filePath: fp, ...JSON.parse(fs.readFileSync(fp, 'utf8')) } } catch(e) { return null }
    }).filter(Boolean)
  })
}

/**
 * Like XLSX.utils.sheet_to_json but skips any leading blank rows so that
 * spreadsheets exported from Numbers (which inserts an empty row 1) still
 * parse correctly. It finds the first row that has at least one non-empty
 * cell and treats that as the header row.
 */
function sheetToJsonSkipBlanks(ws) {
  const XLSX = require('xlsx')
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  // Find the first row index that has at least one non-empty cell
  let headerRow = range.s.r
  for (let r = range.s.r; r <= range.e.r; r++) {
    let hasValue = false
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && cell.v !== undefined && String(cell.v).trim() !== '') {
        hasValue = true
        break
      }
    }
    if (hasValue) { headerRow = r; break }
  }
  // Rebuild a trimmed range starting from the found header row
  const newRange = { s: { r: headerRow, c: range.s.c }, e: range.e }
  const trimmedWs = Object.assign({}, ws, { '!ref': XLSX.utils.encode_range(newRange) })
  return XLSX.utils.sheet_to_json(trimmedWs, { defval: '' })
}

function parseInventoryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  try {
    if (ext === '.json') return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (ext === '.csv') {
      const XLSX = require('xlsx')
      const wb = XLSX.readFile(filePath)
      return sheetToJsonSkipBlanks(wb.Sheets[wb.SheetNames[0]])
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
