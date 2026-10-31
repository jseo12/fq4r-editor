const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Expose only the operations needed by the renderer, never raw Node or IPC APIs.
// 렌더러에는 필요한 기능만 노출하고 Node나 IPC API 자체는 전달하지 않습니다.
contextBridge.exposeInMainWorld('fq4rDesktop', {
  watchSave: (id, baseline) => ipcRenderer.invoke('save:watch', id, baseline),
  onSaveChanged: (listener) => {
    const handler = (_event, id) => listener(id);
    ipcRenderer.on('save:changed', handler);
    return () => ipcRenderer.removeListener('save:changed', handler);
  },
  chooseFile: () => ipcRenderer.invoke('save:choose-file'),
  chooseFolder: () => ipcRenderer.invoke('save:choose-folder'),
  openDroppedFile: (file) => ipcRenderer.invoke('save:drop', webUtils.getPathForFile(file)),
  restoreFolder: () => ipcRenderer.invoke('save:restore'),
  loadSave: (id) => ipcRenderer.invoke('save:load', id),
  saveFileAs: (id, data) => ipcRenderer.invoke('save:write-as', id, data),
  saveFile: (id, data) => ipcRenderer.invoke('save:write', id, data),
});
