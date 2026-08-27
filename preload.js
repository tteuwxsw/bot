const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('painelLocal', {
  selecionarArquivo: () => ipcRenderer.invoke('selecionar-arquivo-txt'),
  salvarRelatorio: () => ipcRenderer.invoke('salvar-relatorio'),
  selecionarPasta: () => ipcRenderer.invoke('selecionar-pasta'),
});
