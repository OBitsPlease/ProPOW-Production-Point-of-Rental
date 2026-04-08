import { useEffect, useState } from 'react'
import { Tag, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

const PRESET_COLORS = [
  '#4f8ef7', '#7c5ef7', '#f75e8e', '#4fd1c5', '#f6ad55', '#fc8181',
  '#68d391', '#63b3ed', '#f687b3', '#e2e8f0', '#a78bfa', '#fb923c',
]

export default function Departments() {
  const [depts, setDepts] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', color: '#4f8ef7' })

  const load = async () => {
    if (!window.electronAPI) return
    setDepts(await window.electronAPI.getDepartments())
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm({ name: '', color: '#4f8ef7' }); setEditing('new') }
  const openEdit = (d) => { setForm({ ...d }); setEditing(d) }
  const cancel = () => setEditing(null)

  const save = async () => {
    if (!form.name) return
    await window.electronAPI.saveDepartment({ ...form, id: editing !== 'new' ? editing.id : undefined })
    setEditing(null)
    load()
  }

  const del = async (id) => {
    if (!confirm('Delete this department?')) return
    await window.electronAPI.deleteDepartment(id)
    load()
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Departments</h1>
          <p className="text-gray-400 text-sm mt-1">Manage departments and their color codes for 3D view</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Add Department</button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
              <h2 className="font-semibold text-white">{editing === 'new' ? 'Add Department' : 'Edit Department'}</h2>
              <button onClick={cancel} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Department Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Audio, Lighting, Video..."
                />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-md transition-all"
                      style={{
                        backgroundColor: c,
                        outline: form.color === c ? `2px solid white` : '2px solid transparent',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    className="input-field flex-1 font-mono"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  />
                  <div
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{ backgroundColor: form.color }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-dark-500">
              <button onClick={cancel} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary"><Check size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {depts.map(d => (
          <div key={d.id} className="card flex items-center gap-3 hover:border-dark-400 transition-colors">
            <div className="w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: d.color }} />
            <span className="flex-1 font-medium text-white text-sm">{d.name}</span>
            <button onClick={() => openEdit(d)} className="text-gray-500 hover:text-white"><Pencil size={13} /></button>
            <button onClick={() => del(d.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
        ))}
        {depts.length === 0 && (
          <div className="col-span-4 card text-center py-12 text-gray-500">
            <Tag size={36} className="mx-auto mb-3 opacity-30" />
            <p>No departments yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
