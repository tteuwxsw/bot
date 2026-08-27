const { chromium } = require('playwright');

const CONFIG = {
  url: 'https://amigosdofred.com.br/cadastro',
  marcarConsentimento: true,
  cadastrar: true,
};

const PRIMEIROS_NOMES = [
  'Ana', 'Maria', 'Juliana', 'Fernanda', 'Patricia', 'Camila', 'Amanda', 'Bruna',
  'Larissa', 'Gabriela', 'Renata', 'Adriana', 'Luciana', 'Mariana', 'Priscila',
  'Carlos', 'João', 'Paulo', 'Pedro', 'Lucas', 'Marcos', 'Rafael', 'Bruno',
  'Gustavo', 'Thiago', 'Eduardo', 'Felipe', 'André', 'Leonardo', 'Daniel',
  'Francisco', 'Antônio', 'José', 'Manoel', 'Raimundo', 'Ricardo', 'Roberto',
  'Sandra', 'Teresa', 'Cristina', 'Vanessa', 'Bianca', 'Letícia', 'Tatiane',
  'Rogério', 'Sérgio', 'Fábio', 'Alexandre', 'Diego', 'Matheus', 'Gabriel',
  'Isabela', 'Beatriz', 'Leticia', 'Raquel', 'Simone', 'Claudia', 'Daniela',
  'Edson', 'Gilberto', 'Valdir', 'Moisés', 'Heitor', 'Léo', 'Cauã', 'Enzo',
  'Miguel', 'Arthur', 'Davi', 'Bernardo', 'Nicolas', 'Helena', 'Valentina',
  'Laura', 'Sophia', 'Manuela', 'Heloísa', 'Luísa', 'Cecília', 'Lorena',
];

const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha',
  'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado',
  'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira',
  'Araújo', 'Pinto', 'Correia', 'Nogueira', 'Batista', 'Campos', 'Azevedo',
  'Castro', 'Melo', 'Monteiro', 'Cavalcanti', 'Pires', 'Dantas', 'Fonseca',
  'Rezende', 'Peixoto', 'Tavares', 'Leite', 'Borges', 'Amaral', 'Duarte',
];

const NUMEROS_UTILIZADOS = new Set();

function gerarNomeAleatorio() {
  const primeiro = PRIMEIROS_NOMES[Math.floor(Math.random() * PRIMEIROS_NOMES.length)];
  const sobrenome1 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  const sobrenome2 = SOBRENOMES[Math.floor(Math.random() * SOBRENOMES.length)];
  return `${primeiro} ${sobrenome1} ${sobrenome2}`;
}

function gerarTelefoneDF() {
  let telefone;
  do {
    const parte1 = String(90000 + Math.floor(Math.random() * 10000));
    const parte2 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    telefone = `(61) ${parte1}-${parte2}`;
  } while (NUMEROS_UTILIZADOS.has(telefone));
  NUMEROS_UTILIZADOS.add(telefone);
  return telefone;
}

function criarDadosDeTeste() {
  return { nome: gerarNomeAleatorio(), telefone: gerarTelefoneDF() };
}

(async () => {
  const dados = criarDadosDeTeste();
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded' });

    await page.locator('input[name="name"]').fill(dados.nome);
    await page.locator('input[name="phone"]').fill(dados.telefone);

    if (CONFIG.marcarConsentimento) {
      await page.locator('#lgpd_consent').check();
    }

    if (CONFIG.cadastrar) {
      await page.locator('button:has-text("Cadastrar")').click();
    }

    console.log('Formulário preenchido:');
    console.log(dados);
    console.log('Aguardando resposta do site...');
  } catch (erro) {
    console.error('Não foi possível preencher o formulário:', erro.message);
    await browser.close();
    process.exitCode = 1;
  }
})();
