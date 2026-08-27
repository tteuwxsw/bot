const statusEl = document.querySelector('#status');
const ponto = document.querySelector('#ponto');
const start = document.querySelector('#start');
const aleatorioBtn = document.querySelector('#aleatorio');
const logsEl = document.querySelector('#logs');
const contadorLog = document.querySelector('#contador-log');
const modal = document.querySelector('#modal');
const quantidadeInput = document.querySelector('#quantidade');
const cooldownInput = document.querySelector('#cooldown');
const modalConfirmar = document.querySelector('#modal-confirmar');
const modalCancelar = document.querySelector('#modal-cancelar');
const modalLista = document.querySelector('#modal-lista');
const cooldownListaInput = document.querySelector('#cooldown-lista');
const modalListaConfirmar = document.querySelector('#modal-lista-confirmar');
const modalListaCancelar = document.querySelector('#modal-lista-cancelar');
const baixarRelatorioBtn = document.querySelector('#baixar-relatorio');

const ocultarChrome = document.querySelector('#ocultar-chrome');
const tirarPrintAleatorio = document.querySelector('#tirar-print-aleatorio');
const pastaPrintAleatorio = document.querySelector('#pasta-print-aleatorio');
const selecionarPastaAleatorio = document.querySelector('#selecionar-pasta-aleatorio');
const pastaSelecionadaAleatorio = document.querySelector('#pasta-selecionada-aleatorio');

const tirarPrintLista = document.querySelector('#tirar-print-lista');
const pastaPrintLista = document.querySelector('#pasta-print-lista');
const selecionarPastaLista = document.querySelector('#selecionar-pasta-lista');
const pastaSelecionadaLista = document.querySelector('#pasta-selecionada-lista');

let pastaPrintsAleatorio = null;
let pastaPrintsLista = null;

ocultarChrome.addEventListener('change', async () => {
  await chamar('/api/toggle-chrome', { ocultar: ocultarChrome.checked });
});

function atualizarCooldownMinimo(input, tirarPrintChecked) {
  const valor = parseInt(input.value, 10) || 20;
  if (tirarPrintChecked && valor < 6) {
    input.value = 6;
  }
  input.min = tirarPrintChecked ? 6 : 5;
}

tirarPrintAleatorio.addEventListener('change', () => {
  pastaPrintAleatorio.style.display = tirarPrintAleatorio.checked ? 'block' : 'none';
  atualizarCooldownMinimo(cooldownInput, tirarPrintAleatorio.checked);
});

tirarPrintLista.addEventListener('change', () => {
  pastaPrintLista.style.display = tirarPrintLista.checked ? 'block' : 'none';
  atualizarCooldownMinimo(cooldownListaInput, tirarPrintLista.checked);
});

selecionarPastaAleatorio.addEventListener('click', async () => {
  if (!window.painelLocal || !window.painelLocal.selecionarPasta) return;
  const pasta = await window.painelLocal.selecionarPasta();
  if (pasta) {
    pastaPrintsAleatorio = pasta;
    pastaSelecionadaAleatorio.textContent = pasta;
    pastaSelecionadaAleatorio.classList.remove('sem-pasta');
  }
});

selecionarPastaLista.addEventListener('click', async () => {
  if (!window.painelLocal || !window.painelLocal.selecionarPasta) return;
  const pasta = await window.painelLocal.selecionarPasta();
  if (pasta) {
    pastaPrintsLista = pasta;
    pastaSelecionadaLista.textContent = pasta;
    pastaSelecionadaLista.classList.remove('sem-pasta');
  }
});

baixarRelatorioBtn.addEventListener('click', async () => {
  if (!window.painelLocal || !window.painelLocal.salvarRelatorio) return;
  baixarRelatorioBtn.disabled = true;
  baixarRelatorioBtn.textContent = 'Salvando…';
  const resultado = await window.painelLocal.salvarRelatorio();
  baixarRelatorioBtn.disabled = false;
  baixarRelatorioBtn.textContent = '📥 Baixar relatório (.html)';
  if (resultado.ok) {
    baixarRelatorioBtn.textContent = `✓ Salvo em: ${resultado.caminho.split(/[/\\]/).pop()}`;
  } else if (resultado.erro !== 'Cancelado pelo usuário.') {
    mostrarStatus({ ativo: false, mensagem: `Erro ao salvar: ${resultado.erro}` });
  }
});

function mostrarStatus(status) {
  statusEl.textContent = status.mensagem;
  ponto.classList.toggle('ativo', status.ativo);
  start.disabled = status.ativo;
  start.textContent = status.ativo ? 'Processando…' : '▶ Iniciar com lista';
  aleatorioBtn.disabled = status.ativo;
  if (!status.ativo) {
    aleatorioBtn.textContent = '🎲 Iniciar sem lista';
    baixarRelatorioBtn.style.display = 'none';
  }

  const logs = status.logs || [];
  contadorLog.textContent = `${logs.length} evento${logs.length === 1 ? '' : 's'}`;
  logsEl.innerHTML = logs.length
    ? logs.map((log) => `<div class="log ${log.tipo}"><time>${log.horario}</time><span>${log.mensagem}</span></div>`).join('')
    : '<p class="log-vazio">Aguardando atividade…</p>';
  logsEl.scrollTop = logsEl.scrollHeight;

  if (status.relatorio) baixarRelatorioBtn.style.display = 'block';
}

async function chamar(url, corpo) {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const status = await resposta.json();
  mostrarStatus(status);
  return status;
}

document.querySelector('#selecionar').addEventListener('click', async () => {
  if (!window.painelLocal) {
    mostrarStatus({ ativo: false, mensagem: 'Abra pelo aplicativo instalado para selecionar a lista.' });
    return;
  }
  const caminho = await window.painelLocal.selecionarArquivo();
  if (caminho) await chamar('/api/carregar', { caminho });
});

start.addEventListener('click', () => {
  cooldownListaInput.value = 20;
  modalLista.style.display = 'flex';
  cooldownListaInput.focus();
});

modalListaCancelar.addEventListener('click', () => {
  modalLista.style.display = 'none';
});

modalLista.addEventListener('click', (e) => {
  if (e.target === modalLista) modalLista.style.display = 'none';
});

modalListaConfirmar.addEventListener('click', async () => {
  const cooldown = parseInt(cooldownListaInput.value, 10) || 20;
  const opcoes = {
    ocultarChrome: ocultarChrome.checked,
    tirarPrint: tirarPrintLista.checked,
    pastaPrints: pastaPrintsLista,
  };
  modalLista.style.display = 'none';
  start.disabled = true;
  start.textContent = 'Preparando…';
  baixarRelatorioBtn.style.display = 'none';
  await chamar('/api/preparar', { cooldown, ...opcoes });
});

aleatorioBtn.addEventListener('click', () => {
  quantidadeInput.value = 1;
  cooldownInput.value = 20;
  modal.style.display = 'flex';
  quantidadeInput.focus();
});

modalCancelar.addEventListener('click', () => {
  modal.style.display = 'none';
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.style.display = 'none';
});

modalConfirmar.addEventListener('click', async () => {
  const quantidade = parseInt(quantidadeInput.value, 10);
  const cooldown = parseInt(cooldownInput.value, 10) || 20;
  if (!quantidade || quantidade < 1) return;
  const opcoes = {
    ocultarChrome: ocultarChrome.checked,
    tirarPrint: tirarPrintAleatorio.checked,
    pastaPrints: pastaPrintsAleatorio,
  };
  modal.style.display = 'none';
  baixarRelatorioBtn.style.display = 'none';
  aleatorioBtn.disabled = true;
  aleatorioBtn.textContent = `Processando 0/${quantidade}…`;
  await chamar('/api/aleatorio', { quantidade, cooldown, ...opcoes });
});

document.querySelector('#stop').addEventListener('click', () => chamar('/api/parar'));
fetch('/api/status').then(r => r.json()).then(mostrarStatus);
setInterval(() => fetch('/api/status').then(r => r.json()).then(mostrarStatus).catch(() => {}), 1500);
