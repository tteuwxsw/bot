const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('painelLocal', {
  selecionarArquivo: () => ipcRenderer.invoke('selecionar-arquivo-txt'),
  carregarArquivoContatos: () => ipcRenderer.invoke('carregar-arquivo-contatos'),
  salvarRelatorio: () => ipcRenderer.invoke('salvar-relatorio'),
  selecionarPasta: () => ipcRenderer.invoke('selecionar-pasta'),
});
