import { useEffect, useState } from 'react'
import { Truck, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

const UNITS = ['in', 'cm', 'ft', 'mm']

const DEFAULT_TRUCK = {
  name: '', length: 636, width: 102, height: 110, max_weight: 80000, unit: 'in', notes: ''
}

export default function TruckProfiles() {
  const [trucks, setTrucks] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | truck object
  const [form, setForm] = useState(DEFAULT_TRUCK)

  const load = async () => {
    if (!window.electronAPI) return
    setTrucks(await window.electronAPI.getTrucks())
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(DEFAULT_TRUCK); setEditing('new') }
  const openEdit = (t) => { setForm({ ...t }); setEditing(t) }
  const cancel = () => setEditing(null)

  const save = async () => {
    if (!form.name || !form.length || !form.width || !form.height) return
    const id = editing !== 'new' ? editing.id : undefined
    await window.electronAPI.saveTruck({ ...form, id })
    setEditing(null)
    load()
  }

  const del = async (id) => {
    if (!confirm('Delete this truck profile?')) return
    await window.electronAPI.deleteTruck(id)
    load()
  }

  const F = ({ label, field, type = 'number', ...props }) => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input-field"
        value={form[field] ?? ''}
        onChange={e => setForm(f => ({ ...f, [field]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
        {...props}
      />
    </div>
  )

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Truck Profiles</h1>
          <p className="text-gray-400 text-sm mt-1">Configure truck and container dimensions</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Add Truck
        </button>
      </div>

      {/* Form modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
              <h2 className="font-semibold text-white">{editing === 'new' ? 'Add Truck Profile' : 'Edit Truck Profile'}</h2>
              <button onClick={cancel} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <F label="Profile Name" field="name" type="text" placeholder="e.g. 53ft Dry Van" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Unit</label>
                  <select className="input-field" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <F label={`Max Weight (lbs)`} field="max_weight" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <F label={`Length (${form.unit})`} field="length" />
                <F label={`Width (${form.unit})`} field="width" />
                <F label={`Height (${form.unit})`} field="height" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>
              <div className="text-xs text-gray-500 bg-dark-800 rounded p-2">
                Volume: {Math.round(form.length * form.width * form.height).toLocaleString()} {form.unit}³
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500">
              <button onClick={cancel} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary"><Check size={14} /> Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {trucks.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Truck size={36} className="mx-auto mb-3 opacity-30" />
          <p>No truck profiles yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Dimensions (L × W × H)</th>
                <th className="table-header">Max Weight</th>
                <th className="table-header">Volume</th>
                <th className="table-header">Unit</th>
                <th className="table-header">Notes</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {trucks.map(t => (
                <tr key={t.id} className="table-row">
                  <td className="table-cell font-medium text-white">{t.name}</td>
                  <td className="table-cell font-mono">{t.length} × {t.width} × {t.height}</td>
                  <td className="table-cell">{t.max_weight?.toLocaleString()} lbs</td>
                  <td className="table-cell text-gray-400">{Math.round(t.length * t.width * t.height).toLocaleString()}</td>
                  <td className="table-cell text-gray-400">{t.unit}</td>
                  <td className="table-cell text-gray-500 text-xs">{t.notes || '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(t)} className="text-gray-400 hover:text-white transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => del(t.id)} className="text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
