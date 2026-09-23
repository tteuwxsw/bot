'use strict';

const fs = require('fs');
const path = require('path');

function caminhoForaDoAsar(caminho) {
  const trechoAsar = `${path.sep}app.asar${path.sep}`;
  return caminho.includes(trechoAsar) ? caminho.replace(trechoAsar, `${path.sep}app.asar.unpacked${path.sep}`) : caminho;
}

function normalizarTelefone61(valor) {
  let digitos = String(valor || '').replace(/\D/g, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (!digitos.startsWith('61') || (digitos.length !== 10 && digitos.length !== 11)) return null;
  if (digitos.length === 10 && Number(digitos[2]) >= 6) digitos = `${digitos.slice(0, 2)}9${digitos.slice(2)}`;
  if (digitos.length === 11 && digitos[2] !== '9') return null;
  return digitos;
}

function extrairTelefones61(texto) {
  const encontrados = new Set();
  const padrao = /(?<!\d)(?:\+?[ \t]*55[ \t().-]*)?\(?[ \t]*61[ \t]*\)?[ \t.-]*(?:9[ \t.-]*)?\d{4}[ \t.-]*\d{4}(?!\d)/g;
  for (const linha of texto.split(/\r?\n/)) {
    for (const correspondencia of linha.matchAll(padrao)) {
      const telefone = normalizarTelefone61(correspondencia[0]);
      if (telefone) encontrados.add(telefone);
    }
  }
  return encontrados;
}

function enviar(dados) {
  process.stdout.write(`${JSON.stringify(dados)}\n`);
}

async function executar() {
  const pastaQuadros = process.argv[2];
  const quadros = fs.readdirSync(pastaQuadros)
    .filter((arquivo) => arquivo.endsWith('.jpg'))
    .sort()
    .map((arquivo) => path.join(pastaQuadros, arquivo));
  if (!quadros.length) throw new Error('Nenhuma imagem foi recebida para OCR.');

  const { createWorker, OEM, PSM } = require('tesseract.js');
  const dadosIdioma = require('@tesseract.js-data/eng');
  const raizTesseract = path.dirname(require.resolve('tesseract.js/package.json'));
  const raizCore = path.dirname(require.resolve('tesseract.js-core/package.json'));
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    langPath: caminhoForaDoAsar(dadosIdioma.langPath),
    workerPath: caminhoForaDoAsar(path.join(raizTesseract, 'src', 'worker-script', 'node', 'index.js')),
    corePath: caminhoForaDoAsar(raizCore),
    cacheMethod: 'none',
    gzip: dadosIdioma.gzip,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: '0123456789()+- ',
      preserve_interword_spaces: '1',
    });
    const telefones = new Set();
    for (let i = 0; i < quadros.length; i++) {
      const resultado = await worker.recognize(quadros[i]);
      for (const telefone of extrairTelefones61(resultado.data.text)) telefones.add(telefone);
      enviar({ tipo: 'progresso', atual: i + 1, total: quadros.length, encontrados: telefones.size });
    }
    enviar({ tipo: 'resultado', telefones: [...telefones] });
  } finally {
    await worker.terminate();
  }
}

executar().catch((erro) => {
  process.stderr.write(erro.stack || erro.message);
  process.exit(1);
});
