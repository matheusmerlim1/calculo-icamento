/*
 * Figuras explicativas, em SVG (se ajustam sozinhas ao espaço, pelo viewBox):
 *
 *   icone(tipo)     esquema pequeno de cada tipo de içamento, no cartão de escolha
 *   medidas(tipo)   desenho mostrando QUAIS medidas informar: as distâncias do centro de
 *                   massa até cada ponto e o ângulo da perna com a estrutura
 */
window.IC = window.IC || {};

IC.figuras = (function () {
  const cabeca = (W, H) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="dw fig" preserveAspectRatio="xMidYMid meet">
    <defs><marker id="fseta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" class="seta"/></marker></defs>`;

  /** cota reta entre dois pontos, com o texto ao lado */
  function cota(xa, ya, xb, yb, texto, anc = "middle") {
    const horizontal = Math.abs(yb - ya) < Math.abs(xb - xa);
    const mx = (xa + xb) / 2, my = (ya + yb) / 2;
    const tx = horizontal ? mx : mx + 8;
    const ty = horizontal ? my - 6 : my;
    return `<g class="cota">
      <line x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${tx}" y="${ty}" text-anchor="${horizontal ? "middle" : anc}">${texto}</text></g>`;
  }

  /* ---------------------------------------------------------- ícones dos tipos */
  function icone(tipo) {
    const g = cabeca(120, 72);
    if (tipo === "duas") {
      return `${g}
        <path d="M60,8 v6" class="peca"/><circle cx="60" cy="16" r="5" class="gancho-i"/>
        <line x1="60" y1="20" x2="24" y2="46" class="perna"/><line x1="60" y1="20" x2="96" y2="46" class="perna"/>
        <rect x="18" y="46" width="84" height="16" class="corpo"/>
        <circle cx="24" cy="46" r="3" class="ponto"/><circle cx="96" cy="46" r="3" class="ponto"/>
        <circle cx="60" cy="54" r="4" class="cg"/></svg>`;
    }
    if (tipo === "quatroSim") {
      return `${g}
        <path d="M60,6 v6" class="peca"/><circle cx="60" cy="14" r="5" class="gancho-i"/>
        <line x1="60" y1="18" x2="20" y2="44" class="perna"/><line x1="60" y1="18" x2="100" y2="44" class="perna"/>
        <line x1="60" y1="18" x2="36" y2="52" class="perna perna--tras"/><line x1="60" y1="18" x2="84" y2="52" class="perna perna--tras"/>
        <polygon points="20,44 100,44 84,60 36,60" class="corpo"/>
        <circle cx="20" cy="44" r="3" class="ponto"/><circle cx="100" cy="44" r="3" class="ponto"/>
        <circle cx="36" cy="60" r="3" class="ponto"/><circle cx="84" cy="60" r="3" class="ponto"/>
        <circle cx="60" cy="52" r="4" class="cg"/></svg>`;
    }
    return `${g}
      <path d="M64,6 v6" class="peca"/><circle cx="64" cy="14" r="5" class="gancho-i"/>
      <line x1="64" y1="18" x2="14" y2="40" class="perna"/><line x1="64" y1="18" x2="104" y2="46" class="perna"/>
      <line x1="64" y1="18" x2="30" y2="58" class="perna perna--tras"/><line x1="64" y1="18" x2="92" y2="62" class="perna perna--tras"/>
      <polygon points="14,40 104,46 92,62 30,58" class="corpo"/>
      <circle cx="14" cy="40" r="3" class="ponto"/><circle cx="104" cy="46" r="3" class="ponto"/>
      <circle cx="30" cy="58" r="3" class="ponto"/><circle cx="92" cy="62" r="3" class="ponto"/>
      <circle cx="58" cy="50" r="4" class="cg"/></svg>`;
  }

  /* ---------------------------------------------------------- medidas a informar */
  const medidas = tipo => (tipo === "duas" ? medidasDuas() : medidasQuatro(tipo === "quatroDif"));

  /** vista lateral com o ângulo da perna, desenhada em qualquer canto */
  function detalheAngulo(x, y) {
    return `<g transform="translate(${x},${y})">
      <text x="0" y="-36" class="rot-peq" text-anchor="middle">vista lateral</text>
      <circle cx="0" cy="-22" r="7" class="gancho-i"/>
      <line x1="0" y1="-15" x2="-62" y2="34" class="perna"/>
      <rect x="-86" y="34" width="150" height="18" class="corpo"/>
      <circle cx="-62" cy="34" r="4" class="ponto"/>
      <line x1="-62" y1="34" x2="14" y2="34" class="eixo"/>
      <path d="M-32,34 A 30,30 0 0,0 -40,12" class="arco"/>
      <text x="-24" y="24" class="forca">α</text>
      <text x="-10" y="70" class="rot-peq" text-anchor="middle">α — ângulo da perna com a estrutura</text>
      <text x="-10" y="86" class="rot-peq" text-anchor="middle">h — altura do ponto em relação ao CG (+ acima, − abaixo)</text>
    </g>`;
  }

  /** duas pernas: vista lateral com a₁, a₂ e o ângulo */
  function medidasDuas() {
    const W = 720, H = 300;
    const gx = 330, gy = 70, y = 190, x1 = 130, x2 = 530;
    return `${cabeca(W, H)}
      <text x="${W / 2}" y="20" class="titulo" text-anchor="middle">MEDIDAS A INFORMAR — DUAS PERNAS</text>
      <path d="M${gx},${gy - 26} v12" class="peca"/><circle cx="${gx}" cy="${gy - 8}" r="8" class="gancho-i"/>
      <line x1="${gx}" y1="${gy}" x2="${x1}" y2="${y}" class="perna"/>
      <line x1="${gx}" y1="${gy}" x2="${x2}" y2="${y}" class="perna"/>
      <rect x="100" y="${y}" width="460" height="32" class="corpo"/>
      <circle cx="${x1}" cy="${y}" r="5" class="ponto"/><circle cx="${x2}" cy="${y}" r="5" class="ponto"/>
      <text x="${x1}" y="${y - 14}" text-anchor="middle">P1</text>
      <text x="${x2}" y="${y - 14}" text-anchor="middle">P2</text>

      <line x1="${gx}" y1="${y - 30}" x2="${gx}" y2="${y + 70}" class="eixo"/>
      <circle cx="${gx}" cy="${y + 16}" r="7" class="cg"/>
      <text x="${gx + 12}" y="${y + 38}" class="rot">CG</text>

      ${cota(x1, y + 56, gx, y + 56, "a₁ — do CG até P1")}
      ${cota(gx, y + 84, x2, y + 84, "a₂ — do CG até P2")}

      <line x1="${x1}" y1="${y}" x2="${x1 + 150}" y2="${y}" class="eixo"/>
      <path d="M${x1 + 60},${y} A 60,60 0 0,0 ${x1 + 42},${y - 42}" class="arco"/>
      <text x="${x1 + 74}" y="${y - 16}" class="forca" text-anchor="start">α — ângulo da perna com a estrutura</text>
      <text x="${W / 2}" y="${H - 8}" class="rot-peq" text-anchor="middle">h — altura dos pontos em relação ao CG (+ acima, − abaixo)</text>
    </svg>`;
  }

  /** quatro pernas: planta à esquerda com a e b, vista lateral à direita com α */
  function medidasQuatro(diferentes) {
    const W = 760, H = 372;
    const cx = 230, cy = 185, dx = 140, dy = 84;
    const p = [[cx + dx, cy - dy], [cx - dx, cy - dy], [cx - dx, cy + dy], [cx + dx, cy + dy]];
    const nomes = diferentes ? ["P1 · x₁/y₁", "P2 · x₂/y₂", "P3 · x₃/y₃", "P4 · x₄/y₄"] : ["P1", "P2", "P3", "P4"];
    return `${cabeca(W, H)}
      <text x="${W / 2}" y="20" class="titulo" text-anchor="middle">MEDIDAS A INFORMAR — ${diferentes ? "QUATRO PERNAS DIFERENTES" : "QUATRO PERNAS SIMÉTRICO"}</text>
      <text x="${cx}" y="44" class="rot-peq" text-anchor="middle">vista de cima</text>

      <polygon points="${p.map(q => q.join(",")).join(" ")}" class="corpo"/>
      ${p.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="5" class="ponto"/>
        <text x="${q[0] + (i === 0 || i === 3 ? 10 : -10)}" y="${q[1] + (i < 2 ? -10 : 18)}"
          text-anchor="${i === 0 || i === 3 ? "start" : "end"}">${nomes[i]}</text>`).join("")}

      <line x1="${cx - dx - 28}" y1="${cy}" x2="${cx + dx + 28}" y2="${cy}" class="eixo"/>
      <line x1="${cx}" y1="${cy - dy - 28}" x2="${cx}" y2="${cy + dy + 28}" class="eixo"/>
      <circle cx="${cx}" cy="${cy}" r="7" class="cg"/>
      <text x="${cx - 12}" y="${cy + 22}" text-anchor="end" class="rot">CG</text>

      ${cota(cx, cy + dy + 40, cx + dx, cy + dy + 40, diferentes ? "x₁" : "a")}
      ${cota(cx + dx, cy, cx + dx, cy - dy, diferentes ? "y₁" : "b", "start")}
      ${diferentes ? `
      <text x="${cx}" y="${cy + dy + 70}" class="rot-peq" text-anchor="middle">x, y — coordenadas do ponto a partir do CG (com sinal, como no desenho)</text>
      <text x="${cx}" y="${cy + dy + 86}" class="rot-peq" text-anchor="middle">z — altura em relação ao CG (+ acima, − abaixo)</text>` : `
      <text x="${cx}" y="${cy + dy + 70}" class="rot-peq" text-anchor="middle">a — do CG ao ponto, no comprimento</text>
      <text x="${cx}" y="${cy + dy + 86}" class="rot-peq" text-anchor="middle">b — do CG ao ponto, na largura</text>`}

      ${detalheAngulo(W - 180, 150)}
    </svg>`;
  }

  /* ---------------------------------------------------------- legenda das figuras */
  /** linhas de texto no rodapé do quadro, centradas — é onde mora a explicação de cada
   *  letra. No desenho ficam só os rótulos curtos, senão o texto cai por cima da peça. */
  function legenda(W, yBase, linhas) {
    return linhas.map((t, i) =>
      `<text x="${W / 2}" y="${yBase + i * 13}" class="rot-peq" text-anchor="middle">${t}</text>`).join("");
  }

  /* ---------------------------------------------------------- manilha cotada */
  /**
   * Geometria do grilhete, na leitura da folha de dimensões do fabricante:
   *
   *   a  diâmetro do corpo (a barra do arco)      f  comprimento interno (do pino ao arco)
   *   b  diâmetro do pino                          g  diâmetro interno do arco
   *   c  largura do corpo (vista lateral)          h  comprimento total
   *   d  largura da orelha                         i  largura total, com o punho do pino
   *   e  boca (entre as orelhas)                   j  largura externa do arco  =  g + 2a
   *
   * Origem no eixo do pino, y para cima.
   */
  function geomManilha(mn) {
    const m = mn || {};
    const v = (x, alt) => (Number(x) > 0 ? Number(x) : alt);
    const a = v(m.a, 16), b = v(m.b, 19), c = v(m.c, 40), d = v(m.d, 16);
    const e = v(m.e, 27), f = v(m.f, 64), g = v(m.g, 43), h = v(m.h, 110);
    const i = v(m.i, 98), j = v(m.j, g + 2 * a), k = v(m.k, 0);

    const Ri = g / 2, Ro = Ri + a;        // arco: interno g, externo g + 2a ( = j )
    const yc = f - Ri;                     // centro do arco acima do eixo do pino
    const topo = yc + Ro;
    const base = topo - h;                 // as orelhas descem até fechar o comprimento h
    const xIn = e / 2, xOut = e / 2 + d;   // faces interna e externa das orelhas
    const yTanOut = yc - Math.sqrt(Math.max(Ro * Ro - xOut * xOut, 1));
    const yTanIn = yc - Math.sqrt(Math.max(Ri * Ri - xIn * xIn, 1));
    return { a, b, c, d, e, f, g, h, i, j, k, Ri, Ro, yc, topo, base, xIn, xOut, yTanOut, yTanIn };
  }

  /** contorno da manilha (vista de frente) */
  function pathManilha(G, X, Y, k) {
    const r = G.d / 2, yLobo = G.base + r, rk = r * k;
    return `M${X(-G.xOut)},${Y(yLobo)}`
      + ` L${X(-G.xOut)},${Y(G.yTanOut)}`
      // large-arc = 1: passa por cima, pelo ponto mais largo
      + ` A${G.Ro * k},${G.Ro * k} 0 1 1 ${X(G.xOut)},${Y(G.yTanOut)}`
      + ` L${X(G.xOut)},${Y(yLobo)}`
      + ` A${rk},${rk} 0 0 1 ${X(G.xIn)},${Y(yLobo)}`
      + ` L${X(G.xIn)},${Y(G.yTanIn)}`
      + ` A${G.Ri * k},${G.Ri * k} 0 1 0 ${X(-G.xIn)},${Y(G.yTanIn)}`
      + ` L${X(-G.xIn)},${Y(yLobo)}`
      + ` A${rk},${rk} 0 0 1 ${X(-G.xOut)},${Y(yLobo)} Z`;
  }

  /**
   * Manilha cotada, em duas vistas como na folha do fabricante: de frente (arco, orelhas e
   * pino) e de lado (a largura do corpo). Desenhada na escala da manilha escolhida.
   */
  function manilha(mn) {
    const G = geomManilha(mn);
    const mm = x => IC.fmt.num(x, x < 10 ? 1 : 0);

    const ALT = 300;
    const k = ALT / (G.topo - G.base);
    const meiaF = Math.max(G.Ro, G.i / 2);            // meia largura da vista de frente
    const esq = 120, entre = 104, dir = 118, cima = 78, baixo = 104;
    const LF = 2 * meiaF * k, LL = G.c * k;           // larguras das duas vistas
    const W = Math.round(esq + LF + entre + LL + dir), H = Math.round(ALT + cima + baixo);
    const cxF = esq + LF / 2, cxL = esq + LF + entre + LL / 2;
    const X = v => cxF + v * k, Y = v => cima + (G.topo - v) * k;

    const cotaH = (yy, x1, x2, txt) => `<g class="cota">
      <line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${(x1 + x2) / 2}" y="${yy - 5}" text-anchor="middle">${txt}</text></g>`;
    const cotaV = (xx, y1, y2, txt, anc = "start") => `<g class="cota">
      <line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${xx + (anc === "start" ? 6 : -6)}" y="${(y1 + y2) / 2 + 4}" text-anchor="${anc}">${txt}</text></g>`;
    const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext"/>`;
    const seta = (x1, y1, x2, y2, txt, anc) => `<g class="cota">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext" marker-start="url(#fseta)"/>
      <text x="${x2 + (anc === "end" ? -4 : 4)}" y="${y2 + 4}" text-anchor="${anc}">${txt}</text></g>`;

    const yPino = Y(0), rP = G.b / 2 * k, yBase = Y(G.base);
    const xPunho = X(-G.i / 2), xPonta = X(G.i / 2);

    /* ---------------------------------------------- vista de frente */
    const frente = `
      <path d="${pathManilha(G, X, Y, k)}" class="corpo"/>
      <!-- pino de rosca: haste, punho de um lado, ponta do outro -->
      <rect x="${X(-G.xOut)}" y="${yPino - rP}" width="${X(G.xOut) - X(-G.xOut)}" height="${2 * rP}"
            class="peca" style="fill:#c3cee1"/>
      <line x1="${X(-G.xIn)}" y1="${yPino - rP}" x2="${X(-G.xIn)}" y2="${yPino + rP}" class="aresta oculta"/>
      <line x1="${X(G.xIn)}" y1="${yPino - rP}" x2="${X(G.xIn)}" y2="${yPino + rP}" class="aresta oculta"/>
      <rect x="${xPunho + rP * 1.2}" y="${yPino - rP * 0.8}" width="${X(-G.xOut) - xPunho - rP * 1.2}"
            height="${rP * 1.6}" class="peca" style="fill:#aebcd2"/>
      <circle cx="${xPunho + rP * 0.9}" cy="${yPino}" r="${rP * 1.15}" class="peca" style="fill:#aebcd2"/>
      <circle cx="${xPunho + rP * 0.9}" cy="${yPino}" r="${rP * 0.42}" style="fill:#f7f9fc" stroke="#7d90a8" stroke-width="1"/>
      <rect x="${X(G.xOut)}" y="${yPino - rP * 0.9}" width="${xPonta - X(G.xOut)}" height="${rP * 1.8}"
            rx="${rP * 0.5}" class="peca" style="fill:#aebcd2"/>
      <line x1="${xPunho - 12}" y1="${yPino}" x2="${xPonta + 12}" y2="${yPino}" class="eixo"/>`;

    /* ---------------------------------------------- vista de lado */
    const topoL = Y(G.topo), baseL = yBase, larg = LL;
    const lado = `
      <rect x="${cxL - larg / 2}" y="${topoL}" width="${larg}" height="${baseL - topoL}"
            rx="${larg / 2}" class="corpo"/>
      <circle cx="${cxL}" cy="${yPino}" r="${rP}" style="fill:#f7f9fc" stroke="#16233f" stroke-width="1.2"/>
      <line x1="${cxL - rP}" y1="${yPino}" x2="${cxL + rP}" y2="${yPino}" class="eixo"/>
      <text x="${cxL}" y="${topoL - 12}" class="rot-peq" text-anchor="middle">vista de lado</text>
      ${ext(cxL - larg / 2, baseL, cxL - larg / 2, baseL + 34)}
      ${ext(cxL + larg / 2, baseL, cxL + larg / 2, baseL + 34)}
      ${cotaH(baseL + 30, cxL - larg / 2, cxL + larg / 2, `c = ${mm(G.c)}`)}`;

    const xDir = X(meiaF) + 30;      // a cota de h fica entre as duas vistas
    return `${cabeca(W, H)}
      <text x="${W / 2}" y="20" class="titulo" text-anchor="middle">MANILHA — ONDE É CADA MEDIDA</text>
      ${frente}
      ${lado}

      <!-- j: largura externa do arco, em cima -->
      ${ext(X(-G.Ro), Y(G.yc), X(-G.Ro), cima - 34)}
      ${ext(X(G.Ro), Y(G.yc), X(G.Ro), cima - 34)}
      ${cotaH(cima - 30, X(-G.Ro), X(G.Ro), `j = ${mm(G.j)}`)}

      <!-- h: comprimento total -->
      ${ext(X(0), Y(G.topo), xDir + 4, Y(G.topo))}
      ${ext(X(G.xOut), yBase, xDir + 4, yBase)}
      ${cotaV(xDir - 6, Y(G.topo), yBase, `h = ${mm(G.h)}`)}

      <!-- f: comprimento interno, e g: interno do arco -->
      ${cotaV(X(0), Y(G.yc + G.Ri), yPino, `f = ${mm(G.f)}`)}
      ${cotaH(Y(G.yc), X(-G.Ri), X(G.Ri), `g = ${mm(G.g)}`)}

      <!-- a: espessura da barra do arco -->
      ${seta(X(-(G.Ri + G.Ro) / 2 * 0.72), Y(G.yc + (G.Ri + G.Ro) / 2 * 0.72), X(-meiaF) - 26, Y(G.topo) + 12, `a = ${mm(G.a)}`, "end")}

      <!-- b: diâmetro do pino -->
      ${cotaV(xPonta + 14, yPino - rP, yPino + rP, `b = ${mm(G.b)}`)}

      <!-- d, e, i embaixo -->
      ${ext(X(-G.xOut), yBase, X(-G.xOut), yBase + 64)}
      ${ext(X(-G.xIn), yBase, X(-G.xIn), yBase + 40)}
      ${ext(X(G.xIn), yBase, X(G.xIn), yBase + 40)}
      ${cotaH(yBase + 36, X(-G.xOut), X(-G.xIn), `d = ${mm(G.d)}`)}
      ${cotaH(yBase + 36, X(-G.xIn), X(G.xIn), `e = ${mm(G.e)}`)}
      ${cotaH(yBase + 60, xPunho, xPonta, `i = ${mm(G.i)}`)}

      <text x="${W / 2}" y="${H - 8}" class="rot-peq" text-anchor="middle">medidas em mm, na escala da manilha escolhida</text>
    </svg>`;
  }

  /* ---------------------------------------------------------- sapatilho cotado */
  /**
   * Sapatilho (thimble) em duas vistas, como na folha de dimensões: de frente, deitado com a
   * ponta à esquerda, e de lado, mostrando a ranhura onde o cabo assenta.
   *
   *   a  comprimento total    b  comprimento interno
   *   c  altura total         d  altura interna (é ela que passa pelo corpo da manilha)
   *   e  largura total        f  largura da ranhura
   *
   * Desenhado na escala do sapatilho escolhido.
   */
  function sapatilho(sp) {
    const v = (x, alt) => (Number(x) > 0 ? Number(x) : alt);
    const s = sp || {};
    const A = v(s.a, 92.2), B = v(s.b, 69.9), C = v(s.c, 68.3);
    const D = v(s.d, 38.1), E = v(s.e, 22.4), F = v(s.f, 15);
    const mm = x => IC.fmt.num(x, x < 10 ? 1 : 0);

    const ALT = 214;
    const k = ALT / C;
    const esq = 96, entre = 122, dir = 104, cima = 76, baixo = 92;   // entre: cabe a cota de c
    const LF = A * k, LL = E * k;
    const W = Math.round(esq + LF + entre + LL + dir), H = Math.round(ALT + cima + baixo);
    const x0 = esq, yMeio = cima + ALT / 2;
    const X = v => x0 + v * k;                    // 0 = ponta da esquerda
    const Yc = v => yMeio - v * k;                // v = altura a partir do eixo

    // contorno: gota deitada — ponta à esquerda, volta redonda à direita
    const rOut = C / 2, rIn = D / 2;
    const cxOut = A - rOut, cxIn = B - rIn;       // centros das voltas
    const gota = (cx, r, pontaX) => `M${X(pontaX)},${Yc(0)}`
      + ` C${X(pontaX + (cx - pontaX) * 0.45)},${Yc(r * 0.72)} ${X(cx - r * 0.55)},${Yc(r)} ${X(cx)},${Yc(r)}`
      + ` A${r * k},${r * k} 0 1 1 ${X(cx)},${Yc(-r)}`
      + ` C${X(cx - r * 0.55)},${Yc(-r)} ${X(pontaX + (cx - pontaX) * 0.45)},${Yc(-r * 0.72)} ${X(pontaX)},${Yc(0)} Z`;

    const cotaH = (yy, x1, x2, txt) => `<g class="cota">
      <line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${(x1 + x2) / 2}" y="${yy - 5}" text-anchor="middle">${txt}</text></g>`;
    const cotaV = (xx, y1, y2, txt, anc = "start") => `<g class="cota">
      <line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${xx + (anc === "start" ? 6 : -6)}" y="${(y1 + y2) / 2 + 4}" text-anchor="${anc}">${txt}</text></g>`;
    const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext"/>`;

    const cxL = esq + LF + entre + LL / 2, altL = C * k;
    const gargF = F * k;
    const lado = `
      <path d="M${cxL - LL / 2},${cima + altL * 0.12}
               Q${cxL - LL / 2},${cima} ${cxL - LL / 2 + LL * 0.18},${cima}
               L${cxL + LL / 2 - LL * 0.18},${cima} Q${cxL + LL / 2},${cima} ${cxL + LL / 2},${cima + altL * 0.12}
               L${cxL + LL / 2},${cima + altL * 0.88} Q${cxL + LL / 2},${cima + altL} ${cxL + LL / 2 - LL * 0.18},${cima + altL}
               L${cxL - LL / 2 + LL * 0.18},${cima + altL} Q${cxL - LL / 2},${cima + altL} ${cxL - LL / 2},${cima + altL * 0.88} Z"
            class="corpo"/>
      <path d="M${cxL - gargF / 2},${cima} A${gargF / 2},${gargF / 2} 0 0 0 ${cxL + gargF / 2},${cima}" style="fill:#f7f9fc" stroke="#7d90a8" stroke-width="1"/>
      <path d="M${cxL - gargF / 2},${cima + altL} A${gargF / 2},${gargF / 2} 0 0 1 ${cxL + gargF / 2},${cima + altL}" style="fill:#f7f9fc" stroke="#7d90a8" stroke-width="1"/>
      <text x="${cxL}" y="${cima - 14}" class="rot-peq" text-anchor="middle">vista de lado</text>
      ${ext(cxL - LL / 2, cima + altL, cxL - LL / 2, cima + altL + 58)}
      ${ext(cxL + LL / 2, cima + altL, cxL + LL / 2, cima + altL + 58)}
      ${cotaH(cima + altL + 54, cxL - LL / 2, cxL + LL / 2, `e = ${mm(E)}`)}
      ${cotaH(cima + altL + 30, cxL - gargF / 2, cxL + gargF / 2, `f = ${mm(F)}`)}`;

    return `${cabeca(W, H)}
      <text x="${W / 2}" y="20" class="titulo" text-anchor="middle">SAPATILHO — ONDE É CADA MEDIDA</text>

      <path d="${gota(cxOut, rOut, 0)}" class="corpo"/>
      <path d="${gota(cxIn, rIn, A - B)}" style="fill:#f7f9fc" stroke="#7d90a8" stroke-width="1"/>

      <!-- a e b embaixo -->
      ${ext(X(0), Yc(0), X(0), Yc(-rOut) + 62)}
      ${ext(X(A), Yc(0), X(A), Yc(-rOut) + 62)}
      ${ext(X(A - B), Yc(0), X(A - B), Yc(-rOut) + 38)}
      ${ext(X(B + (A - B)), Yc(0), X(A), Yc(-rOut) + 38)}
      ${cotaH(Yc(-rOut) + 34, X(A - B), X(A), `b = ${mm(B)}`)}
      ${cotaH(Yc(-rOut) + 58, X(0), X(A), `a = ${mm(A)}`)}

      <!-- c e d à direita da volta -->
      ${ext(X(cxOut), Yc(rOut), X(A) + 58, Yc(rOut))}
      ${ext(X(cxOut), Yc(-rOut), X(A) + 58, Yc(-rOut))}
      ${cotaV(X(A) + 50, Yc(rOut), Yc(-rOut), `c = ${mm(C)}`)}
      ${cotaV(X(cxIn), Yc(rIn), Yc(-rIn), `d = ${mm(D)}`)}

      ${lado}
      <text x="${W / 2}" y="${H - 8}" class="rot-peq" text-anchor="middle">medidas em mm, na escala do sapatilho escolhido</text>
    </svg>`;
  }

  /* ---------------------------------------------------------- olhal (padeye) cotado */
  /**
   * Desenho de fabricação do olhal, em escala, a partir da geometria informada:
   *
   *      base   largura da chapa, medida embaixo
   *      h      do pé da chapa até o centro do furo
   *      R      raio do topo, centrado no furo
   *      dFuro  diâmetro do furo (recebe o pino da manilha)
   *      t      espessura da chapa (aparece na vista de topo, ao lado)
   *
   * Contorno: base reta → lado direito vertical → arco do topo → chanfro até o canto
   * esquerdo. Muda junto com os números.
   */
  function olhal(geom) {
    const g = geom || {};
    const base = Math.max(Number(g.base) || 0, 1);
    const h = Math.max(Number(g.h) || 0, 1);
    const R = Math.max(Number(g.R) || 0, 1);
    const d = Math.max(Number(g.dFuro) || 0, 0);
    const t = Math.max(Number(g.t) || 0, 0);
    const tAnel = Math.max(Number(g.tAnel) || 0, 0);
    const rAnel = Math.max(Number(g.rAnel) || 0, 0);
    const mm = v => IC.fmt.num(v, v < 10 ? 1 : 0);

    const xc = Math.max(base - R, R * 0.15);     // centro do furo
    const topo = h + R;                          // ponto mais alto da peça
    const xEsq = Math.max(xc - R, 0);            // onde o arco encontra o chanfro

    const ALT = 250;
    const k = ALT / topo;
    const espTotal = t + 2 * tAnel;
    const kT = Math.min(k, 46 / Math.max(espTotal, 1));   // escala da vista de topo
    const LF = base * k, LL = Math.max(espTotal * kT, 16);
    const esq = 150, entre = 78, dir = 96, cima = 80, baixo = 92;   // esq: as chamadas de R e do furo
    const W = Math.round(esq + LF + entre + LL + dir), H = Math.round(ALT + cima + baixo);
    const X = v => esq + v * k;
    const Y = v => cima + (topo - v) * k;

    const contorno = `M${X(0)},${Y(0)} L${X(base)},${Y(0)} L${X(base)},${Y(h)} `
      + `A${R * k},${R * k} 0 0 0 ${X(xEsq)},${Y(h)} Z`;

    const cotaH = (yy, x1, x2, txt) => `<g class="cota">
      <line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${(x1 + x2) / 2}" y="${yy - 5}" text-anchor="middle">${txt}</text></g>`;
    const cotaV = (xx, y1, y2, txt, anc = "start") => `<g class="cota">
      <line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${xx + (anc === "start" ? 6 : -6)}" y="${(y1 + y2) / 2 + 4}" text-anchor="${anc}">${txt}</text></g>`;
    const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext"/>`;
    const seta = (x1, y1, x2, y2, txt, anc) => `<g class="cota">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext" marker-start="url(#fseta)"/>
      <text x="${x2 + (anc === "end" ? -4 : 4)}" y="${y2 + 4}" text-anchor="${anc}">${txt}</text></g>`;

    const xFuro = X(xc), yFuro = Y(h), rFuro = d / 2 * k;
    const xDir = X(base) + 66;

    /* ---------------------------------------------- vista de topo (a espessura) */
    const cxL = esq + LF + entre + LL / 2, yTopo0 = Y(topo), yTopo1 = Y(0);
    const larguraAnel = Math.min(rAnel * 2 * k, ALT * 0.5) || 0;
    const vistaTopo = `
      <rect x="${cxL - t * kT / 2}" y="${yTopo0}" width="${t * kT}" height="${yTopo1 - yTopo0}" class="corpo"/>
      ${tAnel > 0 ? `
        <rect x="${cxL - t * kT / 2 - tAnel * kT}" y="${yFuro - larguraAnel / 2}" width="${tAnel * kT}" height="${larguraAnel}" class="peca" style="fill:#c3cee1"/>
        <rect x="${cxL + t * kT / 2}" y="${yFuro - larguraAnel / 2}" width="${tAnel * kT}" height="${larguraAnel}" class="peca" style="fill:#c3cee1"/>` : ""}
      <text x="${cxL}" y="${yTopo0 - 14}" class="rot-peq" text-anchor="middle">vista de topo</text>
      ${ext(cxL - espTotal * kT / 2, yTopo1, cxL - espTotal * kT / 2, yTopo1 + 40)}
      ${ext(cxL + espTotal * kT / 2, yTopo1, cxL + espTotal * kT / 2, yTopo1 + 40)}
      ${cotaH(yTopo1 + 36, cxL - espTotal * kT / 2, cxL + espTotal * kT / 2,
              tAnel > 0 ? `t + 2·t.anel = ${mm(espTotal)}` : `t = ${mm(t)}`)}`;

    return `${cabeca(W, H)}
      <text x="${W / 2}" y="20" class="titulo" text-anchor="middle">OLHAL (PADEYE) — VISTA DE FABRICAÇÃO</text>

      <path d="${contorno}" class="corpo"/>
      <circle cx="${xFuro}" cy="${yFuro}" r="${rFuro}" style="fill:#f7f9fc" stroke="#16233f" stroke-width="1.2"/>
      ${tAnel > 0 && rAnel > d / 2 ? `<circle cx="${xFuro}" cy="${yFuro}" r="${rAnel * k}" style="fill:none" stroke="#7d90a8" stroke-width="1" stroke-dasharray="4 3"/>` : ""}
      <line x1="${xFuro - rFuro - 12}" y1="${yFuro}" x2="${xFuro + rFuro + 12}" y2="${yFuro}" class="eixo"/>
      <line x1="${xFuro}" y1="${yFuro - rFuro - 12}" x2="${xFuro}" y2="${yFuro + rFuro + 12}" class="eixo"/>

      <!-- base, embaixo -->
      ${ext(X(0), Y(0), X(0), Y(0) + 46)}
      ${ext(X(base), Y(0), X(base), Y(0) + 46)}
      ${cotaH(Y(0) + 40, X(0), X(base), `base = ${mm(base)}`)}

      <!-- h, à direita -->
      ${ext(X(base), yFuro, xDir + 4, yFuro)}
      ${ext(X(base), Y(0), xDir + 4, Y(0))}
      ${cotaV(xDir - 8, Y(0), yFuro, `h = ${mm(h)}`, "end")}

      <!-- R e furo: chamadas para fora, pela esquerda, uma abaixo da outra -->
      ${seta(xFuro - R * k * 0.71, yFuro - R * k * 0.71, esq - 16, cima + 16, `R = ${mm(R)}`, "end")}
      ${seta(xFuro - rFuro * 0.72, yFuro - rFuro * 0.72, esq - 16, cima + 44, `Ø furo = ${mm(d)}`, "end")}

      ${vistaTopo}
      <text x="${W / 2}" y="${H - 8}" class="rot-peq" text-anchor="middle">o desenho acompanha as medidas — um olhal igual para todos os pontos</text>
    </svg>`;
  }

  /* ---------------------------------------------------------- olhal comprado (rosqueado) */
  /**
   * Olhal de elevação rosqueado, na escala do modelo escolhido.
   *
   *   b diâmetro da base · c diâmetro externo do olhal · d diâmetro interno do olhal
   *   e comprimento total · f espessura da base · g diâmetro da haste
   *
   * O diâmetro interno (d) é o que recebe o pino da manilha — é ele que manda no encaixe.
   */
  function olhalComprado(ol) {
    const o = ol || {};
    const v = (x, alt) => (Number(x) > 0 ? Number(x) : alt);
    const b = v(o.b, 40), c = v(o.c, 45), d = v(o.d, 22);
    const e = v(o.e, 70), f = v(o.f, 12), g = v(o.g, 16);
    const rosca = o.rosca ? String(o.rosca) : "";
    const mm = x => IC.fmt.num(x, x < 10 ? 1 : 0);

    // o olho fica em cima, a base no meio e a haste rosqueada embaixo
    const rOut = c / 2, rIn = d / 2;
    const alturaOlho = c;                       // o anel ocupa a sua própria altura
    const haste = Math.max(e - f - alturaOlho, e * 0.25);
    const total = alturaOlho + f + haste;

    const ALT = 250;
    const k = ALT / total;
    const meia = Math.max(rOut, b / 2);
    const esq = 128, dir = 128, cima = 62, baixo = 106;
    const W = Math.round(2 * meia * k + esq + dir), H = Math.round(ALT + cima + baixo);
    const cx = esq + meia * k;
    const Y = v => cima + (total - v) * k;      // v medido de baixo para cima

    const yTopoOlho = Y(total), yCentroOlho = Y(total - rOut * 1.0);
    const yBaseTopo = Y(haste + f), yBaseBaixo = Y(haste), yPonta = Y(0);

    const cotaH = (yy, x1, x2, txt) => `<g class="cota">
      <line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${(x1 + x2) / 2}" y="${yy - 5}" text-anchor="middle">${txt}</text></g>`;
    const cotaV = (xx, y1, y2, txt, anc = "start") => `<g class="cota">
      <line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${xx + (anc === "start" ? 6 : -6)}" y="${(y1 + y2) / 2 + 4}" text-anchor="${anc}">${txt}</text></g>`;
    const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext"/>`;
    const seta = (x1, y1, x2, y2, txt, anc) => `<g class="cota">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext" marker-start="url(#fseta)"/>
      <text x="${x2 + (anc === "end" ? -4 : 4)}" y="${y2 + 4}" text-anchor="${anc}">${txt}</text></g>`;

    // filetes da rosca, só como indicação
    const filetes = [];
    for (let y = haste * 0.1; y < haste * 0.92; y += Math.max(haste / 9, 2)) {
      filetes.push(`<line x1="${cx - g / 2 * k}" y1="${Y(y)}" x2="${cx + g / 2 * k}" y2="${Y(y + haste * 0.05)}" class="ext"/>`);
    }

    return `${cabeca(W, H)}
      <text x="${W / 2}" y="20" class="titulo" text-anchor="middle">OLHAL DE ELEVAÇÃO — ONDE É CADA MEDIDA</text>

      <!-- haste rosqueada -->
      <rect x="${cx - g / 2 * k}" y="${yBaseBaixo}" width="${g * k}" height="${yPonta - yBaseBaixo}" class="corpo"/>
      ${filetes.join("")}
      <!-- base -->
      <rect x="${cx - b / 2 * k}" y="${yBaseTopo}" width="${b * k}" height="${yBaseBaixo - yBaseTopo}" rx="2" class="peca" style="fill:#c3cee1"/>
      <!-- olho -->
      <circle cx="${cx}" cy="${yCentroOlho}" r="${rOut * k}" class="corpo"/>
      <circle cx="${cx}" cy="${yCentroOlho}" r="${rIn * k}" style="fill:#f7f9fc" stroke="#7d90a8" stroke-width="1"/>
      <rect x="${cx - g / 2 * k}" y="${yCentroOlho}" width="${g * k}" height="${yBaseTopo - yCentroOlho}" class="corpo"/>
      <line x1="${cx}" y1="${yTopoOlho - 10}" x2="${cx}" y2="${yPonta + 10}" class="eixo"/>

      <!-- d e c no olho -->
      ${cotaH(yCentroOlho, cx - rIn * k, cx + rIn * k, `d = ${mm(d)}`)}
      ${seta(cx - rOut * k * 0.71, yCentroOlho - rOut * k * 0.71, esq - 16, cima + 18, `c = ${mm(c)}`, "end")}

      <!-- b e f na base; as cotas de baixo ficam abaixo da ponta, para não cair sobre a haste -->
      ${ext(cx - b / 2 * k, yBaseBaixo, cx - b / 2 * k, yPonta + 30)}
      ${ext(cx + b / 2 * k, yBaseBaixo, cx + b / 2 * k, yPonta + 30)}
      ${cotaH(yPonta + 26, cx - b / 2 * k, cx + b / 2 * k, `b = ${mm(b)}`)}
      ${cotaV(cx + meia * k + 22, yBaseTopo, yBaseBaixo, `f = ${mm(f)}`)}

      <!-- g na haste e e no total -->
      ${cotaH(yPonta + 52, cx - g / 2 * k, cx + g / 2 * k, `g = ${mm(g)}`)}
      ${ext(cx, yTopoOlho, cx - meia * k - 40, yTopoOlho)}
      ${ext(cx, yPonta, cx - meia * k - 40, yPonta)}
      ${cotaV(cx - meia * k - 32, yTopoOlho, yPonta, `e = ${mm(e)}`, "end")}

      ${rosca ? `<text x="${cx + meia * k + 8}" y="${Y(haste * 0.5)}" class="rot-peq" text-anchor="start">rosca ${IC.fmt.esc(rosca)}</text>` : ""}
      <text x="${W / 2}" y="${H - 8}" class="rot-peq" text-anchor="middle">medidas em mm, na escala do olhal escolhido</text>
    </svg>`;
  }

  /* ---------------------------------------------------------- encaixe sapatilho × manilha */
  /** quebra um rótulo em até duas linhas que caibam no quadro */
  function quebrar(texto, max) {
    const palavras = String(texto).split(/\s+/);
    const linhas = [""];
    for (const p of palavras) {
      const tenta = linhas[linhas.length - 1] ? linhas[linhas.length - 1] + " " + p : p;
      if (tenta.length <= max || !linhas[linhas.length - 1]) linhas[linhas.length - 1] = tenta;
      else if (linhas.length < 2) linhas.push(p);
      else { linhas[1] = linhas[1].slice(0, max - 1) + "…"; break; }
    }
    return linhas;
  }

  /**
   * Um quadro por caso da verificação de encaixe, com as duas peças desenhadas em escala.
   *
   *   forma "furo"  — o que precisa passar é redondo e entra num furo redondo
   *   forma "boca"  — o que precisa passar é a chapa do sapatilho, entre duas faces
   *
   * `casos`: {n, rotulo, vao, peca, rotVao, rotPeca, forma, ok}
   *   vao  = a medida disponível · peca = a medida que precisa caber
   */
  function encaixe(casos) {
    if (!casos || !casos.length) return "";
    const LARG = 196, ALT = 208, COLS = 4;
    const n = casos.length;
    const cols = Math.min(COLS, n), linhas = Math.ceil(n / cols);
    const W = cols * LARG, H = linhas * ALT + 30;
    const mm = x => IC.fmt.num(x, x < 10 ? 1 : 0);

    const quadro = (c, idx) => {
      const cx = (idx % cols) * LARG + LARG / 2;
      const cy = Math.floor(idx / cols) * ALT + 112;
      const vao = Math.max(Number(c.vao) || 0, 0.1);
      const peca = Math.max(Number(c.peca) || 0, 0.1);
      const maior = Math.max(vao, peca);
      const k = 62 / maior;                       // 62 px para a maior das duas medidas
      const cor = c.ok ? "#2fa36b" : "#e2604e";
      const folga = vao - peca;

      let desenho;
      if (c.forma === "furo") {
        const rv = vao / 2 * k, rp = peca / 2 * k;
        desenho = `
          <circle cx="${cx}" cy="${cy}" r="${rv}" style="fill:#e8eef7" stroke="${cor}" stroke-width="1.8"/>
          <circle cx="${cx}" cy="${cy}" r="${rp}" style="fill:#17507e" stroke="none"/>
          <line x1="${cx - rv}" y1="${cy}" x2="${cx + rv}" y2="${cy}" class="eixo"/>`;
      } else {
        // duas faces (o vão) com a chapa do sapatilho no meio
        const hv = vao * k, hp = peca * k, alt = 74;
        desenho = `
          <rect x="${cx - hv / 2 - 9}" y="${cy - alt / 2}" width="9" height="${alt}" class="corpo"/>
          <rect x="${cx + hv / 2}" y="${cy - alt / 2}" width="9" height="${alt}" class="corpo"/>
          <line x1="${cx - hv / 2}" y1="${cy - alt / 2}" x2="${cx - hv / 2}" y2="${cy + alt / 2}" stroke="${cor}" stroke-width="1.8"/>
          <line x1="${cx + hv / 2}" y1="${cy - alt / 2}" x2="${cx + hv / 2}" y2="${cy + alt / 2}" stroke="${cor}" stroke-width="1.8"/>
          <rect x="${cx - hp / 2}" y="${cy - alt / 2 + 8}" width="${hp}" height="${alt - 16}" rx="2" style="fill:#17507e"/>`;
      }

      const meia = c.forma === "furo" ? vao / 2 * k : vao * k / 2;
      return `<g>
        ${quebrar(c.rotulo || ("caso " + c.n), 24).map((t, li) =>
          `<text x="${cx}" y="${cy - 74 + li * 13}" class="rot-peq" text-anchor="middle">${IC.fmt.esc(t)}</text>`).join("")}
        ${desenho}
        <g class="cota">
          <line x1="${cx - meia}" y1="${cy + 50}" x2="${cx + meia}" y2="${cy + 50}" class="dim"
                marker-start="url(#fseta)" marker-end="url(#fseta)"/>
          <text x="${cx}" y="${cy + 64}" text-anchor="middle">${IC.fmt.esc(c.rotVao || "vão")} = ${mm(vao)}</text>
        </g>
        <text x="${cx}" y="${cy + 78}" class="rot-peq" text-anchor="middle" style="fill:#17507e">
          ${IC.fmt.esc(c.rotPeca || "peça")} = ${mm(peca)}</text>
        <text x="${cx}" y="${cy + 93}" class="rot-peq" text-anchor="middle" style="fill:${cor};font-weight:700">
          ${c.ok ? `folga ${mm(folga)} mm` : `falta ${mm(-folga)} mm`}</text>
      </g>`;
    };

    return `${cabeca(W, H)}
      <text x="${W / 2}" y="16" class="titulo" text-anchor="middle">ENCAIXE — O QUE PASSA POR ONDE</text>
      ${casos.map(quadro).join("")}
      <text x="${W / 2}" y="${H - 6}" class="rot-peq" text-anchor="middle">peças em escala · claro: o vão · escuro: o que precisa passar</text>
    </svg>`;
  }

  return { icone, medidas, manilha, sapatilho, olhal, olhalComprado, encaixe };
})();
