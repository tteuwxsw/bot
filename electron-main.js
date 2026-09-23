const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { iniciarServidor, iniciarMonitorAgendamento, PORTA } = require('./servidor');

const execFileAsync = promisify(execFile);
const NOME_TAREFA_AGENDADA = 'Painel de Preenchimento - Cadastro diario';
let janela;

function temArgumentoAgendamento(argumentos = process.argv) {
  return argumentos.includes('--executar-agendamento');
}

function solicitarExecucaoAgendada() {
  return new Promise((resolve) => {
    const requisicao = http.request({
      hostname: '127.0.0.1',
      port: PORTA,
      path: '/api/agendamento/executar',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    requisicao.on('error', resolve);
    requisicao.end(JSON.stringify({ origem: 'windows' }));
  });
}

function escaparPowerShell(valor) {
  return String(valor).replace(/'/g, "''");
}

async function configurarAgendamentoWindows({ ativo, horario }) {
  if (!app.isPackaged) return { ok: false, erro: 'O Agendador do Windows só pode ser configurado no aplicativo instalado.' };
  if (ativo && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(horario || ''))) {
    return { ok: false, erro: 'Horário inválido para o Agendador do Windows.' };
  }

  const nome = escaparPowerShell(NOME_TAREFA_AGENDADA);
  const executavel = escaparPowerShell(process.execPath);
  const script = ativo
    ? `$action = New-ScheduledTaskAction -Execute '${executavel}' -Argument '--executar-agendamento'; `
      + `$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact('${horario}', 'HH:mm', $null)); `
      + '$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable:$false -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries; '
      + '$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited; '
      + `Register-ScheduledTask -TaskName '${nome}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Executa o lote diário do Painel de Preenchimento.' -Force | Out-Null;`
    : `Unregister-ScheduledTask -TaskName '${nome}' -Confirm:$false -ErrorAction SilentlyContinue;`;

  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, ativo: Boolean(ativo) };
  } catch (erro) {
    return { ok: false, erro: erro.stderr || erro.message };
  }
}

async function consultarAgendamentoWindows() {
  if (!app.isPackaged) return { disponivel: false, ativo: false };
  const nome = escaparPowerShell(NOME_TAREFA_AGENDADA);
  const script = `$task = Get-ScheduledTask -TaskName '${nome}' -ErrorAction SilentlyContinue; `
    + "if ($task) { $trigger = $task.Triggers | Select-Object -First 1; $action = $task.Actions | Select-Object -First 1; "
    + "[pscustomobject]@{ ativo = ($task.State -ne 'Disabled'); executavel = $action.Execute; argumentos = $action.Arguments; horario = ([datetime]$trigger.StartBoundary).ToString('HH:mm') } | ConvertTo-Json -Compress "
    + '} else { [pscustomobject]@{ ativo = $false; executavel = $null; argumentos = $null; horario = $null } | ConvertTo-Json -Compress }';
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    return { disponivel: true, ...JSON.parse(stdout.trim()) };
  } catch {
    return { disponivel: true, ativo: false };
  }
}

function obterAgendamentoLocal() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORTA}/api/agendamento`, (res) => {
      let dados = '';
      res.on('data', (parte) => { dados += parte; });
      res.on('end', () => {
        try { resolve(JSON.parse(dados)); } catch (erro) { reject(erro); }
      });
    }).on('error', reject);
  });
}

async function reconciliarAgendamentoWindows() {
  if (!app.isPackaged) return;
  try {
    const [resumo, tarefa] = await Promise.all([obterAgendamentoLocal(), consultarAgendamentoWindows()]);
    const config = resumo.configuracao;
    const deveEstarAtivo = Boolean(config.ativo && config.windowsAtivo);
    const tarefaCorreta = tarefa.ativo
      && path.normalize(tarefa.executavel || '') === path.normalize(process.execPath)
      && String(tarefa.argumentos || '').trim() === '--executar-agendamento'
      && tarefa.horario === config.horario;
    if ((deveEstarAtivo && !tarefaCorreta) || (!deveEstarAtivo && tarefa.ativo)) {
      await configurarAgendamentoWindows({ ativo: deveEstarAtivo, horario: config.horario });
    }
  } catch {}
}

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
  const inicioPeloAgendamento = temArgumentoAgendamento();
  await iniciarServidor(process.env.PAINEL_DADOS_DIR || app.getPath('userData'), {
    adiarMonitorAgendamento: inicioPeloAgendamento,
  });
  await reconciliarAgendamentoWindows();

  if (inicioPeloAgendamento) {
    await solicitarExecucaoAgendada();
    iniciarMonitorAgendamento({ verificarAgora: false, ignorarMinutoAtual: true });
  }

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

const possuiTrava = process.env.PAINEL_IGNORAR_TRAVA_INSTANCIA === '1' || app.requestSingleInstanceLock();
if (!possuiTrava) {
  app.quit();
} else {
  app.on('second-instance', (_evento, argumentos) => {
    if (temArgumentoAgendamento(argumentos)) solicitarExecucaoAgendada();
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });
  app.whenReady().then(criarJanela);
}
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
ipcMain.handle('configurar-agendamento-windows', (_evento, configuracao) => configurarAgendamentoWindows(configuracao));
ipcMain.handle('status-agendamento-windows', () => consultarAgendamentoWindows());
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
