import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, Trash2, AlertTriangle, RefreshCw, Download, CheckCircle } from 'lucide-react'

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored === null) return defaultValue
      return JSON.parse(stored)
    } catch {
      return defaultValue
    }
  })
  const set = (val) => {
    setValue(val)
    localStorage.setItem(key, JSON.stringify(val))
  }
  return [value, set]
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
      <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-blue-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export default function Settings() {
  // Units & Measurements
  const [units, setUnits] = useLocalStorage('tp_units', 'imperial')

  // 3D Viewer Defaults
  const [showGrid, setShowGrid] = useLocalStorage('tp_show_grid', true)
  const [showLabels, setShowLabels] = useLocalStorage('tp_show_labels', true)
  const [cameraAngle, setCameraAngle] = useLocalStorage('tp_camera_angle', 'isometric')

  // Packing Defaults
  const [stackDir, setStackDir] = useLocalStorage('tp_stack_dir', 'length')
  const [allowRotation, setAllowRotation] = useLocalStorage('tp_allow_rotation', true)
  const [weightLimit, setWeightLimit] = useLocalStorage('tp_weight_limit', true)

  // Department Colors
  const [depts, setDepts] = useState([])
  const [deptColors, setDeptColors] = useState({})
  const [savedDepts, setSavedDepts] = useState({})

  // Updates
  const [autoUpdate, setAutoUpdate] = useLocalStorage('tp_auto_update', true)
  const [updateStatus, setUpdateStatus] = useState('idle') // idle | checking | available | downloading | downloaded | error | up-to-date
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // Clear All Data
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    const loadDepts = async () => {
      if (!window.electronAPI) return
      const list = await window.electronAPI.getDepartments()
      setDepts(list)
      const colors = {}
      list.forEach(d => { colors[d.id] = d.color })
      setDeptColors(colors)
    }
    loadDepts()
  }, [])

  // Updater listeners + auto-check on mount
  useEffect(() => {
    if (!window.electronAPI?.updater) return
    const u = window.electronAPI.updater
    u.onUpdateAvailable((info) => { setUpdateStatus('available'); setUpdateInfo(info) })
    u.onNotAvailable(() => setUpdateStatus('up-to-date'))
    u.onProgress((p) => { setUpdateStatus('downloading'); setDownloadProgress(Math.round(p.percent)) })
    u.onDownloaded((info) => { setUpdateStatus('downloaded'); setUpdateInfo(info) })
    u.onError((msg) => { setUpdateStatus('error'); setUpdateInfo({ message: msg }) })
    if (autoUpdate) u.startAutoCheck()
    return () => u.removeListeners()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveDeptColor = async (dept) => {
    if (!window.electronAPI) return
    await window.electronAPI.saveDepartment({ ...dept, color: deptColors[dept.id] })
    setSavedDepts(s => ({ ...s, [dept.id]: true }))
    setTimeout(() => setSavedDepts(s => ({ ...s, [dept.id]: false })), 1500)
  }

  const handleClearAllData = async () => {
    if (!window.electronAPI) return
    await window.electronAPI.deleteAllItems()
    await window.electronAPI.deleteAllPlans()
    setConfirmClear(false)
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon size={24} className="text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-0.5">Configure app preferences and defaults</p>
        </div>
      </div>

      {/* Units & Measurements */}
      <SectionCard title="Units & Measurements">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-gray-400">Unit System</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 ml-auto">
            <button
              onClick={() => setUnits('imperial')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                units === 'imperial' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              Imperial
            </button>
            <button
              onClick={() => setUnits('metric')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                units === 'metric' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              Metric
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {units === 'imperial'
            ? 'Dimensions in inches (in), weight in pounds (lbs)'
            : 'Dimensions in centimeters (cm), weight in kilograms (kg)'}
        </p>
      </SectionCard>

      {/* Department Colors */}
      <SectionCard title="Department Colors">
        {depts.length === 0 ? (
          <p className="text-sm text-gray-500">No departments found. Add departments first.</p>
        ) : (
          <div className="space-y-2">
            {depts.map(dept => (
              <div key={dept.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                <div
                  className="w-4 h-4 rounded shrink-0"
                  style={{ backgroundColor: deptColors[dept.id] || dept.color }}
                />
                <span className="flex-1 text-sm text-gray-200">{dept.name}</span>
                <input
                  type="color"
                  value={deptColors[dept.id] || dept.color}
                  onChange={e => setDeptColors(c => ({ ...c, [dept.id]: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                />
                <button
                  onClick={() => saveDeptColor(dept)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    savedDepts[dept.id]
                      ? 'bg-green-700 text-green-100'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {savedDepts[dept.id] ? 'Saved!' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 3D Viewer Defaults */}
      <SectionCard title="3D Viewer Defaults">
        <Toggle
          label="Show grid floor"
          description="Display a grid on the floor of the 3D viewer"
          checked={showGrid}
          onChange={setShowGrid}
        />
        <div className="border-t border-gray-800" />
        <Toggle
          label="Show item labels on hover"
          description="Display item name when hovering over it in the 3D view"
          checked={showLabels}
          onChange={setShowLabels}
        />
        <div className="border-t border-gray-800 mb-4" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-200">Default camera angle</div>
            <div className="text-xs text-gray-500 mt-0.5">Starting camera position when opening the viewer</div>
          </div>
          <select
            value={cameraAngle}
            onChange={e => setCameraAngle(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="isometric">Isometric</option>
            <option value="front">Front</option>
            <option value="side">Side</option>
            <option value="top">Top</option>
          </select>
        </div>
      </SectionCard>

      {/* Packing Defaults */}
      <SectionCard title="Packing Defaults">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-gray-200">Default stack direction</div>
            <div className="text-xs text-gray-500 mt-0.5">Primary axis used when placing items</div>
          </div>
          <select
            value={stackDir}
            onChange={e => setStackDir(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            <option value="length">Length-first</option>
            <option value="width">Width-first</option>
            <option value="height">Height-first</option>
          </select>
        </div>
        <div className="border-t border-gray-800" />
        <Toggle
          label="Allow rotation by default"
          description="Items may be rotated on all axes during packing"
          checked={allowRotation}
          onChange={setAllowRotation}
        />
        <div className="border-t border-gray-800" />
        <Toggle
          label="Respect weight limit by default"
          description="Stop packing when the truck's max weight is reached"
          checked={weightLimit}
          onChange={setWeightLimit}
        />
      </SectionCard>

      {/* Updates */}
      <SectionCard title="Updates">
        <Toggle
          label="Automatically check for updates"
          description="Check for new versions when the app launches"
          checked={autoUpdate}
          onChange={setAutoUpdate}
        />
        <div className="border-t border-gray-800 my-3" />
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-4">
            {updateStatus === 'idle' && (
              <p className="text-xs text-gray-500">Click "Check Now" to look for updates.</p>
            )}
            {updateStatus === 'checking' && (
              <p className="text-xs text-blue-400">Checking for updates…</p>
            )}
            {updateStatus === 'up-to-date' && (
              <div className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-green-400 shrink-0" />
                <p className="text-xs text-green-400">You're on the latest version.</p>
              </div>
            )}
            {updateStatus === 'available' && updateInfo && (
              <div>
                <p className="text-xs text-blue-300 font-medium">Update available: v{updateInfo.version}</p>
                <p className="text-xs text-gray-500 mt-0.5">Click Download to get the latest version.</p>
              </div>
            )}
            {updateStatus === 'downloading' && (
              <div>
                <p className="text-xs text-blue-400 mb-1">Downloading… {downloadProgress}%</p>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${downloadProgress}%` }} />
                </div>
              </div>
            )}
            {updateStatus === 'downloaded' && updateInfo && (
              <div>
                <p className="text-xs text-green-300 font-medium">v{updateInfo.version} ready to install.</p>
                <p className="text-xs text-gray-500 mt-0.5">Restart the app to apply the update.</p>
              </div>
            )}
            {updateStatus === 'error' && (
              <p className="text-xs text-red-400">{updateInfo?.message || 'Update check failed. Check your connection and try again.'}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {updateStatus === 'available' && (
              <button
                onClick={() => { setUpdateStatus('downloading'); window.electronAPI.updater.download() }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download size={13} />
                Download
              </button>
            )}
            {updateStatus === 'downloaded' && (
              <button
                onClick={() => window.electronAPI.updater.install()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download size={13} />
                Restart &amp; Install
              </button>
            )}
            {(updateStatus === 'idle' || updateStatus === 'up-to-date' || updateStatus === 'error') && (
              <button
                onClick={() => { setUpdateStatus('checking'); window.electronAPI?.updater?.check() }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors"
              >
                <RefreshCw size={13} />
                Check Now
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Application */}
      <SectionCard title="Application">
        <div className="flex items-center justify-between py-2 border-b border-gray-800 mb-4">
          <span className="text-sm text-gray-400">App Version</span>
          <span className="text-sm font-mono text-gray-300">v{window.electronAPI?.getVersion?.() ?? '1.1.0'}</span>
        </div>

        {!confirmClear ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-200">Clear All Data</div>
              <div className="text-xs text-gray-500 mt-0.5">Permanently delete all items and load plans</div>
            </div>
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              Clear All Data
            </button>
          </div>
        ) : (
          <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-300">Are you sure?</div>
                <div className="text-xs text-red-400 mt-0.5">
                  This will permanently delete all items and load plans. This action cannot be undone.
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmClear(false)}
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 size={13} />
                Yes, Delete Everything
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
