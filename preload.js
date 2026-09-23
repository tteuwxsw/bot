const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('painelLocal', {
  selecionarArquivo: () => ipcRenderer.invoke('selecionar-arquivo-txt'),
  carregarArquivoContatos: () => ipcRenderer.invoke('carregar-arquivo-contatos'),
  selecionarVideoContatos: () => ipcRenderer.invoke('selecionar-video-contatos'),
  configurarAgendamentoWindows: (configuracao) => ipcRenderer.invoke('configurar-agendamento-windows', configuracao),
  statusAgendamentoWindows: () => ipcRenderer.invoke('status-agendamento-windows'),
  salvarRelatorio: () => ipcRenderer.invoke('salvar-relatorio'),
  selecionarPasta: () => ipcRenderer.invoke('selecionar-pasta'),
});
