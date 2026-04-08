import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, FolderOpen, Upload, Trash2, DownloadCloud } from 'lucide-react'

const MAX_RECENT = 10
const RECENT_KEY = 'tp_recent_files'

function getRecentFiles() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function addRecentFiles(files) {
  const existing = getRecentFiles()
  const merged = [...files, ...existing.filter(r => !files.find(f => f.filePath === r.filePath))]
  localStorage.setItem(RECENT_KEY, JSON.stringify(merged.slice(0, MAX_RECENT)))
}

export default function RePacks() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('presets')
  const [presets, setPresets] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [loading, setLoading] = useState(false)

  const loadPresets = async () => {
    if (!window.electronAPI?.repack) return
    setLoading(true)
    try {
      const list = await window.electronAPI.repack.list()
      setPresets(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPresets()
    setRecentFiles(getRecentFiles())
  }, [])

  const handleLoadPreset = async (filename) => {
    if (!window.electronAPI?.repack) return
    const data = await window.electronAPI.repack.load(filename)
    sessionStorage.setItem('tp_load_repack', JSON.stringify(data))
    navigate('/planner')
  }

  const handleDeletePreset = async (filename) => {
    if (!window.electronAPI?.repack) return
    await window.electronAPI.repack.delete(filename)
    loadPresets()
  }

  const handleOpenFile = async () => {
    if (!window.electronAPI?.file) return
    const data = await window.electronAPI.file.open()
    if (!data) return
    if (data.filePath) addRecentFiles([{ filePath: data.filePath, name: data.name, savedAt: data.savedAt }])
    sessionStorage.setItem('tp_load_repack', JSON.stringify(data))
    setRecentFiles(getRecentFiles())
    navigate('/planner')
  }

  const handleOpenFolder = async () => {
    if (!window.electronAPI?.file) return
    const files = await window.electronAPI.file.openFolder()
    if (!files.length) return
    const recent = files.map(f => ({ filePath: f.filePath, name: f.name, savedAt: f.savedAt }))
    addRecentFiles(recent)
    setRecentFiles(getRecentFiles())
    // Load the first file
    sessionStorage.setItem('tp_load_repack', JSON.stringify(files[0]))
    navigate('/planner')
  }

  const handleOpenRecent = (file) => {
    sessionStorage.setItem('tp_load_repack', JSON.stringify(file))
    navigate('/planner')
  }

  const removeRecent = (filePath) => {
    const updated = getRecentFiles().filter(f => f.filePath !== filePath)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
    setRecentFiles(updated)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-dark-600 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-primary/15 border border-brand-primary/25 flex items-center justify-center">
            <Archive size={18} className="text-brand-primary" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">RePacks</h1>
            <p className="text-gray-500 text-sm">Save and reuse packing configurations</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-dark-700 rounded-lg p-1 w-fit">
          {[
            { key: 'presets', label: 'RePack Presets', icon: Archive },
            { key: 'files', label: 'Saved Files', icon: FolderOpen },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-dark-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'presets' && (
          <div className="max-w-2xl space-y-4">
            {/* Info card */}
            <div className="bg-brand-primary/10 border border-brand-primary/25 rounded-xl p-4 flex items-start gap-3">
              <Archive size={16} className="text-brand-primary mt-0.5 shrink-0" />
              <p className="text-sm text-gray-300">
                To save a RePack, complete a pack in the <strong className="text-white">Load Planner</strong>, then click <strong className="text-white">"Save as RePack"</strong>.
              </p>
            </div>

            {loading ? (
              <div className="text-gray-500 text-sm py-8 text-center">Loading presets…</div>
            ) : presets.length === 0 ? (
              <div className="text-center py-16">
                <Archive size={40} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No RePack presets yet</p>
                <p className="text-gray-600 text-sm mt-1">Save a pack from the Load Planner to create one.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {presets.map((preset) => (
                  <div
                    key={preset.filename}
                    className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 flex items-center gap-4"
                  >
                    <div className="w-9 h-9 rounded-lg bg-dark-700 flex items-center justify-center shrink-0">
                      <Archive size={16} className="text-brand-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{preset.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        {preset.truck && <span className="mr-2">🚛 {preset.truck}</span>}
                        {preset.savedAt && (
                          <span>{new Date(preset.savedAt).toLocaleDateString()} {new Date(preset.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleLoadPreset(preset.filename)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-primary/15 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/25 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.filename)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                        title="Delete preset"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="max-w-2xl space-y-4">
            {/* File action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleOpenFile}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-brand-primary/15 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/25 transition-colors"
              >
                <Upload size={15} /> Open File
              </button>
              <button
                onClick={handleOpenFolder}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-dark-500 text-gray-300 hover:text-white hover:bg-dark-600 transition-colors"
              >
                <FolderOpen size={15} /> Open from Folder
              </button>
            </div>

            {/* Recent files */}
            <div>
              <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Recent Files</h2>
              {recentFiles.length === 0 ? (
                <div className="text-center py-12">
                  <DownloadCloud size={36} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No recent files</p>
                  <p className="text-gray-600 text-sm mt-1">Open a .truckpack file to see it here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentFiles.map((file, i) => (
                    <div
                      key={file.filePath || i}
                      className="bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 flex items-center gap-4"
                    >
                      <div className="w-9 h-9 rounded-lg bg-dark-700 flex items-center justify-center shrink-0">
                        <DownloadCloud size={15} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate">{file.name || file.filePath?.split('/').pop() || 'Unknown'}</div>
                        <div className="text-gray-600 text-xs mt-0.5 truncate" title={file.filePath}>{file.filePath}</div>
                        {file.savedAt && (
                          <div className="text-gray-500 text-xs">{new Date(file.savedAt).toLocaleDateString()}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenRecent(file)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-700 text-gray-300 border border-dark-500 hover:text-white hover:bg-dark-600 transition-colors"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => removeRecent(file.filePath)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          title="Remove from recent"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
