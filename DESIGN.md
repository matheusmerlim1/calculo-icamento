# Sistema visual — cálculo de içamento

O que a página já usa, para que a próxima alteração use o mesmo. Escrito a partir do código em
`site/css/`, não de intenção.

## Tema

**Escuro.** A escolha vem do uso: a página fica aberta ao lado do modelo 3D e da planilha
durante horas de trabalho de escritório, e o escuro reduz o contraste de fundo entre as janelas.
Os desenhos são a exceção deliberada: ficam em **papel claro** (`--c-papel`), porque é assim que
vão para a impressão e é assim que se lê um desenho técnico.

## Cor

Estratégia **restrained**: neutros tingidos de azul e um acento único, usado só para ação
primária, seleção e estado. Cor não decora nada aqui.

| Token | Valor | Onde |
|---|---|---|
| `--c-fundo` | `#0f1720` | fundo da página |
| `--c-superficie` | `#16202b` | caixa das etapas, coluna de resumo |
| `--c-superficie-2` | `#1d2937` | cabeçalho de caixa, bloco de peça, campo |
| `--c-linha` | `#26364a` | borda normal, divisória de tabela |
| `--c-linha-forte` | `#35485f` | borda de campo, divisória forte |
| `--c-texto` | `#e8eef6` | corpo e valor |
| `--c-texto-2` | `#b3c2d4` | rótulo |
| `--c-texto-3` | `#8192a7` | auxiliar, unidade, legenda — 4,64:1 sobre a superfície 2 |
| `--c-acento` | `#2f8fd6` | ação primária, seleção, estado atual |
| `--c-acento-suave` | `#12314a` | fundo de destaque |
| `--c-ok` / `--c-alerta` / `--c-erro` | `#2fa36b` / `#d8a23a` / `#e2604e` | passa / atenção / falha |
| `--c-papel` | `#f7f9fc` | folha dos desenhos |

**Regra de acessibilidade, não negociável:** cor nunca é o único sinal. OK e falha levam a
palavra; a barra de utilização imprime com hachura; o item escolhido tem borda além de cor.
Piso de contraste: 4,5:1 para corpo de texto.

## Tipografia

Uma família só (`Segoe UI` / `system-ui`) e uma monoespaçada (`Cascadia Mono`) para **todo
número, fórmula e código de peça** — é o que faz uma coluna de valores ser lida como coluna.

Escala fixa de cinco degraus, razão ~1,15. Não é fluida: o usuário está sempre no mesmo DPI, e
título que encolhe dentro de um painel fica pior, não melhor.

| Token | Valor | Uso |
|---|---|---|
| `--t-xs` | 12px | rótulo, legenda, unidade, dica |
| `--t-sm` | 13px | corpo compacto: ficha, painel, tabela |
| `--t-md` | 14px | corpo e título de caixa |
| `--t-lg` | 16px | título de seção |
| `--t-xl` | 20px | o número que a etapa entrega |

## Espaçamento

Escala de 4pt em tokens (`--e-1` 4px … `--e-6` 32px). O ritmo é o que separa os grupos:

- dentro de uma caixa: `--e-2` (8px)
- entre caixas e entre blocos: `--e-3`/`--e-4` (12–16px)

Nada de valor avulso. Se um espaço precisa ser diferente, é porque falta um degrau — acrescente
o degrau, não o número solto.

## Empilhamento

Escala nomeada, três níveis: `--z-base` 1, `--z-grudado` 10 (barra e coluna que acompanham a
rolagem), `--z-flutuante` 20. Número mágico não entra.

## Estrutura

- **Grade de blocos.** As etapas ficam em `repeat(auto-fit, minmax(330px, 1fr))` com
  empacotamento denso: três numa tela grande, duas na média, uma no celular. A etapa que tem
  tabela larga ou desenho leva `.etapa--larga` e ocupa a linha inteira.
- **Caixas da mesma fileira terminam na mesma altura** (`align-items: stretch`).
- **Coluna de resumo à direita**, grudada, com uma caixa por içamento; a do içamento aberto tem
  a borda realçada e é onde ficam os controles.
- **Duas peças lado a lado** (`.pecas-par`) quando são irmãs — sapatilho e manilha — e, dentro
  de cada coluna, a figura fica acima da ficha, para o desenho ter largura de leitura.

## Componentes

- **Etapa** (`.etapa`): cabeçalho com número, título e dois botões — `ƒx` esconde só o cálculo
  daquela caixa, `−` recolhe a caixa. O estado dos dois fica gravado no navegador.
- **Ficha técnica** (`.ficha`): grade que se reparte em colunas conforme a largura, com o valor
  colado no rótulo. Não é tabela: em tabela larga o valor ia parar do outro lado da linha.
- **Memorial** (`.formulas`): as contas à esquerda, a legenda das letras à direita. A legenda
  sai do próprio texto da fórmula, via `site/data/simbolos.js`.
- **Selo** (`.selo`) e **barra** (`.barra`): resultado de verificação, sempre com a palavra.
- **Aviso** (`.aviso`): borda inteira e fundo tingido, com um sinal à esquerda. Nunca tarja
  lateral.
- **Desenhos** (`site/js/ui/figuras.js`, `iso3d.js`, `fbd.js`): SVG construído a partir dos
  números correntes, em folha clara, com `paint-order: stroke` nos rótulos.

## Impressão

Folha A4 de uma coluna (`site/css/desenho.css`). Capa com identificação e resumo; cada etapa
com o que entrou, a fórmula, a substituição e o resultado. Caixa recolhida e memorial escondido
voltam a aparecer; campos viram texto; só o arranjo escolhido é impresso.

## Proibido

- Tarja lateral colorida (`border-left` grosso) como acento.
- Cor como único portador de significado.
- Tamanho de fonte ou espaçamento fora dos tokens.
- Figura fora de escala.
- Animação que não comunique estado.
