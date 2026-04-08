import { useEffect, useState } from 'react'
import { FileText, Download, Trash2, ExternalLink } from 'lucide-react'
import { generateLoadPlanPDF } from '../utils/pdfReport'

export default function Reports() {
  const [plans, setPlans] = useState([])
  const [depts, setDepts] = useState([])

  const load = async () => {
    if (!window.electronAPI) return
    const [p, d] = await Promise.all([
      window.electronAPI.getLoadPlans(),
      window.electronAPI.getDepartments(),
    ])
    setPlans(p)
    setDepts(d)
  }

  useEffect(() => { load() }, [])

  const exportPDF = async (plan) => {
    const fullPlan = await window.electronAPI.getLoadPlan(plan.id)
    if (!fullPlan || !fullPlan.result_json) {
      alert('This plan has no calculated results yet. Open it in Load Planner and run the calculation first.')
      return
    }
    const result = JSON.parse(fullPlan.result_json)
    const truck = {
      name: fullPlan.truck_name,
      length: fullPlan.truck_length,
      width: fullPlan.truck_width,
      height: fullPlan.truck_height,
      max_weight: fullPlan.truck_max_weight,
      unit: fullPlan.truck_unit,
    }
    const doc = generateLoadPlanPDF(
      { name: fullPlan.name, utilization: fullPlan.utilization, totalWeight: fullPlan.total_weight, id: fullPlan.id },
      result.packed || [],
      result.unpacked || [],
      result.callSheet || [],
      truck,
      depts,
    )
    doc.save(`${fullPlan.name.replace(/\s+/g, '-')}-load-plan.pdf`)
  }

  const del = async (id) => {
    if (!confirm('Delete this load plan?')) return
    await window.electronAPI.deleteLoadPlan(id)
    load()
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-gray-400 text-sm mt-1">Export load plans as PDF with packer call sheets</p>
      </div>

      {plans.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <FileText size={36} className="mx-auto mb-3 opacity-30" />
          <p>No saved load plans yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="card flex items-center gap-4 hover:border-dark-400 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-brand-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">{plan.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {plan.truck_name || 'Unknown truck'} •{' '}
                  {plan.utilization ? `${plan.utilization}% utilized` : 'Not calculated'} •{' '}
                  {plan.total_weight ? `${plan.total_weight.toLocaleString()} lbs` : ''} •{' '}
                  {new Date(plan.updated_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportPDF(plan)}
                  className="btn-primary !py-1.5"
                  title="Export PDF + Call Sheet"
                >
                  <Download size={14} /> Export PDF
                </button>
                <button
                  onClick={() => del(plan.id)}
                  className="btn-danger !py-1.5"
                  title="Delete plan"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF info box */}
      <div className="mt-6 card border-dark-500 bg-dark-800/50">
        <div className="flex items-start gap-3">
          <FileText size={18} className="text-brand-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-white text-sm mb-1">What's in the PDF?</div>
            <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
              <li><strong className="text-gray-300">Page 1+: Load Manifest</strong> — truck stats, utilization, department color legend, full item list with positions</li>
              <li><strong className="text-gray-300">Final Page: Next Case Call Sheet</strong> — sequential numbered list for the packer, ordered back-to-front. Call position #, case name, case #/SKU, dept, dimensions, weight, and a checkbox column</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
