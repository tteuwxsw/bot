# Painel de preenchimento Amigos do Fred

Este painel local abre o Google Chrome e lê uma lista de dados de um arquivo `.txt` para preencher:

- Nome e telefone do próximo registro da lista;
- Região Administrativa: `SCIA/Estrutural`;
- Quem te convidou: `Professor Algudão`.

Ele não envia o cadastro nem aceita os termos: você confere a tela e toma essas decisões no Chrome.

Formato da lista:

```text
Ana Martins | (61) 99999-0001
Bruno Almeida | (61) 99999-0002
```

Após um envio concluído manualmente no site, o painel detecta a resposta de sucesso e cria, na mesma pasta, um arquivo com o sufixo `-restantes.txt` contendo somente as linhas ainda não utilizadas. O arquivo original é preservado.

## Instalação (uma única vez)

Com o terminal aberto nesta pasta, execute:

```powershell
npm install
```

## Uso

```powershell
npm start
```

Depois, abra `http://localhost:3030` no navegador. Preencha os dados no painel e pressione **Preparar no Chrome**. O botão **Stop** fecha o Chrome controlado pelo painel.

É necessário ter o Google Chrome instalado no computador.

## Observação

Use apenas para testes autorizados e respeite os termos do site. O reCAPTCHA, caso seja solicitado, deve ser resolvido manualmente por você.
