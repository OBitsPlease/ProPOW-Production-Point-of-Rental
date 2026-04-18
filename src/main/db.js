const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let data = null  // { trucks:[], items:[], departments:[], plans:[], settings:{} }
let dbPath

function getDbPath() {
  return path.join(app.getPath('userData'), 'propor.json')
}

function save() {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
}

function backupOnLaunch() {
  try {
    if (!fs.existsSync(dbPath)) return
    const backupDir = path.join(app.getPath('userData'), 'backups')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
    const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const backupPath = path.join(backupDir, `propor-backup-${stamp}.json`)
    // Only write one backup per calendar day to avoid clutter
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(dbPath, backupPath)
    }
    // Keep only the last 30 daily backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('propor-backup-') && f.endsWith('.json'))
      .sort()
    if (files.length > 30) {
      files.slice(0, files.length - 30).forEach(f =>
        fs.unlinkSync(path.join(backupDir, f))
      )
    }
  } catch (e) {
    // Backup failure should never crash the app
  }
}

function nextId(table) {
  const rows = data[table]
  return rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1
}

function setupDatabase() {
  dbPath = getDbPath()

  // Back up today's data before any writes
  backupOnLaunch()

  if (fs.existsSync(dbPath)) {
    try { data = JSON.parse(fs.readFileSync(dbPath, 'utf8')) } catch(e) { data = null }
  }

  // Migrate: add missing tables introduced in newer versions
  if (data) {
    if (!data.stack_prefs) { data.stack_prefs = []; save() }
  }

  if (!data) {
    data = {
      trucks: [
        { id:1, name:'53ft Dry Van',    length:636, width:102, height:110, max_weight:80000, unit:'in', notes:'' },
        { id:2, name:'48ft Flatbed',    length:576, width:102, height:96,  max_weight:80000, unit:'in', notes:'' },
        { id:3, name:'26ft Box Truck',  length:312, width:96,  height:96,  max_weight:26000, unit:'in', notes:'' },
        { id:4, name:'20ft Container',  length:238, width:92,  height:91,  max_weight:52910, unit:'in', notes:'' },
        { id:5, name:'40ft Container',  length:480, width:92,  height:91,  max_weight:67197, unit:'in', notes:'' },
      ],
      departments: [
        { id:1, name:'Audio',   color:'#4f8ef7' },
        { id:2, name:'General', color:'#6b7280' },
        { id:3, name:'Lighting',color:'#f6ad55' },
        { id:4, name:'Power',   color:'#fc8181' },
        { id:5, name:'Rigging', color:'#f75e8e' },
        { id:6, name:'Staging', color:'#4fd1c5' },
        { id:7, name:'Video',   color:'#7c5ef7' },
      ],
      items: [],
      plans: [],
      events: [],
      item_groups: [],
      cases: [],
      case_repacks: [],
      address_book: [],
      repairs: [],
      stack_prefs: [],
      settings: {},
    }
    save()
  }
  return data
}

function getDb() {
  return {
    data,
    save,
    nextId,
    // Mimic the old API surface used by ipc-handlers
    trucks:      { getAll: () => [...data.trucks].sort((a,b) => a.name.localeCompare(b.name)) },
    departments: { getAll: () => [...data.departments].sort((a,b) => a.name.localeCompare(b.name)) },
    items:       { getAll: () => {
      return [...data.items].sort((a,b) => a.name.localeCompare(b.name)).map(item => {
        // eslint-disable-next-line eqeqeq
        const dept = data.departments.find(d => d.id == item.department_id) || {}
        return {
          can_rotate_lr: 1, can_tip_side: 1, can_flip: 1,
          can_stack_on_others: 1, allow_stacking_on_top: 1, max_stack_weight: 0,
          quantity: 1, serial: '', unique_serials: 0, unit_serials: [], group_id: null,
          ...item,
          department_name: dept.name || null,
          department_color: dept.color || null,
        }
      })
    }},
    plans:       { getAll: () => {
      return [...data.plans].sort((a,b) => b.updated_at.localeCompare(a.updated_at)).map(plan => {
        const truck = data.trucks.find(t => t.id === plan.truck_id) || {}
        return { ...plan, truck_name: truck.name || null }
      })
    }},
    events:      { getAll: () => {
      if (!data.events) data.events = []
      return [...data.events].sort((a,b) => (b.updated_at||'').localeCompare(a.updated_at||''))
    }},
    address_book: { getAll: (type) => {
      if (!data.address_book) data.address_book = []
      const all = [...data.address_book].sort((a,b) => (a.name||'').localeCompare(b.name||''))
      return type ? all.filter(e => e.type === type) : all
    }},
    cases: { getAll: () => {
      if (!data.cases) data.cases = []
      return [...data.cases].sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => ({
        items: [],
        ...c,
      }))
    }},
    repairs: { getAll: () => {
      if (!data.repairs) data.repairs = []
      return [...data.repairs].sort((a,b) => (b.start_date||b.created_at||'').localeCompare(a.start_date||a.created_at||''))
    }},
  }
}

module.exports = { setupDatabase, getDb }
