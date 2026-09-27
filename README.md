# Cálculo de içamento

Página para montar o **memorial de cálculo e a lista de material de um içamento**: a carga que
chega em cada perna, a linga, o sapatilho, a manilha e o olhal — com o desenho de cada peça e
o relatório pronto para imprimir.

Roda **do disco, sem instalar nada**: abra `site/index.html` no navegador. Sem servidor, sem
dependência, sem internet.

---

## O que a ferramenta faz

**1 · Corpo a içar** — massa, origem do peso (pesado, calculado ou estimado), local da operação
e a base normativa que define os fatores de projeto.

**2 · Tipo de içamento** — duas pernas, quatro pernas simétrico, ou quatro pernas com cada ponto
na sua coordenada.

**3 · Medidas** — as **distâncias do centro de massa até cada ponto**, não coordenadas, e o
**ângulo de uma das pernas com a estrutura** (em vez da altura do gancho, que sai calculada).
Duas figuras acompanham: a vista 3D com as distâncias reais e o esquema do que informar.

**4 · Fatores de projeto** — margem de peso, amplificação dinâmica, consequência da falha,
distribuição desigual e FS da linga. Vêm da base escolhida e podem ser ajustados; o memorial
registra o valor usado.

**5 · Carga em cada perna** — comprimento, ângulos, componentes e tração de cada perna, a soma
das verticais e a carga no gancho, com o diagrama de corpo livre e a planta das distâncias.

**6 · Linga** — MBL requerida pela carga governante e pelo FS, e o cabo escolhido na tabela.

**7 · Sapatilho e manilha** — o sapatilho pela bitola do cabo, a manilha pela carga, e as quatro
verificações de encaixe (o que passa por onde), com figura em escala de cada caso.

**8 · Olhal (padeye)** — comprado de catálogo ou fabricado. No fabricado, a verificação de
esmagamento, cisalhamento, tração na área líquida, força axial na base, flexão no e fora do
plano e a tensão combinada, com o **desenho de fabricação cotado** ao lado.

**9 · Lista de material** — linga, sapatilho, manilha e olhal, com título, especificação,
material e massa. Sai em `.xlsx`.

Vários içamentos convivem no mesmo estudo (abas no topo), e a lista pode sair de um só ou
consolidada do estudo inteiro.

---

## Decisões que vale conhecer

**Um olhal para todo o içamento**, dimensionado pela perna mais carregada. Na obra se fabrica um
olhal igual para todos os pontos: é mais barato e não corre o risco de montar o olhal errado no
ponto errado.

**O que é escolha e o que vem da manilha.** No olhal fabricado, `Ø furo` e `R` saem da manilha
escolhida; espessura, base, altura e o reforço são a sua escolha. A chapa com o reforço precisa
entrar na boca da manilha, e isso é verificado.

**Desenhos em escala.** O olhal e a manilha são desenhados a partir dos números correntes — mudou
a medida, muda o desenho.

**Massa na lista.** Vem do catálogo de cada peça. Onde o catálogo não traz peso, sai `-`, nunca
zero. A única massa calculada é a do olhal fabricado, estimada pela chapa, marcada com `*`.

**Relatório.** É a impressão da própria página, em A4 de uma coluna: capa com identificação e
resumo, depois cada etapa com o que entrou, a fórmula, a substituição e o resultado. Caixa
recolhida e memorial oculto são recursos de leitura na tela — no papel sai tudo.

---

## Confira antes de emitir

Os valores das tabelas normativas e dos catálogos de fabricante **são de referência**. As tabelas
de fatores não são de livre reprodução: os números embutidos são os usualmente citados na
literatura técnica, servem de ponto de partida, **todos** são editáveis na página, e o memorial
registra o que foi usado. Confira com a edição da norma contratada e com o catálogo vigente do
fabricante antes de emitir o documento.

A verificação de **solda** do olhal não é automática — fazer à parte.

---

## Estrutura

```
site/
  index.html          a página inteira
  css/                base (cores e tipos), app (layout), desenho (traço das figuras e impressão)
  data/               catálogos: lingas, sapatilhos, manilhas, olhais e fatores das bases
  js/core/            formatação, escritor de .xlsx sem biblioteca
  js/calc/            cargas (estática do içamento) e rigging (linga, sapatilho, manilha, olhal)
  js/ui/              a aplicação e as figuras (ícones, medidas, 3D, corpo livre, olhal, manilha)
docs/METODO.md        o método passo a passo, com as fontes e as decisões
tools/                testes
```

## Testes

```bash
node tools/test_calc.js   # 21 verificações da estática do içamento
node tools/test_ui.js     # 20 verificações da página, num Chrome sem janela
```

`test_ui.js` precisa do Chrome instalado; ele abre a página, mexe nos campos e confere o
resultado na tela.
