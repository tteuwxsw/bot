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
const importarVideoBtn = document.querySelector('#importar-video');
const modalVideo = document.querySelector('#modal-video');
const selecionarVideoBtn = document.querySelector('#selecionar-video');
const analisarVideoBtn = document.querySelector('#analisar-video');
const modalVideoFechar = document.querySelector('#modal-video-fechar');
const videoSelecionadoEl = document.querySelector('#video-selecionado');
const videoProgresso = document.querySelector('#video-progresso');
const videoEtapa = document.querySelector('#video-etapa');
const videoPorcentagem = document.querySelector('#video-porcentagem');
const videoProgressoFill = document.querySelector('#video-progresso-fill');
const videoStatus = document.querySelector('#video-status');
const abrirContatosSalvosBtn = document.querySelector('#abrir-contatos-salvos');
const modalContatosSalvos = document.querySelector('#modal-contatos-salvos');
const modalContatosSalvosCancelar = document.querySelector('#modal-contatos-salvos-cancelar');
const usarContatosSalvosBtn = document.querySelector('#usar-contatos-salvos');
const quantidadeContatosSalvos = document.querySelector('#quantidade-contatos-salvos');
const listaContatosSalvos = document.querySelector('#lista-contatos-salvos');
const totalContatosDisponiveis = document.querySelector('#total-contatos-disponiveis');
const totalContatosUsados = document.querySelector('#total-contatos-usados');
const contatosSalvosStatus = document.querySelector('#contatos-salvos-status');
const abrirAgendamentoBtn = document.querySelector('#abrir-agendamento');
const agendamentoInline = document.querySelector('#agendamento-inline');
const agendamentoToggleResumo = document.querySelector('#agendamento-toggle-resumo');
const agendamentoAtivo = document.querySelector('#agendamento-ativo');
const agendamentoHorario = document.querySelector('#agendamento-horario');
const agendamentoQuantidade = document.querySelector('#agendamento-quantidade');
const agendamentoErros = document.querySelector('#agendamento-erros');
const agendamentoOpcoesResumo = document.querySelector('#agendamento-opcoes-resumo');
const agendamentoWindows = document.querySelector('#agendamento-windows');
const agendamentoWindowsStatus = document.querySelector('#agendamento-windows-status');
const agendamentoDisponiveis = document.querySelector('#agendamento-disponiveis');
const agendamentoProxima = document.querySelector('#agendamento-proxima');
const agendamentoHistoricoLista = document.querySelector('#agendamento-historico-lista');
const agendamentoStatus = document.querySelector('#agendamento-status');
const agendamentoCancelar = document.querySelector('#agendamento-cancelar');
const agendamentoSalvar = document.querySelector('#agendamento-salvar');

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
let videoSelecionado = null;
let contatosSalvosDisponiveis = [];
let monitorVideo = null;
let agendamentoWindowsDisponivel = false;
let agendamentoWindowsAtivoAnterior = false;
let configuracaoAgendamentoCarregada = null;
let formularioListaAlterado = false;
let ocultarChromeAlterado = false;
let agendamentoEspecificoAlterado = false;

async function requisitarJson(url, opcoes = {}) {
  const resposta = await fetch(url, opcoes);
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || dados.mensagem || 'Não foi possível concluir a operação.');
  return dados;
}

function exibirStatusVideo(dados) {
  const progresso = Math.max(0, Math.min(100, Number(dados.progresso) || 0));
  videoProgresso.style.display = dados.ativo || dados.etapa ? 'block' : 'none';
  videoEtapa.textContent = dados.etapa === 'quadros' ? 'Extraindo imagens' : dados.etapa === 'ocr' ? 'Lendo números' : dados.etapa === 'concluido' ? 'Concluído' : dados.etapa === 'erro' ? 'Erro' : 'Preparando';
  videoPorcentagem.textContent = `${progresso}%`;
  videoProgressoFill.style.width = `${progresso}%`;
  videoStatus.textContent = dados.mensagem || '';
  videoStatus.className = `video-status${dados.erro ? ' erro' : dados.etapa === 'concluido' ? ' sucesso' : ''}`;
  analisarVideoBtn.disabled = Boolean(dados.ativo) || !videoSelecionado;
  selecionarVideoBtn.disabled = Boolean(dados.ativo);
}

async function atualizarStatusVideo() {
  try {
    const dados = await requisitarJson('/api/importacao-video/status');
    exibirStatusVideo(dados);
    if (!dados.ativo && monitorVideo) {
      clearInterval(monitorVideo);
      monitorVideo = null;
    }
  } catch (erro) {
    videoStatus.textContent = erro.message;
    videoStatus.className = 'video-status erro';
  }
}

function iniciarMonitorVideo() {
  if (monitorVideo) clearInterval(monitorVideo);
  atualizarStatusVideo();
  monitorVideo = setInterval(atualizarStatusVideo, 1000);
}

importarVideoBtn.addEventListener('click', async () => {
  modalVideo.style.display = 'flex';
  await atualizarStatusVideo();
});

selecionarVideoBtn.addEventListener('click', async () => {
  if (!window.painelLocal || !window.painelLocal.selecionarVideoContatos) return;
  const video = await window.painelLocal.selecionarVideoContatos();
  if (!video) return;
  videoSelecionado = video;
  videoSelecionadoEl.textContent = video.nome;
  videoSelecionadoEl.classList.remove('sem-pasta');
  videoStatus.textContent = 'Vídeo pronto para análise.';
  videoStatus.className = 'video-status';
  analisarVideoBtn.disabled = false;
});

analisarVideoBtn.addEventListener('click', async () => {
  if (!videoSelecionado) return;
  try {
    const dados = await requisitarJson('/api/importacao-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caminho: videoSelecionado.caminho }),
    });
    exibirStatusVideo(dados);
    iniciarMonitorVideo();
  } catch (erro) {
    videoStatus.textContent = erro.message;
    videoStatus.className = 'video-status erro';
  }
});

modalVideoFechar.addEventListener('click', () => {
  modalVideo.style.display = 'none';
});

modalVideo.addEventListener('click', (evento) => {
  if (evento.target === modalVideo) modalVideo.style.display = 'none';
});

function atualizarSelecaoContatosSalvos() {
  const quantidade = parseInt(quantidadeContatosSalvos.value, 10) || 0;
  listaContatosSalvos.querySelectorAll('.contato-salvo-linha').forEach((linha, indice) => {
    linha.classList.toggle('selecionado', indice < quantidade);
  });
}

async function carregarContatosSalvos() {
  contatosSalvosStatus.textContent = 'Carregando contatos…';
  contatosSalvosStatus.className = 'arquivo-contatos-status';
  usarContatosSalvosBtn.disabled = true;
  try {
    const dados = await requisitarJson('/api/contatos-salvos');
    contatosSalvosDisponiveis = dados.disponiveis || [];
    totalContatosDisponiveis.textContent = dados.totalDisponiveis ?? contatosSalvosDisponiveis.length;
    totalContatosUsados.textContent = dados.usados || 0;
    const limite = Math.min(500, contatosSalvosDisponiveis.length);
    quantidadeContatosSalvos.max = Math.max(1, limite);
    quantidadeContatosSalvos.value = Math.min(Math.max(1, getMaxContatos()), Math.max(1, limite));
    listaContatosSalvos.innerHTML = '';
    contatosSalvosDisponiveis.forEach((contato, indice) => {
      const linha = document.createElement('div');
      linha.className = 'contato-salvo-linha';
      const numero = document.createElement('span');
      const telefone = document.createElement('code');
      numero.textContent = `${indice + 1}.`;
      telefone.textContent = contato.formatado;
      linha.append(numero, telefone);
      listaContatosSalvos.appendChild(linha);
    });
    contatosSalvosStatus.textContent = contatosSalvosDisponiveis.length ? '' : 'Não há contatos disponíveis. Importe um vídeo primeiro.';
    usarContatosSalvosBtn.disabled = contatosSalvosDisponiveis.length === 0;
    atualizarSelecaoContatosSalvos();
  } catch (erro) {
    contatosSalvosStatus.textContent = erro.message;
    contatosSalvosStatus.className = 'arquivo-contatos-status erro';
  }
}

abrirContatosSalvosBtn.addEventListener('click', async () => {
  modalContatosSalvos.style.display = 'flex';
  await carregarContatosSalvos();
});

quantidadeContatosSalvos.addEventListener('input', atualizarSelecaoContatosSalvos);

modalContatosSalvosCancelar.addEventListener('click', () => {
  modalContatosSalvos.style.display = 'none';
});

modalContatosSalvos.addEventListener('click', (evento) => {
  if (evento.target === modalContatosSalvos) modalContatosSalvos.style.display = 'none';
});

usarContatosSalvosBtn.addEventListener('click', () => {
  const quantidade = parseInt(quantidadeContatosSalvos.value, 10);
  const limite = Math.min(500, contatosSalvosDisponiveis.length);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > limite) {
    contatosSalvosStatus.textContent = `Informe uma quantidade entre 1 e ${limite}.`;
    contatosSalvosStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  const telefones = contatosSalvosDisponiveis.slice(0, quantidade).map((contato) => contato.formatado);
  apenasNumerosCheck.checked = true;
  quantidadeListaInput.value = quantidade;
  atualizarPlaceholder();
  gerarCampos(quantidade, telefones);
  formularioListaAlterado = true;
  arquivoContatosStatus.textContent = `${quantidade} contato(s) salvo(s) carregado(s). Eles serão retirados dos disponíveis conforme forem usados.`;
  arquivoContatosStatus.className = 'arquivo-contatos-status sucesso';
  modalContatosSalvos.style.display = 'none';
});

function atualizarCamposAgendamento() {
  const ativo = agendamentoAtivo.checked;
  [agendamentoHorario, agendamentoQuantidade, agendamentoErros].forEach((campo) => {
    campo.disabled = !ativo;
  });
  agendamentoWindows.disabled = !ativo || !agendamentoWindowsDisponivel;
  if (!ativo) agendamentoWindows.checked = false;
}

function atualizarResumoOpcoesAgendamento() {
  const partes = [`Cooldown ${parseInt(cooldownListaInput.value, 10) || 20}s`];
  partes.push(ocultarChrome.checked ? 'Chrome oculto' : 'Chrome visível');
  if (tirarPrintLista.checked) {
    partes.push(organizarPrintsLista.checked
      ? `prints em pastas de ${parseInt(printsPorPastaInput.value, 10) || 10}`
      : 'prints ativados');
  } else {
    partes.push('sem prints');
  }
  agendamentoOpcoesResumo.textContent = partes.join(' · ');
}

function nomeStatusAgendamento(status) {
  const nomes = {
    concluido: 'Concluído',
    parcial: 'Parcial',
    erro: 'Erro',
    ignorado: 'Ignorado',
    sem_contatos: 'Sem contatos',
    interrompido: 'Interrompido',
    executando: 'Executando',
    preparando: 'Preparando',
  };
  return nomes[status] || status;
}

function renderizarHistoricoAgendamento(historico) {
  agendamentoHistoricoLista.innerHTML = '';
  if (!historico.length) {
    const vazio = document.createElement('p');
    vazio.className = 'ajuda';
    vazio.textContent = 'Nenhuma execução registrada.';
    agendamentoHistoricoLista.appendChild(vazio);
    return;
  }
  historico.forEach((execucao) => {
    const item = document.createElement('div');
    const data = document.createElement('time');
    const resumo = document.createElement('span');
    const situacao = document.createElement('strong');
    item.className = `agendamento-historico-item ${execucao.status === 'concluido' ? 'sucesso' : ['erro', 'interrompido'].includes(execucao.status) ? 'erro' : ''}`;
    data.textContent = new Date(`${execucao.data}T12:00:00`).toLocaleDateString('pt-BR');
    resumo.textContent = `${execucao.sucessos}/${execucao.processados} sucesso(s) · ${execucao.origem}`;
    situacao.textContent = nomeStatusAgendamento(execucao.status);
    item.title = execucao.mensagem || '';
    item.append(data, resumo, situacao);
    agendamentoHistoricoLista.appendChild(item);
  });
}

function preencherResumoAgendamento(dados) {
  const config = dados.configuracao;
  if (!agendamentoEspecificoAlterado) {
    agendamentoAtivo.checked = config.ativo;
    agendamentoHorario.value = config.horario;
    agendamentoQuantidade.value = config.quantidade;
    agendamentoErros.value = config.limiteErros;
  }
  agendamentoProxima.textContent = dados.proximaExecucao
    ? new Date(dados.proximaExecucao).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Desativado';
  agendamentoToggleResumo.textContent = config.ativo
    ? `${config.horario} · ${dados.disponiveis} restante(s) · ${config.quantidade}/dia`
    : 'Desativado · clique para configurar';
  if (!formularioListaAlterado) {
    if (dados.fila && dados.fila.length) {
      apenasNumerosCheck.checked = false;
      quantidadeListaInput.value = dados.fila.length;
      gerarCampos(dados.fila.length, dados.fila.map((contato) => `${contato.nome} | ${contato.telefone}`));
      atualizarPlaceholder();
    }
    cooldownListaInput.value = config.cooldown;
    tirarPrintLista.checked = config.tirarPrint;
    pastaPrintsLista = config.pastaPrints || null;
    pastaPrintLista.style.display = config.tirarPrint ? 'block' : 'none';
    pastaSelecionadaLista.textContent = pastaPrintsLista || 'Nenhuma pasta selecionada';
    pastaSelecionadaLista.classList.toggle('sem-pasta', !pastaPrintsLista);
    organizarPrintsLista.checked = config.organizarPrints;
    configOrganizarPrints.style.display = config.organizarPrints ? 'grid' : 'none';
    printsPorPastaInput.value = config.printsPorPasta;
    atualizarCooldownMinimo(cooldownListaInput, config.tirarPrint);
    atualizarResumoOrganizacao();
  }
  if (!ocultarChromeAlterado) ocultarChrome.checked = config.ocultarChrome;
  const totalListaAtual = pegarContatos() ? getMaxContatos() : dados.disponiveis;
  agendamentoDisponiveis.textContent = totalListaAtual;
  agendamentoQuantidade.max = Math.max(1, totalListaAtual);
  atualizarResumoOpcoesAgendamento();
  renderizarHistoricoAgendamento(dados.historico || []);
}

async function carregarAgendamento() {
  agendamentoInline.setAttribute('aria-busy', 'true');
  agendamentoStatus.textContent = 'Carregando configuração…';
  agendamentoStatus.className = 'arquivo-contatos-status';
  try {
    const [dados, tarefaWindows] = await Promise.all([
      requisitarJson('/api/agendamento'),
      window.painelLocal && window.painelLocal.statusAgendamentoWindows
        ? window.painelLocal.statusAgendamentoWindows()
        : Promise.resolve({ disponivel: false, ativo: false }),
    ]);
    preencherResumoAgendamento(dados);
    configuracaoAgendamentoCarregada = { ...dados.configuracao };
    agendamentoWindowsDisponivel = Boolean(tarefaWindows.disponivel);
    agendamentoWindowsAtivoAnterior = agendamentoWindowsDisponivel
      ? Boolean(tarefaWindows.ativo)
      : Boolean(dados.configuracao.windowsAtivo);
    if (!agendamentoEspecificoAlterado) {
      agendamentoWindows.checked = dados.configuracao.ativo && agendamentoWindowsAtivoAnterior;
    }
    agendamentoWindowsStatus.textContent = agendamentoWindowsDisponivel
      ? tarefaWindows.ativo ? 'Tarefa diária encontrada no Windows.' : 'Nenhuma tarefa diária ativa no Windows.'
      : 'Instale o aplicativo para habilitar o Agendador do Windows.';
    atualizarCamposAgendamento();
    agendamentoStatus.textContent = '';
  } catch (erro) {
    agendamentoStatus.textContent = erro.message;
    agendamentoStatus.className = 'arquivo-contatos-status erro';
  } finally {
    agendamentoInline.removeAttribute('aria-busy');
  }
}

function fecharOpcoesAgendamento() {
  agendamentoInline.hidden = true;
  abrirAgendamentoBtn.setAttribute('aria-expanded', 'false');
}

abrirAgendamentoBtn.addEventListener('click', async () => {
  if (!agendamentoInline.hidden) {
    fecharOpcoesAgendamento();
    return;
  }
  agendamentoInline.hidden = false;
  abrirAgendamentoBtn.setAttribute('aria-expanded', 'true');
  agendamentoEspecificoAlterado = false;
  abrirAgendamentoBtn.disabled = true;
  try {
    await carregarAgendamento();
  } finally {
    abrirAgendamentoBtn.disabled = false;
  }
});

agendamentoAtivo.addEventListener('change', () => {
  agendamentoEspecificoAlterado = true;
  atualizarCamposAgendamento();
});
agendamentoHorario.addEventListener('input', () => { agendamentoEspecificoAlterado = true; });
agendamentoQuantidade.addEventListener('input', () => { agendamentoEspecificoAlterado = true; });
agendamentoErros.addEventListener('input', () => { agendamentoEspecificoAlterado = true; });
agendamentoWindows.addEventListener('change', () => { agendamentoEspecificoAlterado = true; });

agendamentoCancelar.addEventListener('click', () => {
  fecharOpcoesAgendamento();
  abrirAgendamentoBtn.focus();
});

agendamentoSalvar.addEventListener('click', async () => {
  const texto = pegarContatos();
  const preenchidos = texto ? texto.split(/\r?\n/).length : 0;
  const cooldown = parseInt(cooldownListaInput.value, 10);
  const printsPorPasta = parseInt(printsPorPastaInput.value, 10);
  const configuracao = {
    ativo: agendamentoAtivo.checked,
    windowsAtivo: agendamentoAtivo.checked && agendamentoWindows.checked,
    horario: agendamentoHorario.value,
    quantidade: parseInt(agendamentoQuantidade.value, 10),
    cooldown,
    ocultarChrome: ocultarChrome.checked,
    limiteErros: parseInt(agendamentoErros.value, 10),
    texto,
    apenasNumeros: apenasNumerosCheck.checked,
    tirarPrint: tirarPrintLista.checked,
    pastaPrints: pastaPrintsLista,
    organizarPrints: organizarPrintsLista.checked,
    printsPorPasta,
  };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(configuracao.horario)
      || !Number.isInteger(configuracao.quantidade) || configuracao.quantidade < 1 || configuracao.quantidade > 500
      || !Number.isInteger(cooldown) || cooldown < 5 || cooldown > 300
      || !Number.isInteger(printsPorPasta) || printsPorPasta < 1 || printsPorPasta > 500
      || !Number.isInteger(configuracao.limiteErros) || configuracao.limiteErros < 1 || configuracao.limiteErros > 10) {
    agendamentoStatus.textContent = 'Revise o horário e os limites informados.';
    agendamentoStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  if (configuracao.ativo && preenchidos !== getMaxContatos()) {
    agendamentoStatus.textContent = `Preencha os ${getMaxContatos()} contatos antes de salvar o agendamento.`;
    agendamentoStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  if (configuracao.ativo && configuracao.quantidade > preenchidos) {
    agendamentoStatus.textContent = 'A quantidade diária não pode ser maior que a lista carregada.';
    agendamentoStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  if (configuracao.ativo && tirarPrintLista.checked && !pastaPrintsLista) {
    agendamentoStatus.textContent = 'Selecione a pasta onde os prints serão salvos.';
    agendamentoStatus.className = 'arquivo-contatos-status erro';
    return;
  }
  if (configuracao.ativo && organizarPrintsLista.checked && (printsPorPasta < 1 || printsPorPasta > 500)) {
    agendamentoStatus.textContent = 'Informe entre 1 e 500 prints por pasta.';
    agendamentoStatus.className = 'arquivo-contatos-status erro';
    return;
  }

  agendamentoSalvar.disabled = true;
  agendamentoStatus.textContent = 'Salvando agendamento…';
  agendamentoStatus.className = 'arquivo-contatos-status';
  let tarefaWindowsAlterada = false;
  try {
    if (agendamentoWindowsDisponivel && window.painelLocal.configurarAgendamentoWindows) {
      const resultadoWindows = await window.painelLocal.configurarAgendamentoWindows({
        ativo: configuracao.windowsAtivo,
        horario: configuracao.horario,
      });
      if (!resultadoWindows.ok) throw new Error(resultadoWindows.erro || 'Não foi possível configurar o Agendador do Windows.');
      tarefaWindowsAlterada = true;
    } else if (configuracao.windowsAtivo) {
      throw new Error('O Agendador do Windows não está disponível nesta instalação.');
    }
    const dados = await requisitarJson('/api/agendamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configuracao),
    });
    preencherResumoAgendamento(dados);
    configuracaoAgendamentoCarregada = { ...dados.configuracao };
    agendamentoWindowsAtivoAnterior = configuracao.windowsAtivo;
    agendamentoStatus.textContent = configuracao.ativo ? 'Agendamento salvo com sucesso.' : 'Agendamento desativado.';
    agendamentoStatus.className = 'arquivo-contatos-status sucesso';
    agendamentoWindowsStatus.textContent = configuracao.windowsAtivo
      ? 'Tarefa diária ativa no Windows.'
      : 'Agendamento do Windows desativado.';
  } catch (erro) {
    let mensagem = erro.message;
    if (tarefaWindowsAlterada && configuracaoAgendamentoCarregada && window.painelLocal.configurarAgendamentoWindows) {
      const rollback = await window.painelLocal.configurarAgendamentoWindows({
        ativo: agendamentoWindowsAtivoAnterior,
        horario: configuracaoAgendamentoCarregada.horario,
      });
      if (!rollback.ok) mensagem += ' Também não foi possível restaurar a tarefa anterior do Windows.';
    }
    agendamentoStatus.textContent = mensagem;
    agendamentoStatus.className = 'arquivo-contatos-status erro';
  } finally {
    agendamentoSalvar.disabled = false;
  }
});

ocultarChrome.addEventListener('change', async () => {
  ocultarChromeAlterado = true;
  atualizarResumoOpcoesAgendamento();
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
  formularioListaAlterado = true;
  pastaPrintLista.style.display = tirarPrintLista.checked ? 'block' : 'none';
  if (!tirarPrintLista.checked) {
    organizarPrintsLista.checked = false;
    configOrganizarPrints.style.display = 'none';
  }
  atualizarCooldownMinimo(cooldownListaInput, tirarPrintLista.checked);
  atualizarResumoOpcoesAgendamento();
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
  formularioListaAlterado = true;
  configOrganizarPrints.style.display = organizarPrintsLista.checked ? 'grid' : 'none';
  atualizarResumoOrganizacao();
  atualizarResumoOpcoesAgendamento();
});

printsPorPastaInput.addEventListener('input', () => {
  formularioListaAlterado = true;
  atualizarResumoOrganizacao();
  atualizarResumoOpcoesAgendamento();
});

cooldownListaInput.addEventListener('input', () => {
  formularioListaAlterado = true;
  atualizarResumoOpcoesAgendamento();
});

selecionarPastaLista.addEventListener('click', async () => {
  if (!window.painelLocal || !window.painelLocal.selecionarPasta) return;
  const pasta = await window.painelLocal.selecionarPasta();
  if (pasta) {
    formularioListaAlterado = true;
    pastaPrintsLista = pasta;
    pastaSelecionadaLista.textContent = pasta;
    pastaSelecionadaLista.classList.remove('sem-pasta');
    atualizarResumoOpcoesAgendamento();
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
  formularioListaAlterado = true;
  const max = getMaxContatos();
  const camposAtuais = contatosContainer.querySelectorAll('.contatos-campo');
  const valores = [];
  camposAtuais.forEach(c => valores.push(c.value));
  gerarCampos(max, valores);
  arquivoContatosStatus.textContent = '';
  atualizarResumoOrganizacao();
});

apenasNumerosCheck.addEventListener('change', () => {
  formularioListaAlterado = true;
  atualizarPlaceholder();
});

contatosContainer.addEventListener('input', () => {
  formularioListaAlterado = true;
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
  formularioListaAlterado = true;
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
  formularioListaAlterado = true;
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
  logsEl.innerHTML = '';
  if (logs.length) {
    logs.forEach((log) => {
      const linha = document.createElement('div');
      const horario = document.createElement('time');
      const mensagem = document.createElement('span');
      const tipo = ['sucesso', 'erro', 'aviso'].includes(log.tipo) ? log.tipo : 'info';
      linha.className = `log ${tipo}`;
      horario.textContent = log.horario;
      mensagem.textContent = log.mensagem;
      linha.append(horario, mensagem);
      logsEl.appendChild(linha);
    });
  } else {
    const vazio = document.createElement('p');
    vazio.className = 'log-vazio';
    vazio.textContent = 'Aguardando atividade…';
    logsEl.appendChild(vazio);
  }
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
  formularioListaAlterado = false;
  fecharOpcoesAgendamento();
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
  atualizarResumoOpcoesAgendamento();
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
