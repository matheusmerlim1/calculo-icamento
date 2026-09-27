/*
 * Diagrama de corpo livre e carga em cada perna.
 *
 * Sistema de coordenadas: origem no centro de massa, z para cima, medidas em mm.
 * O gancho fica na vertical do centro de massa, na altura H — é a posição de equilíbrio
 * de um corpo suspenso livre.
 *
 * Para cada perna i:
 *   Li  = |G − Pi|                    comprimento da perna
 *   βi  = ângulo com a vertical       cos βi = (H − zi) / Li
 *   Vi  = parcela vertical            do equilíbrio de momentos em planta
 *   Ti  = Vi / cos βi                 tração na perna
 *   Hi  = Ti · sen βi                 componente horizontal (entra na verificação do olhal)
 *
 * Duas pernas é determinado. Quatro pernas é hiperestático e tem duas hipóteses:
 *   "diagonais"  dois cabos opostos sustentam tudo (hipótese usual de projeto offshore)
 *   "elastica"   reparte pelas quatro conforme a rigidez (1/L), só para comparação
 */
window.IC = window.IC || {};

IC.cargas = (function () {
  const G_ACEL = 9.80665;                       // m/s²

  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vnorm = a => Math.hypot(a[0], a[1], a[2]);

  /**
   * Parcela vertical de cada ponto pelo equilíbrio de momentos em planta:
   *   Σ Vi = W ; Σ Vi·xi = 0 ; Σ Vi·yi = 0
   * Com dois pontos o sistema é determinado (o corpo gira até o CG ficar na linha dos pontos).
   * Com mais pontos há infinitas soluções: escolhe-se a de menor energia, ponderada pela
   * rigidez ki de cada perna (mínimos quadrados com peso 1/ki).
   */
  function verticais(pontos, W, rigidez) {
    const n = pontos.length;
    if (n === 1) return [W];
    if (n === 2) return doisPontos(pontos, W);

    // mínimos quadrados com restrições: V = k·Aᵀ·λ, resolvendo (A·k·Aᵀ)·λ = b
    const k = rigidez || pontos.map(() => 1);
    const A = [pontos.map(() => 1), pontos.map(p => p[0]), pontos.map(p => p[1])];
    const b = [W, 0, 0];
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        for (let i = 0; i < n; i++) M[r][c] += A[r][i] * k[i] * A[c][i];
    const lam = resolve3(M, b);
    if (!lam) return pontos.map(() => W / n);
    return pontos.map((_, i) => k[i] * (lam[0] * A[0][i] + lam[1] * A[1][i] + lam[2] * A[2][i]));
  }

  /** dois pontos: o CG se posiciona sobre a linha que os une */
  function doisPontos(pontos, W) {
    const [A, B] = pontos;
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) return [W / 2, W / 2];
    // parâmetro t da projeção do CG (origem) sobre a linha AB
    const t = (-A[0] * dx - A[1] * dy) / L2;
    const tc = Math.max(0, Math.min(1, t));
    return [W * (1 - tc), W * tc];
  }

  /** sistema 3×3 por eliminação de Gauss */
  function resolve3(M, b) {
    const a = M.map((l, i) => [...l, b[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      if (Math.abs(a[p][c]) < 1e-12) return null;
      [a[c], a[p]] = [a[p], a[c]];
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const f = a[r][c] / a[c][c];
        for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
      }
    }
    return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
  }

  /** posição do CG ao longo da linha AB (0 = em A, 1 = em B); fora de [0,1] o corpo não equilibra */
  function parametroNaLinha(A, B) {
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) return 0.5;
    return (-A[0] * dx - A[1] * dy) / L2;
  }

  /** distância do CG à linha que une dois pontos, em planta (mm) */
  function desvioDaLinha(A, B) {
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) return Math.hypot(A[0], A[1]);
    return Math.abs(dx * (0 - A[1]) - dy * (0 - A[0])) / L;   // ponto (0,0) = CG
  }

  /**
   * Resolve um içamento.
   *
   * dados = {
   *   massa: kg, alturaGancho: mm,
   *   pontos: [{x, y, z, nome}],
   *   hipotese4: "diagonais" | "elastica",
   *   fatores: { peso, daf, consequencia, skl, anguloMax }
   * }
   */
  function resolver(dados) {
    const f = dados.fatores || {};
    const gamaPeso = f.peso || 1, daf = f.daf || 1, gamaCons = f.consequencia || 1, skl = f.skl || 1;
    const P = dados.pontos.map(p => [Number(p.x) || 0, Number(p.y) || 0, Number(p.z) || 0]);
    const n = P.length;
    const H = Number(dados.alturaGancho) || 0;
    const Gk = [0, 0, H];

    const W = (Number(dados.massa) || 0) * G_ACEL / 1000;         // kN
    const Wproj = W * gamaPeso * daf * gamaCons;                  // kN de projeto

    const avisos = [];
    const geo = P.map((p, i) => {
      const v = vsub(Gk, p);
      const L = vnorm(v);
      const cos = L > 1e-6 ? v[2] / L : 1;
      const beta = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
      if (v[2] <= 0) avisos.push(`Perna ${i + 1}: o gancho precisa ficar acima do ponto de içamento.`);
      return { L, cos, beta, dir: v.map(c => c / (L || 1)) };
    });

    const maxAng = f.anguloMax || 60;
    geo.forEach((g, i) => {
      if (g.beta > maxAng) avisos.push(`Perna ${i + 1}: ângulo de ${g.beta.toFixed(1)}° com a vertical passa do limite de ${maxAng}°.`);
    });

    // --- distribuição vertical
    let V, hipotese = "determinado", detalhe = "";
    if (n <= 2) {
      V = verticais(P, Wproj);
      if (n === 2) {
        const d = desvioDaLinha(P[0], P[1]);
        if (d > 1) avisos.push(`O centro de massa está ${d.toFixed(0)} mm fora da linha entre os dois pontos — o corpo vai inclinar até alinhar.`);
        const t = parametroNaLinha(P[0], P[1]);
        if (t < 0 || t > 1) avisos.push("O centro de massa está fora do trecho entre os dois pontos — assim o corpo não se equilibra: reposicione os pontos de içamento.");
      }
    } else if (dados.hipotese4 === "elastica") {
      hipotese = "elástica";
      detalhe = "carga repartida pelas quatro pernas conforme a rigidez (1/L)";
      V = verticais(P, Wproj, geo.map(g => 1 / Math.max(g.L, 1)));
    } else {
      hipotese = "pares diagonais";
      detalhe = "duas pernas opostas sustentam toda a carga — hipótese de projeto";
      V = new Array(n).fill(0);
      // pares opostos: (1,3) e (2,4) na ordem dada
      const pares = n === 4 ? [[0, 2], [1, 3]] : [[0, 1]];
      for (const [a, b] of pares) {
        const Vp = doisPontos([P[a], P[b]], Wproj);
        V[a] = Math.max(V[a], Vp[0]);
        V[b] = Math.max(V[b], Vp[1]);
      }
      if (n === 4) {
        const d1 = desvioDaLinha(P[0], P[2]), d2 = desvioDaLinha(P[1], P[3]);
        if (Math.min(d1, d2) > 1)
          avisos.push("O centro de massa não está sobre nenhuma das diagonais — confira as coordenadas dos pontos.");
      }
    }

    // --- trações
    const pernas = P.map((p, i) => {
      const g = geo[i];
      const Vi = Math.max(V[i], 0) * (n > 2 ? skl : 1);
      const T = g.cos > 1e-6 ? Vi / g.cos : Vi;
      return {
        nome: (dados.pontos[i] || {}).nome || `Perna ${i + 1}`,
        ponto: p, comprimento: g.L, angulo: g.beta,
        vertical: Vi, tracao: T, horizontal: T * Math.sin(g.beta * Math.PI / 180),
        toneladas: T / G_ACEL
      };
    });

    // a carga real no gancho é o peso de projeto; a soma das verticais de projeto é maior
    // quando se adota a hipótese de pares diagonais, porque a carga é contada nos dois pares
    const somaV = pernas.reduce((a, x) => a + x.vertical, 0);
    return {
      pesoKN: W, pesoProjKN: Wproj, gancho: Gk,
      fatores: { peso: gamaPeso, daf, consequencia: gamaCons, skl },
      hipotese, detalhe, pernas, avisos,
      cargaGanchoKN: Wproj,
      somaVerticaisProjKN: somaV,
      maiorTracaoKN: Math.max(...pernas.map(p => p.tracao)),
      maiorTracaoT: Math.max(...pernas.map(p => p.toneladas))
    };
  }

  /** pontos de um arranjo simétrico: retângulo a×b centrado no CG, na cota z */
  function retangulo(a, b, z) {
    const x = a / 2, y = b / 2;
    return [
      { nome: "P1", x: +x, y: +y, z }, { nome: "P2", x: -x, y: +y, z },
      { nome: "P3", x: -x, y: -y, z }, { nome: "P4", x: +x, y: -y, z }
    ];
  }

  return { resolver, retangulo, verticais, desvioDaLinha, parametroNaLinha, G: G_ACEL };
})();
