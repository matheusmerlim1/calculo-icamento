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
 * Duas pernas é determinado. Quatro pernas é hiperestático (4 incógnitas, 3 equações) e
 * tem duas hipóteses — as duas são calculadas sempre, a escolhida governa o projeto:
 *   "elastica"   corpo rígido sobre quatro molas: compatibilidade de deslocamentos com a
 *                rigidez vertical de cada perna k = EA·cos²β/L, e depois × SKL (1,25 na
 *                DNV-ST-N001) para cobrir a tolerância de comprimento das lingas.
 *                É o modelo da norma — recomendado.
 *   "diagonais"  envoltória: um par diagonal sustenta a carga inteira e o outro fica frouxo.
 *                Já é o pior caso estático possível, por isso NÃO leva SKL por cima
 *                (SKL sobre 100 % daria 125 % do peso num par, fisicamente impossível).
 */
window.IC = window.IC || {};

IC.cargas = (function () {
  const G_ACEL = 9.80665;                       // m/s²

  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vnorm = a => Math.hypot(a[0], a[1], a[2]);

  /**
   * Parcela vertical de cada ponto pelo equilíbrio 3D do corpo.
   *
   * Todas as pernas concorrem no gancho G = (0,0,H), então com qi = Ti/Li ("densidade de
   * força") as seis equações de equilíbrio se reduzem a três:
   *   Σ qi·(H − zi) = W ;  Σ qi·xi = 0 ;  Σ qi·yi = 0
   * e Vi = qi·(H − zi). Em termos de Vi:  Σ Vi = W ; Σ Vi·xi/(H−zi) = 0 ; Σ Vi·yi/(H−zi) = 0.
   * (Σ Vi·xi = 0 só vale com todos os pontos na mesma cota — o momento das componentes
   * horizontais, aplicadas fora da cota do CG, entra aqui.)
   *
   * Com quatro pontos sobra uma incógnita: entra a compatibilidade pelo teorema de Menabrea,
   * mínimo de Σ Vi²/ki = Σ Ti²·Li/EA com ki = cos²β/L (energia complementar das lingas).
   * Perna que sai comprimida fica frouxa: é retirada e o sistema resolvido de novo (com três
   * pernas ele é determinado). `frouxas` recebe o índice das que saíram.
   */
  function verticais(pontos, W, rigidez, H, frouxas) {
    const n = pontos.length;
    if (n === 1) return [W];
    if (n === 2) return doisPontos(pontos, W, H);

    const k = (rigidez || pontos.map(() => 1)).slice();
    const h = pontos.map(p => (H == null ? 1 : Math.max(H - p[2], 1e-6)));
    const A = [pontos.map(() => 1), pontos.map((p, i) => p[0] / h[i]), pontos.map((p, i) => p[1] / h[i])];
    const b = [W, 0, 0];
    for (let volta = 0; volta < n; volta++) {
      // mínimos quadrados com restrições: V = k·Aᵀ·λ, resolvendo (A·k·Aᵀ)·λ = b
      const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          for (let i = 0; i < n; i++) M[r][c] += A[r][i] * k[i] * A[c][i];
      const lam = resolve3(M, b);
      if (!lam) return pontos.map(() => W / n);
      const V = pontos.map((_, i) => k[i] * (lam[0] * A[0][i] + lam[1] * A[1][i] + lam[2] * A[2][i]));
      // a mais comprimida afrouxa primeiro
      let pior = -1;
      V.forEach((v, i) => { if (k[i] > 0 && v < -1e-9 && (pior < 0 || v < V[pior])) pior = i; });
      if (pior < 0) return V;
      k[pior] = 0;
      if (frouxas) frouxas.push(pior);
    }
    return pontos.map(() => W / n);
  }

  /** dois pontos: o corpo gira até o CG ficar na linha dos pontos (em planta) */
  function doisPontos(pontos, W, H) {
    const [A, B] = pontos;
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) return [W / 2, W / 2];
    // parâmetro t da projeção do CG (origem) sobre a linha AB: (1−t)·A + t·B = CG
    const t = (-A[0] * dx - A[1] * dy) / L2;
    const tc = Math.max(0, Math.min(1, t));
    // qA·A + qB·B = 0 em planta -> qA ∝ (1−t), qB ∝ t ; Vi = qi·(H − zi)
    const hA = H == null ? 1 : Math.max(H - A[2], 1e-6), hB = H == null ? 1 : Math.max(H - B[2], 1e-6);
    const c = W / ((1 - tc) * hA + tc * hB);
    return [c * (1 - tc) * hA, c * tc * hB];
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

    // --- trações a partir das parcelas verticais V (já com o fator de desbalanceamento f)
    const pernasDe = (V, f) => P.map((p, i) => {
      const g = geo[i];
      const Vi = Math.max(V[i], 0) * f;
      const T = g.cos > 1e-6 ? Vi / g.cos : Vi;
      return {
        nome: (dados.pontos[i] || {}).nome || `Perna ${i + 1}`,
        ponto: p, comprimento: g.L, angulo: g.beta,
        vertical: Vi, tracao: T, horizontal: T * Math.sin(g.beta * Math.PI / 180),
        toneladas: T / G_ACEL
      };
    });
    const maiorT = pp => Math.max(...pp.map(p => p.tracao));

    // --- distribuição vertical
    let pernas, hipotese = "determinado", detalhe = "", sklUsado = 1, comparacao = null;
    if (n <= 2) {
      pernas = pernasDe(verticais(P, Wproj, null, H), 1);
      if (n === 2) {
        const d = desvioDaLinha(P[0], P[1]);
        if (d > 1) avisos.push(`O centro de massa está ${d.toFixed(0)} mm fora da linha entre os dois pontos — o corpo vai inclinar até alinhar.`);
        const t = parametroNaLinha(P[0], P[1]);
        if (t < 0 || t > 1) avisos.push("O centro de massa está fora do trecho entre os dois pontos — assim o corpo não se equilibra: reposicione os pontos de içamento.");
      }
    } else {
      // (1) elástica: corpo rígido sobre molas, rigidez vertical k = EA·cos²β/L (EA igual nas pernas)
      const kVert = geo.map(g => g.cos * g.cos / Math.max(g.L, 1));
      const frouxas = [];
      const pElast = pernasDe(verticais(P, Wproj, kVert, H, frouxas), skl);

      // (2) pares diagonais: cada par (1,3) e (2,4) sustenta sozinho a carga inteira, sem SKL
      const Vd = new Array(n).fill(0);
      const pares = n === 4 ? [[0, 2], [1, 3]] : [[0, 1]];
      for (const [a, b] of pares) {
        const Vp = doisPontos([P[a], P[b]], Wproj, H);
        Vd[a] = Math.max(Vd[a], Vp[0]);
        Vd[b] = Math.max(Vd[b], Vp[1]);
      }
      const pDiag = pernasDe(Vd, 1);

      comparacao = {
        elastica: { maiorTracaoKN: maiorT(pElast), skl },
        diagonais: { maiorTracaoKN: maiorT(pDiag), skl: 1 }
      };

      if (dados.hipotese4 === "diagonais") {
        hipotese = "pares diagonais";
        detalhe = "um par diagonal sustenta a carga inteira (envoltória conservadora, sem SKL)";
        pernas = pDiag;
        if (n === 4) {
          const d1 = desvioDaLinha(P[0], P[2]), d2 = desvioDaLinha(P[1], P[3]);
          if (Math.min(d1, d2) > 1)
            avisos.push("O centro de massa não está sobre nenhuma das diagonais — um par sozinho não equilibra o corpo; prefira a hipótese elástica × SKL.");
        }
      } else {
        hipotese = "elástica × SKL";
        detalhe = `corpo rígido sobre molas (k = EA·cos²β/L) × SKL ${skl.toFixed(2)}`;
        pernas = pElast;
        sklUsado = skl;
        frouxas.forEach(i => avisos.push(`${pernas[i].nome}: pelo equilíbrio esta perna ficaria comprimida — ela fica frouxa e as outras três sustentam o corpo.`));
      }
    }

    // a carga real no gancho é o peso de projeto; a soma das verticais de projeto é maior
    // porque o SKL (ou a hipótese de pares diagonais) conta mais carga do que o peso
    const somaV = pernas.reduce((a, x) => a + x.vertical, 0);
    return {
      pesoKN: W, pesoProjKN: Wproj, gancho: Gk,
      fatores: { peso: gamaPeso, daf, consequencia: gamaCons, skl: sklUsado },
      hipotese, detalhe, pernas, avisos, comparacao,
      cargaGanchoKN: Wproj,
      somaVerticaisProjKN: somaV,
      maiorTracaoKN: maiorT(pernas),
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
