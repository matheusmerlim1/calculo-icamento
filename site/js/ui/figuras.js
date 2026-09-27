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
   * Manilha de arco, desenhada a partir das medidas da manilha escolhida — o desenho muda
   * quando muda a manilha. O eixo do pino é a linha de base (y = 0) e o arco sobe dali.
   *
   *   a corpo · b pino · c interno do arco · d largura do olhal · e boca
   *   f comprimento interno · g largura do corpo · h comprimento
   *   i parafuso · j largura da porca · k espessura da porca
   *
   * Sem manilha escolhida, desenha com medidas de exemplo só para mostrar onde é cada letra.
   */
  function manilha(mn) {
    const m = mn || { a: 32, b: 35, c: 73, d: 32, e: 51, f: 115, g: 83, h: 201, i: 184, j: 147, k: 30 };
    const v = (x, alt) => (Number(x) > 0 ? Number(x) : alt);
    const a = v(m.a, 32), b = v(m.b, 35), c = v(m.c, 73), d = v(m.d, a);
    const e = v(m.e, 51), f = v(m.f, 115), g = v(m.g, 83), h = v(m.h, 201);
    const i = v(m.i, g * 2.2), j = v(m.j, 0), k = v(m.k, 0);

    // arco: o topo interno fica a f do eixo do pino; o miolo do arco tem diâmetro c
    const rIn = c / 2, rOut = c / 2 + d;
    const yc = Math.max(f - rIn, rIn * 0.6);          // altura do centro do arco
    const topo = yc + rOut;                            // ponto mais alto da peça
    const meia = Math.max(g, i, j) / 2;

    // escala e moldura
    const ALT = 250;
    const kk = ALT / Math.max(topo + b, 1);
    const esq = 118, dir = 152, cima = 38, baixo = 104;   // espaço das cotas em volta
    const LARG = 2 * meia * kk;
    const W = Math.round(LARG + esq + dir), H = Math.round(ALT + cima + baixo);
    const cx = esq + LARG / 2;
    const y0 = cima + ALT - b * kk;                    // eixo do pino no desenho
    const X = mm => cx + mm * kk;
    const Y = mm => y0 - mm * kk;

    // contorno: perna esquerda sobe, arco por cima, perna direita desce
    const corpo = (larg, raio, yTop) => {
      const xe = -larg / 2, xd = larg / 2;
      return `M${X(xe)},${Y(0)} C${X(xe)},${Y(yTop * 0.45)} ${X(-raio)},${Y(yTop * 0.62)} ${X(-raio)},${Y(yTop)} `
        + `A${raio * kk},${raio * kk} 0 0 1 ${X(raio)},${Y(yTop)} `
        + `C${X(raio)},${Y(yTop * 0.62)} ${X(xd)},${Y(yTop * 0.45)} ${X(xd)},${Y(0)}`;
    };
    // duas paths: a de fora cheia e a de dentro em branco
    const fora = `${corpo(g, rOut, yc)} L${X(g / 2)},${Y(0)} L${X(-g / 2)},${Y(0)} Z`;
    const dentro = `${corpo(e, rIn, yc)} L${X(e / 2)},${Y(0)} L${X(-e / 2)},${Y(0)} Z`;

    const mm = x => IC.fmt.num(x, x < 10 ? 1 : 0);
    const cotaH = (yy, x1, x2, txt, classe = "") => `<g class="cota ${classe}">
      <line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${(x1 + x2) / 2}" y="${yy - 5}" text-anchor="middle">${txt}</text></g>`;
    const cotaV = (xx, y1, y2, txt, anc = "start") => `<g class="cota">
      <line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${xx + (anc === "start" ? 6 : -6)}" y="${(y1 + y2) / 2 + 4}" text-anchor="${anc}">${txt}</text></g>`;
    const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext"/>`;
    const chamada = (x1, y1, x2, y2, txt, anc) => `<g class="cota">
      ${ext(x1, y1, x2, y2)}<text x="${x2 + (anc === "end" ? -4 : 4)}" y="${y2 + 4}" text-anchor="${anc}">${txt}</text></g>`;

    const yPino = Y(0), rPino = b / 2 * kk;
    return `${cabeca(W, H)}
      <text x="${W / 2}" y="16" class="titulo" text-anchor="middle">MANILHA — ONDE É CADA MEDIDA</text>

      <path d="${fora}" class="corpo"/>
      <path d="${dentro}" style="fill:#f7f9fc" stroke="#7d90a8" stroke-width="1"/>

      <!-- pino, porca e cabeça -->
      <rect x="${X(-i / 2)}" y="${yPino - rPino}" width="${i * kk}" height="${b * kk}" rx="${rPino * 0.4}" class="peca" style="fill:#c3cee1"/>
      ${k > 0 ? `<rect x="${X(-i / 2)}" y="${yPino - rPino * 1.5}" width="${k * kk}" height="${b * kk * 1.5}" class="peca" style="fill:#aebcd2"/>` : ""}
      <line x1="${X(-i / 2) - 10}" y1="${yPino}" x2="${X(i / 2) + 10}" y2="${yPino}" class="eixo"/>

      <!-- h: comprimento total, à direita -->
      ${ext(X(0), Y(topo), X(meia) + 74, Y(topo))}
      ${ext(X(g / 2), Y(-b / 2), X(meia) + 74, Y(-b / 2))}
      ${cotaV(X(meia) + 62, Y(topo), Y(-b / 2), `h = ${mm(h)}`)}

      <!-- f: comprimento interno, no eixo -->
      ${cotaV(X(0), Y(yc + rIn), yPino, `f = ${mm(f)}`)}

      <!-- c e d no arco -->
      ${cotaH(Y(yc), X(-rIn), X(rIn), `c = ${mm(c)}`)}
      ${chamada(X(-rIn - d / 2) , Y(yc + rIn * 0.6), X(-meia) - 30, Y(topo) + 6, `d = ${mm(d)}`, "end")}

      <!-- a: diâmetro do corpo, na perna esquerda -->
      ${chamada(X(-(e + a) / 2), Y(yc * 0.35), X(-meia) - 30, Y(yc * 0.35) - 16, `a = ${mm(a)}`, "end")}

      <!-- e e g embaixo -->
      ${ext(X(-e / 2), yPino, X(-e / 2), yPino + 42)}
      ${ext(X(e / 2), yPino, X(e / 2), yPino + 42)}
      ${cotaH(yPino + 38, X(-e / 2), X(e / 2), `e = ${mm(e)}`)}
      ${ext(X(-g / 2), yPino, X(-g / 2), yPino + 66)}
      ${ext(X(g / 2), yPino, X(g / 2), yPino + 66)}
      ${cotaH(yPino + 62, X(-g / 2), X(g / 2), `g = ${mm(g)}`)}
      ${cotaH(yPino + 88, X(-i / 2), X(i / 2), `i = ${mm(i)}`)}

      <!-- b: diâmetro do pino -->
      ${cotaV(X(i / 2) + 16, yPino - rPino, yPino + rPino, `b = ${mm(b)}`)}
      ${k > 0 ? chamada(X(-i / 2 + k / 2), yPino - rPino * 1.5, X(-meia) - 30, yPino + 10,
                        `k = ${mm(k)}${j > 0 ? ` · j = ${mm(j)}` : ""}`, "end") : ""}

      <text x="${W / 2}" y="${H - 8}" class="rot-peq" text-anchor="middle">medidas em mm, na escala da manilha escolhida</text>
    </svg>`;
  }

  /* ---------------------------------------------------------- sapatilho cotado */
  /** desenho do sapatilho (thimble) — a planilha de origem não detalha o que cada coluna
   *  mede fisicamente; posições aproximadas, do jeito mais comum em catálogo (DIN 3091).
   *  Conferir com o catálogo do fabricante antes de comprar. */
  function sapatilho() {
    const W = 340, H = 330;
    return `${cabeca(W, H)}
      <text x="${W / 2}" y="18" class="titulo" text-anchor="middle">SAPATILHO</text>
      <g transform="translate(44,4)">
        <path d="M130,40 C 190,40 220,90 220,140 C 220,190 180,225 130,260
                 C 80,225 40,190 40,140 C 40,90 70,40 130,40 Z"
          class="corpo"/>
        <path d="M130,60 C 178,60 200,98 200,140 C 200,180 168,208 130,236
                 C 92,208 60,180 60,140 C 60,98 82,60 130,60 Z"
          style="fill:#f7f9fc" stroke="#7d90a8" stroke-width="1"/>

        ${cota(16, 40, 16, 260, "a", "start")}
        <line x1="22" y1="40" x2="130" y2="40" stroke="#9aa7b8" stroke-width=".8"/>
        <line x1="22" y1="260" x2="130" y2="260" stroke="#9aa7b8" stroke-width=".8"/>

        ${cota(40, 278, 220, 278, "b")}
        <line x1="40" y1="140" x2="40" y2="278" stroke="#9aa7b8" stroke-width=".8"/>
        <line x1="220" y1="140" x2="220" y2="278" stroke="#9aa7b8" stroke-width=".8"/>

        <g transform="translate(130,140)">
          <line x1="-70" y1="0" x2="70" y2="0" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
          <text x="0" y="-8" text-anchor="middle" class="rot-peq">c</text>
        </g>

        <g transform="translate(238,110)">
          <line x1="0" y1="-20" x2="0" y2="20" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
          <text x="8" y="4" text-anchor="start" class="rot-peq">d</text>
        </g>
      </g>
      ${legenda(W, H - 30, [
        "a comprimento total · b largura total",
        "c garganta, onde o cabo assenta · e, f — ver a ficha",
        "posições aproximadas — conferir com o catálogo"
      ])}
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
   * O contorno é: base reta → lado direito vertical → arco do topo → chanfro até o canto
   * esquerdo. É o perfil do desenho de referência, e muda junto com os números.
   */
  function olhal(geom) {
    const base = Math.max(Number(geom.base) || 0, 1);
    const h = Math.max(Number(geom.h) || 0, 1);
    const R = Math.max(Number(geom.R) || 0, 1);
    const d = Math.max(Number(geom.dFuro) || 0, 0);
    const t = Math.max(Number(geom.t) || 0, 0);
    const tAnel = Math.max(Number(geom.tAnel) || 0, 0);
    const rAnel = Math.max(Number(geom.rAnel) || 0, 0);

    // centro do furo: encostado no lado direito pelo raio do topo
    const xc = Math.max(base - R, R * 0.15);
    const topo = h + R;                          // ponto mais alto da peça
    const xEsq = Math.max(xc - R, 0);            // onde o arco encontra o chanfro

    // escala: a peça ocupa uma área fixa de desenho e as cotas ficam em volta
    const AL = 240;                              // altura útil do perfil no desenho
    const k = AL / Math.max(topo, 1);
    const LA = base * k;
    const esq = 96, dir = 150, cima = 44, baixo = 78;   // espaço das cotas em volta
    const W = Math.round(LA + esq + dir), H = Math.round(AL + cima + baixo);
    const X = v => esq + v * k;                  // mm → desenho
    const Y = v => cima + (topo - v) * k;        // y para cima

    const contorno = `M${X(0)},${Y(0)} L${X(base)},${Y(0)} L${X(base)},${Y(h)} `
      + `A${R * k},${R * k} 0 0 0 ${X(xEsq)},${Y(h)} Z`;

    const cotaV = (x, y1, y2, txt) => `<g class="cota">
      <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${x + 7}" y="${(y1 + y2) / 2 + 4}" text-anchor="start">${txt}</text></g>`;
    const cotaH = (y, x1, x2, txt) => `<g class="cota">
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="dim" marker-start="url(#fseta)" marker-end="url(#fseta)"/>
      <text x="${(x1 + x2) / 2}" y="${y - 6}" text-anchor="middle">${txt}</text></g>`;
    const cham = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ext"/>`;
    const mm = v => `${IC.fmt.num(v, v < 10 ? 1 : 0)}`;

    const xFuro = X(xc), yFuro = Y(h), rFuro = d / 2 * k;

    // vista de topo, à direita: a espessura da chapa e o reforço, se houver
    const espTotal = t + 2 * tAnel;
    const kT = Math.min(3.2, 46 / Math.max(espTotal, 1));
    const xT = W - dir + 74, yT = Y(h);
    const larguraAnel = Math.min(rAnel * 2 * k, AL * 0.55) || 0;
    const vistaTopo = `<g class="vista-topo">
      <rect x="${xT - t * kT / 2}" y="${yT - AL * 0.3}" width="${t * kT}" height="${AL * 0.6}" class="corpo"/>
      ${tAnel > 0 ? `
        <rect x="${xT - t * kT / 2 - tAnel * kT}" y="${yT - larguraAnel / 2}" width="${tAnel * kT}" height="${larguraAnel}" class="peca" style="fill:#c3cee1"/>
        <rect x="${xT + t * kT / 2}" y="${yT - larguraAnel / 2}" width="${tAnel * kT}" height="${larguraAnel}" class="peca" style="fill:#c3cee1"/>` : ""}
      <text x="${xT}" y="${cima + AL + 44}" class="rot-peq" text-anchor="middle">vista de topo</text>
      ${cotaH(yT + AL * 0.3 + 20, xT - espTotal * kT / 2, xT + espTotal * kT / 2,
              tAnel > 0 ? `t + 2·t.anel = ${mm(espTotal)}` : `t = ${mm(t)} mm`)}
    </g>`;

    return `${cabeca(W, H)}
      <text x="${W / 2}" y="16" class="titulo" text-anchor="middle">OLHAL (PADEYE) — VISTA DE FABRICAÇÃO</text>

      <path d="${contorno}" class="corpo"/>
      <circle cx="${xFuro}" cy="${yFuro}" r="${rFuro}" style="fill:#f7f9fc" stroke="#16233f" stroke-width="1.2"/>
      ${tAnel > 0 && rAnel > d / 2 ? `<circle cx="${xFuro}" cy="${yFuro}" r="${rAnel * k}" style="fill:none" stroke="#7d90a8" stroke-width="1" stroke-dasharray="4 3"/>` : ""}
      <line x1="${xFuro - rFuro - 10}" y1="${yFuro}" x2="${xFuro + rFuro + 10}" y2="${yFuro}" class="eixo"/>
      <line x1="${xFuro}" y1="${yFuro - rFuro - 10}" x2="${xFuro}" y2="${yFuro + rFuro + 10}" class="eixo"/>

      ${cham(X(0), Y(0), X(0), Y(0) + 46)}
      ${cham(X(base), Y(0), X(base), Y(0) + 46)}
      ${cotaH(Y(0) + 38, X(0), X(base), `base = ${mm(base)} mm`)}

      ${cham(X(base), Y(h), X(base) + 56, Y(h))}
      ${cham(X(base), Y(0), X(base) + 56, Y(0))}
      ${cotaV(X(base) + 44, Y(0), Y(h), `h = ${mm(h)} mm`)}

      <g class="cota">
        <line x1="${xFuro + R * k * 0.71}" y1="${yFuro - R * k * 0.71}" x2="${xFuro + R * k * 0.71 + 30}" y2="${yFuro - R * k * 0.71 - 26}" class="ext"/>
        <text x="${xFuro + R * k * 0.71 + 34}" y="${yFuro - R * k * 0.71 - 28}" text-anchor="start">R = ${mm(R)} mm</text>
      </g>
      <g class="cota">
        <line x1="${xFuro - rFuro * 0.7}" y1="${yFuro - rFuro * 0.7}" x2="${xFuro - rFuro - 44}" y2="${yFuro - rFuro - 34}" class="ext"/>
        <text x="${xFuro - rFuro - 46}" y="${yFuro - rFuro - 36}" text-anchor="end">Ø furo = ${mm(d)} mm</text>
      </g>

      ${vistaTopo}
      <text x="${W / 2}" y="${H - 8}" class="rot-peq" text-anchor="middle">o desenho acompanha as medidas — um olhal igual para todos os pontos</text>
    </svg>`;
  }

  /* ---------------------------------------------------------- encaixe sapatilho × manilha */
  /**
   * Um quadro por caso da verificação de encaixe. Cada caso compara duas medidas: a peça que
   * precisa passar e o vão disponível. Aqui elas aparecem desenhadas na mesma escala, uma
   * sobre a outra, com a folga que sobra — é o que a tabela diz em números.
   *
   * `casos` é o que a verificação devolve: {n, nome, criterio, valor, limite, ok}.
   */
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

  function encaixe(casos) {
    if (!casos || !casos.length) return "";
    const LARG = 176, ALT = 146, COL = 4;
    const n = casos.length;
    const cols = Math.min(COL, n), linhas = Math.ceil(n / cols);
    const W = cols * LARG, H = linhas * ALT + 34;
    const mm = x => IC.fmt.num(x, x < 10 ? 1 : 0);

    const quadro = (c, idx) => {
      const cx = (idx % cols) * LARG + LARG / 2;
      const cy = Math.floor(idx / cols) * ALT + 72;
      // as duas medidas na mesma escala: a maior ocupa a largura útil
      const maior = Math.max(Number(c.valor) || 0, Number(c.limite) || 0, 1);
      const k = (LARG - 54) / maior;
      const wDisp = (Number(c.valor) || 0) * k;     // o que existe (o vão)
      const wPeca = (Number(c.limite) || 0) * k;    // o que precisa passar
      const folga = (Number(c.valor) || 0) - (Number(c.limite) || 0);
      const cor = c.ok ? "#2fa36b" : "#e2604e";
      return `<g>
        ${quebrar(c.rotulo || ("caso " + c.n), 22).map((t, li) =>
          `<text x="${cx}" y="${cy - 44 + li * 12}" class="rot-peq" text-anchor="middle">${IC.fmt.esc(t)}</text>`).join("")}
        <rect x="${cx - wDisp / 2}" y="${cy - 14}" width="${wDisp}" height="28" rx="3"
              style="fill:#dfe7f1" stroke="${cor}" stroke-width="1.6"/>
        <rect x="${cx - wPeca / 2}" y="${cy - 8}" width="${wPeca}" height="16" rx="2"
              style="fill:#17507e" stroke="none"/>
        <text x="${cx}" y="${cy + 30}" class="rot-peq" text-anchor="middle">${mm(c.valor)} / ${mm(c.limite)} mm</text>
        <text x="${cx}" y="${cy + 44}" class="rot-peq" text-anchor="middle" style="fill:${cor};font-weight:700">
          ${c.ok ? `folga ${mm(folga)} mm` : `falta ${mm(-folga)} mm`}</text>
      </g>`;
    };

    return `${cabeca(W, H)}
      <text x="${W / 2}" y="14" class="titulo" text-anchor="middle">ENCAIXE — O QUE PASSA POR ONDE</text>
      ${casos.map(quadro).join("")}
      <text x="${W / 2}" y="${H - 4}" class="rot-peq" text-anchor="middle">claro: o vão disponível · escuro: a peça que precisa passar</text>
    </svg>`;
  }

  return { icone, medidas, manilha, sapatilho, olhal, encaixe };
})();
