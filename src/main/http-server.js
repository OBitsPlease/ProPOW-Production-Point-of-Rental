/**
 * http-server.js
 * Local HTTP server that serves the built dist/ files and exposes a JSON REST API
 * so remote browsers (via Cloudflare Tunnel) can read & write app data.
 *
 * The server injects a browser-side window.electronAPI polyfill into every
 * index.html response so the React app works identically in a browser as it
 * does inside Electron.
 */

const http  = require('http')
const fs    = require('fs')
const path  = require('path')
const { getDb } = require('./db')

const PORT = 4321

// ── MIME type map ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
}

// ── Browser window.electronAPI polyfill (injected into served index.html) ─────
// This replicates the same API surface as preload.js, but uses fetch() calls
// to the local /api/* REST endpoints instead of Electron IPC.
const BROWSER_API_SCRIPT = `
<script>
(function () {
  // Skip if Electron preload already set it
  if (window.electronAPI) return;

  async function apiFetch(method, endpoint, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(endpoint, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  const notAvailable = (name) => () => {
    alert(name + ' is not available in browser mode.');
    return Promise.resolve(null);
  };

  window.electronAPI = {
    getVersion: () => Promise.resolve('web'),

    // Items
    getItems:       ()     => apiFetch('GET',    '/api/items'),
    saveItem:       (item) => apiFetch('POST',   '/api/items', item),
    deleteItem:     (id)   => apiFetch('DELETE', '/api/items/' + id),
    clearItems:     ()     => apiFetch('DELETE', '/api/items'),
    deleteAllItems: ()     => apiFetch('DELETE', '/api/items'),

    // Departments
    getDepartments:    ()     => apiFetch('GET',    '/api/departments'),
    saveDepartment:    (dept) => apiFetch('POST',   '/api/departments', dept),
    deleteDepartment:  (id)   => apiFetch('DELETE', '/api/departments/' + id),

    // Trucks
    getTrucks:    ()      => apiFetch('GET',    '/api/trucks'),
    saveTruck:    (truck) => apiFetch('POST',   '/api/trucks', truck),
    deleteTruck:  (id)    => apiFetch('DELETE', '/api/trucks/' + id),

    // Load Plans
    getLoadPlans:    ()     => apiFetch('GET',    '/api/plans'),
    getLoadPlan:     (id)   => apiFetch('GET',    '/api/plans/' + id),
    saveLoadPlan:    (plan) => apiFetch('POST',   '/api/plans', plan),
    deleteLoadPlan:  (id)   => apiFetch('DELETE', '/api/plans/' + id),
    deleteAllPlans:  ()     => apiFetch('DELETE', '/api/plans'),

    // Groups
    groups: {
      getAll: ()    => apiFetch('GET',    '/api/groups'),
      save:   (g)   => apiFetch('POST',   '/api/groups', g),
      delete: (id)  => apiFetch('DELETE', '/api/groups/' + id),
    },

    // Cases
    cases: {
      getAll: ()   => apiFetch('GET',    '/api/cases'),
      save:   (c)  => apiFetch('POST',   '/api/cases', c),
      delete: (id) => apiFetch('DELETE', '/api/cases/' + id),
    },

    // Events
    events: {
      getAll:     ()       => apiFetch('GET',    '/api/events'),
      get:        (id)     => apiFetch('GET',    '/api/events/' + id),
      save:       (event)  => apiFetch('POST',   '/api/events', event),
      delete:     (id)     => apiFetch('DELETE', '/api/events/' + id),
      attachFile: notAvailable('File attachment'),
      removeFile: notAvailable('File removal'),
      openFile:   notAvailable('File open'),
    },

    // Address Book
    addressBook: {
      getAll:  (type)  => apiFetch('GET',    '/api/address-book' + (type ? '?type=' + encodeURIComponent(type) : '')),
      save:    (entry) => apiFetch('POST',   '/api/address-book', entry),
      delete:  (id)    => apiFetch('DELETE', '/api/address-book/' + id),
    },

    // Repairs
    repairs: {
      getAll:     ()       => apiFetch('GET',    '/api/repairs'),
      save:       (repair) => apiFetch('POST',   '/api/repairs', repair),
      delete:     (id)     => apiFetch('DELETE', '/api/repairs/' + id),
      attachFile: notAvailable('File attachment'),
      removeFile: notAvailable('File removal'),
      openFile:   notAvailable('File open'),
    },

    // Repacks
    repack: {
      list:   ()               => apiFetch('GET',    '/api/repacks'),
      save:   (name, data)     => apiFetch('POST',   '/api/repacks', { name, data }),
      load:   (filename)       => apiFetch('GET',    '/api/repacks/' + encodeURIComponent(filename)),
      delete: (filename)       => apiFetch('DELETE', '/api/repacks/' + encodeURIComponent(filename)),
    },

    // Case Repacks
    caseRepacks: {
      list:   ()        => apiFetch('GET',    '/api/case-repacks'),
      save:   (payload) => apiFetch('POST',   '/api/case-repacks', payload),
      delete: (id)      => apiFetch('DELETE', '/api/case-repacks/' + id),
    },

    // Electron-only stubs
    dialog: {
      confirm: (message) => Promise.resolve(window.confirm(message)),
    },
    importExcel:     notAvailable('Excel import'),
    exportLibrary:   notAvailable('Excel export'),
    exportTemplate:  notAvailable('Template export'),
    exportPDF:       notAvailable('PDF export'),
    openFolder:      () => Promise.resolve(null),
    file: {
      saveAs:     () => Promise.resolve(null),
      open:       () => Promise.resolve(null),
      openFolder: () => Promise.resolve(null),
    },
    updater: {
      check:              () => Promise.resolve(),
      download:           () => Promise.resolve(),
      install:            () => Promise.resolve(),
      startAutoCheck:     () => Promise.resolve(),
      onUpdateAvailable:  () => {},
      onNotAvailable:     () => {},
      onProgress:         () => {},
      onDownloaded:       () => {},
      onError:            () => {},
      removeListeners:    () => {},
    },
    tunnel: {
      getUrl:         () => Promise.resolve(null),
      onUrlReady:     () => {},
      removeListeners:() => {},
    },
    stackPrefs: {
      getAll:  () => apiFetch('GET',    '/api/stack_prefs'),
      save:    (pref) => apiFetch('POST',   '/api/stack_prefs', pref),
      delete:  (id)   => apiFetch('DELETE', '/api/stack_prefs/' + id),
    },
  };
})();
</script>
`

// ── Helper: read request body as JSON ────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(raw)) }
      catch (_) { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

// ── Helper: send JSON response ────────────────────────────────────────────────
function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

// ── REST API router ───────────────────────────────────────────────────────────
async function handleApi(req, res, pathname, searchParams) {
  const method = req.method.toUpperCase()

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  // Strip /api prefix and split into segments
  const seg = pathname.replace(/^\/api/, '').replace(/^\//, '').split('/')
  // seg[0] = resource, seg[1] = id (optional)

  try {
    const db = getDb()

    // ── Version ──────────────────────────────────────────────────────────────
    if (seg[0] === 'version' && method === 'GET') {
      return sendJson(res, { version: 'web' })
    }

    // ── Items ────────────────────────────────────────────────────────────────
    if (seg[0] === 'items') {
      if (method === 'GET')    return sendJson(res, db.items.getAll())
      if (method === 'DELETE' && seg[1]) {
        db.data.items = db.data.items.filter(i => i.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'DELETE' && !seg[1]) {
        db.data.items = []; db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const item = await readBody(req)
        if (item.id) {
          const idx = db.data.items.findIndex(i => i.id === item.id)
          if (idx !== -1) db.data.items[idx] = { ...db.data.items[idx], ...item,
            department_id: item.department_id ? parseInt(item.department_id) : null,
            group_id: item.group_id ? parseInt(item.group_id) : null }
          db.save(); return sendJson(res, item.id)
        } else {
          const id = db.nextId('items')
          db.data.items.push({ id, name: item.name, sku: item.sku || '', barcode: item.barcode || '',
            serial: item.serial || '',
            department_id: item.department_id ? parseInt(item.department_id) : null,
            length: item.length, width: item.width, height: item.height,
            weight: item.weight || 0, quantity: item.quantity || 1,
            unique_serials: item.unique_serials || 0,
            unit_serials: Array.isArray(item.unit_serials) ? item.unit_serials : [],
            can_rotate_lr: item.can_rotate_lr !== undefined ? item.can_rotate_lr : 1,
            can_tip_side: item.can_tip_side !== undefined ? item.can_tip_side : 1,
            can_flip: item.can_flip !== undefined ? item.can_flip : 1,
            can_stack_on_others: item.can_stack_on_others !== undefined ? item.can_stack_on_others : 1,
            allow_stacking_on_top: item.allow_stacking_on_top !== undefined ? item.allow_stacking_on_top : 1,
            max_stack_weight: item.max_stack_weight || 0,
            group_id: item.group_id ? parseInt(item.group_id) : null,
            case_id: item.case_id || null, case_qty: item.case_qty || 1, notes: item.notes || '' })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Departments ──────────────────────────────────────────────────────────
    if (seg[0] === 'departments') {
      if (method === 'GET')    return sendJson(res, db.departments.getAll())
      if (method === 'DELETE' && seg[1]) {
        db.data.departments = db.data.departments.filter(d => d.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const dept = await readBody(req)
        if (dept.id) {
          const idx = db.data.departments.findIndex(d => d.id === dept.id)
          if (idx !== -1) db.data.departments[idx] = { ...db.data.departments[idx], ...dept }
          db.save(); return sendJson(res, dept.id)
        } else {
          const id = db.nextId('departments')
          db.data.departments.push({ id, name: dept.name, color: dept.color || '#4f8ef7' })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Trucks ───────────────────────────────────────────────────────────────
    if (seg[0] === 'trucks') {
      if (method === 'GET')    return sendJson(res, db.trucks.getAll())
      if (method === 'DELETE' && seg[1]) {
        db.data.trucks = db.data.trucks.filter(t => t.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const truck = await readBody(req)
        if (truck.id) {
          const idx = db.data.trucks.findIndex(t => t.id === truck.id)
          if (idx !== -1) db.data.trucks[idx] = { ...db.data.trucks[idx], ...truck }
          db.save(); return sendJson(res, truck.id)
        } else {
          const id = db.nextId('trucks')
          db.data.trucks.push({ id, name: truck.name, length: truck.length, width: truck.width,
            height: truck.height, max_weight: truck.max_weight, unit: truck.unit || 'in', notes: truck.notes || '' })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Load Plans ───────────────────────────────────────────────────────────
    if (seg[0] === 'plans') {
      if (method === 'GET' && seg[1]) {
        const plan = db.data.plans.find(p => p.id === parseInt(seg[1]))
        if (!plan) return sendJson(res, null, 404)
        const truck = db.data.trucks.find(t => t.id === plan.truck_id) || {}
        return sendJson(res, { ...plan, truck_name: truck.name, truck_length: truck.length,
          truck_width: truck.width, truck_height: truck.height,
          truck_max_weight: truck.max_weight, truck_unit: truck.unit })
      }
      if (method === 'GET')    return sendJson(res, db.plans.getAll())
      if (method === 'DELETE' && seg[1]) {
        db.data.plans = db.data.plans.filter(p => p.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'DELETE' && !seg[1]) {
        db.data.plans = []; db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const plan = await readBody(req)
        const now = new Date().toISOString()
        if (plan.id) {
          const idx = db.data.plans.findIndex(p => p.id === plan.id)
          if (idx !== -1) db.data.plans[idx] = { ...db.data.plans[idx], ...plan, updated_at: now }
          db.save(); return sendJson(res, plan.id)
        } else {
          const id = db.nextId('plans')
          db.data.plans.push({ id, name: plan.name, truck_id: plan.truck_id,
            result_json: plan.result_json, utilization: plan.utilization,
            total_weight: plan.total_weight, created_at: now, updated_at: now })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Groups ───────────────────────────────────────────────────────────────
    if (seg[0] === 'groups') {
      if (!db.data.item_groups) db.data.item_groups = []
      if (method === 'GET')    return sendJson(res, [...db.data.item_groups])
      if (method === 'DELETE' && seg[1]) {
        const id = parseInt(seg[1])
        const toDelete = new Set([id])
        db.data.item_groups.filter(g => g.parent_id === id).forEach(g => toDelete.add(g.id))
        db.data.item_groups = db.data.item_groups.filter(g => !toDelete.has(g.id))
        db.data.items = db.data.items.map(i => toDelete.has(i.group_id) ? { ...i, group_id: null } : i)
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const group = await readBody(req)
        if (group.id) {
          const idx = db.data.item_groups.findIndex(g => g.id === group.id)
          if (idx !== -1) db.data.item_groups[idx] = { ...db.data.item_groups[idx], ...group }
          else db.data.item_groups.push(group)
          db.save(); return sendJson(res, group.id)
        } else {
          const id = db.nextId('item_groups')
          db.data.item_groups.push({ id, name: group.name, color: group.color || '#4f8ef7', parent_id: group.parent_id || null })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Cases ────────────────────────────────────────────────────────────────
    if (seg[0] === 'cases') {
      if (!db.data.cases) db.data.cases = []
      if (method === 'GET')    return sendJson(res, db.cases.getAll())
      if (method === 'DELETE' && seg[1]) {
        db.data.cases = db.data.cases.filter(c => c.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const c = await readBody(req)
        if (c.id) {
          const idx = db.data.cases.findIndex(x => x.id === c.id)
          if (idx !== -1) db.data.cases[idx] = { ...db.data.cases[idx], ...c }
          else db.data.cases.push(c)
          db.save(); return sendJson(res, c.id)
        } else {
          const id = db.nextId('cases')
          db.data.cases.push({ id, name: c.name, sku: c.sku || '', barcode: c.barcode || '',
            serial: c.serial || '', color: c.color || '#f59e0b',
            group_id: c.group_id ? parseInt(c.group_id) : null,
            length: c.length || 24, width: c.width || 24, height: c.height || 24, weight: c.weight || 0,
            items: Array.isArray(c.items) ? c.items : [],
            can_rotate_lr: c.can_rotate_lr !== undefined ? c.can_rotate_lr : 1,
            can_tip_side: c.can_tip_side !== undefined ? c.can_tip_side : 1,
            can_flip: c.can_flip !== undefined ? c.can_flip : 1,
            can_stack_on_others: c.can_stack_on_others !== undefined ? c.can_stack_on_others : 1,
            allow_stacking_on_top: c.allow_stacking_on_top !== undefined ? c.allow_stacking_on_top : 1,
            max_stack_weight: c.max_stack_weight || 0, max_stack_qty: c.max_stack_qty || 0,
            load_zone: c.load_zone || '',
            notes: c.notes || '', created_at: new Date().toISOString() })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Events ───────────────────────────────────────────────────────────────
    if (seg[0] === 'events') {
      if (!db.data.events) db.data.events = []
      if (method === 'GET' && seg[1]) {
        const ev = db.data.events.find(e => e.id === parseInt(seg[1]))
        return sendJson(res, ev || null, ev ? 200 : 404)
      }
      if (method === 'GET')    return sendJson(res, db.events.getAll())
      if (method === 'DELETE' && seg[1]) {
        db.data.events = db.data.events.filter(e => e.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const event = await readBody(req)
        const now = new Date().toISOString()
        if (event.id) {
          const idx = db.data.events.findIndex(e => e.id === event.id)
          if (idx !== -1) db.data.events[idx] = { ...db.data.events[idx], ...event, updated_at: now }
          else db.data.events.push({ ...event, updated_at: now })
          db.save(); return sendJson(res, event.id)
        } else {
          const id = db.nextId('events')
          db.data.events.push({ id, name: event.name || 'New Event', client: event.client || '',
            event_date: event.event_date || '', load_in: event.load_in || '', load_out: event.load_out || '',
            status: event.status || 'upcoming', notes: event.notes || '',
            venue_name: event.venue_name || '', venue_address: event.venue_address || '',
            venue_city: event.venue_city || '', venue_state: event.venue_state || '',
            venue_contact_name: event.venue_contact_name || '', venue_contact_phone: event.venue_contact_phone || '',
            venue_contact_email: event.venue_contact_email || '', venue_notes: event.venue_notes || '',
            hotel_name: event.hotel_name || '', hotel_address: event.hotel_address || '',
            hotel_checkin: event.hotel_checkin || '', hotel_checkout: event.hotel_checkout || '',
            hotel_confirmation: event.hotel_confirmation || '', hotel_notes: event.hotel_notes || '',
            crew: Array.isArray(event.crew) ? event.crew : [],
            gear: Array.isArray(event.gear) ? event.gear : [],
            files: [], created_at: now, updated_at: now })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Address Book ─────────────────────────────────────────────────────────
    if (seg[0] === 'address-book') {
      if (!db.data.address_book) db.data.address_book = []
      if (method === 'GET') {
        const type = searchParams.get('type')
        const results = type ? db.data.address_book.filter(e => e.type === type) : db.data.address_book
        return sendJson(res, results)
      }
      if (method === 'DELETE' && seg[1]) {
        db.data.address_book = db.data.address_book.filter(e => e.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const entry = await readBody(req)
        const now = new Date().toISOString()
        if (entry.id) {
          const idx = db.data.address_book.findIndex(e => e.id === entry.id)
          if (idx !== -1) db.data.address_book[idx] = { ...db.data.address_book[idx], ...entry, updated_at: now }
          else db.data.address_book.push({ ...entry, updated_at: now })
          db.save(); return sendJson(res, entry.id)
        } else {
          const max = db.data.address_book.reduce((m, e) => Math.max(m, e.id || 0), 0)
          const id = max + 1
          db.data.address_book.push({ ...entry, id, created_at: now, updated_at: now })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Repairs ──────────────────────────────────────────────────────────────
    if (seg[0] === 'repairs') {
      if (!db.data.repairs) db.data.repairs = []
      if (method === 'GET')    return sendJson(res, db.data.repairs)
      if (method === 'DELETE' && seg[1]) {
        db.data.repairs = db.data.repairs.filter(r => r.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const repair = await readBody(req)
        const now = new Date().toISOString()
        if (repair.id) {
          const idx = db.data.repairs.findIndex(r => r.id === repair.id)
          if (idx !== -1) db.data.repairs[idx] = { ...db.data.repairs[idx], ...repair, updated_at: now }
          else db.data.repairs.push({ ...repair, updated_at: now, created_at: now })
          db.save(); return sendJson(res, repair.id)
        } else {
          const id = db.nextId('repairs')
          db.data.repairs.push({ id, asset_type: repair.asset_type || 'item',
            asset_id: repair.asset_id || null, asset_name: repair.asset_name || '',
            asset_sku: repair.asset_sku || '', asset_department: repair.asset_department || '',
            start_date: repair.start_date || '', end_date: repair.end_date || '',
            notes: repair.notes || '', technician: repair.technician || '',
            cost: repair.cost != null ? repair.cost : 0, files: [], created_at: now, updated_at: now })
          db.save(); return sendJson(res, db.data.repairs[db.data.repairs.length - 1].id)
        }
      }
    }

    // ── Repacks ──────────────────────────────────────────────────────────────
    if (seg[0] === 'repacks') {
      const { app } = require('electron')
      const repacksDir = path.join(app.getPath('userData'), 'repacks')
      if (!fs.existsSync(repacksDir)) fs.mkdirSync(repacksDir, { recursive: true })

      if (method === 'GET' && !seg[1]) {
        const files = fs.readdirSync(repacksDir).filter(f => f.endsWith('.json'))
        return sendJson(res, files.map(f => ({ filename: f, name: f.replace('.json', '') })))
      }
      if (method === 'GET' && seg[1]) {
        const file = path.join(repacksDir, decodeURIComponent(seg[1]))
        if (!fs.existsSync(file)) return sendJson(res, null, 404)
        return sendJson(res, JSON.parse(fs.readFileSync(file, 'utf8')))
      }
      if (method === 'DELETE' && seg[1]) {
        const file = path.join(repacksDir, decodeURIComponent(seg[1]))
        if (fs.existsSync(file)) fs.unlinkSync(file)
        return sendJson(res, true)
      }
      if (method === 'POST') {
        const { name, data } = await readBody(req)
        const file = path.join(repacksDir, name.endsWith('.json') ? name : name + '.json')
        fs.writeFileSync(file, JSON.stringify(data, null, 2))
        return sendJson(res, true)
      }
    }

    // ── Case Repacks ─────────────────────────────────────────────────────────
    if (seg[0] === 'case-repacks') {
      if (!db.data.case_repacks) db.data.case_repacks = []
      if (method === 'GET')    return sendJson(res, db.data.case_repacks)
      if (method === 'DELETE' && seg[1]) {
        db.data.case_repacks = db.data.case_repacks.filter(r => r.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const payload = await readBody(req)
        if (payload.id) {
          const idx = db.data.case_repacks.findIndex(r => r.id === payload.id)
          if (idx !== -1) db.data.case_repacks[idx] = { ...db.data.case_repacks[idx], ...payload }
          else db.data.case_repacks.push(payload)
          db.save(); return sendJson(res, payload.id)
        } else {
          const max = db.data.case_repacks.reduce((m, r) => Math.max(m, r.id || 0), 0)
          const id = max + 1
          db.data.case_repacks.push({ ...payload, id })
          db.save(); return sendJson(res, id)
        }
      }
    }

    // ── Stack Preferences ─────────────────────────────────────────────────
    if (seg[0] === 'stack_prefs') {
      if (!db.data.stack_prefs) db.data.stack_prefs = []
      if (method === 'GET') return sendJson(res, db.data.stack_prefs)
      if (method === 'DELETE' && seg[1]) {
        db.data.stack_prefs = db.data.stack_prefs.filter(p => p.id !== parseInt(seg[1]))
        db.save(); return sendJson(res, true)
      }
      if (method === 'POST') {
        const pref = await readBody(req)
        const existing = db.data.stack_prefs.find(p =>
          p.bottom_case_id === pref.bottom_case_id && p.top_case_id === pref.top_case_id
        )
        if (existing) {
          existing.count = (existing.count || 1) + 1
          existing.last_used = new Date().toISOString()
          db.save(); return sendJson(res, true)
        }
        const max = db.data.stack_prefs.reduce((m, p) => Math.max(m, p.id || 0), 0)
        db.data.stack_prefs.push({
          id: max + 1, bottom_case_id: pref.bottom_case_id, top_case_id: pref.top_case_id,
          bottom_name: pref.bottom_name || '', top_name: pref.top_name || '',
          count: 1, created_at: new Date().toISOString(), last_used: new Date().toISOString(),
        })
        db.save(); return sendJson(res, true)
      }
    }

    // Unknown API route
    return sendJson(res, { error: 'Not found' }, 404)

  } catch (err) {
    console.error('[http-server] API error:', err)
    return sendJson(res, { error: err.message }, 500)
  }
}

// ── Static file server ────────────────────────────────────────────────────────
function handleStatic(req, res, distDir) {
  let urlPath = new URL(req.url, 'http://localhost').pathname
  // SPA fallback: non-asset paths → index.html
  const ext = path.extname(urlPath)
  if (!ext || urlPath === '/') urlPath = '/index.html'

  const filePath = path.join(distDir, urlPath)

  // Security: prevent directory traversal outside distDir
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403); return res.end('Forbidden')
  }

  if (!fs.existsSync(filePath)) {
    // SPA fallback
    const indexPath = path.join(distDir, 'index.html')
    if (!fs.existsSync(indexPath)) { res.writeHead(404); return res.end('Not found') }
    let html = fs.readFileSync(indexPath, 'utf8')
    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '')
    html = html.replace('</head>', BROWSER_API_SCRIPT + '</head>')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(html)
  }

  const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'

  if (urlPath === '/index.html') {
    // Inject browser API polyfill before </head>
    // Also strip the Electron-only CSP meta tag — it blocks fonts/workers in real browsers
    let html = fs.readFileSync(filePath, 'utf8')
    html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '')
    html = html.replace('</head>', BROWSER_API_SCRIPT + '</head>')
    res.writeHead(200, { 'Content-Type': mime })
    return res.end(html)
  }

  // Read other static files into memory and send (works inside asar.unpacked)
  try {
    const data = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': mime })
    return res.end(data)
  } catch (e) {
    res.writeHead(404); return res.end('Not found')
  }
}

// ── Main export: start the HTTP server ───────────────────────────────────────
function startHttpServer(distDir) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, res, url.pathname, url.searchParams)
    }
    return handleStatic(req, res, distDir)
  })

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[http-server] Listening on http://0.0.0.0:${PORT}`)
  })

  server.on('error', (err) => {
    console.error('[http-server] Server error:', err.message)
  })

  return server
}

module.exports = { startHttpServer, PORT }
