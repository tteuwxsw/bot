const statusEl = document.querySelector('#status');
const ponto = document.querySelector('#ponto');
const start = document.querySelector('#start');
const logsEl = document.querySelector('#logs');
const contadorLog = document.querySelector('#contador-log');
const modalLista = document.querySelector('#modal-lista');
const cooldownListaInput = document.querySelector('#cooldown-lista');
const modalListaConfirmar = document.querySelector('#modal-lista-confirmar');
const modalListaCancelar = document.querySelector('#modal-lista-cancelar');
const baixarRelatorioBtn = document.querySelector('#baixar-relatorio');
const contatosContainer = document.querySelector('#contatos-container');
const contatosContador = document.querySelector('#contatos-contador');
const contatosFormato = document.querySelector('#contatos-formato');
const quantidadeListaInput = document.querySelector('#quantidade-lista');
const apenasNumerosCheck = document.querySelector('#apenas-numeros');
const ordenarBtn = document.querySelector('#ordenar-contatos');
const carregarContatosBtn = document.querySelector('#carregar-contatos');
const arquivoContatosStatus = document.querySelector('#arquivo-contatos-status');

const ocultarChrome = document.querySelector('#ocultar-chrome');

const tirarPrintLista = document.querySelector('#tirar-print-lista');
const pastaPrintLista = document.querySelector('#pasta-print-lista');
const selecionarPastaLista = document.querySelector('#selecionar-pasta-lista');
const pastaSelecionadaLista = document.querySelector('#pasta-selecionada-lista');
const organizarPrintsLista = document.querySelector('#organizar-prints-lista');
const configOrganizarPrints = document.querySelector('#config-organizar-prints');
const printsPorPastaInput = document.querySelector('#prints-por-pasta');
const resumoOrganizarPrints = document.querySelector('#resumo-organizar-prints');

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

tirarPrintLista.addEventListener('change', () => {
  pastaPrintLista.style.display = tirarPrintLista.checked ? 'block' : 'none';
  if (!tirarPrintLista.checked) {
    organizarPrintsLista.checked = false;
    configOrganizarPrints.style.display = 'none';
  }
  atualizarCooldownMinimo(cooldownListaInput, tirarPrintLista.checked);
});

function atualizarResumoOrganizacao() {
  const porPasta = parseInt(printsPorPastaInput.value, 10);
  if (!Number.isInteger(porPasta) || porPasta < 1) {
    resumoOrganizarPrints.textContent = 'Informe uma quantidade válida.';
    return;
  }
  const total = getMaxContatos();
  const pastas = Math.ceil(total / porPasta);
  resumoOrganizarPrints.textContent = `${total} print(s): até ${pastas} pasta(s), com ${porPasta} em cada.`;
}

organizarPrintsLista.addEventListener('change', () => {
  configOrganizarPrints.style.display = organizarPrintsLista.checked ? 'grid' : 'none';
  atualizarResumoOrganizacao();
});

printsPorPastaInput.addEventListener('input', atualizarResumoOrganizacao);

selecionarPastaLista.addEventListener('click', async () => {
  if (!window.painelLocal || !window.painelLocal.selecionarPasta) return;
  const pasta = await window.painelLocal.selecionarPasta();
  if (pasta) {
    pastaPrintsLista = pasta;
    pastaSelecionadaLista.textContent = pasta;
    pastaSelecionadaLista.classList.remove('sem-pasta');
  }
});

function getMaxContatos() {
  return parseInt(quantidadeListaInput.value, 10) || 1;
}

function criarLinhaContato(numero, valor = '') {
  const linha = document.createElement('div');
  const marcador = document.createElement('span');
  const campo = document.createElement('input');
  linha.className = 'contatos-linha';
  marcador.className = 'contatos-numero';
  marcador.textContent = `${numero}:`;
  campo.type = 'text';
  campo.className = 'contatos-campo';
  campo.value = valor;
  campo.placeholder = apenasNumerosCheck.checked ? '(00) 00000-0000' : 'Nome | Telefone';
  linha.append(marcador, campo);
  return linha;
}

function gerarCampos(quantidade, valores = []) {
  contatosContainer.innerHTML = '';
  for (let i = 1; i <= quantidade; i++) {
    contatosContainer.appendChild(criarLinhaContato(i, valores[i - 1] || ''));
  }
  contarContatos();
}

function contarContatos() {
  const campos = contatosContainer.querySelectorAll('.contatos-campo');
  let preenchidos = 0;
  campos.forEach(c => { if (c.value.trim().length > 0) preenchidos++; });
  contatosContador.textContent = `${preenchidos} / ${campos.length} contato(s)`;
}

function pegarContatos() {
  const campos = contatosContainer.querySelectorAll('.contatos-campo');
  const contatos = [];
  campos.forEach(c => {
    const v = c.value.trim();
    if (v.length > 0) contatos.push(v);
  });
  return contatos.join('\n');
}

function atualizarPlaceholder() {
  if (apenasNumerosCheck.checked) {
    contatosFormato.innerHTML = 'Formato: <code>Só o telefone</code>';
  } else {
    contatosFormato.innerHTML = 'Formato: <code>Nome | Telefone</code>';
  }
  contatosContainer.querySelectorAll('.contatos-campo').forEach(c => {
    c.placeholder = apenasNumerosCheck.checked ? '(00) 00000-0000' : 'Nome | Telefone';
  });
}

quantidadeListaInput.addEventListener('input', () => {
  const max = getMaxContatos();
  const camposAtuais = contatosContainer.querySelectorAll('.contatos-campo');
  const valores = [];
  camposAtuais.forEach(c => valores.push(c.value));
  gerarCampos(max, valores);
  arquivoContatosStatus.textContent = '';
  atualizarResumoOrganizacao();
});

apenasNumerosCheck.addEventListener('change', () => {
  atualizarPlaceholder();
});

contatosContainer.addEventListener('input', () => {
  contarContatos();
});

contatosContainer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const campos = [...contatosContainer.querySelectorAll('.contatos-campo')];
    const idx = campos.indexOf(document.activeElement);
    if (idx >= 0 && idx < campos.length - 1) {
      campos[idx + 1].focus();
    }
  }
});

function organizarContatos() {
  const campos = contatosContainer.querySelectorAll('.contatos-campo');
  const valores = [];
  campos.forEach(c => valores.push(c.value.trim()));
  const preenchidos = valores.filter(v => v.length > 0);

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

  let resultado;
  if (apenasNumerosCheck.checked) {
    resultado = preenchidos
      .map(formatarTelefone)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  } else {
    const telefoneNoFim = /(\(?\d{2}\)?[\s.-]*\d{4,5}[\s.-]*\d{4})\s*$/;
    const validos = [];
    const invalidos = [];

    preenchidos.forEach((valor) => {
      const telefoneEncontrado = valor.match(telefoneNoFim);
      if (!telefoneEncontrado) {
        invalidos.push(valor);
        return;
      }

      const telefone = formatarTelefone(telefoneEncontrado[1]);
      const nome = valor
        .slice(0, telefoneEncontrado.index)
        .replace(/[\s|:;,-]+$/, '')
        .trim();

      if (!nome || !telefone) {
        invalidos.push(valor);
        return;
      }

      validos.push({ nome, telefone });
    });

    validos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    resultado = validos.map(({ nome, telefone }) => `${nome} | ${telefone}`).concat(invalidos);
  }

  campos.forEach((c, i) => { c.value = resultado[i] || ''; });
  contarContatos();
}

ordenarBtn.addEventListener('click', organizarContatos);

carregarContatosBtn.addEventListener('click', async () => {
  if (!window.painelLocal || !window.painelLocal.carregarArquivoContatos) return;
  arquivoContatosStatus.textContent = '';
  arquivoContatosStatus.className = 'arquivo-contatos-status';

  const arquivo = await window.painelLocal.carregarArquivoContatos();
  if (!arquivo) return;

  const linhas = arquivo.conteudo.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!linhas.length || linhas.length > 500) {
    arquivoContatosStatus.textContent = linhas.length > 500
      ? 'O arquivo pode ter no máximo 500 contatos.'
      : 'O arquivo está vazio.';
    arquivoContatosStatus.classList.add('erro');
    return;
  }

  const telefoneNoFim = /(\(?\d{2}\)?[\s.-]*\d{4,5}[\s.-]*\d{4})\s*$/;
  const erroNaLinha = linhas.findIndex((linha) => {
    const telefone = linha.match(telefoneNoFim);
    if (!telefone) return true;
    const nome = linha.slice(0, telefone.index).replace(/[\s|:;,-]+$/, '').trim();
    return apenasNumerosCheck.checked ? nome.length > 0 : nome.length === 0;
  });

  if (erroNaLinha >= 0) {
    arquivoContatosStatus.textContent = apenasNumerosCheck.checked
      ? `Linha ${erroNaLinha + 1}: o modo “Apenas números” não aceita nomes.`
      : `Linha ${erroNaLinha + 1}: informe Nome | Telefone ou marque “Apenas números”.`;
    arquivoContatosStatus.classList.add('erro');
    return;
  }

  quantidadeListaInput.value = linhas.length;
  gerarCampos(linhas.length, linhas);
  organizarContatos();
  arquivoContatosStatus.textContent = `${arquivo.nome}: ${linhas.length} contato(s) carregado(s).`;
  arquivoContatosStatus.classList.add('sucesso');
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
  statusEl.style.display = status.mensagem ? 'block' : 'none';
  ponto.classList.toggle('ativo', status.ativo);
  start.disabled = status.ativo;
  start.textContent = status.ativo ? 'Processando…' : '▶ Iniciar com lista';

  if (!status.ativo) {
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

start.addEventListener('click', () => {
  quantidadeListaInput.value = 1;
  contatosFormato.innerHTML = 'Formato: <code>Nome | Telefone</code>';
  apenasNumerosCheck.checked = false;
  arquivoContatosStatus.textContent = '';
  gerarCampos(1);
  cooldownListaInput.value = 20;
  tirarPrintLista.checked = false;
  pastaPrintLista.style.display = 'none';
  pastaPrintsLista = null;
  pastaSelecionadaLista.textContent = 'Nenhuma pasta selecionada';
  pastaSelecionadaLista.classList.add('sem-pasta');
  organizarPrintsLista.checked = false;
  configOrganizarPrints.style.display = 'none';
  printsPorPastaInput.value = 10;
  atualizarCooldownMinimo(cooldownListaInput, false);
  atualizarResumoOrganizacao();
  modalLista.style.display = 'flex';
  quantidadeListaInput.focus();
});

modalListaCancelar.addEventListener('click', () => {
  modalLista.style.display = 'none';
});

modalLista.addEventListener('click', (e) => {
  if (e.target === modalLista) modalLista.style.display = 'none';
});

modalListaConfirmar.addEventListener('click', async () => {
  const texto = pegarContatos();
  const preenchidos = texto ? texto.split(/\r?\n/).length : 0;
  if (preenchidos !== getMaxContatos()) {
    arquivoContatosStatus.textContent = `Preencha os ${getMaxContatos()} contatos antes de iniciar.`;
    arquivoContatosStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  if (tirarPrintLista.checked && !pastaPrintsLista) {
    arquivoContatosStatus.textContent = 'Selecione a pasta onde os prints serão salvos.';
    arquivoContatosStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  const printsPorPasta = parseInt(printsPorPastaInput.value, 10);
  if (organizarPrintsLista.checked && (!Number.isInteger(printsPorPasta) || printsPorPasta < 1 || printsPorPasta > 500)) {
    arquivoContatosStatus.textContent = 'Informe entre 1 e 500 prints por pasta.';
    arquivoContatosStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  const resultado = await chamar('/api/carregar-texto', {
    texto,
    apenasNumeros: apenasNumerosCheck.checked,
  });
  if (resultado.erro) return;
  const cooldown = parseInt(cooldownListaInput.value, 10) || 20;
  const opcoes = {
    ocultarChrome: ocultarChrome.checked,
    tirarPrint: tirarPrintLista.checked,
    pastaPrints: pastaPrintsLista,
    organizarPrints: organizarPrintsLista.checked,
    printsPorPasta,
  };
  modalLista.style.display = 'none';
  start.disabled = true;
  start.textContent = 'Preparando…';
  baixarRelatorioBtn.style.display = 'none';
  await chamar('/api/preparar', { cooldown, ...opcoes });
});

document.querySelector('#stop').addEventListener('click', () => chamar('/api/parar'));
fetch('/api/status').then(r => r.json()).then(mostrarStatus);
setInterval(() => fetch('/api/status').then(r => r.json()).then(mostrarStatus).catch(() => {}), 1500);
