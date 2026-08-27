const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { iniciarServidor, PORTA } = require('./servidor');

let janela;
let temAtualizacao = false;
let versaoDisponivel = null;

function verificarAtualizacao() {
  return new Promise((resolve) => {
    const url = 'https://raw.githubusercontent.com/tteuwxsw/bot/main/update.json';
    const protocolo = url.startsWith('https') ? https : http;
    
    protocolo.get(url, (res) => {
      let dados = '';
      res.on('data', (chunk) => { dados += chunk; });
      res.on('end', () => {
        try {
          const info = JSON.parse(dados);
          const versaoAtual = app.getVersion();
          if (info.versao && info.versao !== versaoAtual) {
            temAtualizacao = true;
            versaoDisponivel = info.versao;
            resolve({ temAtualizacao: true, versao: info.versao, url: info.url || null });
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
  await iniciarServidor();

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
