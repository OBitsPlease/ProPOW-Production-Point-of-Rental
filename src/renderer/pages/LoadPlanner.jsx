import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Save, FileText, Plus, ChevronDown, AlertTriangle, CheckCircle2, Archive, DownloadCloud } from 'lucide-react'
import { runBinPacking } from '../utils/binPacking'
import { generateLoadPlanPDF } from '../utils/pdfReport'
import TruckViewer3D from '../components/TruckViewer3D'

export default function LoadPlanner() {
  const { planId } = useParams()
  const navigate = useNavigate()

  const [trucks, setTrucks] = useState([])
  const [cases, setCases] = useState([])
  const [depts, setDepts] = useState([])
  const [selectedTruckId, setSelectedTruckId] = useState('')
  const [planName, setPlanName] = useState('New Load Plan')
  const [result, setResult] = useState(null) // { packed, unpacked, utilization, totalWeight, callSheet }
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [currentPlanId, setCurrentPlanId] = useState(null)
  const [repackModal, setRepackModal] = useState(false)
  const [repackName, setRepackName] = useState('')
  const [repackSaving, setRepackSaving] = useState(false)

  const load = useCallback(async () => {
    if (!window.electronAPI) return
    const [t, rawCases, rawItems, d] = await Promise.all([
      window.electronAPI.getTrucks(),
      window.electronAPI.cases.getAll(),
      window.electronAPI.getItems(),
      window.electronAPI.getDepartments(),
    ])
    // Compute each case's total weight: shell weight + sum of contained item weights
    const computedCases = rawCases.map(c => {
      const itemsWeight = (c.items || []).reduce((sum, ci) => {
        const inv = rawItems.find(i => i.id === ci.id)
        return sum + (inv ? (parseFloat(inv.weight) || 0) * (ci.qty || 1) : 0)
      }, 0)
      return { ...c, weight: (parseFloat(c.weight) || 0) + itemsWeight, quantity: 1, department_color: c.color || '#f59e0b' }
    })
    setTrucks(t)
    setCases(computedCases)
    setDepts(d)

    // Check for repack loaded via RePacks page
    const repackRaw = sessionStorage.getItem('tp_load_repack')
    if (repackRaw) {
      sessionStorage.removeItem('tp_load_repack')
      try {
        const repack = JSON.parse(repackRaw)
        if (repack.name) setPlanName(repack.name)
        if (repack.truck) {
          const matchedTruck = t.find(tr => tr.id === repack.truck.id || tr.name === repack.truck.name)
          if (matchedTruck) setSelectedTruckId(matchedTruck.id)
        }
        if (repack.result) setResult(repack.result)
        return
      } catch(e) { /* ignore parse errors */ }
    }

    if (planId) {
      const plan = await window.electronAPI.getLoadPlan(planId)
      if (plan) {
        setPlanName(plan.name)
        setSelectedTruckId(plan.truck_id)
        setCurrentPlanId(plan.id)
        if (plan.result_json) {
          setResult(JSON.parse(plan.result_json))
        }
      }
    }
  }, [planId])

  useEffect(() => { load() }, [load])

  const selectedTruck = trucks.find(t => t.id === parseInt(selectedTruckId) || t.id === selectedTruckId)

  const runPacking = async () => {
    if (!selectedTruck || cases.length === 0) return
    setRunning(true)
    // Run in next tick so UI updates
    await new Promise(r => setTimeout(r, 50))
    try {
      const r = runBinPacking(cases, selectedTruck)
      setResult(r)
    } finally {
      setRunning(false)
    }
  }

  const savePlan = async () => {
    if (!result || !selectedTruck) return
    setSaving(true)
    const plan = {
      id: currentPlanId,
      name: planName,
      truck_id: selectedTruck.id,
      result_json: JSON.stringify(result),
      utilization: result.utilization,
      total_weight: result.totalWeight,
    }
    const id = await window.electronAPI.saveLoadPlan(plan)
    setCurrentPlanId(id)
    setSaving(false)
    navigate(`/planner/${id}`, { replace: true })
  }

  const exportPDF = async () => {
    if (!result || !selectedTruck) return
    const doc = generateLoadPlanPDF(
      { name: planName, utilization: result.utilization, totalWeight: result.totalWeight, id: currentPlanId },
      result.packed,
      result.unpacked,
      result.callSheet,
      selectedTruck,
      depts,
    )
    doc.save(`${planName.replace(/\s+/g, '-')}-load-plan.pdf`)
  }

  const buildPackData = () => ({
    name: planName,
    truck: selectedTruck,
    items: cases,
    result,
    departments: depts,
    settings: { units: selectedTruck?.unit || 'in' },
  })

  const saveAsRepack = async () => {
    if (!repackName.trim()) return
    setRepackSaving(true)
    try {
      await window.electronAPI.repack.save(repackName.trim(), buildPackData())
      setRepackModal(false)
      setRepackName('')
    } finally {
      setRepackSaving(false)
    }
  }

  const saveFile = async () => {
    if (!window.electronAPI) return
    await window.electronAPI.file.saveAs(buildPackData())
  }

  const utilizationColor = result
    ? result.utilization >= 80 ? 'text-green-400' : result.utilization >= 50 ? 'text-yellow-400' : 'text-gray-400'
    : 'text-gray-400'

  return (
    <div className="flex h-full overflow-hidden">
      {/* RePack save modal */}
      {repackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl p-6 w-80">
            <h3 className="text-white font-semibold text-base mb-1">Save as RePack</h3>
            <p className="text-gray-400 text-xs mb-4">Give this preset a name so you can load it later.</p>
            <input
              autoFocus
              type="text"
              className="input-field w-full mb-4"
              placeholder="Preset name..."
              value={repackName}
              onChange={e => setRepackName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAsRepack(); if (e.key === 'Escape') setRepackModal(false) }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRepackModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition-colors"
              >Cancel</button>
              <button
                onClick={saveAsRepack}
                disabled={!repackName.trim() || repackSaving}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Archive size={13} /> {repackSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Left panel */}
      <div className="w-72 bg-dark-800 border-r border-dark-600 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-dark-600">
          <input
            type="text"
            className="input-field text-base font-semibold bg-transparent border-dark-500 mb-3"
            value={planName}
            onChange={e => setPlanName(e.target.value)}
            placeholder="Plan name..."
          />

          {/* Truck selector */}
          <label className="label">Truck Profile</label>
          <div className="relative">
            <select
              className="input-field appearance-none pr-8"
              value={selectedTruckId}
              onChange={e => setSelectedTruckId(e.target.value)}
            >
              <option value="">Select a truck...</option>
              {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          {selectedTruck && (
            <div className="mt-2 text-xs text-gray-500 font-mono bg-dark-700 rounded p-2">
              {selectedTruck.length}" × {selectedTruck.width}" × {selectedTruck.height}"
              {selectedTruck.max_weight && ` • Max ${selectedTruck.max_weight.toLocaleString()} lbs`}
            </div>
          )}
        </div>

        {/* Cases summary */}
        <div className="p-4 border-b border-dark-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">Cases ({cases.length})</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {cases.length === 0 ? (
              <p className="text-gray-600 text-xs">No cases — go to Items page to create cases</p>
            ) : (
              cases.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs text-gray-300">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color || '#f59e0b' }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-gray-500">{c.weight > 0 ? `${c.weight}lbs` : ''}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <button
            onClick={runPacking}
            disabled={!selectedTruck || cases.length === 0 || running}
            className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            {running ? 'Calculating...' : 'Calculate Load'}
          </button>

          {result && (
            <>
              <button
                onClick={savePlan}
                disabled={saving}
                className="btn-secondary w-full justify-center"
              >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save Plan'}
              </button>
              <button
                onClick={() => { setRepackName(planName); setRepackModal(true) }}
                className="w-full justify-center flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-brand-primary/50 text-brand-primary hover:bg-brand-primary/10 transition-colors"
              >
                <Archive size={14} /> Save as RePack
              </button>
              <button
                onClick={saveFile}
                className="w-full justify-center flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-dark-500 text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition-colors"
              >
                <DownloadCloud size={14} /> Save File
              </button>
              <button
                onClick={exportPDF}
                className="btn-secondary w-full justify-center"
              >
                <FileText size={14} /> Export PDF + Call Sheet
              </button>
            </>
          )}
        </div>

        {/* Stats */}
        {result && (
          <div className="p-4 border-t border-dark-600 mt-auto">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-dark-700 rounded-lg py-2 px-1">
                <div className={`text-xl font-bold ${utilizationColor}`}>{result.utilization}%</div>
                <div className="text-gray-500 text-xs">Utilization</div>
              </div>
              <div className="bg-dark-700 rounded-lg py-2 px-1">
                <div className="text-xl font-bold text-white">{result.totalWeight.toLocaleString()}</div>
                <div className="text-gray-500 text-xs">lbs</div>
              </div>
              <div className="bg-dark-700 rounded-lg py-2 px-1">
                <div className="text-xl font-bold text-green-400">{result.packed.length}</div>
                <div className="text-gray-500 text-xs">Packed</div>
              </div>
              <div className="bg-dark-700 rounded-lg py-2 px-1">
                <div className={`text-xl font-bold ${result.unpacked.length > 0 ? 'text-red-400' : 'text-gray-500'}`}>{result.unpacked.length}</div>
                <div className="text-gray-500 text-xs">Overflow</div>
              </div>
            </div>

            {/* Overflow list */}
            {result.unpacked.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1 text-red-400 text-xs font-medium mb-1">
                  <AlertTriangle size={12} /> Items That Didn't Fit
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.unpacked.map((b, i) => (
                    <div key={i} className="text-xs text-red-300/70 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <span className="truncate">{b.name}</span>
                      <span className="text-red-500/50 text-xs ml-auto shrink-0">
                        {b.reason === 'weight_limit' ? 'wt' : 'space'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.unpacked.length === 0 && result.packed.length > 0 && (
              <div className="mt-3 flex items-center gap-1 text-green-400 text-xs">
                <CheckCircle2 size={12} /> All items fit!
              </div>
            )}

            {/* Dept legend */}
            {depts.length > 0 && (
              <div className="mt-3">
                <div className="text-gray-500 text-xs mb-1 font-medium">Departments</div>
                <div className="flex flex-wrap gap-1">
                  {depts.map(d => (
                    <span key={d.id} className="inline-flex items-center gap-1 text-xs text-gray-300">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3D View */}
      <div className="flex-1 overflow-hidden">
        {result ? (
          <TruckViewer3D truck={selectedTruck} packed={result.packed} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3 px-6">
            <div className="text-6xl opacity-20">🚛</div>
            <p className="text-lg font-medium">Select a truck and run the load calculator</p>
            <p className="text-sm">Results will appear here in 3D</p>
            {/* Dimension Reference Card */}
            <div className="mt-4 border border-dark-600 rounded-xl bg-dark-800/60 px-6 py-5 max-w-xs w-full">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-4">Dimension Reference</p>
              <svg viewBox="0 0 200 140" className="w-full mb-4" xmlns="http://www.w3.org/2000/svg">
                {/* Back face */}
                <polygon points="60,20 140,20 140,80 60,80" fill="none" stroke="#4b5563" strokeWidth="1"/>
                {/* Top face */}
                <polygon points="60,20 100,5 180,5 140,20" fill="none" stroke="#4b5563" strokeWidth="1"/>
                {/* Right face */}
                <polygon points="140,20 180,5 180,65 140,80" fill="none" stroke="#4b5563" strokeWidth="1"/>
                {/* Visible edges colored */}
                {/* LENGTH — along X (bottom edge) */}
                <line x1="60" y1="80" x2="140" y2="80" stroke="#22d3ee" strokeWidth="2"/>
                {/* WIDTH — depth edge */}
                <line x1="140" y1="80" x2="180" y2="65" stroke="#a78bfa" strokeWidth="2"/>
                {/* HEIGHT — vertical */}
                <line x1="140" y1="20" x2="140" y2="80" stroke="#86efac" strokeWidth="2"/>
                {/* Labels */}
                <text x="95" y="95" fill="#22d3ee" fontSize="11" fontFamily="monospace" textAnchor="middle">LENGTH</text>
                <text x="168" y="78" fill="#a78bfa" fontSize="11" fontFamily="monospace" textAnchor="middle">WIDTH</text>
                <text x="155" y="52" fill="#86efac" fontSize="11" fontFamily="monospace" textAnchor="middle">HEIGHT</text>
              </svg>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 shrink-0 rounded" style={{background:'#22d3ee'}}></span>
                  <span className="text-gray-400"><strong className="text-gray-200">Rotate L/R</strong> — swaps Width ↔ Length (yaw 90°)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 shrink-0 rounded" style={{background:'#a78bfa'}}></span>
                  <span className="text-gray-400"><strong className="text-gray-200">Tip on side</strong> — swaps Height with Length or Width</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 shrink-0 rounded" style={{background:'#86efac'}}></span>
                  <span className="text-gray-400"><strong className="text-gray-200">Can flip</strong> — allows upside-down placement</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
