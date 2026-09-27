/*
 * Vista tridimensional do içamento (projeção isométrica), que se ajusta às distâncias
 * informadas: o corpo, o centro de massa, o gancho, as pernas e os pontos de içamento.
 *
 *   IC.iso3d.desenhar(res, { modo })
 *     modo "medidas"  mostra as distâncias a, b, h e o ângulo α da perna
 *     modo "cargas"   mostra a tração de cada perna e o peso
 *
 * Eixos: X para o comprimento (leste), Y para a largura (norte), Z para cima.
 * Um triedro no canto mostra as direções. Os rótulos saem para fora do corpo, com
 * linha de chamada, para não ficarem por cima do desenho.
 */
window.IC = window.IC || {};

IC.iso3d = (function () {
  const F = IC.fmt;
  const COS30 = Math.cos(Math.PI / 6), SIN30 = 0.5;

  /** ponto 3D (mm) -> plano do desenho (mm), projeção isométrica */
  const proj = p => [(p[0] - p[1]) * COS30, -((p[0] + p[1]) * SIN30 + p[2])];

  const n = v => Math.round(v * 10) / 10;

  function desenhar(res, opts = {}) {
    const modo = opts.modo || "cargas";
    const comp = opts.comp || (mm => `${F.num(mm, 0)} mm`);
    // área de trabalho da projeção; o recorte final é a caixa do que foi desenhado, medida
    // abaixo, então estes números só definem a proporção de partida
    const W = 680, H = 440, pad = 56;

    const P = res.pernas.map(p => p.ponto);
    const Gk = res.gancho;

    // caixa do corpo, deduzida das distâncias informadas
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]), zs = P.map(p => p[2]);
    const dx = Math.max(...xs) - Math.min(...xs) || 1000;
    const dy = Math.max(...ys) - Math.min(...ys) || dx * 0.5;
    const margem = 0.08;
    const x0 = Math.min(...xs) - dx * margem, x1 = Math.max(...xs) + dx * margem;
    const y0 = Math.min(...ys) - dy * margem, y1 = Math.max(...ys) + dy * margem;
    const alturaCorpo = Math.max(dx, dy) * 0.35;
    let zTop = Math.max(...zs, 0), zBot = Math.min(zTop - alturaCorpo, 0);

    const cantos = [
      [x0, y0, zBot], [x1, y0, zBot], [x1, y1, zBot], [x0, y1, zBot],
      [x0, y0, zTop], [x1, y0, zTop], [x1, y1, zTop], [x0, y1, zTop]
    ];
    // arestas: as três que chegam no canto de trás (índice 3 em planta) ficam tracejadas
    const arestas = [
      [0, 1], [1, 2], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6],
      [2, 3, true], [3, 0, true], [3, 7, true]
    ];

    // enquadramento
    const vistos = [...cantos.map(proj), proj(Gk), ...P.map(proj)];
    const px = vistos.map(v => v[0]), py = vistos.map(v => v[1]);
    const a0 = Math.min(...px), a1 = Math.max(...px), b0 = Math.min(...py), b1 = Math.max(...py);
    const s = Math.min((W - 2 * pad) / Math.max(a1 - a0, 1), (H - 2 * pad) / Math.max(b1 - b0, 1));
    const ox = (W - (a1 + a0) * s) / 2, oy = (H - (b1 + b0) * s) / 2;
    const S = p => { const q = proj(p); return [ox + q[0] * s, oy + q[1] * s]; };

    // ------------------------------------------------- caixa do que foi desenhado
    // Cada coisa desenhada entra aqui. Para o texto, a largura é estimada pelo corpo da
    // fonte de cada classe (não dá para medir SVG antes de montar), com uma folga.
    const cx = {x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity};
    const marcar = (x, y, r = 0) => {
      if (!isFinite(x) || !isFinite(y)) return;
      cx.x0 = Math.min(cx.x0, x - r); cx.x1 = Math.max(cx.x1, x + r);
      cx.y0 = Math.min(cx.y0, y - r); cx.y1 = Math.max(cx.y1, y + r);
    };
    const CORPO = {"rot": 11, "rot-forte": 11, "rot-peq": 10, "forca": 11, "cota-t": 11, "eixo-t": 11};
    const marcarTexto = (p, t, cls, anc) => {
      const corpo = CORPO[cls] || 11;
      const larg = String(t).length * corpo * 0.56;
      const x = anc === "end" ? p[0] - larg : anc === "start" ? p[0] : p[0] - larg / 2;
      marcar(x, p[1] - corpo * 0.8); marcar(x + larg, p[1] + corpo * 0.3);
    };

    const out = [`<defs><marker id="i3seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9 z" class="seta"/></marker></defs>`];
    const linha = (a, b, cls) => {
      marcar(a[0], a[1]); marcar(b[0], b[1]);
      out.push(`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" class="${cls}"/>`);
    };
    const texto = (p, t, cls = "rot", anc = "middle") => {
      marcarTexto(p, t, cls, anc);
      out.push(`<text x="${n(p[0])}" y="${n(p[1])}" class="${cls}" text-anchor="${anc}">${F.esc(t)}</text>`);
    };

    /* --------------------------------------------------- corpo */
    const c = cantos.map(S);
    c.forEach(q => marcar(q[0], q[1]));
    // face de cima, para dar volume
    out.push(`<polygon points="${[4, 5, 6, 7].map(i => `${n(c[i][0])},${n(c[i][1])}`).join(" ")}" class="face-topo"/>`);
    out.push(`<polygon points="${[0, 1, 5, 4].map(i => `${n(c[i][0])},${n(c[i][1])}`).join(" ")}" class="face-lado"/>`);
    out.push(`<polygon points="${[1, 2, 6, 5].map(i => `${n(c[i][0])},${n(c[i][1])}`).join(" ")}" class="face-lado2"/>`);
    arestas.forEach(([i, j, oculta]) => linha(c[i], c[j], oculta ? "aresta oculta" : "aresta"));

    /* --------------------------------------------------- centro de massa e gancho */
    const cg = S([0, 0, 0]), gk = S(Gk);
    marcar(gk[0], gk[1] - 30, 9); marcar(cg[0], cg[1], 8);
    out.push(`<path d="M${n(gk[0])},${n(gk[1] - 30)} v16" class="peca"/>
      <circle cx="${n(gk[0])}" cy="${n(gk[1] - 7)}" r="8" class="gancho-i"/>`);

    // linha de prumo do gancho até o CG
    linha(gk, cg, "prumo");

    /* --------------------------------------------------- pernas */
    res.pernas.forEach((p, i) => {
      const a = S(p.ponto);
      linha(a, gk, "perna");
      out.push(`<circle cx="${n(a[0])}" cy="${n(a[1])}" r="5" class="ponto"/>`);
    });

    // CG por cima das pernas
    out.push(`<circle cx="${n(cg[0])}" cy="${n(cg[1])}" r="7" class="cg"/>`);

    /* --------------------------------------------------- rótulos, para fora do corpo */
    const centroTela = [(a0 + a1) / 2 * s + ox, (b0 + b1) / 2 * s + oy];
    res.pernas.forEach((p, i) => {
      const a = S(p.ponto);
      let ux = a[0] - centroTela[0], uy = a[1] - centroTela[1];
      const m = Math.hypot(ux, uy) || 1;
      ux /= m; uy /= m;
      const alvo = [a[0] + ux * 72, a[1] + uy * 50];
      linha(a, alvo, "chamada");
      const anc = ux < -0.25 ? "end" : ux > 0.25 ? "start" : "middle";
      const dxT = anc === "end" ? -4 : anc === "start" ? 4 : 0;
      texto([alvo[0] + dxT, alvo[1]], p.nome, "rot-forte", anc);
      texto([alvo[0] + dxT, alvo[1] + 13],
        `x ${F.num(p.ponto[0], 0)} · y ${F.num(p.ponto[1], 0)} · z ${F.num(p.ponto[2], 0)}`, "rot-peq", anc);
      if (modo === "cargas") texto([alvo[0] + dxT, alvo[1] + 26], F.kn(p.tracao), "forca", anc);
    });

    texto([cg[0] + 12, cg[1] + 16], "CG", "rot", "start");
    if (modo === "cargas") {
      texto([gk[0], gk[1] - 34], `gancho ${F.kn(res.cargaGanchoKN)}`, "rot-forte");
      // peso: desce do CG até abaixo da caixa, para a seta ficar livre do corpo
      const baseCG = S([0, 0, zBot]);
      const baixo = [baseCG[0], baseCG[1] + 42];
      linha(cg, baixo, "forca-linha");
      marcar(baixo[0], baixo[1], 7);
      out.push(`<path d="M${n(baixo[0] - 6)},${n(baixo[1] - 12)} L${n(baixo[0])},${n(baixo[1])} L${n(baixo[0] + 6)},${n(baixo[1] - 12)} z" class="seta-cheia"/>`);
      texto([baixo[0] + 10, baixo[1]], `W ${F.kn(res.pesoProjKN)}`, "forca", "start");
    } else {
      // cotas das distâncias, desenhadas FORA da caixa para não cair sobre o corpo
      const zc = Math.max(...zs);
      const pa = res.pernas[0].ponto;
      const folgaY = dy * 0.55 + 200;          // bem fora da caixa, para a cota não cair sobre o corpo
      const folgaX = dx * 0.55 + 200;

      const cotaLinha = (A, B, rotulo) => {
        const a = S(A), b = S(B);
        out.push(`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" class="cotaL"/>`);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        texto([mx, my - 12], rotulo, "cota-t");
      };
      const chamada = (A, B) => { const a = S(A), b = S(B); linha(a, b, "chamada"); };

      // a — do CG ao ponto, no comprimento (fora da caixa, do lado de y0)
      chamada([0, y0, zc], [0, y0 - folgaY, zc]);
      chamada([pa[0], y0, zc], [pa[0], y0 - folgaY, zc]);
      cotaLinha([0, y0 - folgaY, zc], [pa[0], y0 - folgaY, zc], `a ${comp(Math.abs(pa[0]))}`);

      // b — do CG ao ponto, na largura (fora da caixa, do lado de x1)
      chamada([x1, 0, zc], [x1 + folgaX, 0, zc]);
      chamada([x1, pa[1], zc], [x1 + folgaX, pa[1], zc]);
      cotaLinha([x1 + folgaX, 0, zc], [x1 + folgaX, pa[1], zc], `b ${comp(Math.abs(pa[1]))}`);

      // ângulo da perna com a estrutura, medido na perna mais à esquerda do desenho
      let iAng = 0, menor = Infinity;
      res.pernas.forEach((p, i) => { const q = S(p.ponto); if (q[0] < menor) { menor = q[0]; iAng = i; } });
      const pAng = res.pernas[iAng].ponto;
      const meio = [pAng[0] * 0.45, pAng[1] * 0.45, pAng[2]];
      const A = S(pAng), Mh = S(meio);
      linha(A, Mh, "eixo");
      const Lg = S([(pAng[0] + Gk[0]) / 2, (pAng[1] + Gk[1]) / 2, (pAng[2] + Gk[2]) / 2]);
      texto([(A[0] + Lg[0]) / 2 - 16, (A[1] + Lg[1]) / 2], `α ${F.grau(90 - res.pernas[iAng].angulo)}`, "forca", "end");
    }

    /* --------------------------------------------------- triedro dos eixos */
    // fica logo abaixo e à direita do que foi desenhado, não num canto fixo da folha
    const tx = cx.x1 + 62, ty = cx.y1 - 20;
    out.push(triedro(tx, ty));
    marcar(tx - 46, ty - 46); marcar(tx + 46, ty + 52);

    /* --------------------------------------------------- recorte final */
    const m = 8;
    const vx = cx.x0 - m, vy = cx.y0 - m;
    const vw = Math.max(cx.x1 - cx.x0 + 2 * m, 10), vh = Math.max(cx.y1 - cx.y0 + 2 * m, 10);
    return `<svg viewBox="${n(vx)} ${n(vy)} ${n(vw)} ${n(vh)}" xmlns="http://www.w3.org/2000/svg" class="dw" preserveAspectRatio="xMidYMid meet">${out.join("")}</svg>`;
  }

  /** eixos X (comprimento), Y (largura) e Z (altura), no canto do desenho */
  function triedro(x, y) {
    const L = 34;
    const ex = proj([1, 0, 0]), ey = proj([0, 1, 0]), ez = proj([0, 0, 1]);
    const seta = (v, rotulo, cls) => {
      const bx = x + v[0] * L, by = y + v[1] * L;
      return `<line x1="${x}" y1="${y}" x2="${n(bx)}" y2="${n(by)}" class="${cls}" marker-end="url(#i3seta)"/>
        <text x="${n(bx + v[0] * 12)}" y="${n(by + v[1] * 12 + 4)}" class="eixo-t" text-anchor="middle">${rotulo}</text>`;
    };
    return `<g class="triedro">
      <circle cx="${x}" cy="${y}" r="3" class="ponto"/>
      ${seta(ex, "X", "eixo-l")}${seta(ey, "Y", "eixo-l")}${seta(ez, "Z", "eixo-l")}
      <text x="${x}" y="${y + 46}" class="rot-peq" text-anchor="middle">X · Y · Z</text>
    </g>`;
  }

  return { desenhar };
})();
