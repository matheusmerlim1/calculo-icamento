# Cálculo de içamento

Ferramenta para montar o **memorial de cálculo e a lista de material de um içamento**: a carga
que chega em cada perna, a linga, o sapatilho, a manilha e o olhal, com o desenho de cada peça
e o relatório pronto para imprimir.

## Register

**product** — o desenho serve à tarefa. Quem abre a página está executando um trabalho
(dimensionar um içamento), não sendo apresentado a um produto. A interface deve sumir dentro
da tarefa.

## Platform

**web** — HTML, CSS e JavaScript sem build nem dependência. Roda de duas formas, e as duas
importam: aberta direto do disco (`site/index.html`), e publicada em GitHub Pages.

## Quem usa

**Primário: engenheiros.** Conhecem içamento e a notação do memorial, mas não conhecem esta
página. Precisam entender a tela sem treino e sem manual.

**Secundário: quem está aprendendo.** Usa a página também para entender o método, não só para
obter o número. É por isso que cada conta mostra a fórmula, a substituição e o resultado, e traz
ao lado o que cada letra significa e em que unidade.

## Propósito

**Sair com o memorial pronto para emitir.** O relatório impresso é o produto final; tudo na tela
existe para que aquele documento saia completo e defensável — com a fórmula usada, o valor
substituído, o resultado e a norma registrada.

Consequência prática, que vale como regra de decisão: **nada que ajude a ler na tela pode
mutilar o papel.** Caixa recolhida, memorial escondido e figura reduzida são recursos de tela;
na impressão o documento sai inteiro.

## Caráter

**Instrumento de engenharia, sóbrio.** Denso de informação, sem enfeite, do tipo em que se
confia porque mostra a conta. Parente de uma planilha bem feita ou de um memorial em SMath —
não de um aplicativo.

Densidade é permitida e desejada: tabelas com muitas linhas, painéis com muitos rótulos. O que
não é permitido é densidade sem hierarquia.

## Anti-referências

- **Calculadora online genérica** — um campo, um botão e um número solto, sem mostrar de onde
  veio. Aqui o caminho do número é o produto.
- **Dashboard corporativo** — cartões coloridos com números grandes e gráficos decorativos que
  não servem à decisão.
- **Site de marketing** — seções largas, títulos enormes, animação de entrada. Forma sem função.

## Condições de uso

Estas não são preferências; são restrições de projeto:

- **Impressão em preto e branco.** Nada pode depender só de cor para ser entendido. OK e falha
  levam a palavra junto; a barra de utilização imprime com hachura e borda, não com fundo
  colorido (fundo é a primeira coisa que a impressão descarta).
- **Daltonismo.** Verde e vermelho sempre acompanhados de um segundo sinal — a palavra, o
  símbolo, a hachura.
- **Tela pequena (13").** Os blocos lado a lado viram um só; a coluna de resumo desce. Nenhuma
  informação pode depender de largura para existir.

## Princípios de projeto

1. **Mostre a conta.** Todo resultado tem fórmula, substituição e resultado à vista, com a
   legenda das letras ao lado. Um número sozinho não serve.
2. **Diga de onde veio.** Valor de catálogo traz o código da peça; valor de norma traz a norma;
   medida derivada traz a fórmula que a derivou e não aceita edição.
3. **Separe o que é escolha do que é consequência.** Campo é para o que a pessoa decide. O que
   sai do cálculo aparece como resultado, sem campo para digitar.
4. **Desenho em escala, sempre.** As figuras são construídas com os números correntes: mudou a
   medida, mudou o desenho. Figura fora de escala é pior que nenhuma.
5. **Conferir antes de emitir.** Valores de norma e de catálogo são de referência, editáveis, e
   a página diz isso onde eles aparecem.

## Estado

Publicado em https://matheusmerlim1.github.io/calculo-icamento/ (repositório público).
Testes: `node tools/test_calc.js` (estática) e `node tools/test_ui.js` (tela, em Chrome sem
janela).

Pendente: a tabela de lingas e o critério do olhal fabricado ainda esperam a fonte definitiva;
os valores dos fatores DNV são de literatura e estão marcados como "conferir com a edição
contratada".
