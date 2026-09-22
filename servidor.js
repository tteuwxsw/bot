const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { chromium } = require('playwright');

const execFileAsync = promisify(execFile);

const PORTA = 3030;
const URL_CADASTRO = 'https://amigosdofred.com.br/cadastro';
let sleepEntreCadastros = 20000;
let relatorioHtml = null;

let browser;
let page;
let chromePid;
let fila = [];
let arquivoOriginal;
let registroAtual;
let pararSolicitado = false;
let logs = [];
let resultados = [];
let temposCiclo = [];
let inicioCiclo = null;
let ocultarChrome = false;
let tirarPrint = false;
let pastaPrints = null;
let organizarPrints = false;
let printsPorPasta = 10;
let printsSalvos = 0;
let pastaSessaoPrints = null;

const PRIMEIROS_NOMES = [
  'Ana','Maria','Juliana','Fernanda','Patricia','Camila','Amanda','Bruna',
  'Larissa','Gabriela','Renata','Adriana','Luciana','Mariana','Priscila',
  'Carlos','João','Paulo','Pedro','Lucas','Marcos','Rafael','Bruno',
  'Gustavo','Thiago','Eduardo','Felipe','André','Leonardo','Daniel',
  'Francisco','Antônio','José','Manoel','Raimundo','Ricardo','Roberto',
  'Sandra','Teresa','Cristina','Vanessa','Bianca','Letícia','Tatiane',
  'Rogério','Sérgio','Fábio','Alexandre','Diego','Matheus','Gabriel',
  'Isabela','Beatriz','Raquel','Simone','Claudia','Daniela',
  'Edson','Gilberto','Valdir','Moisés','Heitor','Léo','Cauã','Enzo',
  'Miguel','Arthur','Davi','Bernardo','Nicolas','Helena','Valentina',
  'Laura','Sophia','Manuela','Heloísa','Luísa','Cecília','Lorena',
];

const SOBRENOMES = [
  'Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves',
  'Pereira','Lima','Gomes','Costa','Ribeiro','Martins','Carvalho',
  'Almeida','Lopes','Soares','Fernandes','Vieira','Barbosa','Rocha',
  'Dias','Nascimento','Andrade','Moreira','Nunes','Marques','Machado',
  'Mendes','Freitas','Cardoso','Ramos','Gonçalves','Santana','Teixeira',
  'Araújo','Pinto','Correia','Nogueira','Batista','Campos','Azevedo',
  'Castro','Melo','Monteiro','Cavalcanti','Pires','Dantas','Fonseca',
  'Rezende','Peixoto','Tavares','Leite','Borges','Amaral','Duarte',
  'Brito','Cunha','Lacerda','Queiroz','Neves','Vargas','Braga',
  'França','Barros','Moraes','Medeiros','Bezerra','Rangel','Macedo',
];

const nomesUsados = new Set();

function gerarNomeAleatorio() {
  let nome;
  do {
    const primeiro = PRIMEIROS_NOMES[Math.floor(Math.random() * PRIMEIROS_NOMES.length)];
    const s1 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
    const s2 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
    nome = `${primeiro} ${s1} ${s2}`;
  } while (nomesUsados.has(nome));
  nomesUsados.add(nome);
  return nome;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registrarLog(mensagem, tipo = 'info') {
  logs.push({ horario: new Date().toLocaleTimeString('pt-BR'), mensagem, tipo });
  if (logs.length > 200) logs = logs.slice(-200);
}

function calcularETA(restantes, cooldownSeg) {
  if (temposCiclo.length === 0 || restantes <= 0) return null;
  const mediaMs = temposCiclo.reduce((a, b) => a + b, 0) / temposCiclo.length;
  const mediaSeg = mediaMs / 1000;
  const totalSeg = (mediaSeg + cooldownSeg) * restantes;
  const horas = Math.floor(totalSeg / 3600);
  const minutos = Math.floor((totalSeg % 3600) / 60);
  const segundos = Math.floor(totalSeg % 60);
  if (horas > 0) return `${horas}h ${minutos}m ${segundos}s`;
  if (minutos > 0) return `${minutos}m ${segundos}s`;
  return `${segundos}s`;
}

function formatarDuracao(ms) {
  const seg = Math.floor(ms / 1000);
  const min = Math.floor(seg / 60);
  const s = seg % 60;
  if (min > 0) return `${min}m ${s}s`;
  return `${s}s`;
}

function criarPastaSessaoPrints() {
  const agora = new Date();
  const pad = (valor) => String(valor).padStart(2, '0');
  const prefixo = `prints-${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}_${pad(agora.getHours())}-${pad(agora.getMinutes())}-${pad(agora.getSeconds())}`;
  let destino = path.join(pastaPrints, prefixo);
  let sufixo = 2;
  while (fs.existsSync(destino)) {
    destino = path.join(pastaPrints, `${prefixo}-${sufixo}`);
    sufixo++;
  }
  fs.mkdirSync(destino, { recursive: true });
  return destino;
}

async function executarScreenshot(nomeArquivo) {
  if (!tirarPrint || !pastaPrints || !page) return;
  try {
    let pastaDestino = pastaPrints;
    if (organizarPrints) {
      const numeroPasta = Math.floor(printsSalvos / printsPorPasta) + 1;
      pastaDestino = path.join(pastaSessaoPrints, `Pasta ${String(numeroPasta).padStart(2, '0')}`);
      fs.mkdirSync(pastaDestino, { recursive: true });
    }
    const nomeSeguro = nomeArquivo.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    const caminho = path.join(pastaDestino, `${nomeSeguro}.png`);
    await page.screenshot({ path: caminho, fullPage: true });
    printsSalvos++;
    const pastaLog = organizarPrints ? `${path.basename(pastaDestino)}/` : '';
    registrarLog(`Print salvo: ${pastaLog}${nomeSeguro}.png`, 'sucesso');
  } catch (erro) {
    registrarLog(`Erro ao tirar print: ${erro.message}`, 'erro');
  }
}

function registrarResultado(dados, statusCadastro, erro) {
  resultados.push({
    nome: dados.nome,
    telefone: dados.telefone,
    status: statusCadastro,
    erro: erro || null,
    horario: new Date().toLocaleTimeString('pt-BR'),
  });
}

function gerarRelatorioHTML() {
  const total = resultados.length;
  const sucessos = resultados.filter((r) => r.status === 'sucesso').length;
  const erros = resultados.filter((r) => r.status === 'erro').length;
  const timeouts = resultados.filter((r) => r.status === 'sem_resposta').length;
  const dataHora = new Date().toLocaleString('pt-BR');

  const linhasHTML = resultados.map((r, i) => {
    const classe = r.status === 'sucesso' ? 'sucesso' : r.status === 'erro' ? 'erro' : 'aviso';
    const label = r.status === 'sucesso' ? 'Sucesso' : r.status === 'erro' ? 'Erro' : 'Sem Resposta';
    const erroCol = r.erro ? `<td>${r.erro}</td>` : '<td>-</td>';
    return `<tr class="${classe}"><td>${i + 1}</td><td>${r.nome}</td><td>${r.telefone}</td><td>${label}</td>${erroCol}<td>${r.horario}</td></tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório de Cadastros - ${dataHora}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #08111f; color: #eef4ff; font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; }
  h1 { color: #ffc400; margin-bottom: 8px; font-size: 28px; }
  .data { color: #90a2b9; margin-bottom: 24px; font-size: 14px; }
  .resumo { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
  .cartao { background: #111d30; border: 1px solid #2a3850; border-radius: 12px; padding: 20px 28px; min-width: 160px; text-align: center; }
  .cartao .numero { font-size: 36px; font-weight: 700; }
  .cartao .rotulo { font-size: 13px; color: #90a2b9; margin-top: 4px; }
  .cartao.total .numero { color: #eef4ff; }
  .cartao.ok .numero { color: #4ee4b4; }
  .cartao.falha .numero { color: #ff8f8f; }
  .cartao.sem .numero { color: #ffd15d; }
  table { width: 100%; border-collapse: collapse; background: #111d30; border-radius: 12px; overflow: hidden; border: 1px solid #2a3850; }
  th { background: #1a2a42; color: #9eb1c9; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; padding: 12px 16px; text-align: left; }
  td { padding: 10px 16px; border-bottom: 1px solid #1e3048; font-size: 14px; }
  tr.sucesso td { color: #eef4ff; }
  tr.erro td { color: #ff8f8f; }
  tr.aviso td { color: #ffd15d; }
  tr:last-child td { border-bottom: none; }
  .fechar { margin-top: 24px; background: #ffc400; color: #0a1424; border: none; border-radius: 10px; padding: 12px 28px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .fechar:hover { opacity: 0.85; }
</style>
</head>
<body>
  <h1>Relatório de Cadastros</h1>
  <p class="data">Gerado em: ${dataHora}</p>
  <div class="resumo">
    <div class="cartao total"><div class="numero">${total}</div><div class="rotulo">Total</div></div>
    <div class="cartao ok"><div class="numero">${sucessos}</div><div class="rotulo">Sucesso</div></div>
    <div class="cartao falha"><div class="numero">${erros}</div><div class="rotulo">Erros</div></div>
    <div class="cartao sem"><div class="numero">${timeouts}</div><div class="rotulo">Sem Resposta</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>Status</th><th>Erro</th><th>Horário</th></tr></thead>
    <tbody>${linhasHTML}</tbody>
  </table>
  <button class="fechar" onclick="window.close()">Fechar</button>
</body>
</html>`;

  const nomeArquivo = `relatorio-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now()}.html`;
  relatorioHtml = html;
  registrarLog(`Relatório gerado: ${nomeArquivo}`, 'sucesso');
  return nomeArquivo;
}

function carregarDados(caminho) {
  resultados = [];
  registrarLog('Lendo a lista de dados selecionada.');
  if (path.extname(caminho).toLowerCase() !== '.txt') throw new Error('Selecione um arquivo .txt.');
  const linhas = fs.readFileSync(caminho, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const novosDados = linhas.map((linha, i) => {
    const [nome, telefoneRaw] = linha.split('|').map((p) => p.trim());
    if (!nome || !telefoneRaw) throw new Error(`Linha ${i + 1}: use o formato Nome | Telefone.`);
    const telefone = formatarTelefone(telefoneRaw);
    if (!telefone) throw new Error(`Linha ${i + 1}: telefone inválido.`);
    return { nome, telefone };
  });
  if (!novosDados.length) throw new Error('O arquivo não possui dados válidos.');
  fila = novosDados;
  arquivoOriginal = caminho;
  registrarLog(`${fila.length} registro(s) adicionados à fila.`, 'sucesso');
  status = { ativo: false, mensagem: `${fila.length} registro(s) carregado(s).`, dados: null, restantes: fila.length };
}

function formatarTelefone(telefone) {
  let digitos = telefone.replace(/\D/g, '').slice(-11);
  if (digitos.length === 10) {
    const terceiro = parseInt(digitos[2], 10);
    if (terceiro >= 6) digitos = digitos.slice(0, 2) + '9' + digitos.slice(2);
  }
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return null;
}

function carregarTexto(texto, apenasNumeros) {
  resultados = [];
  nomesUsados.clear();
  registrarLog('Processando contatos do texto.');
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const novosDados = linhas.map((linha, i) => {
    if (apenasNumeros) {
      const telefone = linha.replace(/\D/g, '');
      if (telefone.length < 10) throw new Error(`Linha ${i + 1}: telefone inválido.`);
      const nome = gerarNomeAleatorio();
      const formatado = formatarTelefone(telefone);
      if (!formatado) throw new Error(`Linha ${i + 1}: telefone inválido.`);
      return { nome, telefone: formatado };
    }
    const [nome, telefoneRaw] = linha.split('|').map((p) => p.trim());
    if (!nome || !telefoneRaw) throw new Error(`Linha ${i + 1}: use o formato Nome | Telefone.`);
    const formatado = formatarTelefone(telefoneRaw);
    if (!formatado) throw new Error(`Linha ${i + 1}: telefone inválido.`);
    return { nome, telefone: formatado };
  });
  if (!novosDados.length) throw new Error('Nenhum contato válido encontrado.');
  fila = novosDados;
  arquivoOriginal = null;
  registrarLog(`${fila.length} contato(s) adicionado(s) à fila.`, 'sucesso');
  status = { ativo: false, mensagem: `${fila.length} contato(s) carregado(s).`, dados: null, restantes: fila.length };
}

async function abrirBrowser() {
  if (!browser) {
    const args = [
      '--disable-backgrounding-occluded-windows',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ];
    if (ocultarChrome) args.push('--window-position=-32000,-32000');
    browser = await chromium.launch({ channel: 'chrome', headless: false, args });
    registrarLog('Google Chrome aberto.');
    browser.on('disconnected', () => {
      browser = undefined;
      page = undefined;
      chromePid = undefined;
      status.ativo = false;
      status.mensagem = 'O Chrome foi fechado.';
      registrarLog('O Chrome foi fechado.', 'aviso');
    });
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage();
    await identificarProcessoChrome();
    if (ocultarChrome) await alterarVisibilidadeChrome(true);
    registrarLog('Nova aba criada.');
  }
}

async function identificarProcessoChrome() {
  if (chromePid || !browser) return;
  const cdp = await browser.newBrowserCDPSession();
  try {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    const processo = processInfo.find((item) => item.type === 'browser');
    chromePid = processo && processo.id;
  } finally {
    await cdp.detach();
  }
  if (!chromePid) throw new Error('Não foi possível identificar a janela do Chrome.');
}

async function alterarVisibilidadeChrome(ocultar) {
  if (!browser) return;
  await identificarProcessoChrome();

  const codigo = `
using System;
using System.Runtime.InteropServices;
public static class ChromeWindowVisibility {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr hWnd, int command);
  [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern bool RedrawWindow(IntPtr hWnd, IntPtr updateRect, IntPtr updateRegion, uint flags);
  public static int Set(uint targetPid, bool visible) {
    int changed = 0;
    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      if (pid == targetPid) {
        ShowWindowAsync(hWnd, visible ? 9 : 0);
        if (visible) {
          SetForegroundWindow(hWnd);
          RedrawWindow(hWnd, IntPtr.Zero, IntPtr.Zero, 0x185);
        }
        changed++;
      }
      return true;
    }, IntPtr.Zero);
    return changed;
  }
}`;
  const comando = `Add-Type -TypeDefinition @'\n${codigo}\n'@; [ChromeWindowVisibility]::Set(${chromePid}, $${ocultar ? 'false' : 'true'})`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando], {
    windowsHide: true,
  });
  if (parseInt(stdout.trim(), 10) < 1) throw new Error('A janela do Chrome não foi encontrada.');

  if (!ocultar && page && !page.isClosed()) {
    await sleep(200);
    const cdp = await page.context().newCDPSession(page);
    try {
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { left: 100, top: 100, width: 1280, height: 800 },
      });
      await cdp.send('Page.bringToFront');
    } finally {
      await cdp.detach();
    }
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  }
  registrarLog(`Janela do Chrome ${ocultar ? 'ocultada' : 'exibida'}.`, 'sucesso');
}

async function selecionarSelect2Valor(valor) {
  await page.evaluate((val) => {
    if (window.jQuery) {
      jQuery('select[name="region_id"]').val(val).trigger('change');
    }
  }, valor);
}

async function buscarRecrutadorAJAX(recrutador) {
  const recruitId = await page.evaluate(async () => {
    try {
      const resp = await fetch('https://amigosdofred.com.br/cadastro/indicadores?q=Professor%20Algudao');
      const data = await resp.json();
      if (data.results && data.results.length > 0) return data.results[0].id;
    } catch (e) {}
    return null;
  });

  if (!recruitId) throw new Error('Não encontrei o recrutador: ' + recrutador);

  await page.evaluate((id) => {
    if (window.jQuery) {
      const sel = jQuery('select[name="recruiter_id"]');
      const option = new Option('Professor Algudão', id, true, true);
      sel.append(option).trigger('change');
    }
  }, recruitId);
}

async function preencherEEnviar(dados) {
  await page.goto(URL_CADASTRO, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name="name"]', { timeout: 15000 });
  await page.locator('input[name="name"]').fill(dados.nome);
  if (dados.email) await page.locator('input[name="email"]').fill(dados.email);
  await page.locator('input[name="phone"]').fill(dados.telefone);
  await sleep(500);
  await selecionarSelect2Valor('25');
  await sleep(500);
  await buscarRecrutadorAJAX('Professor Algudão');
  await sleep(500);
  await page.locator('#lgpd_consent').check();
  await sleep(1000);
  await page.locator('button[data-testid="registration-submit"]').click();
  registrarLog(`Cadastro enviado: ${dados.nome} / ${dados.telefone}.`);
}

function aguardarRespostaSucesso() {
  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ sucesso: false, statusHttp: null, erro: 'Timeout 15s sem resposta' }); }
    }, 15000);

    function handler(resposta) {
      const pedido = resposta.request();
      const envioDoCadastro = pedido.method() === 'POST' && pedido.url().startsWith(URL_CADASTRO);
      if (envioDoCadastro && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        page.removeListener('response', handler);
        const status = resposta.status();
        const ok = status >= 200 && status < 400;
        resolve({ sucesso: ok, statusHttp: status, erro: ok ? null : `HTTP ${status}` });
      }
    }
    page.on('response', handler);
  });
}

async function executarSequenciaLista(cooldown, opcoes) {
  if (!fila.length) throw new Error('Não há contatos na fila. Adicione contatos na caixa de texto.');
  const total = fila.length;
  pararSolicitado = false;
  resultados = [];
  temposCiclo = [];
  ocultarChrome = opcoes.ocultarChrome || false;
  tirarPrint = opcoes.tirarPrint || false;
  pastaPrints = opcoes.pastaPrints || null;
  organizarPrints = tirarPrint && Boolean(opcoes.organizarPrints);
  printsPorPasta = Math.max(1, parseInt(opcoes.printsPorPasta, 10) || 10);
  printsSalvos = 0;
  pastaSessaoPrints = null;
  if (tirarPrint) {
    if (!pastaPrints) throw new Error('Selecione uma pasta para salvar os prints.');
    fs.mkdirSync(pastaPrints, { recursive: true });
    if (organizarPrints) {
      pastaSessaoPrints = criarPastaSessaoPrints();
      registrarLog(`Prints organizados em ${pastaSessaoPrints}, com até ${printsPorPasta} por pasta.`);
    }
  }
  const cooldownFinal = tirarPrint && cooldown < 6 ? 6 : cooldown;
  sleepEntreCadastros = (cooldownFinal || 20) * 1000;

  await abrirBrowser();

  try {
    for (let i = 0; i < total; i++) {
      if (pararSolicitado) {
        registrarLog('Automação interrompida pelo usuário.', 'aviso');
        break;
      }

      const dados = { ...fila[0] };
      registroAtual = dados;
      const restantes = fila.length;
      const eta = calcularETA(restantes, cooldownFinal);

      status = {
        ativo: true,
        mensagem: `Lista ${i + 1}/${total} — ${dados.nome}`,
        dados,
        restantes,
        progresso: { atual: i + 1, total },
        eta,
      };
      registrarLog(`Iniciando cadastro ${i + 1} de ${total}: ${dados.nome}.`);

      inicioCiclo = Date.now();
      try {
        await preencherEEnviar(dados);
        const resultado = await aguardarRespostaSucesso();

        if (resultado.sucesso) {
          registrarResultado(dados, 'sucesso');
          registrarLog(`Cadastro ${i + 1}/${total} concluído com sucesso.`, 'sucesso');
          await executarScreenshot(`cadastro-${i + 1}-${dados.nome.replace(/\s+/g, '_')}`);
        } else {
          registrarResultado(dados, 'sem_resposta', resultado.erro);
          registrarLog(`Cadastro ${i + 1}/${total} — sem confirmação de sucesso.`, 'aviso');
        }
      } catch (erro) {
        registrarResultado(dados, 'erro', erro.message);
        registrarLog(`Erro no cadastro ${i + 1}: ${erro.message}`, 'erro');
      }
      temposCiclo.push(Date.now() - inicioCiclo);

      fila.shift();
      if (arquivoOriginal) {
        const destino = path.join(path.dirname(arquivoOriginal), `${path.basename(arquivoOriginal, '.txt')}-restantes.txt`);
        fs.writeFileSync(destino, fila.map((item) => `${item.nome} | ${item.telefone}`).join('\r\n'), 'utf8');
      }

      if (fila.length > 0 && !pararSolicitado) {
        const etaPosCooldown = calcularETA(fila.length, cooldownFinal);
        status = {
          aguardando: true,
          ativo: true,
          mensagem: `Aguardando ${cooldownFinal}s antes do próximo cadastro… (${total - fila.length}/${total} concluídos)`,
          dados: null,
          restantes: fila.length,
          progresso: { atual: i + 1, total },
          eta: etaPosCooldown,
        };
        registrarLog(`Aguardando ${cooldownFinal}s antes do próximo cadastro…`);
        await sleep(sleepEntreCadastros);
      }
    }
  } finally {
    let nomeRelatorio = null;
    try { nomeRelatorio = gerarRelatorioHTML(); } catch (e) { registrarLog(`Erro ao gerar relatório: ${e.message}`, 'erro'); }

    try { if (browser) await browser.close(); } catch (e) { registrarLog(`Erro ao fechar Chrome: ${e.message}`, 'erro'); }
    browser = undefined;
    page = undefined;
    registroAtual = undefined;

    const concluidos = resultados.filter((r) => r.status === 'sucesso').length;
    status = {
      ativo: false,
      mensagem: `Finalizado. ${concluidos} de ${total} cadastro(s) concluído(s).`,
      dados: null,
      restantes: 0,
      progresso: { atual: total, total },
      relatorio: nomeRelatorio ? { caminho: nomeRelatorio, resultados } : null,
    };
    registrarLog(`Sequência finalizada: ${concluidos}/${total} concluídos.`, 'sucesso');
  }
}

async function parar() {
  pararSolicitado = true;
  if (browser) await browser.close();
  browser = undefined;
  page = undefined;
  temposCiclo = [];
  status = { ativo: false, mensagem: 'Automação parada.', dados: null, restantes: 0 };
  registrarLog('Automação interrompida.', 'aviso');
}

let status = { ativo: false, mensagem: '', dados: null, restantes: 0 };

function responderJson(res, codigo, corpo) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ...corpo, logs }));
}

function servirArquivo(res, arquivo, tipo) {
  res.writeHead(200, { 'Content-Type': tipo });
  res.end(fs.readFileSync(path.join(__dirname, arquivo)));
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') return servirArquivo(res, 'interface.html', 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/estilo.css') return servirArquivo(res, 'estilo.css', 'text/css; charset=utf-8');
    if (req.method === 'GET' && req.url === '/app.js') return servirArquivo(res, 'app.js', 'application/javascript; charset=utf-8');
    if (req.method === 'GET' && req.url === '/api/status') return responderJson(res, 200, status);
    if (req.method === 'GET' && req.url === '/api/relatorio') {
      if (!relatorioHtml) return responderJson(res, 404, { erro: 'Nenhum relatório disponível.' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(relatorioHtml);
    }

    if (req.method === 'POST') {
      let bruto = '';
      for await (const parte of req) bruto += parte;
      const corpo = bruto ? JSON.parse(bruto) : {};

      if (req.url === '/api/carregar') {
        carregarDados(corpo.caminho);
        return responderJson(res, 200, status);
      }

      if (req.url === '/api/carregar-texto') {
        carregarTexto(corpo.texto, corpo.apenasNumeros);
        return responderJson(res, 200, status);
      }

      if (req.url === '/api/preparar') {
        const cooldown = parseInt(corpo.cooldown, 10) || 20;
        const opcoes = {
          ocultarChrome: corpo.ocultarChrome || false,
          tirarPrint: corpo.tirarPrint || false,
          pastaPrints: corpo.pastaPrints || null,
          organizarPrints: corpo.organizarPrints || false,
          printsPorPasta: corpo.printsPorPasta,
        };
        executarSequenciaLista(cooldown, opcoes).catch((erro) => {
          status = { ativo: false, mensagem: `Erro: ${erro.message}`, dados: null, restantes: fila.length };
          registrarLog(`Erro na automação: ${erro.message}`, 'erro');
        });
        return responderJson(res, 200, status);
      }

      if (req.url === '/api/parar') {
        await parar();
        return responderJson(res, 200, status);
      }

      if (req.url === '/api/toggle-chrome') {
        ocultarChrome = Boolean(corpo.ocultar);
        if (browser) await alterarVisibilidadeChrome(ocultarChrome);
        return responderJson(res, 200, status);
      }
    }

    responderJson(res, 404, { erro: 'Página não encontrada.' });
  } catch (erro) {
    registrarLog(`Erro: ${erro.message}`, 'erro');
    status = { ativo: Boolean(browser), mensagem: `Erro: ${erro.message}`, dados: null, restantes: fila.length };
    responderJson(res, 400, status);
  }
});

function iniciarServidor() {
  return new Promise((resolve) => {
    servidor.listen(PORTA, () => {
      console.log(`Painel aberto em http://localhost:${PORTA}`);
      resolve();
    });
  });
}

if (require.main === module) iniciarServidor();

module.exports = { iniciarServidor, PORTA };
