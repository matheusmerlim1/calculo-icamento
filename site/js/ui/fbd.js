/*
 * Desenhos do içamento, em SVG:
 *
 *   planta()    vista de cima com as distâncias do centro de massa até cada ponto (x e y)
 *   elevacao()  vista lateral com o gancho, as pernas, a altura H, os ângulos e as trações
 *
 * Tudo é desenhado em milímetros e depois ajustado ao quadro, para as cotas saírem legíveis
 * em qualquer tamanho de corpo.
 */
window.IC = window.IC || {};

IC.fbd = (function () {
  const F = IC.fmt;

  /** cria o contexto de desenho: converte mm -> px e guarda os elementos */
  function quadro(W, H, pad = 70) {
    const itens = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const pontos = [];
    return {
      W, H, pad, itens, pontos,
      ver(p) { pontos.push(p); },
      ajustar() {
        pontos.forEach(([x, y]) => {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        });
        if (!pontos.length) { x0 = y0 = -1000; x1 = y1 = 1000; }
        if (x1 - x0 < 1) { x0 -= 500; x1 += 500; }
        if (y1 - y0 < 1) { y0 -= 500; y1 += 500; }
        const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
        const ox = (W - (x1 + x0) * s) / 2, oy = (H + (y1 + y0) * s) / 2;
        this.s = s;
        this.X = x => ox + x * s;
        this.Y = y => oy - y * s;
      },
      svg() {
        return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="dw">${itens.join("")}</svg>`;
      }
    };
  }

  const n = v => Math.round(v * 10) / 10;

  /* ---------------------------------------------------------- primitivas (já em px) */
  const linha = (q, a, b, cls = "peca") => q.itens.push(`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" class="${cls}"/>`);
  const poli = (q, pts, cls = "peca") => q.itens.push(`<polygon points="${pts.map(p => `${n(p[0])},${n(p[1])}`).join(" ")}" class="${cls}"/>`);
  const circ = (q, c, r, cls = "peca") => q.itens.push(`<circle cx="${n(c[0])}" cy="${n(c[1])}" r="${n(r)}" class="${cls}"/>`);
  const txt = (q, p, s, cls = "rot", anc = "middle") => q.itens.push(`<text x="${n(p[0])}" y="${n(p[1])}" class="${cls}" text-anchor="${anc}">${F.esc(s)}</text>`);

  /** cota horizontal entre dois x, na altura y (px) */
  function cotaH(q, xa, xb, y, texto, lado = -1) {
    const yy = y + lado * 16;
    q.itens.push(`<g class="cota"><line x1="${n(xa)}" y1="${n(y)}" x2="${n(xa)}" y2="${n(yy)}" class="ext"/>
      <line x1="${n(xb)}" y1="${n(y)}" x2="${n(xb)}" y2="${n(yy)}" class="ext"/>
      <line x1="${n(xa)}" y1="${n(yy)}" x2="${n(xb)}" y2="${n(yy)}" class="dim" marker-start="url(#seta)" marker-end="url(#seta)"/>
      <text x="${n((xa + xb) / 2)}" y="${n(yy - 4)}" text-anchor="middle">${F.esc(texto)}</text></g>`);
  }

  /** cota vertical entre dois y, na abscissa x (px) */
  function cotaV(q, ya, yb, x, texto, lado = 1) {
    const xx = x + lado * 18;
    q.itens.push(`<g class="cota"><line x1="${n(x)}" y1="${n(ya)}" x2="${n(xx)}" y2="${n(ya)}" class="ext"/>
      <line x1="${n(x)}" y1="${n(yb)}" x2="${n(xx)}" y2="${n(yb)}" class="ext"/>
      <line x1="${n(xx)}" y1="${n(ya)}" x2="${n(xx)}" y2="${n(yb)}" class="dim" marker-start="url(#seta)" marker-end="url(#seta)"/>
      <text transform="translate(${n(xx + lado * 4)},${n((ya + yb) / 2)}) rotate(-90)" text-anchor="middle">${F.esc(texto)}</text></g>`);
  }

  const DEFS = `<defs><marker id="seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,1 L9,5 L0,9 z" class="seta"/></marker></defs>`;

  /* ---------------------------------------------------------- planta */
  function planta(res, larg = 520, alt = 380) {
    const q = quadro(larg, alt, 78);
    const P = res.pernas.map(p => p.ponto);
    P.forEach(p => q.ver([p[0], p[1]]));
    q.ver([0, 0]);
    q.ajustar();
    q.itens.push(DEFS);

    // contorno ligando os pontos (ajuda a ler o arranjo)
    if (P.length >= 2) {
      const ordem = P.length === 4 ? [0, 1, 2, 3] : [0, 1];
      const pts = ordem.map(i => [q.X(P[i][0]), q.Y(P[i][1])]);
      if (P.length === 4) poli(q, pts, "corpo");
      else linha(q, pts[0], pts[1], "corpo");
    }

    // centro de massa
    const cg = [q.X(0), q.Y(0)];
    circ(q, cg, 7, "cg");
    linha(q, [cg[0] - 12, cg[1]], [cg[0] + 12, cg[1]], "eixo");
    linha(q, [cg[0], cg[1] - 12], [cg[0], cg[1] + 12], "eixo");
    txt(q, [cg[0] + 14, cg[1] + 16], "CG", "rot", "start");

    // pontos
    res.pernas.forEach(p => {
      const c = [q.X(p.ponto[0]), q.Y(p.ponto[1])];
      circ(q, c, 6, "ponto");
      txt(q, [c[0], c[1] - 12], p.nome, "rot");
    });

    // cotas: uma por valor distinto de x e de y, empilhadas fora do corpo
    const distintos = eixo => {
      const vistos = [];
      P.forEach(p => {
        const v = Math.round(p[eixo]);
        if (Math.abs(v) > 1 && !vistos.some(u => Math.abs(u - v) < 1)) vistos.push(v);
      });
      return vistos.sort((a, b) => Math.abs(a) - Math.abs(b));
    };
    const yBase = Math.max(...P.map(p => q.Y(p[1])), cg[1]);
    distintos(0).forEach((x, i) => cotaH(q, cg[0], q.X(x), yBase + 22 + i * 20, `x ${F.num(Math.abs(x), 0)}`, +1));
    const xBase = Math.max(...P.map(p => q.X(p[0])), cg[0]);
    distintos(1).forEach((y, i) => cotaV(q, cg[1], q.Y(y), xBase + 22 + i * 24, `y ${F.num(Math.abs(y), 0)}`, +1));

    txt(q, [larg / 2, 20], "PLANTA — distâncias do centro de massa", "titulo");
    return q.svg();
  }

  /* ---------------------------------------------------------- elevação / corpo livre */
  function elevacao(res, larg = 560, alt = 420) {
    const q = quadro(larg, alt, 84);
    const Gk = res.gancho;
    // projeta cada ponto na distância radial (√(x²+y²)) com o sinal do x, para ver a abertura
    const proj = res.pernas.map(p => {
      const r = Math.hypot(p.ponto[0], p.ponto[1]);
      const sg = p.ponto[0] !== 0 ? Math.sign(p.ponto[0]) : (p.ponto[1] >= 0 ? 1 : -1);
      return [sg * r, p.ponto[2]];
    });
    proj.forEach(p => q.ver(p));
    q.ver([0, Gk[2]]);
    q.ver([0, 0]);
    q.ajustar();
    q.itens.push(DEFS);

    const g = [q.X(0), q.Y(Gk[2])];
    const cg = [q.X(0), q.Y(0)];

    // gancho
    q.itens.push(`<path d="M${n(g[0])},${n(g[1] - 26)} v14 M${n(g[0] - 9)},${n(g[1] - 4)} a9,9 0 1,0 18,0 a9,9 0 0,1 -9,9" class="gancho"/>`);
    txt(q, [g[0] + 14, g[1] - 10], `gancho · ${F.kn(res.cargaGanchoKN)}`, "rot", "start");

    // corpo (retângulo simplificado ligando os pontos extremos)
    const xs = proj.map(p => p[0]), zs = proj.map(p => p[1]);
    const bx0 = q.X(Math.min(...xs)), bx1 = q.X(Math.max(...xs));
    const bz = q.Y(Math.min(...zs));
    const h = Math.max(24, Math.abs(q.Y(Math.min(...zs)) - q.Y(Math.max(...zs))) + 24);
    q.itens.push(`<rect x="${n(bx0)}" y="${n(bz - h / 2)}" width="${n(bx1 - bx0)}" height="${n(h)}" class="corpo"/>`);

    // pernas com tração e ângulo
    res.pernas.forEach((p, i) => {
      const a = [q.X(proj[i][0]), q.Y(proj[i][1])];
      linha(q, a, g, "perna");
      circ(q, a, 5, "ponto");
      const m = [(a[0] + g[0]) / 2, (a[1] + g[1]) / 2];
      txt(q, [m[0] + (proj[i][0] < 0 ? -8 : 8), m[1]], `${F.kn(p.tracao)}`, "forca", proj[i][0] < 0 ? "end" : "start");
      txt(q, [m[0] + (proj[i][0] < 0 ? -8 : 8), m[1] + 13], `${F.grau(p.angulo)} · ${F.mm(p.comprimento)}`, "rot-peq", proj[i][0] < 0 ? "end" : "start");
    });

    // centro de massa e peso
    circ(q, cg, 7, "cg");
    linha(q, cg, [cg[0], cg[1] + 46], "forca-linha");
    q.itens.push(`<path d="M${n(cg[0] - 6)},${n(cg[1] + 40)} L${n(cg[0])},${n(cg[1] + 52)} L${n(cg[0] + 6)},${n(cg[1] + 40)} z" class="seta-cheia"/>`);
    txt(q, [cg[0] + 10, cg[1] + 52], `W ${F.kn(res.pesoProjKN)}`, "forca", "start");
    txt(q, [cg[0] - 10, cg[1] - 10], "CG", "rot", "end");

    // altura do gancho
    cotaV(q, g[1], cg[1], Math.max(bx1, g[0]) + 30, `H ${F.mm(Gk[2])}`, +1);

    txt(q, [larg / 2, 20], "DIAGRAMA DE CORPO LIVRE", "titulo");
    return q.svg();
  }

  return { planta, elevacao };
})();
