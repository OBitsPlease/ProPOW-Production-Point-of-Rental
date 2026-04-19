import { useState } from 'react'
import { ChevronDown, ArrowRight, Check, Truck } from 'lucide-react'

/**
 * Multi-Truck Setup Modal
 * Step 1: Choose number of trucks, select profile + nickname for each
 * Step 2: Assign each case to a truck slot
 */
export default function MultiTruckSetup({ trucks, cases, onConfirm, onCancel }) {
  const [step, setStep] = useState(1)
  const [numTrucks, setNumTrucks] = useState(2)
  const [slots, setSlots] = useState([
    { id: 0, truckId: '', nickname: '' },
    { id: 1, truckId: '', nickname: '' },
  ])
  // caseId -> slot index string ('' = unassigned)
  const [assignments, setAssignments] = useState(() => {
    const init = {}
    cases.forEach(c => { init[c.id] = '' })
    return init
  })

  const updateNumTrucks = (n) => {
    setNumTrucks(n)
    setSlots(arr => {
      const copy = [...arr]
      while (copy.length < n) copy.push({ id: copy.length, truckId: '', nickname: '' })
      return copy.slice(0, n)
    })
  }

  const updateSlot = (idx, field, value) => {
    setSlots(arr => arr.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const step1Valid = slots.every(s => s.truckId !== '')

  const goStep2 = () => {
    const init = {}
    cases.forEach(c => { init[c.id] = '' })
    setAssignments(init)
    setStep(2)
  }

  const assignCase = (caseId, slotIdx) => {
    setAssignments(a => ({ ...a, [caseId]: String(slotIdx) }))
  }

  const assignAllTo = (slotIdx) => {
    const newA = {}
    cases.forEach(c => { newA[c.id] = String(slotIdx) })
    setAssignments(newA)
  }

  const handleConfirm = () => {
    const finalSlots = slots.map((s, i) => ({
      id: i,
      truckId: parseInt(s.truckId),
      nickname: s.nickname.trim() || `Truck ${i + 1}`,
      caseIds: cases.filter(c => assignments[c.id] === String(i)).map(c => c.id),
    }))
    onConfirm(finalSlots)
  }

  const unassignedCount = cases.filter(c => assignments[c.id] === '').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-600">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Truck size={18} className="text-blue-400" /> Multi-Truck Load Setup
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${step === 1 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'text-gray-500'}`}>
              1. Configure Trucks
            </span>
            <span className="text-gray-600">›</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${step === 2 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'text-gray-500'}`}>
              2. Assign Cases
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="space-y-5">
              {/* Truck count selector */}
              <div>
                <label className="label">Number of Trucks</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => updateNumTrucks(n)}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold border transition-colors ${
                        numTrucks === n
                          ? 'bg-brand-primary border-brand-primary text-white'
                          : 'border-dark-500 text-gray-400 hover:text-gray-200 hover:bg-dark-600'
                      }`}
                    >{n}</button>
                  ))}
                </div>
              </div>

              {/* Per-truck config */}
              <div className="space-y-3">
                {slots.map((slot, i) => {
                  const t = trucks.find(tr => tr.id === parseInt(slot.truckId) || tr.id === slot.truckId)
                  return (
                    <div key={i} className="bg-dark-700 border border-dark-600 rounded-lg p-3">
                      <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                        Truck {i + 1}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="label">Profile</label>
                          <div className="relative">
                            <select
                              className="input-field appearance-none pr-8 w-full"
                              value={slot.truckId}
                              onChange={e => updateSlot(i, 'truckId', e.target.value)}
                            >
                              <option value="">Select truck...</option>
                              {trucks.map(tr => (
                                <option key={tr.id} value={tr.id}>{tr.name}</option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="label">Nickname (optional)</label>
                          <input
                            type="text"
                            className="input-field w-full"
                            placeholder={`Truck ${i + 1}`}
                            value={slot.nickname}
                            onChange={e => updateSlot(i, 'nickname', e.target.value)}
                          />
                        </div>
                      </div>
                      {t && (
                        <div className="mt-1.5 text-xs text-gray-500 font-mono">
                          {t.length}" × {t.width}" × {t.height}"
                          {t.max_weight ? ` • Max ${t.max_weight.toLocaleString()} lbs` : ''}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-gray-400 text-sm mb-3">
                Assign each case to a truck. Unassigned cases won't be loaded.
                {unassignedCount > 0 && (
                  <span className="text-yellow-400"> ({unassignedCount} unassigned)</span>
                )}
              </p>

              {/* Quick-assign all buttons */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => assignAllTo(i)}
                    className="text-xs px-2 py-1 rounded border border-dark-500 text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition-colors"
                  >
                    All → {slot.nickname || `T${i + 1}`}
                  </button>
                ))}
              </div>

              {/* Case list with assignment buttons */}
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {cases.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color || '#f59e0b' }}
                    />
                    <span className="flex-1 text-sm text-gray-200 truncate min-w-0">{c.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {c.weight > 0 ? `${c.weight}lbs` : ''}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {slots.map((slot, i) => (
                        <button
                          key={i}
                          onClick={() => assignCase(c.id, i)}
                          className={`text-xs px-2 py-1 rounded border transition-colors whitespace-nowrap ${
                            assignments[c.id] === String(i)
                              ? 'bg-blue-500/20 border-blue-500/60 text-blue-400'
                              : 'border-dark-500 text-gray-500 hover:text-gray-300 hover:bg-dark-600'
                          }`}
                        >
                          {slot.nickname || `T${i + 1}`}
                        </button>
                      ))}
                      {assignments[c.id] !== '' && (
                        <button
                          onClick={() => assignCase(c.id, 'none')}
                          className="text-xs px-1.5 py-1 rounded border border-dark-500 text-gray-600 hover:text-red-400 hover:bg-dark-600 transition-colors"
                          title="Unassign"
                        >✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-600 flex justify-between items-center">
          <button
            onClick={step === 1 ? onCancel : () => setStep(1)}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition-colors"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step === 1 ? (
            <button
              onClick={goStep2}
              disabled={!step1Valid}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Assign Cases <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="btn-primary"
            >
              <Check size={13} /> Start Packing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
