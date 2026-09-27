# Cálculo de içamento — método

Documento de referência do projeto: o que a página calcula, em que ordem, e com quais fórmulas.
Serve de base para o código e para o memorial que o programa gera.

> As normas e os valores numéricos abaixo foram extraídos de um **memorial de cálculo de
> referência de um projeto real** (plano de içamento de pilares/contraventamentos e módulos de
> acomodação) e das suas planilhas de apoio. Os arquivos ficam na pasta `Referencia/`, que não
> vai para o repositório. Os itens antes marcados **(definir)** já têm norma e valor de referência; onde o
> memorial usa mais de um caminho para o mesmo fator, isso está registrado — a escolha final de
> qual adotar no programa é sua, e está listada em **Pendências**, no fim.

---

## 0. Normas usadas no memorial de referência

| Norma | Uso |
|---|---|
| **DNVGL-ST-N001** — Marine Operations and Marine Warranty | fatores de carga da linga (contingência de peso, desbalanceamento entre pernas, amplificação dinâmica, incerteza do CG) e fatores de segurança do cabo/terminação |
| **ABNT NBR ISO 2408:2019** | tabela de carga de ruptura mínima de cabos de aço (classe 6x19, alma de aço) |
| **critérios de verificação de olhal** | verificação de resistência do olhal — esmagamento, cisalhamento, tração na seção líquida, flexão no/fora do plano, tensão combinada, solda |
| **NBR 8800:2008** | tensões admissíveis de solda, perna mínima por espessura de chapa, coeficiente γ_a1 = 1,1 |
| **Shigley — Elementos de Máquinas** | tensão admissível de solda (via alternativa à NBR 8800) e cálculo de tensão no centroide de um cordão de solda |
| **NBR 13545:2012** | critério de seleção de manilha |
| **DNV-ST-E271** (Offshore Containers) | citada só para dizer que não traz fórmula de olhal — exige solda de penetração total |
| **NR-37** | limites de vento de operação de guindaste (0–38 km/h operação normal; 39–49 km/h suspende operações não críticas) |

## 1. Entrada

Por içamento:

| Dado | Símbolo | Unidade |
|---|---|---|
| Massa do corpo | `m` | kg ou t |
| Tipo de içamento | — | 2 pernas · 4 pernas simétrico · 4 pernas com pernas diferentes |
| Posição de cada ponto de içamento | `xi, yi, zi` | mm, medidos a partir do centro de massa |
| Altura do gancho acima do CG | `H` | mm (ou o comprimento de cada perna) |

O centro de massa é a origem do sistema. `z` positivo para cima.

## 2. Pesos de projeto

```
W = m · g              peso do corpo (g = 9,81 m/s² — conferido no memorial de referência)
```

O memorial de referência aplica os fatores de amplificação em **dois pontos diferentes** da
conta, com cadeias de fatores distintas. Mantido aqui como registrado — decisão sua se unifica
numa cadeia só (ver Pendências).

**(a) Peso de projeto para escolher a linga (DNVGL-ST-N001):**

```
F_p_Max = F_p_Maxima · γ_CoG · γ_cont · γ_skew · DAF
```

| Fator | Valor no memorial | Norma / origem |
|---|---|---|
| `γ_cont` — contingência de peso | 1,10 | DNVGL-ST-N001, Tabela 5-2 |
| `γ_skew` — desbalanceamento entre pernas | 1,05 | DNVGL-ST-N001, Tabela 16.2.6.13 |
| `DAF` — amplificação dinâmica | 2,46 (carga leve, ≈1,2 t) | DNVGL-ST-N001, Tabela 16.2 — decresce com o peso içado |
| `γ_CoG` — incerteza do centro de gravidade | 1,10 | DNVGL-ST-N001 |

**(b) Carga de projeto para dimensionar o olhal e a manilha:**

```
F_linga = f_dc · f_cp · f_cg · FAD · F_olhal_teorico
F_pino  = f_c · F_linga
```

| Fator | Valor no memorial |
|---|---|
| `f_dc` — desvio de carga | 1,25 |
| `f_cp` — contingência de peso | 1,10 |
| `f_cg` — incerteza do centro de gravidade | 1,05 |
| `FAD` — amplificação dinâmica (içamento no mar) | 1,30 (fixo, não tabelado por peso) |
| `f_c` — consequência da falha do olhal | 1,30 |

O memorial não explica a divergência entre `DAF = 2,46` (linga) e `FAD = 1,30` (olhal) — o
primeiro vem de uma tabela DNV que cresce bastante para cargas pequenas, o segundo é um valor
fixo adotado para o olhal no memorial de referência. O `γ_peso` do rascunho anterior (1,03 pesado / 1,05
calculado / 1,10 estimado) corresponde ao `γ_cont` acima — o memorial só documenta o caso
"estimado" (1,10); os outros dois continuam sem citação de norma no documento de referência.

## 3. Diagrama de corpo livre e carga por perna

O gancho fica na vertical do centro de massa (condição de equilíbrio do corpo suspenso).
Para cada perna `i`, com o ponto de içamento em `Pi` e o gancho em `G = (0, 0, H)`:

```
ûi   = (G − Pi) / |G − Pi|        direção da perna (do ponto para o gancho)
βi   = ângulo entre ûi e a vertical
```

**Duas pernas** — sistema determinado. As trações saem do equilíbrio de forças e momentos:

```
Σ Ti·ûi + W_proj·ẑ_baixo = 0
Σ (Pi × Ti·ûi) = 0
```

**Quatro pernas** — sistema hiperestático: quatro incógnitas e três equações de equilíbrio.
No memorial de referência **não se usa um SKL fixo de 1,25 nem 25 % por perna**. O sistema é
reduzido assumindo simetria longitudinal: agrupam-se as quatro pernas em dois pares (diagonal
direita / diagonal esquerda), calcula-se a altura de içamento e o ângulo de cada par, e
resolve-se por equilíbrio de forças nos três eixos + equilíbrio de momento numa das pernas:

```
F_XD = (d_E · m · g) / [(d_D + d_E) · sen(θ_XD) · 2]
F_XE = (m · g − 2 · F_XD · sen(θ_XD)) / (2 · sen(θ_XE))
```

onde `d_D`, `d_E` são as distâncias do CG a cada diagonal em planta e `θ_XD`, `θ_XE` os ângulos
de cada par de pernas com a vertical. Isso é exatamente a hipótese **"pares diagonais"** já
prevista no programa, só que calculada par a par (não 50/50) — e o fator de desbalanceamento
`γ_skew = 1,05` é aplicado de forma genérica sobre o resultado, bem mais brando que o SKL de
catálogo de 1,25 citado na literatura genérica de içamento offshore. As duas hipóteses seguem
previstas no programa:

1. **Pares diagonais**, com a geometria exata acima (recomendada — é o que o memorial de
   referência faz) ou, de forma simplificada, com um SKL fixo por perna quando não se quer
   montar a geometria completa dos pares.
2. **Distribuição elástica** — reparte a carga pelas quatro pernas conforme a rigidez
   (`k ∝ 1/L`), útil para comparação. Não substitui a hipótese 1 na verificação.

Saídas desta etapa: tração em cada perna, ângulo com a vertical, componente horizontal
(que solicita o olhal fora do plano) e a reação no gancho.

## 4. Linga (cabo de aço)

```
MBL_req = F_p_Max                     (carga de projeto da perna, item 2a)
γ_s     = máx(γ_sh, γ_sf)             fator de segurança final da linga
```

Fatores de segurança da linga, todos do **DNVGL-ST-N001**:

```
γ_sh = γ_h · γ_c · γ_w · γ_m
γ_sf = 2,3 · γ_r · γ_w
γ_r  = máx(γ_b, γ_s_term)
γ_b  = 1 / (1 − 0,5 / √(D_sapatilho / D_cabo))     fator de curvatura (bend factor)
```

| Fator | Valor |
|---|---|
| `γ_h` — segurança contra falha de tração | 1,3 |
| `γ_c` — combinação de cargas | 1,3 |
| `γ_w` — condições ambientais | 1,1 |
| `γ_m` — incerteza do material | 1,5 |
| `γ_s_term` — terminação (emenda manual) | 1,25 |

No exemplo do memorial (pilares) essa cadeia deu `γ_s = 3,64` — bem mais conservador que o
"3,0 usual" citado na literatura genérica de içamento offshore.

**Cabo de referência:** classe **6x19, alma de aço (IWRC)**, categoria (grade) **1960 N/mm²**
— ABNT NBR ISO 2408:2019. Tabela em `site/data/lingas.js`, extraída da planilha
`Tabela com dados de eslinga...`; ela traz também 6x36, alma de fibra e as categorias
1770/2160 N/mm², úteis para comparação, mas só a combinação acima foi de fato validada contra
o memorial (o diâmetro 41,3 mm/6,82 kgf·m⁻¹ dos módulos bate exatamente com essa tabela).

O diâmetro escolhido é o menor da tabela cuja carga de ruptura mínima (MBL) atenda `MBL_req`.
**Ângulo máximo da perna:** o memorial de referência **não verifica um limite explícito** — os
pilares chegam a ângulos grandes com a estrutura, sem checagem isolada. Mantida a prática usual
de 60° com a vertical como critério do programa, editável.

## 5. Sapatilho (thimble)

Tabela **"Sapatilha Pesada, Aço Estampado"**, códigos SP-05 a SP-100, por diâmetro de cabo —
`site/data/sapatilhos.js`, extraída de `Tabelas MC - Içamento.xlsx`. O memorial não cita uma
norma isolada para a sapatilha; a compatibilidade é verificada por comparação geométrica direta
com a manilha (ver item 6).

## 6. Manilha

Norma de seleção: **NBR 13545:2012** — critério `CMT ≥ carga no pino`. Tabela de referência:
**Green Pin G-4163**, já cadastrada em `site/data/manilhas.js`, com as medidas `a` corpo,
`b` pino, `c` diâmetro do olhal, `d` largura do olhal, `e` boca, `f` comprimento interno,
`g` largura do corpo, `h` comprimento, `i` comprimento do parafuso.

> **Erro confirmado no memorial de referência** (conferido direto no arquivo-fonte
> o memorial de referência, seção "9.3 CÁLCULO DA MANILHA"): a manilha é escolhida
> comparando o CMT da tabela com `F_p_Max` — a carga **já amplificada pela cadeia da linga**
> (item 2a: `γ_cont · γ_skew · DAF · γ_CoG ≈ 3,1×`, pensada para a resistência à ruptura do
> *cabo*) — em vez de `F_pino` (item 2b, a cadeia certa para acessórios de içamento). Isso
> superdimensiona a manilha: o CMT de uma manilha já embute o próprio fator de segurança de
> catálogo do fabricante (tipicamente 5:1 a 6:1 contra a carga de ruptura); empilhar em cima
> o fator pensado para o desgaste/curvatura/terminação do *cabo* é contar a margem duas vezes.
> Isso acontece **nos dois critérios** disponíveis no seletor do memorial (NBR 13545 e
> DNV 2.7-1) — os dois usam `F_p_Max`.
>
> Tem um segundo problema, ligado a esse: o seletor "Tipo_criterio" (que deveria trocar entre
> NBR 13545 e DNV 2.7-1) calcula os dois caminhos em paralelo (`Manilha.escolhidaP` pela
> NBR 13545, `Manilha.escolhidaDNV` pela DNV 2.7-1), mas a atribuição final
> (`Manilha.escolhidaCerta`) usa `Manilha.escolhidaP` **nos dois ramos do `if`** — ou seja,
> trocar a opção no seletor não muda a manilha escolhida; o cálculo pela DNV 2.7-1 é feito e
> descartado.
>
> **Regra adotada neste programa:** manilha e olhal usam sempre a carga do item 2b (`F_pino`).
> `F_p_Max` (item 2a) é de uso exclusivo da escolha do diâmetro do cabo da linga — nunca deve
> alimentar a seleção de um acessório (manilha, olhal, sapatilho, anel de carga).

Verificações de encaixe do memorial, numeradas como no documento original ("Casos"). **Conferidas
direto na fórmula executável do arquivo-fonte** (o memorial de referência, variáveis
`Caso1.P` a `Caso4.P`) — o resumo em texto/PDF lido antes citava fórmulas diferentes e erradas
(com elas, nenhuma manilha jamais encaixava, por menor que fosse o sapatilho ou maior a
manilha — sinal de que a fonte estava errada, não de que faltava procurar mais):

| Caso | Verificação | Critério |
|---|---|---|
| 1 | sapatilho × diâmetro do corpo da manilha | `d_sapatilho > a_manilha` |
| 2 | largura do corpo da manilha × sapatilho | `g_manilha > e_sapatilho` |
| 3 | boca da manilha × sapatilho | `e_manilha > e_sapatilho` |
| 4 | sapatilho × diâmetro do olhal da manilha | `b_sapatilho > c_manilha` |
| 5 | manilha × anel de carga | `b_manilha > D_anel` |
| 6 | manilha × anel de carga | `d_manilha < E_anel` |
| 7 | anel × 4 eslingas (anelão) | `E_anel > d_manilha × 5` |

Os casos 5-7 (manilha × anel de carga, ainda não implementados — pendência 6) não foram
conferidos direto na fórmula-fonte como os 1-4 acima; vêm só do resumo em texto/PDF, então
merecem a mesma conferência antes de usar.

Folgas usadas no memorial (substituem a faixa "3 a 6 mm" do rascunho anterior):

- **furo do olhal × pino da manilha:** folga = **1,15 mm** (`D_furo = D_pino + 1,15`)
- **espessura mínima na boca da manilha:** folga = **11,75 mm** (`T_min = T_manilha − 11,75`)

Tabelas de anel de carga e corrente também estão na planilha de origem (`Tabelas MC -
Içamento.xlsx`, abas "Anel de Carga"), ainda não digitadas em `site/data/` — entram quando o
Caso 5-7 for implementado.

## 7. Olhal (padeye)

Critérios de verificação de olhal (toda a seção). Material da chapa do olhal no memorial de
referência: **ASTM A131, Fy = 355 MPa** (não A36 nem A572 Gr.50 — este último aparece só na
verificação de solda pela NBR 8800). Eletrodo: **E70XX** (Fwu = 482,6 MPa / 70 ksi).

```
Geometria: t (espessura do olhal), t_anel (chapas de reforço), d_furo, R (raio externo),
           r_furo (raio do furo), h (olhal → base), base (largura da base)
Cargas:    F_pino = carga de projeto da perna (item 2b)
           P_fora = 5 % de F_pino · cos(θ)     confirmado no memorial (verificação 6, abaixo)
```

Verificações e tensões admissíveis (todas em função de `Fy = 355 MPa`; `θ` = ângulo da perna
com a vertical):

| # | Verificação | Fórmula | Admissível |
|---|---|---|---|
| 1 | Esmagamento no furo (contato do pino) | `f_p = F_pino / (D_pino·(t + 2·t_anel))` | ≤ 0,9·Fy |
| 2 | Cisalhamento na área efetiva | `f_v = F_pino / (2·[(R−r_furo)·t + (r_anel−r_furo)·2·t_anel])` | ≤ 0,4·Fy |
| 3 | Tração na área líquida efetiva | `f_a1 = F_pino / (2·b1·t + 4·b2·t_anel)` | ≤ 0,45·Fy |
| 4 | Força axial na base | `f_a = F_pino·sen(θ) / A_base` | ≤ 0,6·Fy |
| 5 | Flexão no plano do olhal | `f_ipb = F_pino·cos(θ)·h / W_ipb`, `W_ipb = t·base²/6` | ≤ 0,6·Fy |
| 6 | Flexão fora do plano do olhal | `f_opb = 0,05·F_pino·cos(θ)·h / W_opb`, `W_opb = base·t²/6` | ≤ 0,75·Fy |
| 7 | Tensão combinada (interação linear) | `f_a/(0,6Fy) + f_ipb/(0,6Fy) + f_opb/(0,75Fy)` | ≤ 1 |
| 8 | Solda | bisel de penetração total (face = 0,7·t) ou filete (perna mínima por NBR 8800 Tab. 10, garganta = 0,7·perna); cisalhamento ≤ 0,4·Fy (Shigley Tab. 9-4) ou 0,6·Fy/1,35 (NBR 8800, `γ_a1 = 1,1`); tração ≤ 0,6·Fy; ponto crítico por momento + cisalhamento direto no centroide da solda (Shigley, ex. 9-52) |

`b1`, `b2` são as duas semi-larguras da seção líquida além do furo — o rasgamento (tear-out)
fica embutido no item 3, não é uma verificação separada no memorial. **Não há verificação de
pressão de contato Hertziana** — o contato do pino é tratado como esmagamento médio (bearing),
item 1 acima.

Geometria de partida do olhal a partir da manilha escolhida:

```
R = f_manilha − g_manilha + b_manilha/2 + 5 mm     raio externo do olhal
```

(`f`, `g`, `b` são colunas da tabela da manilha — comprimento interno, largura do corpo e
largura do olhal.)

## 8. Vários içamentos

- A página aceita vários içamentos no mesmo estudo.
- Opção por içamento: **linga própria** (carga governante = a maior tração deste içamento) ou
  **padronizar** (carga governante = a maior tração entre todos os içamentos do estudo). A
  opção vale para o **conjunto inteiro** — linga, sapatilho e manilha saem da mesma carga
  governante; só o olhal continua sempre calculado pela carga da própria perna (é uma chapa
  soldada naquele ponto específico, não faz sentido padronizar entre içamentos).
- A lista de material soma os itens de todos os içamentos, agrupando por descrição igual —
  é assim que "linga própria vs. padronizar" aparece na lista: convergem para a mesma linha
  quando o conjunto escolhido é o mesmo.
- Premissas de quantidade adotadas na lista de material (ajustar em `materialDe()`,
  `site/js/ui/app.js`, se o seu arranjo for diferente): 1 sapatilho em cada ponta de cada
  perna (2 por perna), 1 manilha por perna, 1 olhal por perna. Anel de carga (anelão) ainda
  não entra na lista — ver pendência 6.

## 9. Relatório

Implementado: dados de entrada, diagrama de corpo livre, cargas por perna (etapas 1-5), seleção
da linga com FS da base normativa (etapa 6), sapatilho e manilha com as verificações de encaixe
(etapa 7), olhal — comprado (catálogo) ou fabricado, com a ficha de dimensões e as 7
verificações de tensão do item 7 por perna (etapa 8) — e a lista de material, por içamento ou
consolidada do estudo (etapa 9). Exportação em arquivo (.json, para reabrir) e impressão via
`window.print()`.

Fora do escopo automatizado por enquanto: a verificação de solda (item 7, linha 8 da tabela —
mostra um aviso pedindo conferência à parte pela NBR 8800) e o dimensionamento automático da
geometria do olhal fabricado (o programa só *verifica* a geometria informada, com um valor de
partida sugerido a partir da manilha escolhida — ajustar `t`, `base`, `h` etc. até as 7
verificações passarem é manual).

---

## Pendências — o que ainda é decisão sua

1. ~~Unificar ou não as duas cadeias de fatores do item 2~~ — **resolvido**: são cadeias para
   coisas diferentes, não uma escolha de estilo. `F_p_Max` (item 2a) dimensiona o cabo da
   linga; `F_pino` (item 2b) dimensiona manilha e olhal. O memorial de referência usa
   `F_p_Max` também na manilha, por engano (ver a nota logo acima, no item 6) — não repetir
   isso aqui. Ainda em aberto: por que `DAF = 2,46` (linga) e `FAD = 1,30` (olhal) divergem
   tanto — pode ser só a tabela DNV crescendo bastante para cargas pequenas, ou outro engano
   no memorial; vale conferir a tabela completa antes de copiar o valor de `DAF`.
2. **DAF por faixa de peso** — só temos um ponto da curva do memorial (2,46 para ≈1,2 t); a
   tabela completa (DNVGL-ST-N001, Tabela 16.2) precisa ser conferida na edição contratada da
   norma antes de virar tabela fixa no programa.
3. **`γ_peso` para os casos "pesado" e "calculado"** (1,03 e 1,05) — o memorial só documenta o
   caso "estimado" (1,10); os outros dois continuam sem citação de norma.
4. **Categoria do cabo a adotar como padrão** — 1770, 1960 (a única usada no memorial) ou
   2160 N/mm².
5. **Ângulo máximo da perna** — o memorial não verifica; manter os 60° usuais do programa ou
   definir outro valor.
6. **Tabela de anel de carga e corrente** (Casos 5-7 do item 6) — dados já extraídos da
   planilha de origem, faltam entrar em `site/data/`.
7. **Verificação de solda do olhal** (item 7, linha 8) — não implementada; o programa mostra
   um aviso pedindo conferência manual pela NBR 8800.
8. **Dimensionamento automático do olhal fabricado** — hoje o programa só verifica a geometria
   que você digitar (com um ponto de partida sugerido a partir da manilha). Se quiser que ele
   ajuste `t`/`base`/`h` sozinho até passar nas 7 verificações, isso ainda não existe.
9. **Quantidades da lista de material** (2 sapatilhos e 1 manilha por perna, 1 olhal por
   perna, sem anel de carga) — são uma suposição razoável, não vieram de uma regra do
   memorial; confira se bate com o seu arranjo de içamento antes de comprar.


---

## Decisões de projeto desta versão

**Um olhal para todo o içamento.** Antes havia uma geometria por perna. Na obra se fabrica um
olhal igual para todos os pontos, dimensionado pela perna mais carregada: é mais barato e não
corre o risco de montar o olhal errado no ponto errado. A tela mostra qual perna governa e a
lista de material traz um item com a quantidade.

**O que é escolha e o que vem da manilha.** No olhal fabricado, `Ø furo` e `R` saem da manilha
(`Ø furo = b + folga`, `R = f − g + b/2 + 5`) e aparecem separados dos que a pessoa escolhe
(espessura, base, altura e o reforço opcional). Há um botão para recalcular os dois pela
manilha corrente, e uma verificação nova: a chapa com o reforço tem que entrar na boca da
manilha (`t + 2·t.anel < e`).

**Desenhos em escala.** O olhal e a manilha são desenhados a partir dos números correntes — o
desenho muda quando a medida muda. A figura do encaixe mostra, em escala, o vão disponível e a
peça que precisa passar em cada um dos quatro casos.

**Massa na lista de material.** Vem do catálogo de cada peça (linga em kgf/m × comprimento;
sapatilho, manilha e olhal comprado têm peso em tabela). Onde o catálogo não traz peso, sai
"-", nunca zero. A única massa calculada é a do olhal fabricado, estimada pela chapa
(`base × h − furo`, × espessura × 7,85 kg/dm³), e vai marcada com "*".

**Relatório.** É a impressão da própria página, em A4 de uma coluna só: capa com identificação
e resumo dos içamentos, depois cada etapa com o que entrou, a fórmula, a substituição e o
resultado. Caixa recolhida e memorial oculto são recursos de leitura na tela — no papel sai
tudo. A lista de material também sai em `.xlsx`, com as mesmas colunas da lista de corte
(projeto 8): Item, Qtd., Título, Especificação, Material e Massa.

**Espessura de chapa e reforço do olhal.** A espessura `t` (e a do reforço `t.anel`) é escolhida
numa lista de espessuras comerciais de chapa grossa — as bitolas em polegada com o milímetro
exato da fração, e a série métrica — porque chapa se compra na bitola que existe. O `R.anel`
não é escolha: o reforço acompanha o raio do topo da chapa, então **R.anel = R**, calculado e
mostrado sem campo de edição. `Ø furo` e `R` continuam vindo da manilha, com um botão para
recalcular.
