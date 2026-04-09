import { useEffect, useState, useRef } from 'react'
import { Package, Plus, Pencil, Trash2, X, Check, Upload, Download, Trash } from 'lucide-react'
import { detectMapping, applyMapping } from '../utils/excelImport'

const DEFAULT_ITEM = {
  name: '', sku: '', department_id: '', length: 12, width: 12, height: 12,
  weight: 0, quantity: 1, notes: '',
  can_rotate_lr: 1, can_tip_side: 1, can_flip: 1,
  can_stack_on_others: 1, allow_stacking_on_top: 1, max_stack_weight: 0,
}

const hasRestrictions = (item) =>
  !item.can_rotate_lr || !item.can_tip_side || !item.can_flip ||
  !item.can_stack_on_others || !item.allow_stacking_on_top || item.max_stack_weight > 0

export default function Items() {
  const [items, setItems] = useState([])
  const [depts, setDepts] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(DEFAULT_ITEM)
  const [importModal, setImportModal] = useState(null) // { rows, columns, mapping }
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set()) // ids of selected items
  const [batchModal, setBatchModal] = useState(false)
  const [batchForm, setBatchForm] = useState({}) // partial fields to apply

  const load = async () => {
    if (!window.electronAPI) return
    const [i, d] = await Promise.all([window.electronAPI.getItems(), window.electronAPI.getDepartments()])
    setItems(i)
    setDepts(d)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ ...DEFAULT_ITEM }); setEditing('new') }
  const openEdit = (item) => {
    setForm({
      can_rotate_lr: 1, can_tip_side: 1, can_flip: 1,
      can_stack_on_others: 1, allow_stacking_on_top: 1, max_stack_weight: 0,
      ...item,
    })
    setEditing(item)
  }
  const cancel = () => setEditing(null)

  const save = async () => {
    if (!form.name || !form.length || !form.width || !form.height) return
    await window.electronAPI.saveItem({ ...form, id: editing !== 'new' ? editing.id : undefined })
    setEditing(null)
    load()
  }

  const del = async (id) => {
    if (!confirm('Delete this item?')) return
    await window.electronAPI.deleteItem(id)
    load()
  }

  const clearAll = async () => {
    if (!confirm('Clear ALL items from library? This cannot be undone.')) return
    await window.electronAPI.clearItems()
    load()
  }

  // Excel import
  const startImport = async () => {
    const rows = await window.electronAPI.importExcel()
    if (!rows || !rows.length) return
    const cols = Object.keys(rows[0])
    const mapping = detectMapping(cols)
    setImportModal({ rows, columns: cols, mapping })
  }

  const startInventoryImport = async () => {
    const data = await window.electronAPI.importInventoryFile()
    if (!data || data.error) { alert(data?.error || 'Import failed'); return }
    const rows = Array.isArray(data) ? data : [data]
    const cols = Object.keys(rows[0] || {})
    const mapping = detectMapping(cols)
    setImportModal({ rows, columns: cols, mapping })
  }

  const confirmImport = async () => {
    const { rows, mapping } = importModal
    const mapped = applyMapping(rows, mapping)
    for (const item of mapped) {
      // Match department by name
      const dept = depts.find(d => d.name.toLowerCase() === (item.department || '').toLowerCase())
      await window.electronAPI.saveItem({
        ...item,
        department_id: dept ? dept.id : null,
      })
    }
    setImportModal(null)
    load()
  }

  // Selection helpers
  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(i => i.id)))
  }
  const clearSelection = () => setSelected(new Set())

  const openBatchEdit = () => {
    setBatchForm({
      department_id: '',
      can_rotate_lr: '',
      can_tip_side: '',
      can_flip: '',
      can_stack_on_others: '',
      allow_stacking_on_top: '',
      max_stack_weight: '',
    })
    setBatchModal(true)
  }

  const confirmBatchEdit = async () => {
    const updates = {}
    for (const [k, v] of Object.entries(batchForm)) {
      if (v !== '') updates[k] = v === 'true' ? 1 : v === 'false' ? 0 : v
    }
    if (Object.keys(updates).length === 0) { setBatchModal(false); return }
    for (const id of selected) {
      const item = items.find(i => i.id === id)
      if (item) await window.electronAPI.saveItem({ ...item, ...updates })
    }
    setBatchModal(false)
    clearSelection()
    load()
  }

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.sku || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.department_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Items Library</h1>
          <p className="text-gray-400 text-sm mt-1">{items.length} items total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={startInventoryImport} className="btn-secondary">
            <Download size={14} /> From Inventory
          </button>
          <button onClick={startImport} className="btn-secondary">
            <Upload size={14} /> Import Excel
          </button>
          {items.length > 0 && (
            <button onClick={clearAll} className="btn-danger">
              <Trash size={14} /> Clear All
            </button>
          )}
          {selected.size > 0 && (
            <button onClick={openBatchEdit} className="btn-secondary">
              <Pencil size={14} /> Edit {selected.size} Selected
            </button>
          )}
          <button onClick={openNew} className="btn-primary">
            <Plus size={16} /> Add Item
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        className="input-field mb-4 max-w-sm"
        placeholder="Search items..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Add/Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 sticky top-0 bg-dark-700">
              <h2 className="font-semibold text-white">{editing === 'new' ? 'Add Item' : 'Edit Item'}</h2>
              <button onClick={cancel} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Item Name *</label>
                  <input type="text" className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Audio Console Case" />
                </div>
                <div>
                  <label className="label">SKU / Case #</label>
                  <input type="text" className="input-field" value={form.sku || ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. AUD-001" />
                </div>
              </div>
              <div>
                <label className="label">Department</label>
                <select className="input-field" value={form.department_id || ''} onChange={e => setForm(f => ({ ...f, department_id: e.target.value || null }))}>
                  <option value="">— None —</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {['length', 'width', 'height', 'weight'].map(field => (
                  <div key={field}>
                    <label className="label capitalize">{field} {field === 'weight' ? '(lbs)' : '(in)'}</label>
                    <input type="number" className="input-field" value={form[field]} min={0} step={0.1}
                      onChange={e => setForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>
              <div>
                <label className="label">Quantity</label>
                <input type="number" className="input-field max-w-[120px]" value={form.quantity} min={1} step={1}
                  onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              {/* Placement Restrictions */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Placement Restrictions</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { key: 'can_rotate_lr',        label: 'Can rotate left/right',          hint: 'Swap length ↔ width' },
                    { key: 'can_tip_side',          label: 'Can tip on side',                hint: 'Swap width ↔ height' },
                    { key: 'can_flip',              label: 'Can flip upside down',           hint: '180° pitch rotation' },
                    { key: 'can_stack_on_others', label: 'This case can be stacked on others', hint: 'Allow this case to sit on top of other cases' },
                  ].map(({ key, label, hint }) => (
                    <label key={key} className="flex items-center justify-between p-2 rounded-lg bg-gray-800 cursor-pointer hover:bg-gray-750">
                      <div>
                        <span className="text-sm text-white">{label}</span>
                        <span className="text-xs text-gray-500 ml-2">{hint}</span>
                      </div>
                      <input type="checkbox"
                        className="w-4 h-4 accent-blue-500"
                        checked={!!form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.checked ? 1 : 0 }))}
                      />
                    </label>
                  ))}
                  {/* Do Not Stack / weight limit — visually grouped together */}
                  <div className={`p-2 rounded-lg border ${
                    !form.allow_stacking_on_top
                      ? 'bg-red-500/10 border-red-500/40'
                      : 'bg-gray-800 border-transparent'
                  }`}>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm text-white font-medium">Allow stacking on top of this case</span>
                        <span className="text-xs text-gray-500 ml-2">Uncheck = DO NOT STACK (no cases placed on top)</span>
                      </div>
                      <input type="checkbox"
                        className="w-4 h-4 accent-blue-500"
                        checked={!!form.allow_stacking_on_top}
                        onChange={e => setForm(f => ({ ...f, allow_stacking_on_top: e.target.checked ? 1 : 0 }))}
                      />
                    </label>
                    {!!form.allow_stacking_on_top && (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
                        <div>
                          <span className="text-sm text-white">Max weight allowed on top</span>
                          <span className="text-xs text-gray-500 ml-2">lbs — enter 0 for no limit</span>
                        </div>
                        <input type="number" min="0" className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white text-right"
                          value={form.max_stack_weight || 0}
                          onChange={e => setForm(f => ({ ...f, max_stack_weight: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input-field resize-none" rows={2} value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500 sticky bottom-0 bg-dark-700">
              <button onClick={cancel} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary"><Check size={14} /> Save Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
              <h2 className="font-semibold text-white">Map Columns — {importModal.rows.length} rows detected</h2>
              <button onClick={() => setImportModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-gray-400 text-sm">Map your spreadsheet columns to item fields. Auto-detected where possible.</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries({
                  name: 'Item Name *', sku: 'SKU/Case #', department: 'Department',
                  length: 'Length', width: 'Width', height: 'Height',
                  weight: 'Weight', quantity: 'Quantity',
                  rotate_x: 'Rotate X', rotate_y: 'Rotate Y', rotate_z: 'Rotate Z',
                }).map(([field, label]) => (
                  <div key={field}>
                    <label className="label">{label}</label>
                    <select
                      className="input-field"
                      value={importModal.mapping[field] || ''}
                      onChange={e => setImportModal(m => ({ ...m, mapping: { ...m.mapping, [field]: e.target.value || undefined } }))}
                    >
                      <option value="">— skip —</option>
                      {importModal.columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {/* Preview */}
              <div className="mt-3 bg-dark-800 rounded-lg p-3 text-xs text-gray-400">
                <strong className="text-gray-300">Preview (first 3 rows):</strong>
                <div className="mt-2 space-y-1">
                  {importModal.rows.slice(0, 3).map((row, i) => {
                    const mapped = applyMapping([row], importModal.mapping)[0]
                    return mapped ? (
                      <div key={i} className="text-gray-400">
                        {mapped.name} — {mapped.length}×{mapped.width}×{mapped.height} — qty:{mapped.quantity}
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500">
              <button onClick={() => setImportModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmImport} className="btn-primary"><Check size={14} /> Import {importModal.rows.length} Items</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Package size={36} className="mx-auto mb-3 opacity-30" />
          <p>{items.length === 0 ? 'No items yet. Add items or import from Excel.' : 'No items match your search.'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header w-8">
                  <input type="checkbox" className="w-4 h-4 accent-blue-500"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleSelectAll} />
                </th>
                <th className="table-header">Name</th>
                <th className="table-header">SKU</th>
                <th className="table-header">Dept</th>
                <th className="table-header">L × W × H (in)</th>
                <th className="table-header">Weight</th>
                <th className="table-header">Qty</th>
                <th className="table-header">Stacking</th>
                <th className="table-header">Restrictions</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className={`table-row ${selected.has(item.id) ? 'bg-blue-500/10' : ''}`}>
                  <td className="table-cell">
                    <input type="checkbox" className="w-4 h-4 accent-blue-500"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)} />
                  </td>
                  <td className="table-cell font-medium text-white">{item.name}</td>
                  <td className="table-cell text-gray-400 font-mono text-xs">{item.sku || '—'}</td>
                  <td className="table-cell">
                    {item.department_name ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.department_color }} />
                        {item.department_name}
                      </span>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="table-cell font-mono text-sm">{item.length} × {item.width} × {item.height}</td>
                  <td className="table-cell text-gray-400">{item.weight} lbs</td>
                  <td className="table-cell text-center font-semibold">{item.quantity}</td>
                  <td className="table-cell">
                    {(item.allow_stacking_on_top === 0 || item.allow_stacking_on_top === false) ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                        No Stack
                      </span>
                    ) : item.max_stack_weight > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        ≤ {item.max_stack_weight} lbs
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    {hasRestrictions(item) ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        Restricted
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-white"><Pencil size={14} /></button>
                      <button onClick={() => del(item.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Batch Edit Modal */}
      {batchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
              <h2 className="font-semibold text-white">Batch Edit — {selected.size} Items</h2>
              <button onClick={() => setBatchModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-gray-400 text-sm">Only fields you change here will be updated. Blank = keep each item's current value.</p>

              {/* Department */}
              <div>
                <label className="label">Department</label>
                <select className="input-field"
                  value={batchForm.department_id}
                  onChange={e => setBatchForm(f => ({ ...f, department_id: e.target.value }))}>
                  <option value="">— no change —</option>
                  <option value="null">Clear department</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Placement restrictions */}
              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Placement Restrictions</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { key: 'can_rotate_lr',      label: 'Can rotate left/right' },
                    { key: 'can_tip_side',        label: 'Can tip on side' },
                    { key: 'can_flip',            label: 'Can flip upside down' },
                    { key: 'can_stack_on_others', label: 'This case can be stacked on others' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-gray-800">
                      <span className="text-sm text-white">{label}</span>
                      <select className="bg-gray-700 border border-gray-600 rounded text-sm text-white px-2 py-1"
                        value={batchForm[key]}
                        onChange={e => setBatchForm(f => ({ ...f, [key]: e.target.value }))}>
                        <option value="">— no change —</option>
                        <option value="true">Yes (allowed)</option>
                        <option value="false">No (restricted)</option>
                      </select>
                    </div>
                  ))}

                  {/* No stack / weight limit */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800">
                    <span className="text-sm text-white">Allow stacking on top</span>
                    <select className="bg-gray-700 border border-gray-600 rounded text-sm text-white px-2 py-1"
                      value={batchForm.allow_stacking_on_top}
                      onChange={e => setBatchForm(f => ({ ...f, allow_stacking_on_top: e.target.value }))}>
                      <option value="">— no change —</option>
                      <option value="true">Yes (allowed)</option>
                      <option value="false">NO STACK</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800">
                    <div>
                      <span className="text-sm text-white">Max weight on top (lbs)</span>
                      <span className="text-xs text-gray-500 ml-2">0 = unlimited, blank = no change</span>
                    </div>
                    <input type="number" min="0" placeholder="—"
                      className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white text-right"
                      value={batchForm.max_stack_weight}
                      onChange={e => setBatchForm(f => ({ ...f, max_stack_weight: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500">
              <button onClick={() => setBatchModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={confirmBatchEdit} className="btn-primary"><Check size={14} /> Apply to {selected.size} Items</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
