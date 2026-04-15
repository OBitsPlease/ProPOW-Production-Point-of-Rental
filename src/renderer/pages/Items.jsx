import { useEffect, useState, useRef, useMemo } from 'react'
import {
  Package, Plus, Pencil, Trash2, X, Check, Upload, Download, Trash,
  AlertTriangle, ChevronDown, ChevronRight, FolderPlus, Layers, Search, GripVertical,
} from 'lucide-react'
import { detectMapping, applyMapping } from '../utils/excelImport'

const COLORS = [
  '#4f8ef7', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b',
  '#f87171', '#10b981', '#38bdf8', '#a78bfa', '#f97316',
  '#059669', '#db2777',
]

const DEFAULT_ITEM = {
  name: '', sku: '', serial: '', department_id: '', group_id: '',
  length: 12, width: 12, height: 12, weight: 0, quantity: 1, notes: '',
  can_rotate_lr: 1, can_tip_side: 1, can_flip: 1,
  can_stack_on_others: 1, allow_stacking_on_top: 1, max_stack_weight: 0,
  unique_serials: 0,
}
const DEFAULT_CASE = {
  name: '', sku: '', serial: '', group_id: '',
  length: 24, width: 24, height: 24, weight: 0,
  color: '#f59e0b', notes: '', items: [],
  can_rotate_lr: 1, can_tip_side: 1, can_flip: 1,
  can_stack_on_others: 1, allow_stacking_on_top: 1,
  max_stack_qty: 0, max_stack_weight: 0,
}
const DEFAULT_GROUP = { name: '', color: '#4f8ef7' }

function ColorPicker({ value, onChange }) {
  return (
    <div>
      <label className="label">Color Tag</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {COLORS.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={`w-8 h-8 rounded-lg border-2 transition-all ${value === c ? 'border-white scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-white/60">
        <span>Custom:</span>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
        <span className="font-mono text-xs">{value}</span>
      </div>
    </div>
  )
}

function Modal({ title, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 flex-shrink-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="font-semibold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, onSave, saveLabel }) {
  return (
    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500 flex-shrink-0">
      <button onClick={onCancel} className="btn-secondary">Cancel</button>
      <button onClick={onSave} className="btn-primary flex items-center gap-1">{saveLabel}</button>
    </div>
  )
}

function ItemRow({ item, depts, indent, selected, onToggle, onEdit, onDelete, onDragStart, onDragEnd }) {
  const dept = depts.find(d => d.id == item.department_id)
  const noStack = !item.can_stack_on_others || !item.allow_stacking_on_top
  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-3 hover:bg-white/5 group/itemrow cursor-grab active:cursor-grabbing ${indent ? 'ml-5' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <GripVertical size={12} className="text-white/20 flex-shrink-0 group-hover/itemrow:text-white/40 transition-colors" />
      <input type="checkbox" className="w-3.5 h-3.5 accent-blue-500 flex-shrink-0"
        checked={selected} onChange={onToggle} onClick={e => e.stopPropagation()} />
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dept?.color || '#555' }} />
      <span className="text-sm text-white flex-1 min-w-0 truncate">{item.name}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!!item.unique_serials && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold whitespace-nowrap">
            Unique ×{item.quantity}
          </span>
        )}
        {dept && (
          <span className="text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap"
            style={{ color: dept.color, borderColor: dept.color + '50', backgroundColor: dept.color + '20' }}>
            {dept.name}
          </span>
        )}
        <span className="text-xs text-white/40 font-mono whitespace-nowrap">{item.length}×{item.width}×{item.height}"</span>
        <span className="text-xs text-white/40 whitespace-nowrap">{item.weight} lbs</span>
        <span className="text-xs text-white/60 font-semibold whitespace-nowrap">×{item.quantity}</span>
        {noStack && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap">No Stack</span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover/itemrow:opacity-100 transition-opacity ml-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10"><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1 text-white/40 hover:text-red-400 rounded hover:bg-white/10"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

export default function Items() {
  const [items, setItems] = useState([])
  const [groups, setGroups] = useState([])
  const [cases, setCases] = useState([])
  const [depts, setDepts] = useState([])
  const [search, setSearch] = useState('')

  // collapsed sets
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [collapsedSubgroups, setCollapsedSubgroups] = useState(new Set())
  const [collapsedCases, setCollapsedCases] = useState(new Set())
  const [collapsedCaseGroups, setCollapsedCaseGroups] = useState(new Set())
  const [collapsedCaseSubgroups, setCollapsedCaseSubgroups] = useState(new Set())

  const [selected, setSelected] = useState(new Set())

  // modals
  const [itemModal, setItemModal] = useState(null)
  const [itemForm, setItemForm] = useState({ ...DEFAULT_ITEM })
  const [unitSerials, setUnitSerials] = useState([])
  const [caseModal, setCaseModal] = useState(null)
  const [caseForm, setCaseForm] = useState({ ...DEFAULT_CASE })
  const [caseQty, setCaseQty] = useState(1)
  const [caseUnitSerials, setCaseUnitSerials] = useState([])
  const [caseItemSearch, setCaseItemSearch] = useState('')
  const [caseItemQty, setCaseItemQty] = useState(1)
  const [groupModal, setGroupModal] = useState(null)
  const [groupForm, setGroupForm] = useState({ ...DEFAULT_GROUP })
  const [importModal, setImportModal] = useState(null)
  const [confirmClearModal, setConfirmClearModal] = useState(false)
  // { targetCase, pendingItems: [{ item, currentQty, maxAvail }], index, qty }
  const [dropQtyModal, setDropQtyModal] = useState(null)
  const [dropOver, setDropOver] = useState(null) // { zone: 'group'|'case', id }
  const dragging = useRef(null)
  const initialized = useRef(false)

  const api = window.electronAPI

  const loadAll = async () => {
    if (!api) return
    const [i, g, c, d] = await Promise.all([
      api.getItems(),
      api.groups.getAll(),
      api.cases.getAll(),
      api.getDepartments(),
    ])
    setItems(i || [])
    setGroups(g || [])
    setCases(c || [])
    setDepts(d || [])
    if (!initialized.current) {
      initialized.current = true
      const allGroupIds = new Set((g || []).map(x => x.id))
      const allSubIds = new Set((g || []).filter(x => x.parent_id).map(x => x.id))
      setCollapsedGroups(allGroupIds)
      setCollapsedSubgroups(allSubIds)
      setCollapsedCases(new Set((c || []).map(x => x.id)))
      setCollapsedCaseGroups(allGroupIds)
      setCollapsedCaseSubgroups(allSubIds)
    }
  }
  useEffect(() => { loadAll() }, [])

  // ── Item CRUD ──────────────────────────────────────────────────────
  const setI = (k, v) => setItemForm(f => ({ ...f, [k]: v }))
  const openNewItem = () => { setItemForm({ ...DEFAULT_ITEM }); setUnitSerials([]); setItemModal('new') }
  const openEditItem = (item) => { setItemForm({ ...item }); setUnitSerials(item.unit_serials || []); setItemModal(item) }
  const saveItem = async () => {
    if (!itemForm.name.trim()) return
    await api.saveItem({ ...itemForm, unit_serials: unitSerials, id: itemModal !== 'new' ? itemModal.id : undefined })
    setItemModal(null); loadAll()
  }
  const toggleUniqueSerials = (checked) => {
    setI('unique_serials', checked ? 1 : 0)
    if (checked) {
      const qty = parseInt(itemForm.quantity) || 1
      setUnitSerials(prev => Array.from({ length: qty }, (_, i) => prev[i] || { sku: '', serial: '' }))
    } else {
      setUnitSerials([])
    }
  }
  const handleItemQtyChange = (val) => {
    const qty = parseInt(val) || 1
    setI('quantity', qty)
    if (itemForm.unique_serials) {
      setUnitSerials(prev => Array.from({ length: qty }, (_, i) => prev[i] || { sku: '', serial: '' }))
    }
  }
  const deleteItem = async (id) => {
    if (!await api.dialog.confirm('Delete this item?')) return
    await api.deleteItem(id); loadAll()
  }

  // ── Case CRUD ──────────────────────────────────────────────────────
  const setC = (k, v) => setCaseForm(f => ({ ...f, [k]: v }))
  const openNewCase = () => { setCaseForm({ ...DEFAULT_CASE }); setCaseQty(1); setCaseItemSearch(''); setCaseUnitSerials([]); setCaseModal('new') }
  const openEditCase = (c) => { setCaseForm({ ...c }); setCaseQty(1); setCaseItemSearch(''); setCaseUnitSerials(c.unit_serials || []); setCaseModal(c) }
  const saveCase = async () => {
    if (!caseForm.name.trim()) return
    if (caseModal === 'new') {
      const qty = Math.max(1, parseInt(caseQty) || 1)
      if (caseForm.unique_serials && qty > 1) {
        for (let i = 0; i < qty; i++) {
          const u = caseUnitSerials[i] || { sku: '', serial: '' }
          await api.cases.save({ ...caseForm, sku: u.sku, serial: u.serial, unit_serials: [] })
        }
      } else {
        for (let i = 0; i < qty; i++) await api.cases.save({ ...caseForm, unit_serials: caseUnitSerials })
      }
    } else {
      await api.cases.save({ ...caseForm, unit_serials: caseUnitSerials, id: caseModal.id })
    }
    setCaseModal(null); loadAll()
  }
  const toggleCaseUniqueSerials = (checked) => {
    setC('unique_serials', checked ? 1 : 0)
    if (checked) {
      const qty = Math.max(1, parseInt(caseQty) || 1)
      setCaseUnitSerials(prev => Array.from({ length: qty }, (_, i) => prev[i] || { sku: '', serial: '' }))
    } else {
      setCaseUnitSerials([])
    }
  }
  const handleCaseQtyChange = (val) => {
    const qty = parseInt(val) || 1
    setCaseQty(qty)
    if (caseForm.unique_serials) {
      setCaseUnitSerials(prev => Array.from({ length: qty }, (_, i) => prev[i] || { sku: '', serial: '' }))
    }
  }
  const deleteCase = async (id) => {
    if (!await api.dialog.confirm('Delete this case?')) return
    await api.cases.delete(id); loadAll()
  }
  const emptyCase = async (c) => {
    if (!await api.dialog.confirm(`Remove all items from "${c.name}"?`, 'The inventory will go back into rotation.')) return
    await api.cases.save({ ...c, items: [] }); loadAll()
  }
  // Returns how many of an item are free to assign to the current case being edited.
  // Total inventory minus whatever OTHER cases have already claimed.
  const availableForCase = (itemId) => {
    const invItem = items.find(i => i.id === itemId)
    const totalInv = invItem ? (parseInt(invItem.quantity) || 1) : 0
    const currentCaseId = typeof caseModal === 'object' && caseModal !== null ? caseModal.id : null
    const allocatedElsewhere = cases
      .filter(c => c.id !== currentCaseId)
      .reduce((s, c) => {
        const ci = (c.items || []).find(ci => ci.id === itemId)
        return s + (ci ? (ci.qty || 1) : 0)
      }, 0)
    return Math.max(0, totalInv - allocatedElsewhere)
  }

  const addItemToCase = (item, qty = 1) => {
    const maxQty = availableForCase(item.id)
    const existing = (caseForm.items || []).find(ci => ci.id === item.id)
    const currentQty = existing ? (existing.qty || 0) : 0
    const newQty = Math.min(maxQty, currentQty + qty)
    if (newQty <= 0) return
    if (existing) {
      setC('items', caseForm.items.map(ci => ci.id === item.id ? { ...ci, qty: newQty } : ci))
    } else {
      setC('items', [...(caseForm.items || []), { id: item.id, name: item.name, qty: newQty }])
    }
  }
  const updateCaseItemQty = (itemId, newQty) => {
    const maxQty = availableForCase(itemId)
    const capped = Math.max(1, Math.min(maxQty, parseInt(newQty) || 1))
    setC('items', caseForm.items.map(ci => ci.id === itemId ? { ...ci, qty: capped } : ci))
  }
  const removeItemFromCase = (itemId) => setC('items', (caseForm.items || []).filter(ci => ci.id !== itemId))

  // ── Group CRUD ─────────────────────────────────────────────────────
  const setG = (k, v) => setGroupForm(f => ({ ...f, [k]: v }))
  const openNewGroup = (parentId = null) => { setGroupForm({ name: '', color: '#4f8ef7', parent_id: parentId }); setGroupModal({ mode: 'new', parentId }) }
  const openEditGroup = (group) => { setGroupForm({ ...group }); setGroupModal({ mode: 'edit', data: group }) }
  const saveGroup = async () => {
    if (!groupForm.name.trim()) return
    await api.groups.save({ ...groupForm, id: groupModal.mode === 'edit' ? groupModal.data.id : undefined })
    setGroupModal(null); loadAll()
  }
  const deleteGroup = async (id) => {
    if (!await api.dialog.confirm('Delete this group?', 'Items inside will become ungrouped.')) return
    await api.groups.delete(id); loadAll()
  }

  // ── Import ─────────────────────────────────────────────────────────
  const startImport = async () => {
    const rows = await api.importExcel()
    if (!rows?.length) return
    const cols = Object.keys(rows[0])
    setImportModal({ rows, columns: cols, mapping: detectMapping(cols) })
  }
  const startInventoryImport = async () => {
    const data = await api.importInventoryFile()
    if (!data || data.error) { alert(data?.error || 'Import failed'); return }
    const rows = Array.isArray(data) ? data : [data]
    const cols = Object.keys(rows[0] || {})
    setImportModal({ rows, columns: cols, mapping: detectMapping(cols) })
  }
  const confirmImport = async () => {
    const { rows, mapping } = importModal
    const mapped = applyMapping(rows, mapping)
    for (const item of mapped) {
      const dept = depts.find(d => d.name.toLowerCase() === (item.department || '').toLowerCase())
      await api.saveItem({ ...item, department_id: dept ? dept.id : null })
    }
    setImportModal(null); loadAll()
  }
  const clearAll = async () => {
    await api.clearItems()
    // Also empty the contents of every case so they don't reference deleted items
    await Promise.all(cases.map(c => c.items?.length > 0 ? api.cases.save({ ...c, items: [] }) : Promise.resolve()))
    setConfirmClearModal(false)
    loadAll()
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const toggleSel = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleGroup = (id) => setCollapsedGroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSubgroup = (id) => setCollapsedSubgroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleCaseRow = (id) => setCollapsedCases(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleCaseGroup = (id) => setCollapsedCaseGroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleCaseSubgroup = (id) => setCollapsedCaseSubgroups(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Drag & Drop ───────────────────────────────────────────────────
  const handleDragStart = (e, type, id) => {
    e.stopPropagation()
    const ids = type === 'item' && selected.has(id) && selected.size > 1
      ? [...selected] : [id]
    dragging.current = { type, ids }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', ids.length > 1 ? `${ids.length} items` : id.toString())
  }

  const handleDragEnd = () => {
    dragging.current = null
    setDropOver(null)
  }

  const handleDropOnGroup = async (e, groupId) => {
    e.preventDefault()
    e.stopPropagation()
    setDropOver(null)
    const d = dragging.current
    if (!d) return
    if (d.type === 'item') {
      for (const id of d.ids) {
        const item = items.find(i => i.id === id)
        if (item) await api.saveItem({ ...item, group_id: groupId })
      }
    } else if (d.type === 'case') {
      for (const id of d.ids) {
        const c = cases.find(x => x.id === id)
        if (c) await api.cases.save({ ...c, group_id: groupId })
      }
    }
    dragging.current = null
    loadAll()
  }

  const handleDropOnCase = (e, caseId) => {
    e.preventDefault()
    e.stopPropagation()
    setDropOver(null)
    const d = dragging.current
    if (!d || d.type !== 'item') return
    const targetCase = cases.find(c => c.id === caseId)
    if (!targetCase) return
    // Build list of droppable items with availability info
    const pendingItems = d.ids.map(id => {
      const item = items.find(i => i.id === id)
      if (!item) return null
      const totalInv = parseInt(item.quantity) || 1
      const allocatedElsewhere = cases
        .filter(c => c.id !== caseId)
        .reduce((s, c) => {
          const ci = (c.items || []).find(ci => ci.id === id)
          return s + (ci ? (ci.qty || 1) : 0)
        }, 0)
      const currentInCase = (targetCase.items || []).find(ci => ci.id === id)?.qty || 0
      const maxAvail = Math.max(0, totalInv - allocatedElsewhere)
      return { item, currentInCase, maxAvail }
    }).filter(Boolean).filter(p => p.maxAvail > 0)
    dragging.current = null
    if (pendingItems.length === 0) return
    setDropQtyModal({ targetCase, pendingItems, index: 0, qty: 1 })
  }

  const commitDropQty = async () => {
    const { targetCase, pendingItems, index, qty } = dropQtyModal
    const { item, currentInCase, maxAvail } = pendingItems[index]
    const newItems = [...(targetCase.items || [])]
    const newQty = Math.min(maxAvail, currentInCase + qty)
    const existing = newItems.find(ci => ci.id === item.id)
    if (existing) existing.qty = newQty
    else newItems.push({ id: item.id, name: item.name, qty: newQty })
    const updatedCase = { ...targetCase, items: newItems }
    await api.cases.save(updatedCase)
    // If more items queued, advance to next; otherwise close
    if (index + 1 < pendingItems.length) {
      setDropQtyModal({ targetCase: updatedCase, pendingItems, index: index + 1, qty: 1 })
    } else {
      setDropQtyModal(null)
      loadAll()
    }
  }

  const topGroups = groups.filter(g => !g.parent_id)
  const subgroupsOf = (pid) => groups.filter(g => g.parent_id === pid)
  const itemsInGroup = (gid) => items.filter(i => i.group_id === gid)
  const ungroupedItems = items.filter(i => !i.group_id)
  const casesInGroup = (gid) => cases.filter(c => c.group_id === gid)
  const ungroupedCases = cases.filter(c => !c.group_id || !groups.find(g => g.id === c.group_id))

  const lsearch = search.toLowerCase()
  const matchItem = (item) => !search || item.name.toLowerCase().includes(lsearch) || (item.sku || '').toLowerCase().includes(lsearch)
  const matchCase = (c) => !search || c.name.toLowerCase().includes(lsearch)

  const totalUnits = items.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0)

  const caseItemResults = useMemo(() => {
    if (!caseItemSearch.trim()) return []
    const q = caseItemSearch.toLowerCase()
    return items.filter(i => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q)).slice(0, 8)
  }, [caseItemSearch, items])

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">Items Library</h1>
          <p className="text-gray-400 text-sm mt-1">{items.length} items · {totalUnits} units total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={startInventoryImport} className="btn-secondary"><Download size={14} /> From Inventory</button>
          <button onClick={startImport} className="btn-secondary"><Upload size={14} /> Import Excel</button>
          {items.length > 0 && <button onClick={() => setConfirmClearModal(true)} className="btn-danger"><Trash size={14} /> Clear All</button>}
          <button onClick={() => openNewGroup(null)} className="btn-secondary"><FolderPlus size={14} /> Create Group</button>
          <button onClick={openNewCase} className="btn-secondary"><Layers size={14} /> Create Case</button>
          <button onClick={openNewItem} className="btn-primary"><Plus size={16} /> Add Item</button>
        </div>
      </div>

      {/* Search + select all */}
      <div className="px-6 pb-3 flex-shrink-0 space-y-2">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="text" className="input-field pl-8" placeholder="Search items..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {items.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-blue-500"
              checked={selected.size === items.length}
              onChange={() => selected.size === items.length ? setSelected(new Set()) : setSelected(new Set(items.map(i => i.id)))} />
            Select all {items.length} items
          </label>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-0.5">

        {/* Top-level groups */}
        {topGroups.map(group => {
          const subs = subgroupsOf(group.id)
          const directItems = itemsInGroup(group.id)
          const groupItemCount = subs.reduce((s, sg) => s + itemsInGroup(sg.id).length, 0) + directItems.length
          const isCollapsed = collapsedGroups.has(group.id)
          return (
            <div key={group.id}>
              <div
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 group/grow cursor-pointer transition-colors ${
                  dropOver?.zone === 'group' && dropOver?.id === group.id ? 'bg-blue-500/15 ring-1 ring-blue-400/40' : ''
                }`}
                onClick={() => toggleGroup(group.id)}
                onDragOver={e => { e.preventDefault(); setDropOver({ zone: 'group', id: group.id }) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(null) }}
                onDrop={e => handleDropOnGroup(e, group.id)}
              >
                <span className="text-white/40 flex-shrink-0">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </span>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                <span className="font-semibold text-white">{group.name}</span>
                <span className="text-xs text-white/40">{groupItemCount} items</span>
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/grow:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openNewGroup(group.id)}
                    className="flex items-center gap-1 text-xs text-white/50 hover:text-white px-2 py-0.5 rounded hover:bg-white/10">
                    <FolderPlus size={11} /> + Subgroup
                  </button>
                  <button onClick={() => openEditGroup(group)} className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10"><Pencil size={13} /></button>
                  <button onClick={() => deleteGroup(group.id)} className="p-1 text-white/40 hover:text-red-400 rounded hover:bg-white/10"><Trash2 size={13} /></button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="ml-5 border-l border-white/10">
                  {/* Direct items in group */}
                  {directItems.filter(matchItem).map(item => (
                    <ItemRow key={item.id} item={item} depts={depts}
                      selected={selected.has(item.id)} onToggle={() => toggleSel(item.id)}
                      onEdit={() => openEditItem(item)} onDelete={() => deleteItem(item.id)}
                      onDragStart={e => handleDragStart(e, 'item', item.id)} onDragEnd={handleDragEnd} />
                  ))}
                  {/* Subgroups */}
                  {subs.map(sub => {
                    const subItems = itemsInGroup(sub.id).filter(matchItem)
                    const isSubCollapsed = collapsedSubgroups.has(sub.id)
                    return (
                      <div key={sub.id}>
                        <div
                          className={`flex items-center gap-2 py-1.5 px-3 hover:bg-white/5 group/sgrow cursor-pointer transition-colors ${
                            dropOver?.zone === 'group' && dropOver?.id === sub.id ? 'bg-blue-500/15 ring-1 ring-blue-400/40 rounded-lg' : ''
                          }`}
                          onClick={() => toggleSubgroup(sub.id)}
                          onDragOver={e => { e.preventDefault(); setDropOver({ zone: 'group', id: sub.id }) }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(null) }}
                          onDrop={e => handleDropOnGroup(e, sub.id)}
                        >
                          <span className="text-white/30 flex-shrink-0">
                            {isSubCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          </span>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || group.color }} />
                          <span className="font-medium text-white/80 text-sm">{sub.name}</span>
                          <span className="text-xs text-white/30">{subItems.length} {subItems.length === 1 ? 'item' : 'items'}</span>
                          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/sgrow:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEditGroup(sub)} className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10"><Pencil size={12} /></button>
                            <button onClick={() => deleteGroup(sub.id)} className="p-1 text-white/40 hover:text-red-400 rounded hover:bg-white/10"><Trash2 size={12} /></button>
                          </div>
                        </div>
                        {!isSubCollapsed && subItems.map(item => (
                          <ItemRow key={item.id} item={item} depts={depts} indent
                            selected={selected.has(item.id)} onToggle={() => toggleSel(item.id)}
                            onEdit={() => openEditItem(item)} onDelete={() => deleteItem(item.id)}
                            onDragStart={e => handleDragStart(e, 'item', item.id)} onDragEnd={handleDragEnd} />
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Ungrouped items */}
        {ungroupedItems.filter(matchItem).map(item => (
          <ItemRow key={item.id} item={item} depts={depts}
            selected={selected.has(item.id)} onToggle={() => toggleSel(item.id)}
            onEdit={() => openEditItem(item)} onDelete={() => deleteItem(item.id)}
            onDragStart={e => handleDragStart(e, 'item', item.id)} onDragEnd={handleDragEnd} />
        ))}

        {/* Cases section — organized by case group/subgroup */}
        {cases.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 py-1.5 px-2">
              <Layers size={14} className="text-amber-400 flex-shrink-0" />
              <span className="font-semibold text-white">Cases</span>
              <span className="text-xs text-white/40">{cases.length} case{cases.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Cases under groups */}
            {topGroups
              .filter(group =>
                casesInGroup(group.id).length > 0 ||
                subgroupsOf(group.id).some(sg => casesInGroup(sg.id).length > 0)
              )
              .map(group => {
                const isCaseGroupCollapsed = collapsedCaseGroups.has(group.id)
                const directCases = casesInGroup(group.id).filter(matchCase)
                const subsWithCases = subgroupsOf(group.id).filter(sg => casesInGroup(sg.id).length > 0)
                const totalCount = casesInGroup(group.id).length +
                  subsWithCases.reduce((s, sg) => s + casesInGroup(sg.id).length, 0)
                return (
                  <div key={`casegroup-${group.id}`}>
                    <div
                      className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => toggleCaseGroup(group.id)}
                    >
                      <span className="text-white/40 flex-shrink-0">
                        {isCaseGroupCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      </span>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="font-semibold text-white">{group.name}</span>
                      <span className="text-xs text-white/40">{totalCount} case{totalCount !== 1 ? 's' : ''}</span>
                    </div>
                    {!isCaseGroupCollapsed && (
                      <div className="ml-5 border-l border-white/10">
                        {directCases.map(c => (
                          <div key={c.id}>
                            <div className={`flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 group/crow cursor-grab active:cursor-grabbing transition-colors ${dropOver?.zone === 'case' && dropOver?.id === c.id ? 'bg-amber-500/15 ring-1 ring-amber-400/40 rounded-lg' : ''}`}
                              draggable onDragStart={e => handleDragStart(e, 'case', c.id)} onDragEnd={handleDragEnd}
                              onDragOver={e => { e.preventDefault(); setDropOver({ zone: 'case', id: c.id }) }}
                              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(null) }}
                              onDrop={e => handleDropOnCase(e, c.id)} onClick={() => toggleCaseRow(c.id)}
                            >
                              <span className="text-white/30 flex-shrink-0">{collapsedCases.has(c.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
                              <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: c.color || '#f59e0b' }} />
                              <span className="font-medium text-white text-sm flex-1 min-w-0 truncate">{c.name}</span>
                              <span className="text-xs text-white/40 font-mono whitespace-nowrap">{c.length}×{c.width}×{c.height}"</span>
                              <span className="text-xs text-white/40 whitespace-nowrap">{c.weight} lbs</span>
                              {c.items?.length > 0 && <span className="text-xs text-white/40 whitespace-nowrap">{c.items.length} item{c.items.length !== 1 ? 's' : ''}</span>}
                              <div className="flex items-center gap-1 opacity-0 group-hover/crow:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                                {c.items?.length > 0 && <button onClick={() => emptyCase(c)} className="text-xs px-2 py-0.5 rounded border border-orange-500/40 text-orange-400 hover:bg-orange-500/20 hover:border-orange-400/60 transition-colors">Empty</button>}
                                <button onClick={() => openEditCase(c)} className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10"><Pencil size={13} /></button>
                                <button onClick={() => deleteCase(c.id)} className="p-1 text-white/40 hover:text-red-400 rounded hover:bg-white/10"><Trash2 size={13} /></button>
                              </div>
                            </div>
                            {!collapsedCases.has(c.id) && c.items?.length > 0 && (
                              <div className="ml-8 border-l border-white/10">
                                {c.items.map((ci, idx) => (
                                  <div key={idx} className="flex items-center gap-2 py-1 px-3 text-sm text-white/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                                    <span>{ci.name || ci.id}</span>
                                    {(ci.qty || 1) > 1 && <span className="text-xs text-white/30">×{ci.qty}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {subsWithCases.map(sub => {
                          const isCaseSubCollapsed = collapsedCaseSubgroups.has(sub.id)
                          const subCases = casesInGroup(sub.id).filter(matchCase)
                          return (
                            <div key={`casesubgroup-${sub.id}`}>
                              <div className="flex items-center gap-2 py-1.5 px-3 hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => toggleCaseSubgroup(sub.id)}>
                                <span className="text-white/30 flex-shrink-0">{isCaseSubCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color || group.color }} />
                                <span className="font-medium text-white/80 text-sm">{sub.name}</span>
                                <span className="text-xs text-white/30">{subCases.length} case{subCases.length !== 1 ? 's' : ''}</span>
                              </div>
                              {!isCaseSubCollapsed && subCases.map(c => (
                                <div key={c.id} className="ml-5">
                                  <div className={`flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 group/crow cursor-grab active:cursor-grabbing transition-colors ${dropOver?.zone === 'case' && dropOver?.id === c.id ? 'bg-amber-500/15 ring-1 ring-amber-400/40 rounded-lg' : ''}`}
                                    draggable onDragStart={e => handleDragStart(e, 'case', c.id)} onDragEnd={handleDragEnd}
                                    onDragOver={e => { e.preventDefault(); setDropOver({ zone: 'case', id: c.id }) }}
                                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(null) }}
                                    onDrop={e => handleDropOnCase(e, c.id)} onClick={() => toggleCaseRow(c.id)}
                                  >
                                    <span className="text-white/30 flex-shrink-0">{collapsedCases.has(c.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
                                    <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: c.color || '#f59e0b' }} />
                                    <span className="font-medium text-white text-sm flex-1 min-w-0 truncate">{c.name}</span>
                                    <span className="text-xs text-white/40 font-mono whitespace-nowrap">{c.length}×{c.width}×{c.height}"</span>
                                    <span className="text-xs text-white/40 whitespace-nowrap">{c.weight} lbs</span>
                                    {c.items?.length > 0 && <span className="text-xs text-white/40 whitespace-nowrap">{c.items.length} item{c.items.length !== 1 ? 's' : ''}</span>}
                                    <div className="flex items-center gap-1 opacity-0 group-hover/crow:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                                      {c.items?.length > 0 && <button onClick={() => emptyCase(c)} className="text-xs px-2 py-0.5 rounded border border-orange-500/40 text-orange-400 hover:bg-orange-500/20 hover:border-orange-400/60 transition-colors">Empty</button>}
                                      <button onClick={() => openEditCase(c)} className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10"><Pencil size={13} /></button>
                                      <button onClick={() => deleteCase(c.id)} className="p-1 text-white/40 hover:text-red-400 rounded hover:bg-white/10"><Trash2 size={13} /></button>
                                    </div>
                                  </div>
                                  {!collapsedCases.has(c.id) && c.items?.length > 0 && (
                                    <div className="ml-8 border-l border-white/10">
                                      {c.items.map((ci, idx) => (
                                        <div key={idx} className="flex items-center gap-2 py-1 px-3 text-sm text-white/50">
                                          <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                                          <span>{ci.name || ci.id}</span>
                                          {(ci.qty || 1) > 1 && <span className="text-xs text-white/30">×{ci.qty}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

            {/* Ungrouped cases */}
            {ungroupedCases.filter(matchCase).map(c => (
              <div key={c.id}>
                <div className={`flex items-center gap-2 py-1.5 px-2 hover:bg-white/5 group/crow cursor-grab active:cursor-grabbing transition-colors ${dropOver?.zone === 'case' && dropOver?.id === c.id ? 'bg-amber-500/15 ring-1 ring-amber-400/40 rounded-lg' : ''}`}
                  draggable onDragStart={e => handleDragStart(e, 'case', c.id)} onDragEnd={handleDragEnd}
                  onDragOver={e => { e.preventDefault(); setDropOver({ zone: 'case', id: c.id }) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOver(null) }}
                  onDrop={e => handleDropOnCase(e, c.id)} onClick={() => toggleCaseRow(c.id)}
                >
                  <span className="text-white/30 flex-shrink-0">{collapsedCases.has(c.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
                  <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: c.color || '#f59e0b' }} />
                  <span className="font-medium text-white text-sm flex-1 min-w-0 truncate">{c.name}</span>
                  <span className="text-xs text-white/40 font-mono whitespace-nowrap">{c.length}×{c.width}×{c.height}"</span>
                  <span className="text-xs text-white/40 whitespace-nowrap">{c.weight} lbs</span>
                  {c.items?.length > 0 && <span className="text-xs text-white/40 whitespace-nowrap">{c.items.length} item{c.items.length !== 1 ? 's' : ''}</span>}
                  <div className="flex items-center gap-1 opacity-0 group-hover/crow:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {c.items?.length > 0 && <button onClick={() => emptyCase(c)} className="text-xs px-2 py-0.5 rounded border border-orange-500/40 text-orange-400 hover:bg-orange-500/20 hover:border-orange-400/60 transition-colors">Empty</button>}
                    <button onClick={() => openEditCase(c)} className="p-1 text-white/40 hover:text-white rounded hover:bg-white/10"><Pencil size={13} /></button>
                    <button onClick={() => deleteCase(c.id)} className="p-1 text-white/40 hover:text-red-400 rounded hover:bg-white/10"><Trash2 size={13} /></button>
                  </div>
                </div>
                {!collapsedCases.has(c.id) && c.items?.length > 0 && (
                  <div className="ml-8 border-l border-white/10">
                    {c.items.map((ci, idx) => (
                      <div key={idx} className="flex items-center gap-2 py-1 px-3 text-sm text-white/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                        <span>{ci.name || ci.id}</span>
                        {(ci.qty || 1) > 1 && <span className="text-xs text-white/30">×{ci.qty}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && cases.length === 0 && groups.length === 0 && (
          <div className="card text-center py-12 text-gray-500 mt-4">
            <Package size={36} className="mx-auto mb-3 opacity-30" />
            <p>No items yet. Add items or import from Excel.</p>
          </div>
        )}
      </div>

      {/* ── Add / Edit Item Modal ────────────────────────────────────── */}
      {itemModal && (
        <Modal title={itemModal === 'new' ? 'Add Item' : 'Edit Item'} onClose={() => setItemModal(null)}>
          <div className="p-5 space-y-4">
            <div className={itemForm.unique_serials ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <label className="label">Item Name *</label>
                <input className="input-field" value={itemForm.name} autoFocus
                  placeholder="e.g. Audio Console Case"
                  onChange={e => setI('name', e.target.value)} />
              </div>
              {!itemForm.unique_serials && (
                <div>
                  <label className="label">Barcode / SKU</label>
                  <input className="input-field" value={itemForm.sku || ''}
                    placeholder="e.g. AUD-001"
                    onChange={e => setI('sku', e.target.value)} />
                </div>
              )}
            </div>
            <div className={itemForm.unique_serials ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <label className="label">Department</label>
                <select className="input-field" value={itemForm.department_id || ''}
                  onChange={e => setI('department_id', e.target.value || null)}>
                  <option value="">— None —</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {!itemForm.unique_serials && (
                <div>
                  <label className="label">Serial Number</label>
                  <input className="input-field" value={itemForm.serial || ''}
                    placeholder="e.g. SN-2024-001"
                    onChange={e => setI('serial', e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <label className="label">Group</label>
              <select className="input-field" value={itemForm.group_id || ''}
                onChange={e => setI('group_id', e.target.value || null)}>
                <option value="">— Ungrouped —</option>
                {topGroups.map(g => (
                  <optgroup key={g.id} label={g.name}>
                    <option value={g.id}>{g.name} (top level)</option>
                    {subgroupsOf(g.id).map(sg => (
                      <option key={sg.id} value={sg.id}>{sg.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[['length','Length (In)'],['width','Width (In)'],['height','Height (In)'],['weight','Weight (Lbs)']].map(([f, label]) => (
                <div key={f}>
                  <label className="label">{label}</label>
                  <input type="number" className="input-field" min={0} step={0.1} value={itemForm[f]}
                    onChange={e => setI(f, parseFloat(e.target.value) || 0)} />
                </div>
              ))}
            </div>
            <div>
              <label className="label">Quantity</label>
              <input type="number" className="input-field max-w-[120px]" min={1} value={itemForm.quantity}
                onChange={e => handleItemQtyChange(e.target.value)} />
            </div>

            {/* Unique serials per unit */}
            <div>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer select-none transition-colors ${
                itemForm.unique_serials ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}>
                <input type="checkbox" className="w-4 h-4 mt-0.5 accent-purple-400 flex-shrink-0"
                  checked={!!itemForm.unique_serials}
                  onChange={e => toggleUniqueSerials(e.target.checked)} />
                <div>
                  <p className="text-sm font-semibold text-white">Each unit has a unique barcode &amp; serial number</p>
                  <p className="text-xs text-white/40">Enter individual barcode and serial for each of the {itemForm.quantity} units</p>
                </div>
              </label>
              {!!itemForm.unique_serials && (itemForm.quantity > 1 || unitSerials.length > 0) && (
                <div className="mt-3 space-y-2">
                  <div className="grid gap-2 px-1" style={{ gridTemplateColumns: '52px 1fr 1fr' }}>
                    <span />
                    <span className="text-xs text-white/40 font-medium">Barcode / SKU</span>
                    <span className="text-xs text-white/40 font-medium">Serial Number</span>
                  </div>
                  {Array.from({ length: itemForm.quantity }, (_, i) => (
                    <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '52px 1fr 1fr' }}>
                      <span className="text-xs text-white/40 text-right pr-1">Unit {i + 1}</span>
                      <input className="input-field py-1.5 text-sm" placeholder="Barcode"
                        value={unitSerials[i]?.sku || ''}
                        onChange={e => setUnitSerials(prev => {
                          const next = Array.from({ length: itemForm.quantity }, (_, j) => prev[j] || { sku: '', serial: '' })
                          next[i] = { ...next[i], sku: e.target.value }
                          return next
                        })} />
                      <input className="input-field py-1.5 text-sm" placeholder="Serial #"
                        value={unitSerials[i]?.serial || ''}
                        onChange={e => setUnitSerials(prev => {
                          const next = Array.from({ length: itemForm.quantity }, (_, j) => prev[j] || { sku: '', serial: '' })
                          next[i] = { ...next[i], serial: e.target.value }
                          return next
                        })} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input-field resize-none" rows={2} value={itemForm.notes || ''}
                placeholder="Optional..." onChange={e => setI('notes', e.target.value)} />
            </div>
          </div>
          <ModalFooter onCancel={() => setItemModal(null)} onSave={saveItem}
            saveLabel={<><Check size={14} /> Save Item</>} />
        </Modal>
      )}

      {/* ── Create / Edit Case Modal ─────────────────────────────────── */}
      {caseModal && (
        <Modal
          title={caseModal === 'new' ? 'Create Case' : 'Edit Case'}
          icon={<Layers size={18} className="text-amber-400" />}
          onClose={() => setCaseModal(null)}>
          <div className="p-5 space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-xs text-amber-200/80">
              A Case is a physical road case. Its dimensions are what get packed into the truck. Items bound to this case are its contents.
            </div>
            <div>
              <label className="label">Case Name *</label>
              <input className="input-field" value={caseForm.name} autoFocus
                placeholder="e.g. Audio Console Case"
                onChange={e => setC('name', e.target.value)} />
            </div>
            {caseModal === 'new' && (
              <div>
                <label className="label">How many cases to create?</label>
                <input type="number" className="input-field max-w-[120px]" min={1} value={caseQty}
                  onChange={e => handleCaseQtyChange(e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Group</label>
              <select className="input-field" value={caseForm.group_id || ''}
                onChange={e => setC('group_id', e.target.value || null)}>
                <option value="">— Ungrouped —</option>
                {topGroups.map(g => (
                  <optgroup key={g.id} label={g.name}>
                    <option value={g.id}>{g.name} (top level)</option>
                    {subgroupsOf(g.id).map(sg => (
                      <option key={sg.id} value={sg.id}>{sg.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[['length','Length (In)'],['width','Width (In)'],['height','Height (In)'],['weight','Weight (Lbs)']].map(([f, label]) => (
                <div key={f}>
                  <label className="label">{label}</label>
                  <input type="number" className="input-field" min={0} step={0.1} value={caseForm[f]}
                    onChange={e => setC(f, parseFloat(e.target.value) || 0)} />
                </div>
              ))}
            </div>
            <ColorPicker value={caseForm.color} onChange={v => setC('color', v)} />
            <div>
              <p className="text-sm font-semibold text-white mb-2">Placement Restrictions</p>
              <div className="space-y-1">
                {[
                  ['can_rotate_lr', 'Can rotate left/right'],
                  ['can_tip_side', 'Can tip on side'],
                  ['can_flip', 'Can flip upside down'],
                  ['can_stack_on_others', 'Can stack on other cases'],
                  ['allow_stacking_on_top', 'Allow stacking on top'],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 cursor-pointer">
                    <span className="text-sm text-white/80">{label}</span>
                    <input type="checkbox" className="w-4 h-4 accent-amber-400"
                      checked={!!caseForm[k]} onChange={e => setC(k, e.target.checked ? 1 : 0)} />
                  </label>
                ))}
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm text-white/80">Max stack quantity </span>
                    <span className="text-xs text-white/40">cases of same type allowed high — 0 = unlimited</span>
                  </div>
                  <input type="number" className="input-field w-16 text-center py-1 px-2 text-sm" min={0}
                    value={caseForm.max_stack_qty || 0}
                    onChange={e => setC('max_stack_qty', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input-field resize-none" rows={2} value={caseForm.notes || ''}
                placeholder="Optional..." onChange={e => setC('notes', e.target.value)} />
            </div>
            {!caseForm.unique_serials && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Barcode / SKU</label>
                  <input className="input-field" value={caseForm.sku || ''} placeholder="Optional"
                    onChange={e => setC('sku', e.target.value)} />
                </div>
                <div>
                  <label className="label">Serial Number</label>
                  <input className="input-field" value={caseForm.serial || ''} placeholder="Optional"
                    onChange={e => setC('serial', e.target.value)} />
                </div>
              </div>
            )}

            {/* Unique serials per case */}
            <div>
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer select-none transition-colors ${
                caseForm.unique_serials ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/10 bg-white/5 hover:bg-white/8'
              }`}>
                <input type="checkbox" className="w-4 h-4 mt-0.5 accent-purple-400 flex-shrink-0"
                  checked={!!caseForm.unique_serials}
                  onChange={e => toggleCaseUniqueSerials(e.target.checked)} />
                <div>
                  <p className="text-sm font-semibold text-white">Each case has a unique barcode &amp; serial number</p>
                  <p className="text-xs text-white/40">Enter individual barcode and serial for each of the {caseQty} cases</p>
                </div>
              </label>
              {!!caseForm.unique_serials && caseQty > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="grid gap-2 px-1" style={{ gridTemplateColumns: '56px 1fr 1fr' }}>
                    <span />
                    <span className="text-xs text-white/40 font-medium">Barcode / SKU</span>
                    <span className="text-xs text-white/40 font-medium">Serial Number</span>
                  </div>
                  {Array.from({ length: Math.max(1, parseInt(caseQty) || 1) }, (_, i) => (
                    <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '56px 1fr 1fr' }}>
                      <span className="text-xs text-white/40 text-right pr-1">Case {i + 1}</span>
                      <input className="input-field py-1.5 text-sm" placeholder="Barcode"
                        value={caseUnitSerials[i]?.sku || ''}
                        onChange={e => setCaseUnitSerials(prev => {
                          const next = Array.from({ length: Math.max(1, parseInt(caseQty) || 1) }, (_, j) => prev[j] || { sku: '', serial: '' })
                          next[i] = { ...next[i], sku: e.target.value }
                          return next
                        })} />
                      <input className="input-field py-1.5 text-sm" placeholder="Serial #"
                        value={caseUnitSerials[i]?.serial || ''}
                        onChange={e => setCaseUnitSerials(prev => {
                          const next = Array.from({ length: Math.max(1, parseInt(caseQty) || 1) }, (_, j) => prev[j] || { sku: '', serial: '' })
                          next[i] = { ...next[i], serial: e.target.value }
                          return next
                        })} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {caseModal === 'new' ? (
              <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs text-white/50">
                Contents can be added after the case is created — open the case with the edit button to assign items.
              </div>
            ) : (
            <div>
              <p className="text-sm font-semibold text-white mb-2">Contents</p>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <input className="input-field" value={caseItemSearch}
                    placeholder="Search items to add..."
                    onChange={e => setCaseItemSearch(e.target.value)} />
                  {caseItemResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-dark-700 border border-dark-500 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                      {caseItemResults.map(item => {
                        const inv = parseInt(item.quantity) || 1
                        const avail = availableForCase(item.id)
                        return (
                          <button key={item.id} type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 text-white/80 flex items-center justify-between"
                            onClick={() => { addItemToCase(item, caseItemQty); setCaseItemSearch(''); setCaseItemQty(1) }}>
                            <span>{item.name}{item.sku && <span className="text-white/40 text-xs ml-2">{item.sku}</span>}</span>
                            <span className={`text-xs ml-2 whitespace-nowrap ${avail > 0 ? 'text-green-400' : 'text-red-400'}`}>{avail}/{inv} avail</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <input type="number" min="1" className="input-field w-16 text-center py-2 text-sm flex-shrink-0"
                  value={caseItemQty} onChange={e => setCaseItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                  title="Quantity to add" />
              </div>
              {(caseForm.items || []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {(caseForm.items || []).map((ci, idx) => {
                    const inv = items.find(i => i.id === ci.id)
                    const maxQty = availableForCase(ci.id)
                    const overCap = (ci.qty || 1) > maxQty
                    return (
                      <div key={idx} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${
                        overCap ? 'bg-red-500/10 border border-red-500/30' : 'bg-white/5'
                      }`}>
                        <div className="min-w-0">
                          <span className="text-sm text-white/80">{ci.name}</span>
                          {inv && <span className="text-xs text-white/30 ml-2">max {maxQty}</span>}
                          {overCap && <span className="text-xs text-red-400 ml-1">⚠ exceeds stock</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input type="number" min="1" max={maxQty}
                            className={`input-field w-14 text-center py-0.5 px-1 text-sm ${
                              overCap ? 'border-red-500/50 text-red-300' : ''
                            }`}
                            value={ci.qty || 1}
                            onChange={e => updateCaseItemQty(ci.id, e.target.value)} />
                          <button type="button" onClick={() => removeItemFromCase(ci.id)}
                            className="text-white/40 hover:text-red-400"><X size={12} /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )}
          </div>
          <ModalFooter onCancel={() => setCaseModal(null)} onSave={saveCase}
            saveLabel={<><Check size={14} /> {caseModal === 'new' ? 'Create Case' : 'Save Case'}</>} />
        </Modal>
      )}

      {/* ── Add / Edit Group Modal ───────────────────────────────────── */}
      {groupModal && (
        <Modal
          title={groupModal.mode === 'new' ? (groupModal.parentId ? 'Add Subgroup' : 'Add Group') : 'Edit Group'}
          onClose={() => setGroupModal(null)}>
          <div className="p-5 space-y-4">
            <div>
              <label className="label">Group Name</label>
              <input className="input-field" value={groupForm.name} autoFocus
                placeholder="e.g. Audio"
                onChange={e => setG('name', e.target.value)} />
            </div>
            <ColorPicker value={groupForm.color} onChange={v => setG('color', v)} />
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: groupForm.color }} />
              <span className="font-semibold text-white">{groupForm.name || 'Group name preview'}</span>
            </div>
          </div>
          <ModalFooter onCancel={() => setGroupModal(null)} onSave={saveGroup}
            saveLabel={groupModal.mode === 'new' ? <><Check size={14} /> Create</> : <><Check size={14} /> Save</>} />
        </Modal>
      )}

      {/* ── Drop Quantity Picker Modal ──────────────────────────────── */}
      {dropQtyModal && (() => {
        const { pendingItems, index, qty } = dropQtyModal
        const { item, currentInCase, maxAvail } = pendingItems[index]
        const isMulti = pendingItems.length > 1
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-xs shadow-2xl">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-dark-500">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Layers size={15} className="text-amber-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-white text-sm truncate">Add to {dropQtyModal.targetCase.name}</h2>
                  {isMulti && <p className="text-xs text-white/40">Item {index + 1} of {pendingItems.length}</p>}
                </div>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-sm text-white font-medium truncate">{item.name}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {currentInCase > 0
                      ? <>{currentInCase} already in case · <span className="text-green-400">{maxAvail} more available</span></>
                      : <span className="text-green-400">{maxAvail} available</span>
                    }
                  </p>
                </div>
                <div>
                  <label className="label">Quantity to add</label>
                  <input type="number" autoFocus min={1} max={maxAvail}
                    className="input-field w-28 text-center"
                    value={qty}
                    onChange={e => setDropQtyModal(m => ({ ...m, qty: Math.min(maxAvail, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    onKeyDown={e => { if (e.key === 'Enter') commitDropQty() }}
                  />
                  <span className="text-xs text-white/40 ml-2">max {maxAvail}</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500">
                <button onClick={() => { setDropQtyModal(null); loadAll() }} className="btn-secondary">Cancel</button>
                <button onClick={commitDropQty} className="btn-primary flex items-center gap-1.5">
                  <Check size={14} /> {isMulti && index + 1 < pendingItems.length ? 'Next' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Confirm Clear All Modal ─────────────────────────────────── */}
      {confirmClearModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-dark-500">
              <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <h2 className="font-semibold text-white">Clear All Items?</h2>
            </div>
            <div className="px-5 py-4 text-sm text-white/70 space-y-2">
              <p>This will permanently delete <span className="text-white font-semibold">all {items.length} items</span> from your inventory.</p>
              <p className="text-red-400/80">This action cannot be undone.</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500">
              <button onClick={() => setConfirmClearModal(false)} className="btn-secondary">No, Keep Items</button>
              <button onClick={clearAll} className="btn-danger flex items-center gap-1.5"><Trash size={14} /> Yes, Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ─────────────────────────────────────────────── */}
      {importModal && (
        <Modal title={`Map Columns — ${importModal.rows.length} rows`} onClose={() => setImportModal(null)}>
          <div className="p-5 space-y-3">
            <p className="text-gray-400 text-sm">Map your spreadsheet columns to item fields. Auto-detected where possible.</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries({
                name: 'Item Name *', sku: 'SKU/Case #', department: 'Department',
                length: 'Length', width: 'Width', height: 'Height',
                weight: 'Weight', quantity: 'Quantity',
              }).map(([field, label]) => (
                <div key={field}>
                  <label className="label">{label}</label>
                  <select className="input-field" value={importModal.mapping[field] || ''}
                    onChange={e => setImportModal(m => ({ ...m, mapping: { ...m.mapping, [field]: e.target.value || undefined } }))}>
                    <option value="">— skip —</option>
                    {importModal.columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <ModalFooter onCancel={() => setImportModal(null)} onSave={confirmImport}
            saveLabel={<><Check size={14} /> Import {importModal.rows.length} Items</>} />
        </Modal>
      )}
    </div>
  )
}
