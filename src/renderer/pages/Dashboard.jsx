import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Package, Truck, ArrowRight, Plus } from 'lucide-react'

export default function Dashboard() {
  const [plans, setPlans] = useState([])
  const [trucks, setTrucks] = useState([])
  const [items, setItems] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI) return
      setPlans(await window.electronAPI.getLoadPlans())
      setTrucks(await window.electronAPI.getTrucks())
      setItems(await window.electronAPI.getItems())
    }
    load()
  }, [])

  const StatCard = ({ icon: Icon, label, value, color, onClick }) => (
    <div
      onClick={onClick}
      className={`card flex items-center gap-4 cursor-pointer hover:border-brand-primary/40 transition-all ${onClick ? 'hover:scale-[1.01]' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-gray-400 text-sm">{label}</div>
      </div>
      {onClick && <ArrowRight size={16} className="ml-auto text-gray-600" />}
    </div>
  )

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome to Truck Pack — 3D Load Planner</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Layers} label="Load Plans" value={plans.length} color="bg-brand-primary/20 text-brand-primary" onClick={() => navigate('/planner')} />
        <StatCard icon={Truck} label="Truck Profiles" value={trucks.length} color="bg-brand-secondary/20 text-brand-secondary" onClick={() => navigate('/trucks')} />
        <StatCard icon={Package} label="Items in Library" value={items.length} color="bg-brand-success/20 text-brand-success" onClick={() => navigate('/items')} />
      </div>

      {/* Recent plans */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Recent Load Plans</h2>
          <button onClick={() => navigate('/planner')} className="btn-primary !py-1.5">
            <Plus size={14} /> New Plan
          </button>
        </div>
        {plans.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            <Layers size={36} className="mx-auto mb-3 opacity-30" />
            <p>No load plans yet. Create your first one!</p>
            <button onClick={() => navigate('/planner')} className="btn-primary mt-4 mx-auto">
              <Plus size={14} /> Create Load Plan
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Plan Name</th>
                  <th className="table-header">Truck</th>
                  <th className="table-header">Utilization</th>
                  <th className="table-header">Weight</th>
                  <th className="table-header">Date</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {plans.slice(0, 8).map(p => (
                  <tr key={p.id} className="table-row cursor-pointer" onClick={() => navigate(`/planner/${p.id}`)}>
                    <td className="table-cell font-medium text-white">{p.name}</td>
                    <td className="table-cell text-gray-400">{p.truck_name || '-'}</td>
                    <td className="table-cell">
                      <span className={`text-sm font-medium ${p.utilization > 80 ? 'text-green-400' : p.utilization > 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {p.utilization ? `${p.utilization}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-400">{p.total_weight ? `${p.total_weight.toLocaleString()} lbs` : '-'}</td>
                    <td className="table-cell text-gray-500 text-xs">{new Date(p.updated_at).toLocaleDateString()}</td>
                    <td className="table-cell"><ArrowRight size={14} className="text-gray-600" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
