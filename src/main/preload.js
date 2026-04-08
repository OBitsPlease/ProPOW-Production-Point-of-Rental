const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Trucks
  getTrucks: () => ipcRenderer.invoke('trucks:getAll'),
  saveTruck: (truck) => ipcRenderer.invoke('trucks:save', truck),
  deleteTruck: (id) => ipcRenderer.invoke('trucks:delete', id),

  // Items
  getItems: () => ipcRenderer.invoke('items:getAll'),
  saveItem: (item) => ipcRenderer.invoke('items:save', item),
  deleteItem: (id) => ipcRenderer.invoke('items:delete', id),
  clearItems: () => ipcRenderer.invoke('items:clear'),
  deleteAllItems: () => ipcRenderer.invoke('items:deleteAll'),

  // Departments
  getDepartments: () => ipcRenderer.invoke('departments:getAll'),
  saveDepartment: (dept) => ipcRenderer.invoke('departments:save', dept),
  deleteDepartment: (id) => ipcRenderer.invoke('departments:delete', id),

  // Load Plans
  getLoadPlans: () => ipcRenderer.invoke('plans:getAll'),
  saveLoadPlan: (plan) => ipcRenderer.invoke('plans:save', plan),
  deleteLoadPlan: (id) => ipcRenderer.invoke('plans:delete', id),
  deleteAllPlans: () => ipcRenderer.invoke('plans:deleteAll'),
  getLoadPlan: (id) => ipcRenderer.invoke('plans:get', id),

  // Excel Import
  importExcel: () => ipcRenderer.invoke('import:excel'),

  // Inventory Integration
  importInventoryFile: () => ipcRenderer.invoke('import:inventory'),
  setWatchFolder: (folderPath) => ipcRenderer.invoke('watch:setFolder', folderPath),
  getWatchFolder: () => ipcRenderer.invoke('watch:getFolder'),

  // PDF Export
  exportPDF: (planId) => ipcRenderer.invoke('export:pdf', planId),

  // File dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Events from main → renderer
  onInventoryImported: (cb) => ipcRenderer.on('inventory:imported', (_, data) => cb(data)),
  onInventoryError: (cb) => ipcRenderer.on('inventory:error', (_, err) => cb(err)),
  removeInventoryListeners: () => {
    ipcRenderer.removeAllListeners('inventory:imported')
    ipcRenderer.removeAllListeners('inventory:error')
  },

  repack: {
    list: () => ipcRenderer.invoke('repack:list'),
    save: (name, data) => ipcRenderer.invoke('repack:save', { name, data }),
    load: (filename) => ipcRenderer.invoke('repack:load', filename),
    delete: (filename) => ipcRenderer.invoke('repack:delete', filename),
  },
  file: {
    saveAs: (data) => ipcRenderer.invoke('file:saveAs', data),
    open: () => ipcRenderer.invoke('file:open'),
    openFolder: () => ipcRenderer.invoke('file:openFolder'),
  },
})
