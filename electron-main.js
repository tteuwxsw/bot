const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { iniciarServidor, PORTA } = require('./servidor');

let janela;

function versaoMaisNova(disponivel, atual) {
  const partesDisponivel = disponivel.split('.').map(Number);
  const partesAtual = atual.split('.').map(Number);
  const tamanho = Math.max(partesDisponivel.length, partesAtual.length);
  for (let i = 0; i < tamanho; i++) {
    const diferenca = (partesDisponivel[i] || 0) - (partesAtual[i] || 0);
    if (diferenca !== 0) return diferenca > 0;
  }
  return false;
}

function verificarAtualizacao() {
  return new Promise((resolve) => {
    const url = 'https://api.github.com/repos/tteuwxsw/bot/releases/latest';
    https.get(url, { headers: { 'User-Agent': 'Painel-de-Preenchimento' } }, (res) => {
      let dados = '';
      res.on('data', (chunk) => { dados += chunk; });
      res.on('end', () => {
        try {
          const info = JSON.parse(dados);
          const versaoAtual = app.getVersion();
          const versao = String(info.tag_name || '').replace(/^v/i, '');
          const instalador = (info.assets || []).find((asset) => asset.name.toLowerCase().endsWith('.exe'));
          if (versao && instalador && versaoMaisNova(versao, versaoAtual)) {
            resolve({ temAtualizacao: true, versao, url: instalador.browser_download_url });
          } else {
            resolve({ temAtualizacao: false });
          }
        } catch (e) {
          resolve({ temAtualizacao: false });
        }
      });
    }).on('error', () => {
      resolve({ temAtualizacao: false });
    });
  });
}

async function criarJanela() {
  await iniciarServidor(process.env.PAINEL_DADOS_DIR || app.getPath('userData'));

  janela = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 780,
    minHeight: 640,
    backgroundColor: '#08111f',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  await janela.loadURL(`http://localhost:${PORTA}`);

  const resultado = await verificarAtualizacao();
  if (resultado.temAtualizacao) {
    const resposta = await dialog.showMessageBox(janela, {
      type: 'info',
      title: 'Atualização disponível',
      message: `Uma nova versão (${resultado.versao}) está disponível!`,
      buttons: ['Baixar atualização', 'Depois'],
      defaultId: 0,
      cancelId: 1,
    });

    if (resposta.response === 0 && resultado.url) {
      require('electron').shell.openExternal(resultado.url);
      app.quit();
    }
  }
}

app.whenReady().then(criarJanela);
ipcMain.handle('selecionar-arquivo-txt', async () => {
  const resultado = await dialog.showOpenDialog({
    title: 'Selecione a lista de dados',
    properties: ['openFile'],
    filters: [{ name: 'Arquivo de texto', extensions: ['txt'] }],
  });
  return resultado.canceled ? null : resultado.filePaths[0];
});
ipcMain.handle('carregar-arquivo-contatos', async () => {
  const resultado = await dialog.showOpenDialog(janela, {
    title: 'Carregar contatos',
    properties: ['openFile'],
    filters: [{ name: 'Arquivo de texto', extensions: ['txt'] }],
  });
  if (resultado.canceled) return null;

  const caminho = resultado.filePaths[0];
  return {
    nome: path.basename(caminho),
    conteudo: fs.readFileSync(caminho, 'utf8'),
  };
});
ipcMain.handle('selecionar-video-contatos', async () => {
  const resultado = await dialog.showOpenDialog(janela, {
    title: 'Selecione a gravação com os contatos',
    properties: ['openFile'],
    filters: [{ name: 'Vídeo MP4', extensions: ['mp4'] }],
  });
  if (resultado.canceled) return null;
  return {
    caminho: resultado.filePaths[0],
    nome: path.basename(resultado.filePaths[0]),
  };
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) criarJanela();
});

ipcMain.handle('selecionar-pasta', async () => {
  const resultado = await dialog.showOpenDialog({
    title: 'Selecione a pasta para salvar os prints',
    properties: ['openDirectory', 'createDirectory'],
  });
  return resultado.canceled ? null : resultado.filePaths[0];
});

ipcMain.handle('salvar-relatorio', async () => {
  let html = '';
  try {
    html = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORTA}/api/relatorio`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  } catch {
    return { ok: false, erro: 'Nenhum relatório disponível.' };
  }

  const resultado = await dialog.showSaveDialog({
    title: 'Salvar relatório',
    defaultPath: `relatorio-${new Date().toISOString().slice(0, 10)}.html`,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  });

  if (resultado.canceled) return { ok: false, erro: 'Cancelado pelo usuário.' };

  fs.writeFileSync(resultado.filePath, html, 'utf8');
  return { ok: true, caminho: resultado.filePath };
});
