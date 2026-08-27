const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORTA = 3030;
const URL_CADASTRO = 'https://amigosdofred.com.br/cadastro';
let sleepEntreCadastros = 20000;
let relatorioHtml = null;

let browser;
let page;
let fila = [];
let arquivoOriginal;
let registroAtual;
let usandoAleatorio = false;
let totalAleatorio = 0;
let concluidosAleatorio = 0;
let pararSolicitado = false;
let logs = [];
let resultados = [];
let temposCiclo = [];
let inicioCiclo = null;
let ocultarChrome = false;
let tirarPrint = false;
let pastaPrints = null;

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

const NUMEROS_UTILIZADOS = new Set();

function gerarNomeAleatorio() {
  const primeiro = PRIMEIROS_NOMES[Math.floor(Math.random() * PRIMEIROS_NOMES.length)];
  const s1 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  const s2 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  return `${primeiro} ${s1} ${s2}`;
}

function gerarTelefoneDF() {
  let telefone;
  do {
    const p1 = String(90000 + Math.floor(Math.random() * 10000));
    const p2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    telefone = `(61) ${p1}-${p2}`;
  } while (NUMEROS_UTILIZADOS.has(telefone));
  NUMEROS_UTILIZADOS.add(telefone);
  return telefone;
}

function criarDadosAleatorios() {
  return { nome: gerarNomeAleatorio(), telefone: gerarTelefoneDF() };
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

async function executarScreenshot(nomeArquivo) {
  if (!tirarPrint || !pastaPrints || !page) return;
  try {
    const caminho = path.join(pastaPrints, `${nomeArquivo}.png`);
    await page.screenshot({ path: caminho, fullPage: true });
    registrarLog(`Print salvo: ${nomeArquivo}.png`, 'sucesso');
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
  usandoAleatorio = false;
  resultados = [];
  registrarLog('Lendo a lista de dados selecionada.');
  if (path.extname(caminho).toLowerCase() !== '.txt') throw new Error('Selecione um arquivo .txt.');
  const linhas = fs.readFileSync(caminho, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const novosDados = linhas.map((linha, i) => {
    const [nome, telefone] = linha.split('|').map((p) => p.trim());
    if (!nome || !telefone) throw new Error(`Linha ${i + 1}: use o formato Nome | Telefone.`);
    return { nome, telefone };
  });
  if (!novosDados.length) throw new Error('O arquivo não possui dados válidos.');
  fila = novosDados;
  arquivoOriginal = caminho;
  registrarLog(`${fila.length} registro(s) adicionados à fila.`, 'sucesso');
  status = { ativo: false, mensagem: `${fila.length} registro(s) carregado(s).`, dados: null, restantes: fila.length };
}

async function abrirBrowser() {
  if (!browser) {
    const args = ocultarChrome ? ['--window-position=-32000,-32000'] : [];
    browser = await chromium.launch({ channel: 'chrome', headless: false, args });
    registrarLog('Google Chrome aberto.');
    browser.on('disconnected', () => {
      browser = undefined;
      page = undefined;
      status.ativo = false;
      status.mensagem = 'O Chrome foi fechado.';
      registrarLog('O Chrome foi fechado.', 'aviso');
    });
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage();
    if (ocultarChrome) {
      try {
        const cdp = await page.context().newCDPSession(page);
        const { windowId } = await cdp.send('Browser.getWindowForTarget');
        await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: -32000, top: -32000 } });
      } catch (e) {}
    }
    registrarLog('Nova aba criada.');
  }
}

async function selecionarSelect2(seletor, texto) {
  await page.locator(seletor).click();
  const busca = page.locator('input.select2-search__field');
  await busca.fill(texto);
  const opcao = page.locator('.select2-results__option').filter({ hasText: texto }).first();
  await opcao.waitFor({ state: 'visible', timeout: 10000 });
  const encontrado = (await opcao.innerText()).trim();
  if (encontrado !== texto) throw new Error(`Não encontrei a opção: ${texto}`);
  await opcao.click();
}

async function preencherEEnviar(dados) {
  await page.goto(URL_CADASTRO, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="name"]').fill(dados.nome);
  await page.locator('input[name="phone"]').fill(dados.telefone);
  await selecionarSelect2('#select2-region_id-container', 'SCIA/Estrutural');
  await selecionarSelect2('#select2-recruiter_id-container', 'Professor Algudão');
  await page.locator('#lgpd_consent').check();
  await page.locator('button:has-text("Cadastrar")').click();
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

async function executarSequenciaAleatoria(quantidade, cooldown, opcoes) {
  usandoAleatorio = true;
  totalAleatorio = quantidade;
  concluidosAleatorio = 0;
  pararSolicitado = false;
  resultados = [];
  temposCiclo = [];
  ocultarChrome = opcoes.ocultarChrome || false;
  tirarPrint = opcoes.tirarPrint || false;
  pastaPrints = opcoes.pastaPrints || null;
  const cooldownFinal = tirarPrint && cooldown < 6 ? 6 : cooldown;
  sleepEntreCadastros = (cooldownFinal || 20) * 1000;

  await abrirBrowser();

  try {
    for (let i = 0; i < quantidade; i++) {
      if (pararSolicitado) {
        registrarLog('Automação interrompida pelo usuário.', 'aviso');
        break;
      }

      const dados = criarDadosAleatorios();
      registroAtual = dados;
      const restantes = quantidade - i;
      const eta = calcularETA(restantes, cooldownFinal);

      status = {
        ativo: true,
        mensagem: `Aleatório ${i + 1}/${quantidade} — ${dados.nome}`,
        dados,
        restantes,
        progresso: { atual: i + 1, total: quantidade },
        eta,
      };
      registrarLog(`Iniciando cadastro ${i + 1} de ${quantidade}.`);

      inicioCiclo = Date.now();
      try {
        await preencherEEnviar(dados);
        const resultado = await aguardarRespostaSucesso();

        if (resultado.sucesso) {
          concluidosAleatorio++;
          registrarResultado(dados, 'sucesso');
          registrarLog(`Cadastro ${i + 1}/${quantidade} concluído com sucesso.`, 'sucesso');
          await executarScreenshot(`cadastro-${i + 1}-${dados.nome.replace(/\s+/g, '_')}`);
        } else {
          registrarResultado(dados, 'sem_resposta', resultado.erro);
          registrarLog(`Cadastro ${i + 1}/${quantidade} — sem confirmação de sucesso.`, 'aviso');
        }
      } catch (erro) {
        registrarResultado(dados, 'erro', erro.message);
        registrarLog(`Erro no cadastro ${i + 1}: ${erro.message}`, 'erro');
      }
      temposCiclo.push(Date.now() - inicioCiclo);

      if (i < quantidade - 1 && !pararSolicitado) {
        const etaPosCooldown = calcularETA(quantidade - i - 1, cooldownFinal);
        status = {
          aguardando: true,
          ativo: true,
          mensagem: `Aguardando ${cooldownFinal}s antes do próximo cadastro… (${concluidosAleatorio}/${quantidade} concluídos)`,
          dados: null,
          restantes: quantidade - i - 1,
          progresso: { atual: i + 1, total: quantidade },
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

    status = {
      ativo: false,
      mensagem: `Finalizado. ${concluidosAleatorio} de ${quantidade} cadastro(s) concluído(s).`,
      dados: null,
      restantes: 0,
      progresso: { atual: quantidade, total: quantidade },
      relatorio: nomeRelatorio ? { caminho: nomeRelatorio, resultados } : null,
    };
    registrarLog(`Sequência finalizada: ${concluidosAleatorio}/${quantidade} concluídos.`, 'sucesso');
    usandoAleatorio = false;
  }
}

async function executarSequenciaLista(cooldown, opcoes) {
  if (!fila.length) throw new Error('Não há registros na fila. Carregue outro arquivo .txt.');
  const total = fila.length;
  pararSolicitado = false;
  resultados = [];
  temposCiclo = [];
  ocultarChrome = opcoes.ocultarChrome || false;
  tirarPrint = opcoes.tirarPrint || false;
  pastaPrints = opcoes.pastaPrints || null;
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
  usandoAleatorio = false;
  temposCiclo = [];
  status = { ativo: false, mensagem: 'Automação parada.', dados: null, restantes: 0 };
  registrarLog('Automação interrompida.', 'aviso');
}

let status = { ativo: false, mensagem: 'Carregue um arquivo .txt ou gere dados aleatórios.', dados: null, restantes: 0 };

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

      if (req.url === '/api/preparar') {
        const cooldown = parseInt(corpo.cooldown, 10) || 20;
        const opcoes = {
          ocultarChrome: corpo.ocultarChrome || false,
          tirarPrint: corpo.tirarPrint || false,
          pastaPrints: corpo.pastaPrints || null,
        };
        executarSequenciaLista(cooldown, opcoes);
        return responderJson(res, 200, status);
      }

      if (req.url === '/api/aleatorio') {
        const quantidade = parseInt(corpo.quantidade, 10) || 1;
        const cooldown = parseInt(corpo.cooldown, 10) || 20;
        const opcoes = {
          ocultarChrome: corpo.ocultarChrome || false,
          tirarPrint: corpo.tirarPrint || false,
          pastaPrints: corpo.pastaPrints || null,
        };
        executarSequenciaAleatoria(quantidade, cooldown, opcoes);
        return responderJson(res, 200, status);
      }

      if (req.url === '/api/parar') {
        await parar();
        return responderJson(res, 200, status);
      }

      if (req.url === '/api/toggle-chrome') {
        const ocultar = corpo.ocultar;
        ocultarChrome = ocultar;
        if (browser) {
          try {
            const context = browser.contexts()[0];
            if (context) {
              const pages = context.pages();
              for (const p of pages) {
                const cdp = await p.context().newCDPSession(p);
                if (ocultar) {
                  await cdp.send('Browser.getWindowForTarget');
                  await p.evaluate(() => {
                    Object.defineProperty(document, 'hidden', { value: true });
                  });
                  const { windowId } = await cdp.send('Browser.getWindowForTarget');
                  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: -32000, top: -32000 } });
                } else {
                  const { windowId } = await cdp.send('Browser.getWindowForTarget');
                  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: 100, top: 100, width: 1280, height: 800 } });
                }
              }
            }
          } catch (e) {
            registrarLog(`Erro ao ${ocultar ? 'ocultar' : 'mostrar'} Chrome: ${e.message}`, 'erro');
          }
        }
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
