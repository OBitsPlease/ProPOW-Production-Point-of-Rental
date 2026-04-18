import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Save, FileText, Plus, ChevronDown, AlertTriangle, CheckCircle2, Archive, DownloadCloud, Move, RotateCcw, Check } from 'lucide-react'
import { runBinPacking, generateCallSheet } from '../utils/binPacking'
import { generateLoadPlanPDF } from '../utils/pdfReport'
import TruckViewer3D from '../components/TruckViewer3D'

export default function LoadPlanner() {
  const { planId, eventId } = useParams()
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

  // Edit mode (drag-to-reposition) state
  const [editMode, setEditMode] = useState(false)
  const [undoStack, setUndoStack] = useState([])  // array of packed snapshots
  const [algoResult, setAlgoResult] = useState(null) // original algorithm output, never mutated
  const [hasManualOverrides, setHasManualOverrides] = useState(false)
  const undoStackRef = useRef([])
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
    const allComputedCases = rawCases.map(c => {
      const itemsWeight = (c.items || []).reduce((sum, ci) => {
        const inv = rawItems.find(i => i.id === ci.id)
        return sum + (inv ? (parseFloat(inv.weight) || 0) * (ci.qty || 1) : 0)
      }, 0)
      return { ...c, weight: (parseFloat(c.weight) || 0) + itemsWeight, quantity: 1, department_color: c.color || '#f59e0b' }
    })
    setTrucks(t)
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
        setCases(allComputedCases)
        return
      } catch(e) { /* ignore parse errors */ }
    }

    // When opened from an event, filter to only the cases on that event's gear list
    if (eventId) {
      const ev = await window.electronAPI.events.get(parseInt(eventId))
      if (ev) {
        setPlanName(`${ev.name} — Load Plan`)
        const eventCaseIds = new Set(
          (ev.gear || []).filter(g => g._type === 'case').map(g => g.case_id)
        )
        setCases(allComputedCases.filter(c => eventCaseIds.has(c.id)))
      } else {
        setCases(allComputedCases)
      }
      return
    }

    setCases(allComputedCases)

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
  }, [planId, eventId])

  useEffect(() => { load() }, [load])

  const selectedTruck = trucks.find(t => t.id === parseInt(selectedTruckId) || t.id === selectedTruckId)

  const runPacking = async () => {
    if (!selectedTruck || cases.length === 0) return
    setRunning(true)
    await new Promise(r => setTimeout(r, 50))
    try {
      // Load user-defined stack preferences to bias the algorithm
      let stackPrefs = []
      if (window.electronAPI?.stackPrefs) {
        try { stackPrefs = await window.electronAPI.stackPrefs.getAll() } catch(e) {}
      }
      const r = runBinPacking(cases, selectedTruck, stackPrefs)
      setResult(r)
      setAlgoResult(r)
      setUndoStack([])
      undoStackRef.current = []
      setHasManualOverrides(false)
      setEditMode(false)
    } finally {
      setRunning(false)
    }
  }

  // ── Edit mode: box moved handler ─────────────────────────────────────────
  const handleBoxMoved = useCallback((movedBox) => {
    setResult(prev => {
      if (!prev) return prev
      // Push current state to undo stack (cap at 50)
      const snapshot = prev.packed.map(b => ({ ...b }))
      const newStack = [...undoStackRef.current, snapshot].slice(-50)
      undoStackRef.current = newStack
      setUndoStack(newStack)
      setHasManualOverrides(true)

      // Update position
      const newPacked = prev.packed.map(b =>
        (b.id === movedBox.id && b.unitIndex === movedBox.unitIndex)
          ? { ...b, x: movedBox.x, y: movedBox.y, z: movedBox.z }
          : b
      )

      // Recalculate loadOrder: sort by x ascending (cab=low → door=high = loaded last = first off)
      const sorted = [...newPacked].sort((a, b) => {
        if (Math.abs(a.x - b.x) > 1) return b.x - a.x // deepest (cab-end, low x) = lowest order
        if (Math.abs(a.z - b.z) > 1) return a.z - b.z // floor first
        return a.y - b.y
      })
      sorted.forEach((b, i) => { b.loadOrder = i + 1 })

      // Save stack pref: if the moved box is now on top of another box, record the pair
      if (movedBox.z > 0.5 && window.electronAPI?.stackPrefs) {
        const others = newPacked.filter(b =>
          !(b.id === movedBox.id && b.unitIndex === movedBox.unitIndex)
        )
        const below = others.filter(b =>
          Math.abs((b.z + b.h) - movedBox.z) < 1 &&
          movedBox.x < b.x + b.l - 0.5 && movedBox.x + movedBox.l > b.x + 0.5 &&
          movedBox.y < b.y + b.w - 0.5 && movedBox.y + movedBox.w > b.y + 0.5
        )
        for (const b of below) {
          window.electronAPI.stackPrefs.save({
            bottom_case_id: b.id,
            top_case_id: movedBox.id,
            bottom_name: b.name,
            top_name: movedBox.name,
          }).catch(() => {})
        }
      }

      const newCallSheet = generateCallSheet(sorted, selectedTruck)
      return { ...prev, packed: sorted, callSheet: newCallSheet }
    })
  }, [selectedTruck])

  // ── Ctrl+Z undo (global, only active in edit mode) ───────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && editMode) {
        e.preventDefault()
        const stack = undoStackRef.current
        if (stack.length === 0) return
        const prev = stack[stack.length - 1]
        const newStack = stack.slice(0, -1)
        undoStackRef.current = newStack
        setUndoStack(newStack)
        setResult(r => {
          if (!r) return r
          const newCallSheet = generateCallSheet(prev, selectedTruck)
          return { ...r, packed: prev, callSheet: newCallSheet }
        })
        if (newStack.length === 0) setHasManualOverrides(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editMode, selectedTruck])

  const resetToAlgo = () => {
    if (!algoResult) return
    setResult(algoResult)
    setUndoStack([])
    undoStackRef.current = []
    setHasManualOverrides(false)
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
              <p className="text-gray-600 text-xs">{eventId ? 'No cases added to this event — add cases in the event gear list first' : 'No cases — go to Items page to create cases'}</p>
            ) : (
              cases.map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs text-gray-300">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color || '#f59e0b' }}
                  />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.load_zone === 'first_off' && <span className="text-xs px-1 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400 font-medium shrink-0">Near Door</span>}
                  {c.load_zone === 'floor_only' && <span className="text-xs px-1 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium shrink-0">Floor Only</span>}
                  <span className="text-gray-500 shrink-0">{c.weight > 0 ? `${c.weight}lbs` : ''}</span>
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
      <div className="flex-1 overflow-hidden flex flex-col">
        {result && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border-b border-dark-600 text-xs">
            <button
              onClick={() => setEditMode(m => !m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                editMode
                  ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-400 hover:bg-yellow-500/30'
                  : 'border-dark-500 text-gray-400 hover:text-gray-200 hover:bg-dark-600'
              }`}
            >
              <Move size={12} /> {editMode ? 'Exit Edit Mode' : 'Edit Layout'}
            </button>
            {editMode && (
              <>
                <span className="text-gray-600">|</span>
                <button
                  onClick={() => {
                    const stack = undoStackRef.current
                    if (stack.length === 0) return
                    const prev = stack[stack.length - 1]
                    const newStack = stack.slice(0, -1)
                    undoStackRef.current = newStack
                    setUndoStack(newStack)
                    setResult(r => {
                      if (!r) return r
                      const newCallSheet = generateCallSheet(prev, selectedTruck)
                      return { ...r, packed: prev, callSheet: newCallSheet }
                    })
                    if (newStack.length === 0) setHasManualOverrides(false)
                  }}
                  disabled={undoStack.length === 0}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={11} /> Undo
                </button>
                {hasManualOverrides && (
                  <>
                    <button
                      onClick={() => { setEditMode(false) }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
                    >
                      <Check size={11} /> Apply Changes
                    </button>
                    <button
                      onClick={resetToAlgo}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-red-400 hover:bg-dark-600"
                    >
                      Reset to Algorithm
                    </button>
                  </>
                )}
              </>
            )}
            {hasManualOverrides && !editMode && (
              <span className="text-yellow-500/80 text-xs">✏ Manual overrides active</span>
            )}
          </div>
        )}
        {result ? (
          <div className="flex-1 overflow-hidden">
            <TruckViewer3D
              truck={selectedTruck}
              packed={result.packed}
              editMode={editMode}
              onBoxMoved={handleBoxMoved}
            />
          </div>
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
