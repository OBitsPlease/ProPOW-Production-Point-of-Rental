const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getVersion: () => ipcRenderer.sendSync('app:getVersion'),
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
  exportTemplate: () => ipcRenderer.invoke('export:template'),
  exportLibrary: () => ipcRenderer.invoke('export:library'),

  // PDF Export
  exportPDF: (planId) => ipcRenderer.invoke('export:pdf', planId),

  // File dialog
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Native confirm dialog (replaces window.confirm to avoid Electron focus bug)
  dialog: {
    confirm: (message, detail) => ipcRenderer.invoke('dialog:confirm', { message, detail }),
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
  groups: {
    getAll: () => ipcRenderer.invoke('groups:getAll'),
    save: (g) => ipcRenderer.invoke('groups:save', g),
    delete: (id) => ipcRenderer.invoke('groups:delete', id),
  },
  cases: {
    getAll: () => ipcRenderer.invoke('cases:getAll'),
    save: (c) => ipcRenderer.invoke('cases:save', c),
    delete: (id) => ipcRenderer.invoke('cases:delete', id),
  },
  caseRepacks: {
    list: () => ipcRenderer.invoke('case_repack:list'),
    save: (payload) => ipcRenderer.invoke('case_repack:save', payload),
    delete: (id) => ipcRenderer.invoke('case_repack:delete', id),
  },
  addressBook: {
    getAll:  (type) => ipcRenderer.invoke('addressBook:getAll', type),
    save:    (entry) => ipcRenderer.invoke('addressBook:save', entry),
    delete:  (id)   => ipcRenderer.invoke('addressBook:delete', id),
  },
  events: {
    getAll: () => ipcRenderer.invoke('events:getAll'),
    get: (id) => ipcRenderer.invoke('events:get', id),
    save: (event) => ipcRenderer.invoke('events:save', event),
    delete: (id) => ipcRenderer.invoke('events:delete', id),
    attachFile: (eventId) => ipcRenderer.invoke('events:attachFile', eventId),
    removeFile: (eventId, fileName) => ipcRenderer.invoke('events:removeFile', { eventId, fileName }),
    openFile: (filePath) => ipcRenderer.invoke('events:openFile', filePath),
  },
  repairs: {
    getAll: () => ipcRenderer.invoke('repairs:getAll'),
    save: (repair) => ipcRenderer.invoke('repairs:save', repair),
    delete: (id) => ipcRenderer.invoke('repairs:delete', id),
    attachFile: (repairId) => ipcRenderer.invoke('repairs:attachFile', repairId),
    removeFile: (repairId, fileName) => ipcRenderer.invoke('repairs:removeFile', { repairId, fileName }),
    openFile: (filePath) => ipcRenderer.invoke('repairs:openFile', filePath),
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    startAutoCheck: () => ipcRenderer.invoke('updater:startAutoCheck'),
    onUpdateAvailable: (cb) => ipcRenderer.on('updater:update-available', (_, info) => cb(info)),
    onNotAvailable: (cb) => ipcRenderer.on('updater:not-available', () => cb()),
    onProgress: (cb) => ipcRenderer.on('updater:progress', (_, p) => cb(p)),
    onDownloaded: (cb) => ipcRenderer.on('updater:downloaded', (_, info) => cb(info)),
    onError: (cb) => ipcRenderer.on('updater:error', (_, msg) => cb(msg)),
    removeListeners: () => {
      ipcRenderer.removeAllListeners('updater:update-available')
      ipcRenderer.removeAllListeners('updater:not-available')
      ipcRenderer.removeAllListeners('updater:progress')
      ipcRenderer.removeAllListeners('updater:downloaded')
      ipcRenderer.removeAllListeners('updater:error')
    },
  },
  tunnel: {
    getUrl: () => ipcRenderer.invoke('tunnel:getUrl'),
    onUrlReady: (cb) => ipcRenderer.on('tunnel:urlReady', (_, url) => cb(url)),
    removeListeners: () => ipcRenderer.removeAllListeners('tunnel:urlReady'),
  },
})
