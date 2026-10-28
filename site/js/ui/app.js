/*
 * Controlador da página.
 *
 * Um "estudo" guarda vários içamentos. Cada içamento tem: corpo (massa, local, base normativa),
 * tipo de arranjo, as DISTÂNCIAS do centro de massa até cada ponto de içamento, o ângulo da
 * perna com a estrutura e os fatores de projeto. A cada alteração tudo é recalculado.
 *
 * Por dentro tudo é guardado em milímetros e quilogramas; as unidades escolhidas pelo usuário
 * (mm/m e kg/t/N) valem só para mostrar e digitar.
 */
(function () {
  const F = IC.fmt, C = IC.cargas, FAT = IC.fatores, FIG = IC.figuras, RIG = IC.rigging;
  const $ = id => document.getElementById(id);
  const CHAVE = "ic-estudo";
  const G = C.G;

  /**
   * Vários campos numéricos ficam dentro de blocos que são inteiramente reescritos
   * (innerHTML) a cada tecla digitada, para recalcular tudo em tempo real — mas isso troca
   * o elemento <input> por um novo, e o campo perde o foco no meio da digitação. Esta função
   * guarda qual campo estava focado (pelo atributo `data-key`, único por campo) e o cursor,
   * roda a repintura, e devolve o foco e a posição do cursor ao campo equivalente já novo.
   */
  function comFocoPreservado(fn) {
    const ativo = document.activeElement;
    const key = ativo && ativo.dataset ? ativo.dataset.key : null;
    const id = ativo && !key ? ativo.id : null;
    const pos = ativo && ativo.selectionStart != null ? [ativo.selectionStart, ativo.selectionEnd] : null;
    fn();
    const alvo = key ? document.querySelector(`[data-key="${key}"]`) : (id ? $(id) : null);
    if (alvo && alvo.focus) {
      alvo.focus();
      if (pos && alvo.setSelectionRange) { try { alvo.setSelectionRange(pos[0], pos[1]); } catch (e) { /* tipo do campo não suporta seleção */ } }
    }
  }

  /* ------------------------------------------------------------ unidades */
  const UNID = {
    comp: { mm: { f: 1, dec: 0 }, m: { f: 1000, dec: 3 } },
    massa: { kg: { f: 1, dec: 0 }, t: { f: 1000, dec: 3 }, N: { f: 1 / G, dec: 0 } }
  };
  const uComp = () => E.unid.comp, uMassa = () => E.unid.massa;
  const compParaTela = mm => Number(mm || 0) / UNID.comp[uComp()].f;
  const compParaMm = v => Number(v || 0) * UNID.comp[uComp()].f;
  const massaParaTela = kg => Number(kg || 0) / UNID.massa[uMassa()].f;
  const massaParaKg = v => Number(v || 0) * UNID.massa[uMassa()].f;
  const decComp = () => UNID.comp[uComp()].dec;
  const passoComp = () => (uComp() === "m" ? 0.05 : 10);
  const passoMassa = () => (uMassa() === "t" ? 0.1 : uMassa() === "N" ? 100 : 10);
  const txtComp = mm => `${F.num(compParaTela(mm), decComp())} ${uComp()}`;
  // o campo mostra o valor como foi digitado — vírgula decimal e sem arredondar; as 6 casas
  // só limpam o ruído do ponto flutuante (2,5 m → 2500 mm → 2,5 m, e não 2,4999999)
  const paraCampo = v => F.num(isFinite(Number(v)) ? Number(v) : 0, 6);

  /* ---------------------------------------------------------- valor com unidade digitada
   * O campo aceita "5000", "5 t", "5t", "12,5 kN" e contas ("20 + 30"). Quando vem unidade junto, é ela que vale
   * — e não a escolhida no topo. É o jeito natural de corrigir a unidade sem ter que trocar
   * o seletor e recalcular de cabeça.
   */
  const FATOR_MASSA = {                       // para kg
    kg: 1, kgf: 1, g: 0.001, t: 1000, ton: 1000, tf: 1000,
    n: 1 / G, kn: 1000 / G
  };
  const FATOR_COMP = { mm: 1, cm: 10, m: 1000 };   // para mm

  /**
   * Conta digitada no campo: "20 + 30", "(1500 - 200) / 2", "2 x 350", "2 m + 300 mm".
   * Soma, subtração, multiplicação (*, x, ×), divisão e parênteses. Cada número pode trazer a
   * sua unidade; `conv(unid)` dá o fator para a unidade do campo (undefined = unidade que não
   * vale aqui) e o número sem unidade já está na unidade do campo. NaN se a conta não fecha.
   */
  function avaliarConta(texto, conv) {
    const t = String(texto == null ? "" : texto).trim().toLowerCase().replace(/\s+/g, "").replace(/×/g, "*");
    let i = 0;
    const falha = () => { throw new Error("conta"); };
    const unidade = v => {
      const m = t.slice(i).match(/^[a-zçãéê°]+/);
      if (!m || m[0] === "x") return v;                  // "x" é multiplicação, não unidade
      const f = conv(m[0]);
      if (f === undefined) falha();
      i += m[0].length;
      return v * f;
    };
    const fator = () => {
      if (t[i] === "+") { i++; return fator(); }
      if (t[i] === "-") { i++; return -fator(); }
      if (t[i] === "(") {
        i++; const v = soma();
        if (t[i] !== ")") falha();
        i++; return unidade(v);
      }
      const m = t.slice(i).match(/^[\d.,]+/);
      if (!m || !/\d/.test(m[0])) falha();
      i += m[0].length;
      return unidade(lerNum(m[0]));
    };
    const produto = () => {
      let v = fator();
      while (t[i] === "*" || t[i] === "/" || t[i] === "x") {
        const op = t[i++], w = fator();
        v = op === "/" ? v / w : v * w;
      }
      return v;
    };
    const soma = () => {
      let v = produto();
      while (t[i] === "+" || t[i] === "-") { const op = t[i++], w = produto(); v = op === "+" ? v + w : v - w; }
      return v;
    };
    try {
      if (!t) return NaN;
      const v = soma();
      return i === t.length && isFinite(v) ? v : NaN;
    } catch (e) { return NaN; }
  }

  /**
   * texto -> número, aceitando vírgula ou ponto decimal: "12,5", "12.5", "1.250,75".
   * Com vírgula, o ponto é separador de milhar; sem vírgula, um ponto só é decimal
   * ("2.125 m" é dois metros e pouco, não 2125) e vários pontos são milhar ("1.250.000").
   */
  function lerNum(texto) {
    let t = String(texto == null ? "" : texto).trim().replace(/\s+/g, "");
    if (t === "") return NaN;
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
    return Number(t);
  }
  /** número do campo (aceita conta; "°" pode vir junto), ou o padrão quando vem vazio ou com lixo */
  const numCampoOu = (texto, padrao) => {
    const v = avaliarConta(texto, u => (u === "°" ? 1 : undefined));
    return isFinite(v) ? v : padrao;
  };

  /** texto do campo -> kg (a conta é feita na unidade do topo; número com unidade é convertido) */
  function lerMassa(texto) {
    const v = avaliarConta(texto, u => (FATOR_MASSA[u] === undefined ? undefined : FATOR_MASSA[u] / UNID.massa[uMassa()].f));
    return isFinite(v) ? massaParaKg(v) : 0;
  }

  /** texto do campo -> mm */
  function lerComp(texto) {
    const v = avaliarConta(texto, u => (FATOR_COMP[u] === undefined ? undefined : FATOR_COMP[u] / UNID.comp[uComp()].f));
    return isFinite(v) ? compParaMm(v) : 0;
  }

  /* ------------------------------------------------------------ tipos de arranjo
   * Cada tipo diz quais medidas o usuário informa (sempre DISTÂNCIAS do CG até o ponto)
   * e como elas viram coordenadas — o sentido de cada uma está na figura das medidas.
   */
  const TIPOS = {
    uma: {
      nome: "Uma linga", resumo: "um único ponto, na vertical do CG", pernas: 1, unica: true,
      // um ponto só: o corpo gira até o CG ficar na vertical do ponto, então a linga é vertical
      // e o ângulo com a estrutura não define a altura do gancho — entra o comprimento da linga
      // hu (e não h): as medidas são compartilhadas entre os arranjos, e aqui o ponto precisa
      // ficar acima do CG — não pode herdar o h = 0 dos outros nem devolver o seu para eles
      medidas: [["L", "L — comprimento da linga (do ponto ao gancho)"], ["hu", "h — altura do ponto acima do CG"]],
      padrao: { L: 2000, hu: 500 },
      pontos: m => [{ nome: "P1", x: 0, y: 0, z: m.hu }]
    },
    duas: {
      nome: "Duas pernas", resumo: "duas lingas, corpo alongado", pernas: 2,
      medidas: [["a1", "a₁ — do CG até P1"], ["a2", "a₂ — do CG até P2"], ["h", "h — altura dos pontos em relação ao CG"]],
      padrao: { a1: 1000, a2: 1000, h: 0 },
      pontos: m => [
        { nome: "P1", x: -Math.abs(m.a1), y: 0, z: m.h },
        { nome: "P2", x: +Math.abs(m.a2), y: 0, z: m.h }
      ]
    },
    pilar: {
      nome: "Pilar — olhais laterais", resumo: "peça em pé, olhais nas faces", pernas: 2, pilar: true,
      // olhais soldados nas faces do pilar, com o eixo na horizontal, apontando para fora: a
      // linga puxa inclinada em relação a ele (o ângulo da perna com a horizontal). c₁, c₂ e hp
      // são só deste arranjo — as medidas são compartilhadas e o pilar não deve herdar o a = 1000
      // nem o h = 0 das duas pernas (nem devolver os seus)
      medidas: [["c1", "c₁ — do eixo do pilar (CG) até o furo do olhal em P1"],
        ["c2", "c₂ — do eixo do pilar (CG) até o furo do olhal em P2"],
        ["hp", "h — altura dos furos acima do CG"]],
      padrao: { c1: 400, c2: 400, hp: 3000 },
      pontos: m => [
        { nome: "P1", x: -Math.abs(m.c1), y: 0, z: m.hp },
        { nome: "P2", x: +Math.abs(m.c2), y: 0, z: m.hp }
      ]
    },
    quatroSim: {
      nome: "Quatro pernas — simétrico", resumo: "corpo simétrico, CG no centro", pernas: 4,
      medidas: [["a", "a — do CG ao ponto, no comprimento"], ["b", "b — do CG ao ponto, na largura"],
        ["h", "h — altura dos pontos em relação ao CG"]],
      padrao: { a: 1000, b: 750, h: 0 },
      pontos: m => [
        { nome: "P1", x: +Math.abs(m.a), y: +Math.abs(m.b), z: m.h },
        { nome: "P2", x: -Math.abs(m.a), y: +Math.abs(m.b), z: m.h },
        { nome: "P3", x: -Math.abs(m.a), y: -Math.abs(m.b), z: m.h },
        { nome: "P4", x: +Math.abs(m.a), y: -Math.abs(m.b), z: m.h }
      ]
    },
    quatroDif: {
      nome: "Quatro pernas — pernas diferentes", resumo: "cada ponto na sua coordenada", pernas: 4,
      porPonto: true, medidas: [],
      // x, y, z são coordenadas de verdade (com sinal), como no desenho: cada ponto pode ficar
      // em qualquer lugar em torno do CG, não só "um por quadrante".
      padrao: { x1: 1200, y1: 800, z1: 0, x2: -900, y2: 800, z2: 0, x3: -900, y3: -700, z3: 0, x4: 1200, y4: -700, z4: 0 },
      pontos: m => [
        { nome: "P1", x: m.x1, y: m.y1, z: m.z1 },
        { nome: "P2", x: m.x2, y: m.y2, z: m.z2 },
        { nome: "P3", x: m.x3, y: m.y3, z: m.z3 },
        { nome: "P4", x: m.x4, y: m.y4, z: m.z4 }
      ]
    }
  };

  /* ------------------------------------------------------------ estado */
  function novoIcamento(n) {
    return {
      nome: `Içamento ${n}`,
      massa: 5000, origem: "calculado", local: "onshore", base: "N001", consequencia: "normal",
      tipo: "quatroSim", medidas: Object.assign({}, TIPOS.quatroSim.padrao),
      angulo: 60, pernaAngulo: 0,          // ângulo da perna com a estrutura, medido nesta perna
      hipotese4: "elastica", fatores: null, lingaPropria: true,
      linga: { tipo: "6x19-aco", categoria: "1960", terminacao: "manual" },
      manilhaTipo: "G-4163", manilhaCodigo: null,   // null = escolha automática (menor manilha que encaixa em tudo)
      olhal: { modo: "fabricado", tipoComprado: "GPAL-UNC", fy: 355, porPerna: [],
        solda: { tipo: "penetracao", a: 0, eletrodo: "E70" } }
    };
  }

  let E = carregar() || {
    nome: "", doc: "", resp: "", atual: 0,
    unid: { comp: "mm", massa: "kg" }, icamentos: [novoIcamento(1)]
  };
  if (!E.unid) E.unid = { comp: "mm", massa: "kg" };

  function carregar() {
    try { const j = localStorage.getItem(CHAVE); return j ? JSON.parse(j) : null; } catch (e) { return null; }
  }
  function gravar() { try { localStorage.setItem(CHAVE, JSON.stringify(E)); } catch (e) { /* sem storage */ } }
  const atual = () => E.icamentos[E.atual] || E.icamentos[0];

  /* ------------------------------------------------------------ geometria */
  const numOu = (v, padrao) => (v === "" || v == null || !isFinite(Number(v)) ? padrao : Number(v));
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vesc = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
  const vsoma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

  /**
   * Estrutura das duas pernas: horizontal, inclinada (reta) ou dobrada (em V).
   *
   * Nas duas últimas a peça é vista como dois trechos que se encontram na dobra, cada um com a
   * sua inclinação φᵢ com a horizontal — positiva quando o ponto Pᵢ fica acima da dobra.
   * Inclinada: um φ só (P2 do lado de cima), que vira φ₁ = −φ, φ₂ = φ, com a dobra no CG.
   * Nas duas os pontos vêm direto: x₁, x₂ na horizontal, do eixo vertical do CG até cada furo
   * (guardados em a1, a2), e y₁, y₂ a altura de cada furo em relação ao CG (z1, z2) — os olhais
   * podem estar em níveis diferentes. φ dá só a direção de cada trecho: o olhal fica em pé sobre
   * ele (γ = 90°), e a dobra, onde os trechos se cruzam passando pelos furos, sai disso (serve
   * ao desenho). w[i] é o eixo do trecho i (da dobra para Pᵢ), n[i] a normal "para cima" dele.
   * Na horizontal, nada disso entra.
   */
  const estruturaDe = ic => (ic.tipo !== "duas" || !ic.inclinada ? "horizontal" : ic.dobrada ? "dobrada" : "inclinada");

  function inclinacaoDe(ic) {
    const est = estruturaDe(ic);
    if (est === "horizontal") return null;
    if (!ic.inclinacao) ic.inclinacao = {};
    const c = ic.inclinacao;
    const phi = est === "dobrada"
      ? [numOu(c.phi1, 30), numOu(c.phi2, 30)]
      : [-numOu(c.phi, 30), numOu(c.phi, 30)];
    const f = phi.map(v => v * Math.PI / 180);
    const w = [[-Math.cos(f[0]), 0, Math.sin(f[0])], [Math.cos(f[1]), 0, Math.sin(f[1])]];
    const n = [[Math.sin(f[0]), 0, Math.cos(f[0])], [-Math.sin(f[1]), 0, Math.cos(f[1])]];
    // os furos entram por x (na horizontal, do eixo vertical do CG) e y (altura em relação ao CG);
    // ficam em a1, a2 (os mesmos da horizontal) e z1, z2. Sem y ainda: na inclinada, sobre a peça
    const m = ic.medidas;
    const tg = Math.tan(f[1]);
    if (m.z1 === undefined) m.z1 = est === "dobrada" ? 500 : Math.round(-Math.abs(numOu(m.a1, 0)) * tg);
    if (m.z2 === undefined) m.z2 = est === "dobrada" ? 500 : Math.round(Math.abs(numOu(m.a2, 0)) * tg);
    // inclinada: peça reta, então y₂ sai de y₁, x₁, x₂ e φ — só y₁ é informado
    if (est === "inclinada") m.z2 = numOu(m.z1, 0) + (Math.abs(numOu(m.a1, 0)) + Math.abs(numOu(m.a2, 0))) * tg;
    const P = [[-Math.abs(numOu(m.a1, 0)), 0, numOu(m.z1, 0)], [Math.abs(numOu(m.a2, 0)), 0, numOu(m.z2, 0)]];
    // dobra: D + s₁·w₁ = P1 e D + s₂·w₂ = P2  ->  s₁·w₁ − s₂·w₂ = P1 − P2 (em x e z)
    const det = -w[0][0] * w[1][2] + w[1][0] * w[0][2];
    const bx = P[0][0] - P[1][0], bz = P[0][2] - P[1][2];
    let s1, s2;
    if (Math.abs(det) > 1e-9) {
      s1 = (-bx * w[1][2] + w[1][0] * bz) / det;
      s2 = (w[0][0] * bz - w[0][2] * bx) / det;
    } else {
      // trechos paralelos (peça reta, a inclinada): a "dobra" fica na vertical do CG, sobre o trecho 1
      s1 = Math.abs(P[0][0]) / Math.max(Math.cos(f[0]), 1e-9);
      s2 = Math.hypot(P[1][0] - (P[0][0] - w[0][0] * s1), P[1][2] - (P[0][2] - w[0][2] * s1));
    }
    return {
      dobrada: est === "dobrada", phi, g: [90, 90], w, n, pontos: P, s: [s1, s2],
      dobra: [P[0][0] - w[0][0] * s1, 0, P[0][2] - w[0][2] * s1]
    };
  }

  function pontosDe(ic) {
    const inc = inclinacaoDe(ic);
    if (!inc) return TIPOS[ic.tipo].pontos(ic.medidas);
    return inc.pontos.map((v, i) => ({ nome: `P${i + 1}`, x: v[0], y: v[1], z: v[2] }));
  }

  /** eixo de cada olhal (unitário, do pé para o furo): vertical, girado com o trecho da peça,
   *  ou — no pilar — na horizontal, para fora da face */
  function eixosOlhalDe(ic) {
    if (TIPOS[ic.tipo].pilar) return pontosDe(ic).map(p => [Math.sign(p.x) || 1, 0, 0]);
    const inc = inclinacaoDe(ic);
    if (!inc) return pontosDe(ic).map(() => [0, 0, 1]);
    return [0, 1].map(i => {
      const g = inc.g[i] * Math.PI / 180;
      return vsoma(vesc(inc.w[i], Math.cos(g)), vesc(inc.n[i], Math.sin(g)));   // para fora · para cima
    });
  }

  /**
   * Ângulo da linga com o olhal, por perna: θ_eixo entre a linga e o eixo do olhal, e
   * θ = 90° − θ_eixo, o ângulo com a base do olhal — é este que entra nas fórmulas do
   * memorial (f_a = F·sen θ, f_ipb = F·cos θ·h). Olhal em pé e linga vertical: θ = 90°.
   */
  function angulosOlhal(ic, r) {
    const eixos = eixosOlhalDe(ic);
    return r.pernas.map((p, i) => {
      const d = vsub(r.gancho, p.ponto), L = Math.hypot(...d) || 1;
      let c = Math.max(-1, Math.min(1, vdot(d, eixos[i]) / L));
      // pilar: o olhal aponta para fora e a linga puxa para dentro, por cima do pilar — vale o
      // ângulo com a LINHA do eixo (a componente axial empurra o olhal contra a solda)
      if (TIPOS[ic.tipo].pilar) c = Math.abs(c);
      const eixo = Math.acos(c) * 180 / Math.PI;
      return { eixo, base: 90 - eixo };
    });
  }

  /** altura do gancho: sai do ângulo informado na perna escolhida */
  function alturaGancho(ic) {
    const P = pontosDe(ic);
    if (TIPOS[ic.tipo].unica) return P[0].z + Math.max(Number(ic.medidas.L) || 0, 1);
    const i = Math.min(ic.pernaAngulo || 0, P.length - 1);
    const d = Math.hypot(P[i].x, P[i].y);
    const ang = Math.max(1, Math.min(89, Number(ic.angulo) || 60));
    return P[i].z + d * Math.tan(ang * Math.PI / 180);
  }

  /* ------------------------------------------------------------ fatores e cálculo */
  function fatoresDe(ic) {
    const b = FAT.bases[ic.base] || FAT.bases.N001;
    const padrao = {
      peso: b.peso[ic.origem] ?? 1.05,
      cog: b.cog ?? 1,
      // uma linga só leva o peso inteiro: não há distribuição desigual a cobrir
      skl: TIPOS[ic.tipo].pernas > 2 ? b.skl.quatro : TIPOS[ic.tipo].pernas === 1 ? 1 : b.skl.duas,
      fsLinga: b.fsLinga.padrao,
      anguloMax: FAT.anguloMaximo
    };
    if (b.linga.modelo === "N001") Object.assign(padrao, {
      gh: b.linga.gh, gc: b.linga.gc[ic.consequencia] ?? b.linga.gc.normal, gm: b.linga.gm, gw: b.linga.gw
    });
    const f = Object.assign(padrao, ic.fatores || {});
    // DAF pela carga estática no gancho SHL = W·γ_peso·γ_CoG (t), salvo se foi digitado
    f.shlT = (Number(ic.massa) || 0) / 1000 * f.peso * f.cog;
    if (!(ic.fatores && ic.fatores.dafManual)) f.daf = FAT.daf(ic.base, ic.local, f.shlT);
    return f;
  }
  /** fatores da linga para o rigging: os parciais da N001 ou o FS único das outras bases */
  function fatoresLinga(ic) {
    const f = fatoresDe(ic), b = FAT.bases[ic.base] || FAT.bases.N001;
    if (b.linga.modelo !== "N001") return { modelo: "fs", fs: f.fsLinga };
    const term = FAT.terminacoes[(ic.linga && ic.linga.terminacao) || "manual"] || FAT.terminacoes.manual;
    const lg = ic.linga || {};
    const Dtopo = lg.topo === "gancho" && Number(lg.dTopo) > 0 ? Number(lg.dTopo) : null;
    return { modelo: "N001", gh: f.gh, gc: f.gc, gs: term.gs, gw: f.gw, gm: f.gm, terminacao: term.nome, Dtopo };
  }

  function resolver(ic) {
    const r = C.resolver({
      massa: ic.massa, alturaGancho: alturaGancho(ic), pontos: pontosDe(ic),
      hipotese4: ic.hipotese4, fatores: fatoresDe(ic)
    });
    // para os desenhos: o eixo de cada olhal e, na estrutura inclinada, os trechos da peça
    r.eixosOlhal = eixosOlhalDe(ic);
    const inc = inclinacaoDe(ic);
    if (inc) r.peca = { dobrada: inc.dobrada, phi: inc.phi, w: inc.w, n: inc.n, dobra: inc.dobra,
      a: inc.s.map(v => Math.max(v, 0)), h: 0 };
    if (inc && inc.dobrada && (inc.s[0] <= 0 || inc.s[1] <= 0))
      r.avisos.push("Com estas inclinações φ₁ e φ₂ os dois trechos não se encontram entre os pontos — confira os ângulos "
        + "(φ positivo com o ponto acima da dobra). O cálculo das cargas não muda; só o desenho e o ângulo do olhal dependem de φ.");
    // gancho abaixo (ou no nível) de um furo: o ângulo foi dado na perna errada ou é pequeno demais
    const Pts = pontosDe(ic), baixos = Pts.filter(p => r.gancho[2] - p.z < 1);
    if (baixos.length && !TIPOS[ic.tipo].unica)
      r.avisos.push(`Com o ângulo informado na perna ${Pts[Math.min(ic.pernaAngulo || 0, Pts.length - 1)].nome}, `
        + `o gancho fica abaixo de ${baixos.map(p => p.nome).join(" e ")} — confira em qual perna o ângulo foi medido (campo "Medido na perna") `
        + "ou aumente o ângulo. Os comprimentos das lingas não valem assim.");
    if (TIPOS[ic.tipo].pilar) r.pilar = { c: [Math.abs(ic.medidas.c1), Math.abs(ic.medidas.c2)], h: Number(ic.medidas.hp) || 0 };
    return r;
  }

  /* ------------------------------------------------------------ linga, sapatilho, manilha, olhal
   * Regra (docs/METODO.md, item 6): manilha e olhal usam a carga da perna direto (F_pino);
   * só a linga recebe o fator de segurança extra (fsLinga), nunca o contrário.
   */

  /** carga (kN) que manda na escolha da linga/manilha/sapatilho: deste içamento, ou a maior do estudo */
  function cargaGovernanteKN(ic) {
    const propria = resolver(ic).maiorTracaoKN;
    if (ic.lingaPropria) return propria;
    return Math.max(...E.icamentos.map(x => resolver(x).maiorTracaoKN));
  }

  /** o içamento de maior carga de perna do estudo (no empate, o primeiro) */
  function icamentoGovernante() {
    return E.icamentos.reduce((a, b) => (resolver(b).maiorTracaoKN > resolver(a).maiorTracaoKN + 1e-9 ? b : a), E.icamentos[0]);
  }

  /** de quem são a linga, a manilha e o olhal deste içamento: dele, ou do de maior carga */
  const modeloDe = ic => (ic.lingaPropria ? ic : icamentoGovernante());

  /**
   * Quem usa a maior carga do estudo leva o mesmo conjunto do içamento de maior carga:
   * mesma linga, mesma manilha e o mesmo olhal (modo, aço e geometria). Copiado a cada
   * repintura, para acompanhar o que mudar lá.
   */
  function sincronizarPadrao() {
    const gov = icamentoGovernante();
    if (gov.olhal.modo === "fabricado" && !gov.olhal.geom) olhalDe(gov, riggingDe(gov));
    E.icamentos.forEach(ic => {
      if (ic.lingaPropria || ic === gov) return;
      ic.linga = Object.assign({}, gov.linga);
      ic.manilhaTipo = gov.manilhaTipo;
      ic.manilhaCodigo = gov.manilhaCodigo;
      ic.olhal = JSON.parse(JSON.stringify(gov.olhal));
    });
  }

  /** t + 2·t.anel do olhal fabricado — entra na escolha da manilha; null no olhal comprado */
  function espessuraChapa(ic) {
    if (ic.olhal.modo !== "fabricado") return null;
    const g = ic.olhal.geom || { t: 25, tAnel: 0 };     // 25 mm = espessura de partida (rigging.js)
    return (Number(g.t) || 0) + 2 * (Number(g.tAnel) || 0);
  }

  function riggingDe(ic) {
    // FS da linga do dono do conjunto: com a maior carga do estudo, a linga é a mesma de lá
    const f = fatoresDe(modeloDe(ic));
    const cargaGov = cargaGovernanteKN(ic);
    const linga = RIG.escolherLinga({ cargaKN: cargaGov, fl: fatoresLinga(modeloDe(ic)), tipo: ic.linga.tipo, categoria: ic.linga.categoria });
    const sapatilho = RIG.escolherSapatilho(linga.diametro);
    const manilha = RIG.escolherManilha({
      cargaKN: cargaGov, tipo: ic.manilhaTipo, sapatilho: sapatilho.sapatilho,
      diametroCaboMm: linga.diametro, codigo: ic.manilhaCodigo || null,
      espessuraChapaMm: espessuraChapa(ic)
    });
    return { cargaGov, linga, sapatilho, manilha, casos: manilha.casos };
  }

  /** geometria do olhal — UMA para o içamento inteiro.
   *
   * Na obra se fabrica um olhal igual para todos os pontos, dimensionado pela perna mais
   * carregada: é mais barato, não troca peça no campo e não corre o risco de montar o olhal
   * errado no ponto errado. Por isso não existe mais geometria por perna.
   */
  function olhalGeomDe(ic, manilha) {
    // vinha da versão que tinha um olhal por perna: aproveita o primeiro e descarta o resto
    if (ic.olhal.porPerna && ic.olhal.porPerna[0] && !ic.olhal.geom) ic.olhal.geom = ic.olhal.porPerna[0];
    delete ic.olhal.porPerna;
    if (!ic.olhal.geom) {
      ic.olhal.geom = RIG.geometriaOlhalPartida(manilha) ||
        { t: 25, tAnel: 0, base: 200, h: 200, R: 50, rAnel: 50, dFuro: 50 };
    }
    // Furo, raio do topo e raio do reforço saem da manilha e do próprio raio — são
    // consequência, não escolha. Recalculados a cada vez, para acompanharem a manilha.
    const daManilha = RIG.geometriaOlhalPartida(manilha);
    if (daManilha) {
      ic.olhal.geom.dFuro = daManilha.dFuro;
      ic.olhal.geom.R = daManilha.R;
    }
    // N-2683 5.3.3: d_anel ≤ 2·(R − n·t_anel); com n = 1 o anel fica com raio R − t_anel
    const tA = Number(ic.olhal.geom.tAnel) || 0;
    ic.olhal.geom.rAnel = tA > 0 ? Math.max((Number(ic.olhal.geom.R) || 0) - tA, 0) : 0;
    return ic.olhal.geom;
  }

  /** a perna mais tracionada */
  function pernaGovernante(ic) {
    const pernas = resolver(ic).pernas;
    return pernas.reduce((a, b) => (b.tracao > a.tracao ? b : a), pernas[0]);
  }

  const piorUtilizacao = v => Math.max(...v.checks.map(c => c.utilizacao));
  /** fator de consequência do olhal: N-2683 5.2 a) e DNV-ST-N001 Tabela 16-5 */
  const FC_OLHAL = 1.30;
  function soldaDe(ic) {
    if (!ic.olhal.solda) ic.olhal.solda = { tipo: "penetracao", a: 0, eletrodo: "E70" };
    return ic.olhal.solda;
  }

  /**
   * O olhal do içamento (um só, igual em todos os pontos). O comercial vai pela perna mais
   * tracionada (CMT). O fabricado é verificado em CADA perna, com a carga e o ângulo dela
   * com o olhal, e governa a de maior utilização — com a peça inclinada, ou olhais em
   * ângulos diferentes, ela não é necessariamente a mais tracionada.
   */
  function olhalDe(ic, rig) {
    const r = resolver(ic), pernas = r.pernas;
    const angs = angulosOlhal(ic, r);
    const nomes = pernas.map(p => p.nome);
    if (ic.olhal.modo === "comprado") {
      const gov = pernaGovernante(ic);
      const pinoMm = rig.manilha.manilha ? rig.manilha.manilha.b : null;
      // com a maior carga do estudo, o modelo sai dessa carga — o mesmo do içamento de maior carga
      const resultado = RIG.escolherOlhalComprado({ cargaKN: rig.cargaGov, tipo: ic.olhal.tipoComprado, pinoMm });
      return { nomes, qtd: pernas.length, governante: gov, modo: "comprado", resultado };
    }
    const geom = olhalGeomDe(ic, rig.manilha.manilha);
    const porPerna = pernas.map((p, i) => ({
      perna: p, angulo: angs[i],
      verif: RIG.verificarOlhalFabricado({
        Flinga: p.tracao, fc: FC_OLHAL, thetaGraus: Math.max(0, angs[i].base), geom, Fy: fyDoOlhal(ic),
        dPino: rig.manilha.manilha ? rig.manilha.manilha.b : null, solda: soldaDe(ic),
        encaixe: { manilha: rig.manilha.manilha, sapatilho: rig.sapatilho.sapatilho }
      })
    }));
    const pior = porPerna.reduce((a, b) => (piorUtilizacao(b.verif) > piorUtilizacao(a.verif) + 1e-9 ? b : a), porPerna[0]);
    return {
      nomes, qtd: pernas.length, governante: pior.perna, angulo: pior.angulo, porPerna,
      modo: "fabricado", geom, verif: pior.verif
    };
  }

  /** lista de material de um içamento (linga, sapatilho, manilha, olhal)
   *
   * Colunas iguais às da lista de corte (projeto 8): título (o que é), especificação (o
   * detalhe técnico), material e massa. `massa` é a massa TOTAL da quantidade, em kg;
   * `null` quer dizer que o catálogo não traz o peso — sai "-", não zero.
   */
  function materialDe(ic) {
    const rig = riggingDe(ic);
    const olhalUnico = olhalDe(ic, rig);
    const pernas = resolver(ic).pernas;
    const itens = [];

    /* ---------------------------------------------------------- linga */
    const compTotalMm = pernas.reduce((t, p) => t + p.comprimento, 0);
    const tipoLinga = IC.lingas.tipos[rig.linga.tipo];
    itens.push({
      titulo: "Linga",
      qtd: 1,
      especificacao: `${tipoLinga.nome}, Ø ${F.num(rig.linga.diametro, 1)} mm, `
        + `${pernas.length} ${pernas.length > 1 ? "pernas" : "perna"} de ${pernas.map(p => F.num(p.comprimento, 0)).join(" / ")} mm`,
      material: `Cabo de aço, categoria ${rig.linga.categoria} N/mm²`,
      // peso do catálogo é kgf por metro de cabo
      massa: rig.linga.peso ? rig.linga.peso * (compTotalMm / 1000) : null
    });

    /* ---------------------------------------------------------- sapatilho */
    if (rig.sapatilho.ok) {
      const sp = rig.sapatilho.sapatilho;
      const qtd = pernas.length * 2;
      itens.push({
        titulo: "Sapatilho",
        qtd,
        especificacao: `${sp.codigo} — sapatilha pesada, cabo ${sp.cabo}`,
        material: "Aço estampado",
        massa: sp.peso ? sp.peso * qtd : null
      });
    }

    /* ---------------------------------------------------------- manilha */
    if (rig.manilha.ok) {
      const mn = rig.manilha.manilha;
      const tipo = IC.manilhas.tipos[rig.manilha.tipo];
      itens.push({
        titulo: "Manilha",
        qtd: pernas.length,
        especificacao: `${tipo.nome} — ${mn.codigo}, CMT ${F.num(mn.cmt, 2)} t`,
        material: "Aço liga",
        massa: mn.peso ? mn.peso * pernas.length : null
      });
    }

    /* ---------------------------------------------------------- olhais
       Olhais iguais viram um item só, com a quantidade somada e as pernas listadas —
       é o que a lista de material faz com item repetido. */
    // um olhal igual para todos os pontos: uma linha só, com a quantidade
    const o = olhalUnico;
    if (o.modo === "comprado" && o.resultado.ok) {
      const ol = o.resultado.olhal;
      itens.push({
        titulo: "Olhal de elevação",
        qtd: o.qtd,
        especificacao: `${o.nomes.join(", ")} — ${IC.olhais.tipos[ic.olhal.tipoComprado].nome}, `
          + `${ol.codigo}, rosca ${ol.rosca}, CMT ${F.num(ol.cmt, 2)} t`,
        material: "Aço liga grau 8",
        massa: ol.peso ? ol.peso * o.qtd : null
      });
    } else if (o.modo === "fabricado") {
      const g = o.geom;
      const unit = massaOlhalFabricado(g);
      itens.push({
        titulo: "Olhal (padeye) fabricado",
        qtd: o.qtd,
        especificacao: `${o.nomes.join(", ")} — chapa t=${F.num(g.t, 0)} mm, base=${F.num(g.base, 0)} mm, `
          + `h=${F.num(g.h, 0)} mm, furo Ø${F.num(g.dFuro, 1)} mm`,
        material: `${acoDoOlhal(ic).nome} — Fy ${F.num(fyDoOlhal(ic), 0)} MPa`,
        massa: unit == null ? null : unit * o.qtd,
        estimada: true
      });
    }
    return { rig, olhal: o, itens };
  }

  /** massa aproximada do olhal fabricado: a chapa (base × h, mais o topo arredondado de raio R
   *  acima do furo) menos o furo, a 7,85 kg/dm³. Sem o topo, um furo grande deixava a área — e
   *  a massa — negativa. É estimativa: serve para o peso total do conjunto não sair vazio. */
  function massaOlhalFabricado(g) {
    const base = Number(g.base), h = Number(g.h), t = Number(g.t), d = Number(g.dFuro) || 0;
    if (!(base > 0 && h > 0 && t > 0)) return null;
    const R = Number(g.R) || base / 2;
    const areaMm2 = Math.max(0, base * h + Math.PI * R * R / 2 - Math.PI * d * d / 4);
    const chapa = areaMm2 * t * 7.85e-6;                       // mm³ → kg
    const anel = (Number(g.tAnel) > 0 && Number(g.rAnel) > 0)  // reforço, quando houver
      ? Math.PI * (Math.pow(Number(g.rAnel), 2) - Math.pow(d / 2, 2)) * Number(g.tAnel) * 2 * 7.85e-6
      : 0;
    return chapa + anel;
  }

  /** lista de material consolidada do estudo — soma quantidades de itens iguais */
  function materialConsolidado() {
    const mapa = new Map();
    E.icamentos.forEach(ic => {
      materialDe(ic).itens.forEach(it => {
        const chave = [it.titulo, it.especificacao, it.material].join("|");
        const atual = mapa.get(chave);
        if (atual) {
          atual.qtd += it.qtd;
          // se um dos dois não tem massa, a soma não é confiável: some com ela
          atual.massa = (atual.massa == null || it.massa == null) ? null : atual.massa + it.massa;
        } else mapa.set(chave, Object.assign({}, it));
      });
    });
    return Array.from(mapa.values());
  }

  /* ------------------------------------------------------------ abas */
  function pintarAbas() {
    $("abas").innerHTML = E.icamentos.map((ic, i) => {
      const r = resolver(ic);
      return `<button type="button" class="aba${i === E.atual ? " on" : ""}" data-aba="${i}">
        ${F.esc(ic.nome)}<span class="aba__peso">${F.num(massaParaTela(ic.massa), 2)} ${uMassa()} · ${F.num(r.maiorTracaoT, 1)} t/perna</span></button>`;
    }).join("") + `<button type="button" class="aba aba--novo" data-novo>+ içamento</button>`;
    // a lixeira some quando só resta um içamento: o estudo precisa de pelo menos um
    if (E.icamentos.length > 1) {
      document.querySelectorAll("#abas .aba[data-aba]").forEach((b, i) => {
        const lixo = document.createElement("span");
        lixo.className = "aba__lixo";
        lixo.dataset.remover = String(i);
        lixo.title = "Excluir este içamento";
        lixo.setAttribute("role", "button");
        lixo.textContent = "\u{1F5D1}";
        b.appendChild(lixo);
      });
    }
  }

  /* ------------------------------------------------------------ entrada */
  function pintarEntrada() {
    const ic = atual();
    const t = TIPOS[ic.tipo];

    $("ic-nome").value = ic.nome;
    $("ic-massa").value = paraCampo(massaParaTela(ic.massa));
    $("ic-massa").title = `Dá para digitar a unidade junto e fazer conta: "5 t", "800 kg", "50 kN", "2 t + 350 kg".`;
    $("rot-massa").textContent = `Massa (${uMassa()})`;
    $("ic-origem").value = ic.origem;
    $("ic-local").value = ic.local;
    $("ic-cons").value = ic.consequencia === "reduzida" ? "reduzida" : "normal";
    $("ic-cons").closest(".campo").style.display = (FAT.bases[ic.base] || FAT.bases.N001).linga.modelo === "N001" ? "" : "none";
    $("ic-hipotese").value = ic.hipotese4;
    $("ic-hipotese").closest(".campo").style.display = t.pernas > 2 ? "" : "none";
    $("dica-hipotese").style.display = t.pernas > 2 ? "" : "none";
    $("dica-hipotese").innerHTML = ic.hipotese4 === "diagonais"
      ? "<b>Pares diagonais:</b> admite que as lingas não ficam iguais e um par diagonal fica frouxo — "
        + "o outro par sustenta sozinho o peso inteiro. É o pior caso estático possível, por isso "
        + "<b>não leva SKL</b>. Conservador (≈ 2× a carga nominal por perna com o CG no centro)."
      : "<b>Elástica × SKL (DNV-ST-N001):</b> o corpo é rígido e as quatro lingas são molas "
        + "(rigidez vertical EA·cos²β/L). O equilíbrio (ΣV = W, ΣM = 0) mais a compatibilidade de "
        + "deslocamentos dá a carga de cada perna; o SKL (1,25) cobre a diferença de comprimento "
        + "entre as lingas — equivale a um par diagonal pegar 62,5 % do peso em vez de 50 %.";
    $("un-comp").value = uComp();
    $("un-massa").value = uMassa();

    $("ic-base").innerHTML = Object.entries(FAT.bases)
      .map(([k, b]) => `<option value="${k}"${k === ic.base ? " selected" : ""}>${F.esc(b.nome)}</option>`).join("");
    const b = FAT.bases[ic.base];
    $("dica-base").innerHTML = F.esc(b.nota);

    // cartões dos tipos, cada um com o seu desenho
    $("tipos").innerHTML = Object.entries(TIPOS).map(([k, tp]) =>
      `<button type="button" class="tipo${k === ic.tipo ? " on" : ""}" data-tipo="${k}" role="radio" aria-checked="${k === ic.tipo}">
        <div class="tipo__fig">${FIG.icone(k)}</div>
        <b>${F.esc(tp.nome)}</b><span>${F.esc(tp.resumo)}</span></button>`).join("");

    // figuras no alto da etapa das medidas: o 3D com as distâncias reais e o esquema do que informar
    $("fig-3d-medidas").innerHTML = IC.iso3d.desenhar(resolver(ic), { modo: "medidas", comp: txtComp });
    const inc = inclinacaoDe(ic);
    const est = estruturaDe(ic);
    $("fig-medidas").innerHTML = FIG.medidas(ic.tipo, { inclinada: !!inc, dobrada: est === "dobrada" });

    const numCampo = k => `<input type="text" inputmode="decimal" data-medida="${k}"
      data-key="medida-${k}" title="Dá para digitar a unidade junto e fazer conta: &quot;2,5 m&quot;, &quot;2500 mm&quot;, &quot;20 + 30&quot;, &quot;2 m + 300 mm&quot;."
      value="${paraCampo(compParaTela(ic.medidas[k]))}">`;
    if (t.porPonto) {
      $("campos-medidas").innerHTML = `<table class="tab tab--pontos"><thead><tr>
          <th>Ponto</th><th>x (${uComp()})</th><th>y (${uComp()})</th>
          <th>z — altura (${uComp()})</th><th>distância horizontal</th></tr></thead>
        <tbody>${[1, 2, 3, 4].map(i => `<tr><td>P${i}</td>
          <td>${numCampo(`x${i}`)}</td><td>${numCampo(`y${i}`)}</td><td>${numCampo(`z${i}`)}</td>
          <td class="num som">${txtComp(Math.hypot(ic.medidas[`x${i}`], ic.medidas[`y${i}`]))}</td></tr>`).join("")}</tbody></table>`;
    } else {
      // inclinada e em V: cada furo pelas suas coordenadas — x na horizontal e y na vertical, a partir do CG
      const ROT = {
        xy: {
          a1: "x₁ — do eixo vertical do CG até o furo de P1, na horizontal (eixo X)",
          a2: "x₂ — do eixo vertical do CG até o furo de P2, na horizontal (eixo X)",
          z1: "y₁ — altura do furo de P1 em relação ao CG, na vertical (eixo Y, + acima)",
          z2: "y₂ — altura do furo de P2 em relação ao CG, na vertical (eixo Y, + acima)"
        }
      }[est === "horizontal" ? "" : "xy"] || {};
      const listaMedidas = est === "dobrada" ? [["a1", ROT.a1], ["a2", ROT.a2], ["z1", ROT.z1], ["z2", ROT.z2]]
        : est === "inclinada" ? [["a1", ROT.a1], ["a2", ROT.a2], ["z1", ROT.z1]] : t.medidas;
      const angCampo = (k, rot, valor) => `<label class="campo"><span>${F.esc(rot)}</span>
        <input type="text" inputmode="decimal" data-incl="${k}" data-key="incl-${k}" value="${paraCampo(valor)}"></label>`;
      const opc = (v, txt) => `<option value="${v}"${v === est ? " selected" : ""}>${txt}</option>`;
      const angulos = est === "dobrada"
        ? angCampo("phi1", "φ₁ — trecho de P1 com a horizontal (°)", inc.phi[0])
          + angCampo("phi2", "φ₂ — trecho de P2 com a horizontal (°)", inc.phi[1])
        : est === "inclinada"
          ? angCampo("phi", "φ — inclinação da peça com a horizontal (°)", inc.phi[1])
          : "";
      const dica = est === "dobrada"
        ? `<p class="dica">Cada trecho tem a sua inclinação com a horizontal: φ é positivo quando o
          ponto fica <b>acima</b> da dobra e negativo quando fica abaixo — na peça em V, os dois
          positivos. Os furos podem estar em alturas diferentes (y₁ e y₂). O olhal fica em pé sobre o
          trecho e é verificado com o ângulo real entre a linga e ele. A peça fica nesta posição se as
          lingas tiverem os comprimentos da tabela da etapa 5.</p>`
        : est === "inclinada"
          ? `<p class="dica">Cada furo pelas suas coordenadas a partir do CG: x na horizontal e y na
          vertical. O olhal fica em pé sobre a peça (perpendicular a ela) e é verificado com o
          ângulo real entre a linga e ele. A peça fica nesta inclinação se as lingas tiverem os
          comprimentos da tabela da etapa 5.</p>`
          : "";
      $("campos-medidas").innerHTML = (ic.tipo === "duas" ? `<div class="grade">
          <label class="campo"><span>Estrutura</span><select id="ic-inclinada">
            ${opc("horizontal", "horizontal")}
            ${opc("inclinada", "inclinada (peça reta)")}
            ${opc("dobrada", "em V (dobrada)")}</select></label>
          ${angulos}
        </div>${dica}` : "")
        + `<div class="grade">${listaMedidas.map(([k, rot]) =>
        `<label class="campo"><span>${F.esc(ROT[k] || rot)} (${uComp()})</span>${numCampo(k)}</label>`).join("")}</div>`
        + (est === "inclinada" ? `<p class="dica" id="saida-y2">y₂ — altura do furo de P2, calculada pela inclinação:
          y₂ = y₁ + (x₁ + x₂)·tg φ = <b>${txtComp(ic.medidas.z2)}</b></p>` : "");
    }

    // ângulo da perna com a estrutura (substitui a altura do gancho); com uma linga só ela é
    // vertical e quem dá a altura do gancho é o comprimento informado nas medidas
    const P = pontosDe(ic);
    $("ic-angulo").closest(".campo").style.display = t.unica ? "none" : "";
    // com a peça inclinada ou em pé, "a estrutura" não é mais horizontal: o ângulo informado é com a horizontal
    $("ic-angulo").previousElementSibling.textContent = inc || t.pilar
      ? "Ângulo da perna com a horizontal (°)" : "Ângulo da perna com a estrutura (°)";
    $("ic-perna-ang").closest(".campo").style.display = t.unica ? "none" : "";
    const iAng = Math.min(ic.pernaAngulo || 0, P.length - 1);
    $("ic-angulo").value = paraCampo(ic.angulo);
    $("ic-perna-ang").innerHTML = P.map((p, i) =>
      `<option value="${i}"${i === iAng ? " selected" : ""}>${F.esc(p.nome)}</option>`).join("");
    const H = alturaGancho(ic);
    const Lp = Math.hypot(P[iAng].x, P[iAng].y, H - P[iAng].z);
    const baixos = t.unica ? [] : P.filter(p => H - p.z < 1);
    $("saida-altura").innerHTML = (baixos.length ? `<span class="aviso aviso--erro" style="display:block;margin-bottom:6px">⚠ O gancho
        ficou abaixo de ${baixos.map(p => F.esc(p.nome)).join(" e ")}: confira em qual perna o ângulo foi medido
        (campo "Medido na perna") — o ângulo vale para a perna escolhida ali.</span>` : "")
      + `Altura do gancho acima do CG: <b>${txtComp(H)}</b> · comprimento da perna ${F.esc(P[iAng].nome)}: <b>${txtComp(Lp)}</b>`
      + (inc ? ` · para a peça ficar ${inc.dobrada ? `com φ₁ = ${F.grau(inc.phi[0])} e φ₂ = ${F.grau(inc.phi[1])}` : `a ${F.grau(inc.phi[1])}`}, as lingas precisam ter
        ${P.map(p => `${F.esc(p.nome)} <b>${txtComp(Math.hypot(p.x, p.y, H - p.z))}</b>`).join(" e ")}` : "")
      + (t.unica ? ` · <b>uma linga só:</b> o ponto de içamento fica na vertical do centro de massa — o corpo gira até
        isso acontecer — e a linga trabalha na vertical, com o peso inteiro.` : "");
    // cada eslinga: altura (do furo ao gancho), distância horizontal, comprimento e ângulo — com os
    // furos em alturas diferentes as pernas não são iguais, e é daqui que sai o comprimento certo
    $("saida-pernas").innerHTML = t.unica ? "" : `<table class="tab tab--pernas"><thead><tr>
        <th>Eslinga</th><th>Altura (furo ao gancho)</th><th>Distância horizontal</th><th>Comprimento</th><th>Ângulo c/ a horizontal</th></tr></thead>
      <tbody>${P.map(p => {
        const v = H - p.z, hz = Math.hypot(p.x, p.y);
        return `<tr><td>${F.esc(p.nome)}${p.x < -1e-6 ? " (esquerda)" : p.x > 1e-6 ? " (direita)" : ""}</td>
          <td class="num">${txtComp(v)}</td><td class="num">${txtComp(hz)}</td>
          <td class="num"><b>${txtComp(Math.hypot(hz, v))}</b></td>
          <td class="num">${F.grau(Math.atan2(v, hz) * 180 / Math.PI)}</td></tr>`;
      }).join("")}</tbody></table>`;

    // fatores
    const f = fatoresDe(ic);
    const n001 = (FAT.bases[ic.base] || FAT.bases.N001).linga.modelo === "N001";
    const rotulos = Object.assign({
      peso: "Margem de peso γ_peso", cog: "Imprecisão do CoG γ_CoG", daf: "Amplificação dinâmica DAF",
      skl: "Distribuição desigual SKL"
    }, n001 ? { gh: "Eslinga: fator de içamento γh", gc: "Eslinga: consequência γc", gm: "Eslinga: material γm",
      gw: "Eslinga: desgaste e aplicação γw" } : { fsLinga: "FS da linga" }, { anguloMax: "Ângulo máx. c/ a vertical (°)" });
    $("campos-fatores").innerHTML = Object.entries(rotulos).map(([k, rot]) =>
      `<label class="campo"><span>${rot}</span><input type="text" inputmode="decimal" data-fator="${k}" data-key="fator-${k}" value="${paraCampo(f[k])}"></label>`).join("");
  }

  /** quatro pernas: as duas hipóteses lado a lado, para o memorial mostrar a diferença */
  function comparacaoHipoteses(r) {
    const c = r.comparacao, el = c.elastica.maiorTracaoKN, dg = c.diagonais.maiorTracaoKN;
    const usada = r.hipotese === "pares diagonais" ? "diagonais" : "elastica";
    const linha = (k, nome, modelo, T, skl) => `<tr class="${k === usada ? "adotada" : ""}">
      <td>${nome}${k === usada ? " <b>(adotada)</b>" : ""}</td><td>${modelo}</td>
      <td class="num">${F.num(skl, 2)}</td><td class="num">${F.kn(T)}</td><td class="num">${F.ton(T / G)}</td></tr>`;
    return `
      <h3 class="capa__h">Comparação das hipóteses nas quatro pernas</h3>
      <table class="tab">
        <thead><tr><th>Hipótese</th><th>Modelo</th><th class="num">SKL</th>
          <th class="num">Maior tração</th><th class="num">Maior tração</th></tr></thead>
        <tbody>
          ${linha("elastica", "Elástica × SKL (DNV-ST-N001)",
            "corpo rígido sobre 4 molas, k = EA·cos²β/L; ΣV = W, ΣMx = ΣMy = 0 + compatibilidade", el, c.elastica.skl)}
          ${linha("diagonais", "Pares diagonais (envoltória)",
            "um par diagonal sustenta 100 % do peso, o outro frouxo; sem SKL", dg, 1)}
        </tbody>
      </table>
      <p>Hipótese adotada: <b>${usada === "diagonais" ? "pares diagonais (envoltória)" : "elástica × SKL (DNV-ST-N001)"}</b>
        · maior tração de projeto <b>${F.kn(usada === "diagonais" ? dg : el)}</b>
        · razão diagonais / elástica × SKL = <b>${F.num(dg / el, 2)}</b>.</p>`;
  }

  /* ------------------------------------------------------------ passos do memorial
   * Usados na tela e no arquivo do SMath: a mesma conta, escrita num lugar só. */
  function passosPeso(ic, r) {
    return [
      {
        formula: "W = m · g",
        sub: `W = ${F.num(massaParaTela(ic.massa), 2)} ${uMassa()} × 9,80665 m/s²`,
        resultado: `W = ${F.num(r.pesoKN, 2)} kN`
      },
      {
        formula: "W_proj = W · γ_peso · γ_CoG · DAF",
        sub: `W_proj = ${F.num(r.pesoKN, 2)} × ${F.num(r.fatores.peso, 2)} × ${F.num(r.fatores.cog, 2)} × ${F.num(r.fatores.daf, 3)}`,
        resultado: `W_proj = ${F.num(r.pesoProjKN, 2)} kN`
      }
    ];
  }

  /** p: perna resolvida; pt: o ponto dela; H: altura do gancho */
  function passosPerna(r, p, pt, H) {
    return [
      {
        formula: `L_${p.nome} = |G − ${p.nome}|`,
        sub: `L_${p.nome} = |(0,0,${F.num(H, 0)}) − (${F.num(pt.x, 0)},${F.num(pt.y, 0)},${F.num(pt.z, 0)})|`,
        resultado: `L_${p.nome} = ${F.num(p.comprimento, 0)} mm`
      },
      {
        formula: `cos(β_${p.nome}) = (H − z)/L_${p.nome}`,
        sub: `cos(β_${p.nome}) = (${F.num(H, 0)} − ${F.num(pt.z, 0)})/${F.num(p.comprimento, 0)} = ${F.num(Math.cos(p.angulo * Math.PI / 180), 3)}`,
        resultado: `β_${p.nome} = ${F.grau(p.angulo)}`
      },
      {
        formula: `T_${p.nome} = V_${p.nome} / cos(β_${p.nome})   — V_${p.nome} do equilíbrio do sistema (hipótese: ${r.hipotese}${r.fatores.skl !== 1 ? `, já com SKL ${F.num(r.fatores.skl, 2)}` : ""})`,
        sub: `T_${p.nome} = ${F.kn(p.vertical)} / ${F.num(Math.cos(p.angulo * Math.PI / 180), 3)}`,
        resultado: `T_${p.nome} = ${F.kn(p.tracao)}`
      }
    ];
  }

  /* ------------------------------------------------------------ resultado */
  function pintarResultado() {
    const ic = atual();
    const r = resolver(ic);
    const P = pontosDe(ic), H = alturaGancho(ic);

    $("avisos").innerHTML = r.avisos.map(a => `<div class="aviso">⚠ ${F.esc(a)}</div>`).join("");

    $("memorial-peso").innerHTML = memorial(passosPeso(ic, r));

    const maior = Math.max(...r.pernas.map(p => p.tracao));
    const menor = Math.min(...r.pernas.map(p => p.tracao));
    const desiguais = maior - menor > 0.05;
    $("tab-cargas").innerHTML = `
      <thead><tr><th>Perna</th><th>Comprimento</th><th>Ângulo c/ a ${r.peca || r.pilar ? "horizontal" : "estrutura"}</th><th>Ângulo c/ a vertical</th>
        <th>Vertical</th><th>Tração</th><th>Tração</th><th>Horizontal</th></tr></thead>
      <tbody>${r.pernas.map((p, i) => `<tr class="${desiguais && p.tracao >= maior - 1e-6 ? "maior" : ""}">
        <td>${F.esc(p.nome)}</td>
        <td class="num">${txtComp(p.comprimento)}</td>
        <td class="num">${F.grau(90 - p.angulo)}</td>
        <td class="num">${F.grau(p.angulo)}</td>
        <td class="num">${F.kn(p.vertical)}</td>
        <td class="num">${F.kn(p.tracao)}</td>
        <td class="num">${F.ton(p.toneladas)}</td>
        <td class="num som">${F.kn(p.horizontal)}</td></tr>
      <tr class="linha-formula"><td colspan="8">${memorial(passosPerna(r, p, P[i], H))}</td></tr>`).join("")}</tbody>
      <tfoot>
        <tr><td>Soma das verticais de projeto</td><td colspan="3"></td>
          <td class="num">${F.kn(r.somaVerticaisProjKN)}</td>
          <td colspan="3" class="som">${r.pernas.length <= 2 ? ""
            : r.hipotese === "pares diagonais" ? "na hipótese de pares diagonais cada par sustenta a carga inteira"
            : `o SKL ${F.num(r.fatores.skl, 2)} faz a soma passar do peso de projeto`}</td></tr>
        <tr><td>Carga no gancho</td><td colspan="3"></td>
          <td class="num">${F.kn(r.cargaGanchoKN)}</td>
          <td class="num">${F.ton(r.cargaGanchoKN / G)}</td><td colspan="2" class="som">peso de projeto</td></tr>
      </tfoot>`;

    $("comparacao-hipoteses").innerHTML = r.comparacao ? comparacaoHipoteses(r) : "";

    $("fig-3d-cargas").innerHTML = IC.iso3d.desenhar(r, { modo: "cargas", comp: txtComp });
    // com uma linga só, a planta é um ponto em cima do CG: um quadro vazio que não diz nada
    const umPonto = TIPOS[ic.tipo].unica;
    $("fig-planta").style.display = umPonto ? "none" : "";
    $("fig-planta").innerHTML = umPonto ? "" : IC.fbd.planta(r);
    $("fig-elevacao").innerHTML = IC.fbd.elevacao(r);

    const f = r.fatores;
    const maiorEstudo = Math.max(...E.icamentos.map(x => resolver(x).maiorTracaoT));
    // uma caixa por içamento; a do que está aberto fica realçada e traz os controles
    const caixaResumo = (x, i) => {
      const rx = resolver(x);
      const fx = rx.fatores;
      const aberto = i === E.atual;
      return `<section class="resumo__ic${aberto ? " is-atual" : ""}" data-resumo="${i}"
                 ${aberto ? 'aria-current="true"' : ""}>
        <h3>${F.esc(x.nome)}${aberto ? "" : ` <span class="resumo__ver">ver</span>`}</h3>
        <div class="destaque">
          <div class="rot">Maior tração por perna</div>
          <div class="valor">${F.num(rx.maiorTracaoT, 2)} t</div>
          <div class="rot">${F.kn(rx.maiorTracaoKN)} · ${F.esc(rx.hipotese)}</div>
        </div>
        <div class="painel">
          <div class="item"><span>Massa</span><b>${F.num(massaParaTela(x.massa), 2)} ${uMassa()}</b></div>
          <div class="item"><span>Arranjo</span><b>${F.esc(TIPOS[x.tipo].nome)}</b></div>
          ${aberto ? `
            <div class="item"><span>Peso do corpo</span><b>${F.kn(rx.pesoKN)}</b></div>
            <div class="item"><span>Peso de projeto</span><b>${F.kn(rx.pesoProjKN)}</b></div>
            <div class="item"><span>Ângulo da perna</span><b>${TIPOS[x.tipo].unica ? "vertical (linga única)" : `${F.grau(x.angulo)} c/ a ${TIPOS[x.tipo].pilar ? "horizontal" : "estrutura"}`}</b></div>
            <div class="item"><span>Altura do gancho</span><b>${txtComp(alturaGancho(x))}</b></div>
            <div class="item"><span>γ_peso × γ_CoG × DAF</span><b>${F.num(fx.peso, 2)} × ${F.num(fx.cog, 2)} × ${F.num(fx.daf, 3)}</b></div>
            <div class="item"><span>SKL</span><b>${F.num(fx.skl, 2)}</b></div>` : ""}
        </div>
        ${aberto ? `
          <label class="campo"><span>Linga</span>
            <select id="ic-linga">
              <option value="propria"${x.lingaPropria ? " selected" : ""}>dimensionar para este içamento</option>
              <option value="padrao"${x.lingaPropria ? "" : " selected"}>usar a maior carga do estudo (${F.num(maiorEstudo, 2)} t)</option>
            </select></label>
          ${!x.lingaPropria && modeloDe(x) !== x ? `<p class="etiqueta" id="dica-linga">Linga, manilha e olhal iguais aos de
            <b>${F.esc(modeloDe(x).nome)}</b>, o içamento de maior carga. Mudar um deles aqui muda lá também.</p>` : ""}
          <div class="linha-campos">
            <button type="button" class="bt bt--peq bt--fantasma" id="bt-duplicar">Duplicar</button>
            <button type="button" class="bt bt--peq bt--risco" id="bt-remover">Remover</button>
          </div>
          <span class="etiqueta">${F.esc((FAT.bases[x.base] || {}).referencia || "")}</span>` : ""}
      </section>`;
    };

    $("resumo").innerHTML = E.icamentos.map(caixaResumo).join("")
      + `<section class="resumo__estudo">
          <h3>Estudo</h3>
          <div class="painel">
            <div class="item"><span>Içamentos</span><b>${E.icamentos.length}</b></div>
            <div class="item"><span>Maior carga de perna</span><b>${F.num(maiorEstudo, 2)} t</b></div>
          </div>
        </section>`;

    $("rodape-dir").textContent = `${E.icamentos.length} içamento(s) · ${F.hoje()}`;
    $("topo-sub").textContent = E.nome || "memorial de cálculo e lista de material";
  }

  /* ------------------------------------------------------------ fichas técnicas (uma linha por dimensão,
   * do jeito que o memorial de referência apresenta cada cota calculada separadamente) */
  const ROTULOS_LINGA = {
    diametro: "Diâmetro (mm)", peso: "Peso nominal (kgf/m)",
    ruptura1770: "Ruptura mínima — 1770 N/mm² (kN)", ruptura1960: "Ruptura mínima — 1960 N/mm² (kN)",
    ruptura2160: "Ruptura mínima — 2160 N/mm² (kN)", dimB: "Olhal — dimensão B (mm)", dimC: "Olhal — dimensão C (mm)"
  };
  const ROTULOS_MANILHA = {
    codigo: "Código", cmt: "CMT — carga máxima de trabalho (t)", peso: "Peso (kg)",
    a: "a — diâmetro do corpo (mm)", b: "b — diâmetro do pino (mm)",
    c: "c — largura do corpo, de lado (mm)", d: "d — largura da orelha (mm)",
    e: "e — boca (mm)", f: "f — comprimento interno (mm)",
    g: "g — diâmetro interno do arco (mm)", h: "h — comprimento total (mm)",
    i: "i — largura total (mm)", j: "j — largura externa do arco (mm)",
    k: "k — ver o catálogo (mm)"
  };
  const ROTULOS_SAPATILHO = {
    codigo: "Código", cabo: "Cabo (polegada)", diametroCabo: "Diâmetro do cabo (mm)",
    peso: "Peso (kg)",
    a: "a — comprimento total (mm)", b: "b — comprimento interno (mm)",
    c: "c — altura total (mm)", d: "d — altura interna (mm)",
    e: "e — largura total (mm)", f: "f — largura da ranhura (mm)"
  };

  /** bloco de fórmulas com os números já substituídos — como o memorial de referência mostra */
  /**
   * Cada passo é {formula, sub, resultado} — fórmula simbólica, substituição com os números
   * e o resultado, cada um em sua linha (do jeito que memoriais de cálculo mostram). Aceita
   * também string solta, tratada como o resultado de um passo sem fórmula/substituição.
   */
  /**
   * Memorial de cálculo: as contas à esquerda e, ao lado, o que cada letra quer dizer e em
   * que unidade. A legenda sai do próprio texto das fórmulas (IC.simbolos), então acompanha
   * o que está sendo mostrado — e ocupa o espaço que sobrava à direita.
   */
  function memorial(passos) {
    const arr = (Array.isArray(passos) ? passos : [passos]).filter(Boolean)
      .map(p => (typeof p === "string" ? { resultado: p } : p));
    if (!arr.length) return "";

    const texto = arr.map(p => [p.formula, p.resultado].filter(Boolean).join(" ")).join(" ");
    const simbolos = (window.IC && IC.simbolos) ? IC.simbolos.noTexto(texto) : [];
    const legenda = simbolos.length ? `
      <div class="formulas__legenda">
        <div class="formulas__titulo">O que é cada letra</div>
        ${simbolos.map(sb => `<div class="simbolo">
          <span class="simbolo__k">${F.mat(sb.k)}</span>
          <span class="simbolo__d">${F.esc(sb.desc)}</span>
          <span class="simbolo__u${/^[\s\-–—]*$/.test(sb.un || "") ? " simbolo__u--vazio" : ""}">${F.esc(sb.un)}</span>
        </div>`).join("")}
      </div>` : "";

    return `<div class="formulas${simbolos.length ? " formulas--com-legenda" : ""}">
      <div class="formulas__contas">
        <div class="formulas__titulo">Memorial de cálculo</div>
        ${arr.map(p => `<div class="passo">
          ${p.formula ? `<div class="passo__formula">${F.mat(p.formula)}</div>` : ""}
          ${p.sub ? `<div class="passo__sub">${F.mat(p.sub)}</div>` : ""}
          ${p.resultado ? `<div class="passo__resultado">${F.mat(p.resultado)}</div>` : ""}
        </div>`).join("")}
      </div>
      ${legenda}
    </div>`;
  }

  /** tabela de 2 colunas (campo, valor) — uma ficha técnica, campo a campo */
  /**
   * Ficha técnica de uma peça. Deixou de ser tabela: numa tabela larga o valor ia parar do
   * outro lado da linha, longe do rótulo. Agora é uma grade que se reparte em duas (ou mais)
   * colunas quando há largura, com o valor sempre ao lado do seu rótulo.
   */
  function ficha(titulo, obj, campos, rotulos) {
    if (!obj) return "";
    const val = v => typeof v === "number" ? F.num(v, 2) : F.esc(String(v));
    const itens = campos.filter(c => c in obj).map(c =>
      `<div class="ficha__item"><span>${F.esc(rotulos[c] || c)}</span><b>${val(obj[c])}</b></div>`).join("");
    return `<div class="ficha">
      <div class="ficha__t">${F.esc(titulo)}</div>
      <div class="ficha__grade">${itens}</div>
    </div>`;
  }

  /* ------------------------------------------------------------ linga */
  function pintarLinga() {
    const ic = atual();
    $("ic-linga-tipo").innerHTML = Object.entries(IC.lingas.tipos)
      .map(([k, t]) => `<option value="${k}"${k === ic.linga.tipo ? " selected" : ""}>${F.esc(t.nome)}</option>`).join("");
    $("ic-linga-cat").value = ic.linga.categoria;
    $("ic-linga-term").innerHTML = Object.entries(FAT.terminacoes).map(([k, t]) =>
      `<option value="${k}"${k === (ic.linga.terminacao || "manual") ? " selected" : ""}>${F.esc(t.nome)} — γs ${F.num(t.gs, 2)}</option>`).join("");
    const lgN001 = (FAT.bases[modeloDe(ic).base] || FAT.bases.N001).linga.modelo === "N001";
    $("ic-linga-term").closest(".campo").style.display = lgN001 ? "" : "none";
    $("ic-linga-topo").value = ic.linga.topo === "gancho" ? "gancho" : "sapatilho";
    $("ic-linga-topo").closest(".campo").style.display = lgN001 ? "" : "none";
    $("ic-linga-dtopo").value = paraCampo(Number(ic.linga.dTopo) || 0);
    $("ic-linga-dtopo").closest(".campo").style.display = lgN001 && ic.linga.topo === "gancho" ? "" : "none";

    const rig = riggingDe(ic);
    const l = rig.linga;
    if (!l.ok) {
      $("resultado-linga").innerHTML = `<div class="aviso aviso--erro">Nenhum cabo da tabela atende à MBL requerida (${F.kn(l.mblReqKN)}).</div>`;
      return;
    }
    // caixa larga: os números e o cabo à esquerda, o memorial (com a legenda das letras) à direita
    $("resultado-linga").innerHTML = `<div class="linga-par">
      <div class="linga-par__col">
        <div class="painel">
          <div class="item"><span>Carga governante</span><b>${F.kn(rig.cargaGov)} · ${F.ton(rig.cargaGov / G)}</b></div>
          ${l.n001 ? `<div class="item"><span>Terminação (γs)</span><b>${F.esc(l.fl.terminacao)} — ${F.num(l.fl.gs, 2)}</b></div>
          <div class="item"><span>Dobra no sapatilho, olho inferior (γb)</span><b>${F.num(l.fatores.gbSap, 3)} (D ${F.num(l.fatores.D, 1)} mm)</b></div>
          <div class="item"><span>Dobra no olho superior (γb)</span><b>${F.num(l.fatores.gbTopo, 3)}${l.fatores.Dtopo
            ? ` (D ${F.num(l.fatores.Dtopo, 1)} mm${l.fatores.Dtopo < l.diametro ? " — menor que o cabo: só o olho pode dobrar assim, 16.4.8.5" : ""})`
            : ic.linga.topo === "gancho" ? " — informe o D do gancho ou elo" : " (com sapatilho)"}</b></div>` : ""}
          <div class="item"><span>${l.n001 ? "Fator de segurança γsf (DNV-ST-N001 16.4.3)" : "FS da linga"}</span><b>${F.num(l.fsLinga, 3)}</b></div>
          <div class="item"><span>MBL requerida</span><b>${F.kn(l.mblReqKN)}</b></div>
          <div class="item"><span>Utilização (MBL requerida / MBL do cabo)</span><b>${F.num(l.utilizacao * 100, 0)} %</b></div>
        </div>
        ${ficha(`Cabo escolhido — ${IC.lingas.tipos[l.tipo].nome}`, l.linha,
          ["diametro", "peso", "ruptura" + l.categoria, "dimB", "dimC"], ROTULOS_LINGA)}
      </div>
      <div class="linga-par__col linga-par__col--mem">${memorial(l.formula)}</div>
    </div>`;
  }

  /* ------------------------------------------------------------ sapatilho e manilha */
  function pintarSapatilhoManilha() {
    const ic = atual();
    // o tipo de manilha é escolha da manilha: o seletor mora na caixa dela, não no alto da
    // etapa, que é de sapatilho E manilha
    const opcoesTipo = Object.entries(IC.manilhas.tipos)
      .map(([k, t]) => `<option value="${k}"${k === ic.manilhaTipo ? " selected" : ""}>${F.esc(t.nome)}</option>`).join("");

    const rig = riggingDe(ic);
    const s = rig.sapatilho, m = rig.manilha;
    let html = "";
    // a escolha da manilha fica numa faixa larga acima das peças: dentro da coluna da manilha ela
    // a deixava ~300px mais alta que a do sapatilho, com um vazio embaixo do sapatilho
    let pecas = `<div class="pecas-par">`;
    pecas += s.ok
      ? `<div class="peca-bloco"><h4 class="peca-bloco__t">Sapatilho</h4>
         <div class="ficha-par ficha-par--col">
          <figure class="fig-topo">${FIG.sapatilho(s.sapatilho)}</figure>
          ${ficha("Sapatilho escolhido", s.sapatilho, ["codigo", "cabo", "diametroCabo", "a", "b", "c", "d", "e", "f", "peso"], ROTULOS_SAPATILHO)}
        </div></div>`
      : `<div class="peca-bloco"><div class="aviso aviso--erro">Nenhum sapatilho cadastrado para Ø ${F.num(rig.linga.diametro, 1)} mm.</div></div>`;

    html += `<div class="peca-bloco escolha-manilha"><h4 class="peca-bloco__t">Escolha da manilha</h4>
      <div class="escolha-manilha__grade">
      <label class="campo"><span>Tipo de manilha</span>
        <select id="ic-manilha-tipo">${opcoesTipo}</select></label>`;

    // seletor manual: automático (o programa já procura a menor manilha que passa em todos os
    // casos de encaixe) ou uma manilha específica, escolhida à mão
    const opcoes = [`<option value="">automático — ${m.manilha ? F.esc(m.manilha.codigo) : "nenhuma atende"}${m.encaixeCompleto ? "" : " (não encaixa em tudo)"}</option>`]
      .concat((m.candidatos || []).map(c => {
        const casosC = RIG.casosEncaixe({ sapatilho: s.sapatilho, manilha: c, diametroCaboMm: rig.linga.diametro });
        const chC = RIG.encaixeChapa(c, espessuraChapa(ic));
        const tag = (casosC.length && !casosC.every(x => x.ok)) ? "✗ falha em algum caso"
          : chC && !chC.ok ? "✗ boca não serve para a chapa do olhal"
          : casosC.length ? "✓ encaixa em tudo" : "";
        return `<option value="${F.esc(c.codigo)}"${ic.manilhaCodigo === c.codigo ? " selected" : ""}>${F.esc(c.codigo)} — CMT ${F.num(c.cmt, 2)} t ${tag}</option>`;
      }));
    html += `<label class="campo"><span>Manilha (código)</span><select id="ic-manilha-codigo">${opcoes.join("")}</select></label>`;
    html += m.ok
      ? `<div class="painel">
          <div class="item"><span>Carga no pino (F.pino)</span><b>${F.kn(m.cargaKN)} · ${F.ton(m.cargaT)}</b></div>
          <div class="item"><span>Utilização (carga / CMT)</span><b>${F.num(m.utilizacao * 100, 0)} %</b></div>
        </div></div>
        ${memorial([m.formula, m.formulaCmt])}</div>`
      : `</div></div>`;

    pecas += `<div class="peca-bloco"><h4 class="peca-bloco__t">Manilha</h4>`;
    pecas += m.ok
      ? `<div class="ficha-par ficha-par--col">
          <figure class="fig-topo">${FIG.manilha(rig.manilha.ok ? rig.manilha.manilha : null)}</figure>
          ${ficha(`Manilha escolhida — ${IC.manilhas.tipos[m.tipo].nome}`, m.manilha,
            IC.manilhas.tipos[m.tipo].campos, ROTULOS_MANILHA)}
        </div>`
      : `<div class="aviso aviso--erro">Nenhuma manilha do tipo escolhido atende à carga de ${F.ton(m.cargaT)}.</div>`;
    pecas += `</div></div>`;     // fecha a coluna da manilha e o par
    html += pecas;
    // o aviso da chapa já sai na etapa 8, onde a espessura é escolhida: aqui só quando falha
    if (m.ok && m.chapa && !m.chapa.ok) html += avisoChapa(m.chapa, m.manual);
    if (m.ok && !m.encaixeCompleto) html += `<div class="aviso aviso--erro">Nenhuma manilha ${F.esc(IC.manilhas.tipos[m.tipo].nome)}
      encaixa nos 4 casos ao mesmo tempo com este sapatilho — veja qual caso falha na tabela abaixo.
      Tente outro código na lista acima, o outro tipo de manilha, ou um sapatilho/linga de outra bitola.</div>`;
    $("resultado-sapatilho-manilha").innerHTML = html;

    $("tab-encaixe").innerHTML = rig.casos.length ? `
      <thead><tr><th>Caso</th><th>Verificação</th><th>Critério</th><th>Valores</th><th>Resultado</th></tr></thead>
      <tbody>${rig.casos.map(c => `<tr>
        <td>${c.n}</td><td>${F.esc(c.nome)}</td><td class="som">${F.esc(c.formula)}</td>
        <td class="num">${F.num(c.a, 1)} / ${F.num(c.b, 1)} mm</td>
        <td class="selo-cel"><span class="selo ${c.ok ? "selo--ok" : "selo--erro"}">${c.ok ? "OK" : "falha"}</span></td>
      </tr>
      <tr class="linha-formula"><td colspan="5">${memorial({
        formula: c.formula,
        sub: `${F.num(c.a, 1)} mm ${c.ok ? ">" : "≤"} ${F.num(c.b, 1)} mm`,
        resultado: c.ok
          ? `passa, com folga de ${F.num(c.a - c.b, 1)} mm`
          : `não passa — faltam ${F.num(c.b - c.a, 1)} mm`
      })}</td></tr>`).join("")}</tbody>` : "";

    // a mesma verificação, desenhada: o vão de que se dispõe e a peça que precisa passar
    const figEnc = $("fig-encaixe");
    if (figEnc) figEnc.innerHTML = rig.casos.length
      ? FIG.encaixe(rig.casos, s.sapatilho, m.manilha, rig.linga.diametro)
      : "";
  }

  /** chapa do olhal × boca da manilha: entra na boca, sem passar da folga máxima */
  function avisoChapa(ch, manual) {
    const dica = ch.ok ? ""
      : !ch.cabe ? manual
        ? " Escolha uma manilha de boca maior ou diminua a espessura/reforço da chapa."
        : " Nenhuma manilha do tipo escolhido, com CMT suficiente, recebe esta chapa: diminua a espessura ou o reforço."
      : manual
        ? " Escolha uma manilha menor (se a carga permitir) ou engrosse a chapa / ponha reforço."
        : " Nenhuma manilha com CMT suficiente fica justa nesta chapa: engrosse a chapa ou ponha reforço (t.anel) até a folga ficar dentro do limite.";
    return `<div class="${ch.ok ? "aviso" : "aviso aviso--erro"}">
      <span class="selo ${ch.ok ? "selo--ok" : "selo--erro"}">${ch.ok ? "OK" : "falha"}</span>
      Chapa do olhal na boca da manilha: t + 2·t.anel = ${F.num(ch.espessura, 1)} mm, boca e = ${F.num(ch.boca, 1)} mm,
      folga ${F.num(ch.folga, 1)} mm — tem que ficar entre 0 e ${F.num(ch.folgaMax, 2)} mm
      (t mínimo ${F.num(ch.tMin, 1)} mm).${dica}</div>`;
  }

  /* ------------------------------------------------------------ olhal */
  const ROTULOS_OLHAL = {
    codigo: "Código", cmt: "CMT — carga máxima de trabalho (t)", rosca: "Rosca",
    b: "b — diâmetro da base (mm)", c: "c — diâmetro externo do olho (mm)",
    d: "d — diâmetro interno do olho (mm)", e: "e — comprimento total (mm)",
    f: "f — espessura da base (mm)", g: "g — diâmetro da haste (mm)", peso: "Peso (kg)"
  };

  const ROTULOS_GEOM = {
    t: "t — espessura da chapa (mm)", tAnel: "t.anel — reforço, cada lado (mm)",
    base: "base — largura da chapa (mm)", h: "h — do pé ao centro do furo (mm)",
    R: "R — raio do topo (mm)", rAnel: "R.anel — raio do reforço (calculado, mm)",
    dFuro: "Ø furo — recebe o pino (mm)"
  };

  // o que a pessoa escolhe e o que sai da manilha — a confusão era tudo aparecer junto
  const GEOM_ESCOLHA = ["base", "h"];          // t e t.anel têm lista própria, abaixo
  const GEOM_ESPESSURA = ["t", "tAnel"];       // espessuras comerciais de chapa
  // dFuro, R e rAnel não têm campo: saem da manilha e aparecem como resultado

  /** Fy do olhal: vem do aço escolhido; só é digitado quando o aço é "outro" */
  function acoDoOlhal(ic) {
    if (!ic.olhal.aco) ic.olhal.aco = "A131AH36";       // o do memorial de referência
    return IC.acos.de(ic.olhal.aco);
  }
  function fyDoOlhal(ic) {
    const a = acoDoOlhal(ic);
    if (a.fy) return a.fy;
    return Number(ic.olhal.fy) || 355;                   // aço fora da lista
  }

  function pintarOlhal() {
    const ic = atual();
    $("ic-olhal-modo").value = ic.olhal.modo;
    $("campo-olhal-comprado").style.display = ic.olhal.modo === "comprado" ? "" : "none";
    $("ic-olhal-tipo").innerHTML = Object.entries(IC.olhais.tipos)
      .map(([k, t]) => `<option value="${k}"${k === ic.olhal.tipoComprado ? " selected" : ""}>${F.esc(t.nome)}</option>`).join("");
    const aco = acoDoOlhal(ic);
    $("ic-olhal-aco").innerHTML = IC.acos.lista.map(a =>
      `<option value="${a.id}"${a.id === aco.id ? " selected" : ""}>${F.esc(a.nome)}${a.fy ? ` — Fy ${a.fy} MPa` : ""}</option>`).join("");
    // o Fy só é campo quando o aço é "outro"; nos demais ele é o valor do aço
    const fyLivre = !aco.fy;
    $("ic-olhal-fy").value = paraCampo(fyDoOlhal(ic));
    $("ic-olhal-fy").disabled = !fyLivre;
    $("ic-olhal-fy").title = fyLivre
      ? "Aço fora da lista: informe o Fy do certificado do material."
      : `Vem do aço escolhido (${aco.nome}).`;
    $("campo-olhal-fy").style.display = ic.olhal.modo === "comprado" ? "none" : "";
    $("ic-olhal-aco").parentElement.style.display = ic.olhal.modo === "comprado" ? "none" : "";

    const rig = riggingDe(ic);
    const o = olhalDe(ic, rig);
    const gov = o.governante;
    const dono = modeloDe(ic);
    const quais = `${o.qtd} olhal(is) iguais — ${o.nomes.join(", ")}`
      + (dono !== ic ? ` · o mesmo olhal de ${dono.nome} (maior carga do estudo)` : "");

    if (o.modo === "comprado") {
      const r = o.resultado;
      $("resultado-olhal").innerHTML = !r.ok
        ? `<div class="aviso aviso--erro">Nenhum olhal comercial atende ${F.ton(r.cargaT)} com pino Ø ${F.num(r.pinoMm, 1)} mm.</div>`
        : `<div class="olhal-par">
            <figure class="fig-topo" id="fig-olhal">${FIG.olhalComprado(r.olhal)}</figure>
            <div class="olhal-bloco"><h4>${F.esc(quais)}</h4>
              <div class="painel">
                <div class="item"><span>Dimensionado pela perna</span><b>${F.esc(gov.nome)} — a mais carregada</b></div>
                <div class="item"><span>Carga</span><b>${F.kn(rig.cargaGov)} · ${F.ton(r.cargaT)}</b></div>
                <div class="item"><span>Modelo</span><b>${F.esc(r.olhal.codigo)}</b></div>
                <div class="item"><span>Rosca</span><b>${F.esc(r.olhal.rosca || "—")}</b></div>
                <div class="item"><span>Utilização (carga / CMT)</span><b>${F.num(r.utilizacao * 100, 0)} %</b></div>
              </div>
              ${memorial(`CMT ≥ carga → ${F.num(r.olhal.cmt, 2)} t ≥ ${F.num(r.cargaT, 2)} t`)}
              ${ficha("Olhal escolhido", r.olhal,
                 ["codigo", "cmt", "rosca", "b", "c", "d", "e", "f", "g", "peso"], ROTULOS_OLHAL)}
            </div>
          </div>`;
      return;
    }

    const g = o.geom, v = o.verif;
    const mn = rig.manilha.ok ? rig.manilha.manilha : null;
    const campo = k => `<label class="campo"><span>${ROTULOS_GEOM[k]}</span>
      <input type="text" inputmode="decimal" data-olhal-campo="${k}" data-key="olhal-${k}" value="${paraCampo(g[k])}"></label>`;

    // espessura: só bitola que se compra. O valor atual entra na lista mesmo que não seja
    // comercial (projeto antigo, chapa de sobra), marcado como fora de tabela.
    const campoEspessura = k => {
      const atual = Number(g[k]) || 0;
      const naLista = IC.chapas.daEspessura(atual);
      const opcoes = IC.chapas.lista.map(c =>
        `<option value="${c.mm}"${Math.abs(c.mm - atual) < 0.01 ? " selected" : ""}>${F.esc(c.texto)}</option>`);
      if (k === "tAnel") opcoes.unshift(`<option value="0"${atual === 0 ? " selected" : ""}>sem reforço</option>`);
      if (!naLista && atual > 0) opcoes.push(
        `<option value="${atual}" selected>${F.num(atual, 2)} mm — fora de tabela</option>`);
      return `<label class="campo"><span>${ROTULOS_GEOM[k]}</span>
        <select data-olhal-campo="${k}" data-key="olhal-${k}">${opcoes.join("")}</select></label>`;
    };

    // medida que sai do cálculo: mostra o valor, sem campo para editar

    // a chapa, com o reforço, tem que entrar na boca da manilha sem ficar folgada demais
    const chapa = RIG.encaixeChapa(mn, espessuraChapa(ic));

    $("resultado-olhal").innerHTML = `
      <div class="olhal-bloco olhal-bloco--largo">
        <h4>${F.esc(quais)}</h4>
        <div class="painel">
          <div class="item"><span>Dimensionado pela perna</span><b>${F.esc(gov.nome)} — a mais solicitada no olhal</b></div>
          <div class="item"><span>Força da linga (F.linga)</span><b>${F.kn(gov.tracao)}</b></div>
          <div class="item"><span>Carga no pino F.pino = 1,30 · F.linga (N-2683 5.2)</span><b>${F.kn(v.FpinoKN)}</b></div>
          <div class="item"><span>Ângulo da linga com o eixo do olhal</span><b>${F.grau(o.angulo.eixo)}</b></div>
          <div class="item"><span>Ângulo da linga com a base do olhal (θ)</span><b>${F.grau(o.angulo.base)}</b></div>
        </div>
        ${o.porPerna.length > 1 ? `<table class="tab">
          <thead><tr><th>Perna</th><th class="num">F.linga</th><th class="num">c/ o eixo do olhal</th>
            <th class="num">θ c/ a base</th><th class="num">Maior utilização</th></tr></thead>
          <tbody>${o.porPerna.map(x => `<tr class="${x.perna === gov ? "maior" : ""}">
            <td>${F.esc(x.perna.nome)}</td><td class="num">${F.kn(x.perna.tracao)}</td>
            <td class="num">${F.grau(x.angulo.eixo)}</td><td class="num">${F.grau(x.angulo.base)}</td>
            <td class="num">${F.num(piorUtilizacao(x.verif) * 100, 0)} %</td></tr>`).join("")}</tbody></table>` : ""}
        <p class="dica">O olhal é verificado em cada perna, com a carga e o ângulo real entre a linga e ele;
          governa a de maior utilização. θ é o ângulo com a base do olhal: 90° = a linga puxa no eixo dele.</p>
        ${o.porPerna.filter(x => x.angulo.eixo > 90).map(x => `<div class="aviso aviso--erro">⚠ ${F.esc(x.perna.nome)}: a linga
          puxa por baixo do plano da base do olhal (${F.grau(x.angulo.eixo)} com o eixo) — gire o olhal para a linga.</div>`).join("")}
      </div>

      <div class="olhal-par">
        <figure class="fig-topo" id="fig-olhal">${FIG.olhal(g)}</figure>
        <div>
          <div class="olhal-bloco">
            <h4 class="so-tela">Medidas que você escolhe</h4>
            <div class="olhal-geom">${GEOM_ESPESSURA.map(campoEspessura).join("")}${GEOM_ESCOLHA.map(campo).join("")}
              ${camposSolda(soldaDe(ic), g)}</div>
            <p class="dica">A <b>espessura</b> vem da lista de chapa comercial — é a bitola que se
              compra. Ela tem que caber na boca W da manilha com folga de até mín(0,25·W ; 12 mm)
              (N-2683 4.2.3.2) — na escolha automática, mudar a espessura troca a manilha. <b>Base</b> e <b>altura</b> definem o
              tamanho da chapa. O <b>reforço</b> é opcional: escolha "sem reforço" se o olhal não
              tiver anel.</p>
          </div>
          <div class="olhal-bloco">
            <h4>Medidas que vêm da manilha${mn ? ` <span class="olhal-bloco__tag">${F.esc(mn.codigo)}</span>` : ""}</h4>
            ${mn ? `<p class="dica" style="margin:-2px 0 6px;">${F.esc(IC.manilhas.tipos[rig.manilha.tipo].nome)} —
              CMT ${F.num(mn.cmt, 2)} t · pino Ø ${F.num(mn.b, 1)} mm · boca ${F.num(mn.e, 1)} mm (etapa 7)</p>` : ""}
            <div class="painel">
              <div class="item"><span>Ø furo — recebe o pino</span><b>${F.num(g.dFuro, 2)} mm</b></div>
              <div class="item"><span>R — raio do topo</span><b>${F.num(g.R, 1)} mm</b></div>
              <div class="item"><span>R.anel — raio do reforço</span><b>${F.num(g.rAnel, 1)} mm</b></div>
            </div>
            ${mn ? memorial(passosFuro(mn, g)) : ""}
            <p class="dica">São calculadas a partir da manilha — mudou a manilha na etapa 7,
              mudam aqui e no desenho.</p>
          </div>
        </div>
      </div>

      ${chapa ? avisoChapa(chapa, rig.manilha.manual) : ""}

      <table class="tab">
        <thead><tr><th>#</th><th>Verificação</th><th>Solicitante</th><th>Limite</th><th>Utilização</th><th></th></tr></thead>
        <tbody>${v.checks.map(c => `<tr>
          <td>${c.n}</td><td>${F.esc(c.nome)}</td>
          <td class="num">${valorCheck(c, c.tensao)}</td>
          <td class="num">${valorCheck(c, c.admissivel)}</td>
          <td class="num"><div class="barra${c.utilizacao > 1 ? " estourou" : ""}"><i style="width:${Math.min(100, c.utilizacao * 100)}%"></i></div>${F.num(c.utilizacao * 100, 0)}%</td>
          <td class="selo-cel"><span class="selo ${c.ok ? "selo--ok" : "selo--erro"}">${c.ok ? "OK" : "falha"}</span></td>
        </tr>
        <tr class="linha-formula"><td colspan="6">${memorial(c.formula)}</td></tr>`).join("")}</tbody>
      </table>
      ${v.soldaBase.tipo === "penetracao" ? `<p>Solda do olhal na estrutura: <b>penetração total</b> — resistência igual à da
        chapa, verificada pelos itens de força axial, flexões, tensões combinadas e cisalhamento na base
        (N-2683 5.4.10${g.t >= 12.7 ? "; chapa ≥ 12,7 mm, conforme a nota de 4.5" : ""}).</p>` : ""}`;


  }

  /** solda do olhal na estrutura: tipo, lado do filete e eletrodo */
  function camposSolda(sd, g) {
    const sel = (id, ops, v) => `<select data-olhal-solda="${id}" data-key="olhal-solda-${id}">${ops.map(([k, t]) =>
      `<option value="${k}"${k === v ? " selected" : ""}>${t}</option>`).join("")}</select>`;
    return `<label class="campo"><span>Solda na estrutura</span>${sel("tipo",
        [["penetracao", "penetração total"], ["filete", "filete nas duas faces"]], sd.tipo)}</label>
      ${sd.tipo === "filete" ? `<label class="campo"><span>a — lado do filete (mm)</span>
        <input type="text" inputmode="decimal" data-olhal-solda="a" data-key="olhal-solda-a"
          value="${paraCampo(Number(sd.a) > 0 ? sd.a : RIG.fileteMinimo(Number(g.t) || 0))}"></label>` : ""}
      <label class="campo"><span>Eletrodo</span>${sel("eletrodo",
        Object.entries(RIG.ELETRODOS).map(([k, fu]) => [k, `${k}xx — Fwu ${fu} MPa`]), sd.eletrodo || "E70")}</label>`;
  }

  /** solicitante/limite de uma verificação, com a unidade dela */
  const valorCheck = (c, v) => c.semUnidade ? F.num(v, 2) : `${F.num(v, c.unidade === "mm" ? 2 : 1)} ${c.unidade || "MPa"}`;

  /** Ø do furo (N-2683 5.3.1) e raio do topo, a partir da manilha */
  function passosFuro(mn, g) {
    const folga = RIG.folgaFuro(mn.b);
    return [
      { formula: "d_furo = d_pino + folga;  folga = 1 mm (d_pino ≤ 33 mm) ou mín(0,03·d_pino ; 6 mm)   (N-2683 5.3.1)",
        sub: `d_furo = ${F.num(mn.b, 1)} + ${F.num(folga, 2)}`, resultado: `d_furo = ${F.num(g.dFuro, 2)} mm` },
      { formula: "R = f − g + b/2 + 5", sub: `R = ${F.num(mn.f, 1)} − ${F.num(mn.g, 1)} + ${F.num(mn.b / 2, 1)} + 5`,
        resultado: `R = ${F.num(g.R, 1)} mm` }
    ].concat(Number(g.tAnel) > 0 ? [{ formula: "r_anel = R − n·t_anel, n = 1   (N-2683 5.3.3)",
      sub: `r_anel = ${F.num(g.R, 1)} − ${F.num(g.tAnel, 1)}`, resultado: `r_anel = ${F.num(g.rAnel, 1)} mm` }] : []);
  }

  /* ------------------------------------------------------------ lista de material */
  function pintarMaterial() {
    const ic = atual();
    const modo = ($("ic-material-modo") || {}).value || "icamento";
    const itens = modo === "estudo" ? materialConsolidado() : materialDe(ic).itens;
    const total = itens.reduce((t, it) => t + (it.massa || 0), 0);
    const faltaPeso = itens.some(it => it.massa == null);
    $("tab-material").innerHTML = `
      <thead><tr><th>Item</th><th class="num">Qtd.</th><th>Título</th><th>Especificação</th>
        <th>Material</th><th class="num">Massa (kg)</th></tr></thead>
      <tbody>${itens.map((it, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td class="num">${F.num(it.qtd, 0)}</td>
        <td>${F.esc(it.titulo)}</td>
        <td class="col-esp">${F.esc(it.especificacao)}</td>
        <td>${F.esc(it.material)}</td>
        <td class="num">${it.massa == null ? "-" : F.num(it.massa, 2) + (it.estimada ? " *" : "")}</td>
      </tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="5">Massa do conjunto de içamento${faltaPeso ? " (só dos itens com peso em catálogo)" : ""}</td>
        <td class="num">${F.num(total, 2)}</td></tr></tfoot>`;
    const nota = $("material-nota");
    if (nota) nota.innerHTML = "A massa é a <b>total da quantidade</b>, em kg. \u201c-\u201d é peso que o "
      + "catálogo da peça não traz. \u201c*\u201d é massa estimada pela chapa do olhal fabricado.";
  }

  /** textos livres do relatório (capítulos de texto do memorial no SMath e no papel) */
  const TEXTOS_RELATORIO = [
    ["introducao", "Introdução", "O que é o documento e a que obra ou estrutura se refere."],
    ["objetivo", "Objetivo", "O que este memorial demonstra."],
    ["plano", "Plano de içamento", "Como e em que etapas a estrutura será içada."],
    ["local", "Local da instalação", "Onde a estrutura será instalada (plataforma, elevação, área)."],
    ["guindaste", "Dados do guindaste", "Guindaste ou embarcação usada, documento de referência, capacidade."],
    ["referencias", "Referências", "Uma referência por linha: normas, desenhos, catálogos."]
  ];
  const textosRelatorio = () => Object.assign({}, E.textos || {});

  /** capa do relatório — só sai no papel */
  function pintarCapa() {
    const alvo = $("capa");
    if (!alvo) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
    const T = textosRelatorio();
    const linhas = E.icamentos.map(ic => {
      const r = resolver(ic);
      return `<tr><td>${F.esc(ic.nome)}</td>
        <td class="num">${F.num(massaParaTela(ic.massa), 2)} ${uMassa()}</td>
        <td>${F.esc(TIPOS[ic.tipo].nome)}</td>
        <td class="num">${F.kn(r.cargaGanchoKN)}</td>
        <td class="num">${F.ton(r.maiorTracaoT)}</td></tr>`;
    }).join("");
    alvo.innerHTML = `
      <h1 class="capa__titulo">Memorial de cálculo de içamento</h1>
      <table class="tab capa__id">
        <tbody>
          <tr><td>Estudo</td><td>${F.esc(E.nome || "—")}</td></tr>
          <tr><td>Documento</td><td>${F.esc(E.doc || "—")}</td></tr>
          <tr><td>Responsável</td><td>${F.esc(E.resp || "—")}</td></tr>
          <tr><td>Emitido em</td><td>${hoje}</td></tr>
          <tr><td>Içamentos</td><td>${E.icamentos.length}</td></tr>
        </tbody>
      </table>
      <h2 class="capa__h">Resumo dos içamentos</h2>
      <table class="tab">
        <thead><tr><th>Içamento</th><th class="num">Massa</th><th>Arranjo</th>
          <th class="num">Carga no gancho</th><th class="num">Maior tração</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      ${TEXTOS_RELATORIO.filter(([k]) => k !== "referencias" && T[k]).map(([k, rot]) =>
        `<h2 class="capa__h">${rot}</h2><p class="capa__texto">${F.esc(T[k])}</p>`).join("")}`;
    const refs = $("rel-referencias");
    if (refs) refs.innerHTML = T.referencias
      ? `<h2 class="capa__h">Referências</h2><p class="capa__texto">${F.esc(T.referencias)}</p>` : "";
  }

  /** no papel, campo de digitar não diz nada (e o select corta o texto): cada um ganha ao lado
   *  um texto com o valor que mostra, e só esse texto é impresso (desenho.css) */
  function espelharCampos() {
    // todos os campos do documento, inclusive os que ficam dentro de tabelas (coordenadas etc.)
    document.querySelectorAll(".etapas input:not([type=checkbox]):not([type=radio]):not([type=file]), .etapas select, .etapas textarea").forEach(el => {
      let sp = el.nextElementSibling;
      if (!sp || !sp.classList.contains("valor-impresso")) {
        sp = document.createElement("span");
        sp.className = "valor-impresso";
        el.after(sp);
      }
      const txt = el.tagName === "SELECT" ? (el.selectedOptions[0] ? el.selectedOptions[0].text : "") : el.value;
      sp.textContent = txt === "" ? "—" : txt;
    });
  }

  /** tabela das caixas dentro de uma faixa que rola de lado: numa tela estreita, a tabela
   *  rola dentro da caixa em vez de esticar a página inteira */
  function rolagemNasTabelas() {
    document.querySelectorAll(".etapa table.tab").forEach(t => {
      if (t.parentElement.classList.contains("tab-rolagem") || t.closest("tr.linha-formula")) return;
      const faixa = document.createElement("div");
      faixa.className = "tab-rolagem";
      t.before(faixa);
      faixa.appendChild(t);
    });
  }

  /** relatório de todos os içamentos: cada um é pintado na tela e as etapas são copiadas
   *  para uma área que só sai no papel; no fim volta o içamento que estava aberto */
  function montarTodos() {
    const alvo = $("impressao-todos");
    const volta = E.atual;
    alvo.innerHTML = "";
    E.icamentos.forEach((ic, i) => {
      E.atual = i;
      pintar();
      const bloco = document.createElement("section");
      bloco.className = "rel-icamento";
      bloco.innerHTML = `<h1 class="rel-icamento__titulo">Içamento ${i + 1} de ${E.icamentos.length} — ${F.esc(ic.nome)}</h1>`;
      const copia = $("etapas").cloneNode(true);
      copia.removeAttribute("id");
      // os campos já estão espelhados em texto; tirá-los evita que o espelhamento da hora
      // de imprimir leia o valor da cópia (o select clonado volta para a 1ª opção)
      copia.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, textarea").forEach(el => el.remove());
      renomearRefs(copia, `--r${i}`);
      bloco.appendChild(copia);
      alvo.appendChild(bloco);
    });
    E.atual = volta;
    pintar();
  }

  /** ids citados por url(#…) ou href="#…" nos desenhos: cada cópia ganha os seus, senão as
   *  setas e preenchimentos apontariam para os da etapa original (que não sai no papel) */
  function renomearRefs(raiz, suf) {
    const els = [raiz, ...raiz.querySelectorAll("*")];
    const citados = new Set();
    els.forEach(el => {
      for (const a of el.attributes) {
        for (const m of a.value.matchAll(/url\(["']?#([^)"']+)["']?\)/g)) citados.add(m[1]);
        if (/(^|:)href$/.test(a.name) && a.value.startsWith("#")) citados.add(a.value.slice(1));
      }
    });
    if (!citados.size) return;
    els.forEach(el => {
      if (el.id && citados.has(el.id)) el.id += suf;
      for (const a of [...el.attributes]) {
        let v = a.value.replace(/url\((["']?)#([^)"']+)\)/g, (t, q, id) => citados.has(id) ? `url(${q}#${id}${suf}${q})` : t);
        if (/(^|:)href$/.test(a.name) && v.startsWith("#") && citados.has(v.slice(1))) v += suf;
        if (v !== a.value) el.setAttribute(a.name, v);
      }
    });
  }

  const pintar = () => {
    sincronizarPadrao();
    pintarAbas(); pintarEntrada(); pintarResultado();
    pintarLinga(); pintarSapatilhoManilha(); pintarOlhal(); pintarMaterial(); pintarCapa();
    espelharCampos();
    rolagemNasTabelas();
    // o conteúdo acabou de ser refeito: os botões de recolher e de esconder o cálculo
    // precisam ser recolocados (o do cálculo só existe onde há cálculo)
    if (typeof pintarDobra === "function") pintarDobra();
    gravar();
  };

  /* ------------------------------------------------------------ lista de material em Excel */
  // Mesmas colunas da tela e a mesma regra do projeto 8 para o que falta: "-", não zero.
  function baixarMaterialXlsx() {
    const modo = ($("ic-material-modo") || {}).value || "icamento";
    const itens = modo === "estudo" ? materialConsolidado() : materialDe(atual()).itens;
    if (!itens.length) return;
    const linhas = itens.map((it, i) => [
      i + 1, it.qtd, it.titulo, it.especificacao, it.material,
      it.massa == null ? "-" : Math.round(it.massa * 100) / 100
    ]);
    const comPeso = itens.filter(it => it.massa != null);
    const total = comPeso.reduce((t, it) => t + it.massa, 0);
    linhas.push(["", "", "", comPeso.length === itens.length
      ? "Massa do conjunto de içamento"
      : "Massa do conjunto (só dos itens com peso em catálogo)", "", Math.round(total * 100) / 100]);

    const ic = atual();
    const titulo = [
      E.nome ? `Estudo: ${E.nome}` : "Lista de material — içamento",
      E.doc ? `Documento: ${E.doc}` : "",
      modo === "estudo" ? `Todos os içamentos do estudo (${E.icamentos.length})` : `Içamento: ${ic.nome}`,
      E.resp ? `Responsável: ${E.resp}` : ""
    ].filter(Boolean);

    const bytes = IC.xlsx.build({
      name: "Lista de material",
      cols: [6, 7, 24, 62, 30, 12],
      head: ["Item", "Qtd.", "Título", "Especificação", "Material", "Massa (kg)"],
      rows: linhas,
      title: titulo
    });
    const nome = (modo === "estudo" ? "lista_material_estudo" : "lista_material_" +
      String(ic.nome || "icamento").replace(/[^\w.-]+/g, "_")) + ".xlsx";
    baixar(nome, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  /* ------------------------------------------------------------ peças vazias para o SolidWorks
   * Uma peça para a linga e outra para a manilha, sem geometria, só com as propriedades que a
   * lista de material do conjunto lê. Os .SLDPRT saem prontos de js/core/sldprt.js, que troca
   * as propriedades de uma peça vazia salva pelo próprio SolidWorks.
   *
   * Texto no padrão das listas de material de içamento já emitidas. A eslinga é UMA peça (o
   * conjunto de pernas) e leva a massa do cabo todo; a manilha leva a massa UNITÁRIA — ela é
   * inserida uma vez por ponto no conjunto, e a quantidade sai da contagem do SolidWorks.
   * Massa em kg, sem unidade, com ponto decimal. */
  const nomeArquivo = s => String(s).replace(/[\\/:*?"<>|]+/g, "-").trim();
  // nome dentro do .zip sem acento: o descompactador do Windows nem sempre respeita UTF-8
  const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w .()-]+/g, "_");
  const massaSw = (kg, dec) => (kg == null ? "-" : String(Math.round(kg * 10 ** dec) / 10 ** dec));

  /** bitola em polegada, no jeito da lista: 5/8", 1.1/2", 2" (arredonda a 1/16") */
  function polegada(mm) {
    const n = Math.round(mm / 25.4 * 16);
    const inteiro = Math.floor(n / 16);
    let num = n % 16, den = 16;
    while (num && num % 2 === 0) { num /= 2; den /= 2; }
    const frac = num ? `${num}/${den}` : "";
    return (inteiro && frac ? `${inteiro}.${frac}` : inteiro ? `${inteiro}` : frac) + '"';
  }

  /** "1 perna com 2880 mm e 1 perna com 3100 mm" — pernas iguais (a 10 mm) juntas */
  function textoPernas(pernas) {
    const grupos = new Map();
    pernas.forEach(p => {
      const L = Math.round(p.comprimento / 10) * 10;
      grupos.set(L, (grupos.get(L) || 0) + 1);
    });
    if (grupos.size === 1) return `com ${F.num([...grupos.keys()][0], 0)} mm`;
    return ": " + [...grupos].sort((a, b) => a[0] - b[0])
      .map(([L, q]) => `${q} ${q > 1 ? "pernas" : "perna"} com ${F.num(L, 0)} mm`).join(" e ");
  }

  function pecasSolidworks(ic) {
    const rig = riggingDe(ic);
    const pernas = resolver(ic).pernas;
    const pecas = [];

    const l = rig.linga;
    if (l.ok) {
      const n = pernas.length;
      const alma = /-aco$/.test(l.tipo) ? "AACI" : "AF";
      const classe = l.tipo.split("-")[0];
      const compM = pernas.reduce((t, p) => t + p.comprimento, 0) / 1000;
      pecas.push({
        arquivo: nomeArquivo(`${ic.nome} - Eslinga`),
        props: {
          titlePT: `Eslinga içamento ${ic.nome}`,
          specPT: `Eslinga ${n} ${n > 1 ? "pernas" : "perna"} (CMT ${F.num(rig.cargaGov / G, 1)} ton) `
            + `com ${n > 1 ? "anelão e " : ""}sapatilho ${textoPernas(pernas)}. `
            + `Cabo de aço (${alma}) Ø${polegada(l.diametro)} (${F.num(l.diametro, 1)} mm): `
            + `classe ${classe} (${F.num(l.peso, 2)} kg/m). Categoria ${l.categoria} N/mm².`,
          material: "Aço liga",
          mass: massaSw(l.peso ? l.peso * compM : null, 1),
          length: "-",
          area: "-"
        }
      });
    }

    const m = rig.manilha;
    if (m.ok) {
      const mn = m.manilha, tipo = IC.manilhas.tipos[m.tipo];
      pecas.push({
        arquivo: nomeArquivo(`${ic.nome} - Manilha`),
        props: {
          titlePT: `Manilha içamento ${ic.nome}`,
          specPT: `${tipo.especificacao || tipo.descricao}. Green Pin ${m.tipo} (${mn.codigo}) ou similar `
            + `(CMT ${F.num(mn.cmt, 2)} ton)`,
          material: "-",
          mass: massaSw(mn.peso, 2),
          length: "-",
          area: "-"
        }
      });
    }
    return pecas;
  }

  async function baixarPecasSolidworks() {
    const ic = atual();
    const pecas = pecasSolidworks(ic);
    if (!pecas.length) return;
    try {
      const arquivos = [];
      for (const p of pecas)
        arquivos.push({ name: semAcento(p.arquivo) + ".SLDPRT", data: await IC.sldprt.gerar(p.props) });
      baixar(`pecas_solidworks_${semAcento(ic.nome || "icamento").replace(/ +/g, "_")}.zip`,
        IC.xlsx.zip(arquivos), "application/zip");
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar as peças SolidWorks: " + err.message);
    }
  }

  /* ------------------------------------------------------------ memorial no SMath Studio (.sm)
   * O estudo inteiro, içamento por içamento. Cada etapa de cálculo vai para uma área
   * recolhida do SMath com todas as contas; fora dela, os resultados da área são chamados de
   * novo. A conta só fica "viva" no SMath quando reproduz o valor desta página — detalhes em
   * js/core/smath-export.js. */
  function descricaoSimbolo(sym) {
    const s = IC.simbolos.lista.find(x => {
      if (!x.re) return x.k === sym;
      x.re.lastIndex = 0;
      const m = String(sym).match(x.re);
      return m && m[0] === sym;
    });
    return s ? `${s.desc}${s.un && !/^[\s\-–—]*$/.test(s.un) ? ` (${s.un})` : ""}` : "";
  }
  /** {formula, sub, resultado} (ou texto solto) -> passo do memorial do SMath */
  const passoSm = (t, o, extra) => o && Object.assign(typeof o === "string" ? { t, r: o }
    : { t, f: o.formula, s: o.sub, r: o.resultado }, extra || {});

  /**
   * SVG da página -> PNG (base64) para a folha do SMath. O SVG usa as classes do desenho.css,
   * que não vão junto numa imagem: ele entra na página escondido, cada elemento recebe o estilo
   * calculado por extenso e só então é rasterizado — com o dobro de pixels, para a impressão.
   * larg é a largura na folha (px); a altura sai do viewBox, limitada a altMax.
   */
  const PROPS_SVG = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
    "stroke-linejoin", "stroke-opacity", "opacity", "font-size", "font-weight", "font-family", "font-style",
    "paint-order", "display"];
  async function svgParaPng(svgTexto, larg, altMax = 520) {
    const host = document.createElement("div");
    // fora da tela, mas visível: "visibility: hidden" passaria para o estilo de cada elemento
    host.style.cssText = "position:absolute;left:-10000px;top:0;width:900px";
    host.innerHTML = svgTexto;
    document.body.appendChild(host);
    try {
      const svg = host.querySelector("svg");
      if (!svg) return null;
      [svg, ...svg.querySelectorAll("*")].forEach(el => {
        const cs = getComputedStyle(el);
        el.setAttribute("style", PROPS_SVG.map(k => `${k}:${cs.getPropertyValue(k)}`).join(";"));
      });
      const vb = svg.viewBox && svg.viewBox.baseVal;
      const vw = vb && vb.width || 600, vh = vb && vb.height || 400;
      let w = larg, h = Math.round(larg * vh / vw);
      if (h > altMax) { w = Math.round(w * altMax / h); h = altMax; }
      const k = 2;
      svg.setAttribute("width", w * k); svg.setAttribute("height", h * k);
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w * k; c.height = h * k;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return { png: c.toDataURL("image/png").split(",")[1], w, h };
    } finally { host.remove(); }
  }

  /** figura na folha; sem conseguir rasterizar (navegador antigo), a folha sai sem ela */
  async function figuraSm(doc, svg, larg, legenda, altMax) {
    try {
      const f = await svgParaPng(svg, larg, altMax);
      if (f) doc.figura(f.png, f.w, f.h, legenda);
    } catch (e) { console.warn("figura fora do SMath:", legenda, e); }
  }

  /**
   * Monta a folha do SMath, organizada como os modelos feitos à mão: descrição em cima de cada
   * variável, conteúdo recuado, contas intermediárias em áreas recolhidas e as figuras da
   * estrutura. Títulos, legendas e o sumário são do plugin Sumario Region do SMath: ele numera
   * (1, 1.1, Figura N) e monta o índice com a lista de figuras e o número da página.
   */
  async function montarSmath() {
    const S = window.SMathExport;
    const doc = new S.Documento({ autor: E.resp || "", casas: 3, recuo: 18, recuoTitulo: 9, descricaoEmCima: true, sumario: true });
    const mem = new S.Memorial(doc, { descricao: descricaoSimbolo });
    const T = textosRelatorio();
    const varios = E.icamentos.length > 1;
    // níveis do plugin: capítulo (1), seção (1.1), subseção (1.1.1), item (1.1.1.1)
    const capitulo = t => doc.titulo(t.toUpperCase(), 2, { numerado: true });
    const secao = t => doc.titulo(t.toUpperCase(), 3, { numerado: true });
    const sub = t => doc.titulo(t, 4, { numerado: true });
    const nv4 = { nivel: 4, numerado: true }, nv5 = { nivel: 5, numerado: true };
    const criterio = ok => doc.texto(ok ? "Critério aceito" : "Critério NÃO aceito", { negrito: true, cor: ok ? "#256B4D" : "#A1332C" });

    // tudo o que é de cada içamento, calculado uma vez
    const dados = E.icamentos.map(ic => {
      const r = resolver(ic), rig = riggingDe(ic);
      return { ic, r, f: r.fatores, fx: fatoresDe(modeloDe(ic)), P: pontosDe(ic), H: alturaGancho(ic), rig, o: olhalDe(ic, rig) };
    });

    function definirFatores({ f, ic }) {
      const fx = fatoresDe(ic), fl = fatoresLinga(modeloDe(ic));
      mem.definir("γ_peso", F.num(f.peso, 3), "Margem sobre o peso (DNV-ST-N001 5.6.2.2)");
      mem.definir("γ_CoG", F.num(f.cog, 3), "Imprecisão do centro de gravidade (DNV-ST-N001 5.6.2.3)");
      mem.definir("DAF", F.num(f.daf, 3), `Amplificação dinâmica — SHL = ${F.num(fx.shlT, 2)} t, local ${ic.local} (DNV-ST-N001 Tabela 16-1)`);
      mem.definir("SKL", F.num(f.skl, 3), "Distribuição desigual entre as pernas (DNV-ST-N001 16.2.6)");
      if (fl.modelo === "N001") {
        mem.definir("γ_h", F.num(fl.gh, 3), "Eslinga: fator de içamento (16.4.4)");
        mem.definir("γ_c", F.num(fl.gc, 3), "Eslinga: fator de consequência (16.4.5)");
        mem.definir("γ_s", F.num(fl.gs, 3), `Eslinga: terminação — ${fl.terminacao} (Tabela 16-3)`);
        mem.definir("γ_m", F.num(fl.gm, 3), "Eslinga: fator de material (16.4.9)");
        mem.definir("γ_w", F.num(fl.gw, 3), "Eslinga: desgaste e aplicação (16.4.10)");
      } else mem.definir("FS_linga", F.num(fl.fs, 3), "Fator de segurança da linga");
    }
    function definirGeometria({ ic, P, H }) {
      mem.definir("m", `${F.num(ic.massa, 3)} kg`, "Massa do corpo");
      mem.definir("g", "9,80665 m/s²", "Aceleração da gravidade");
      P.forEach(p => {
        mem.definir(`x_${p.nome}`, `${F.num(p.x, 1)} mm`, `Ponto ${p.nome}: distância horizontal ao CG, no comprimento (x)`);
        if (Math.abs(p.y) > 1e-6) mem.definir(`y_${p.nome}`, `${F.num(p.y, 1)} mm`, `Ponto ${p.nome}: distância horizontal ao CG, na largura (y)`);
        mem.definir(`z_${p.nome}`, `${F.num(p.z, 1)} mm`, `Ponto ${p.nome}: altura em relação ao CG (z)`);
      });
      mem.definir("H", `${F.num(H, 1)} mm`, "Altura do gancho acima do centro de massa");
    }
    /** Os capítulos são por tema e cada um passa por todos os içamentos. No SMath as variáveis
     *  valem para a folha inteira (m, x.P1, H...): cada seção começa redefinindo as do seu
     *  içamento numa área recolhida, senão a conta usaria o valor do último içamento. */
    const contexto = d => {
      if (!varios) return;
      doc.abrirArea(`Dados de ${d.ic.nome}`, true);
      definirGeometria(d);
      definirFatores(d);
      doc.fecharArea();
    };

    doc.titulo("MEMORIAL DE CÁLCULO DE IÇAMENTO", 1);
    doc.texto([`Estudo: ${E.nome || "—"}`, `Documento: ${E.doc || "—"}`, `Responsável: ${E.resp || "—"}`,
      `Emitido em: ${new Date().toLocaleDateString("pt-BR")}`].join("\n"));
    doc.indice({ maxLevel: 2, figuras: true });

    /* ---- capítulos de texto, como foram escritos no site */
    const textoLivre = (k, rotulo) => { if (T[k]) { capitulo(rotulo); doc.texto(T[k]); } };
    textoLivre("introducao", "Introdução");
    textoLivre("objetivo", "Objetivo");
    capitulo("Plano de içamento");
    if (T.plano) doc.texto(T.plano);
    doc.texto(`O estudo tem ${dados.length} içamento(s):\n` + dados.map(d =>
      `- ${d.ic.nome}: ${TIPOS[d.ic.tipo].nome}, massa ${F.num(massaParaTela(d.ic.massa), 2)} ${uMassa()}`).join("\n"));
    textoLivre("local", "Local da instalação");
    textoLivre("guindaste", "Dados do guindaste");

    /* ---- dados das estruturas */
    capitulo("Dados das estruturas");
    for (const d of dados) {
      const { ic, r, P } = d;
      secao(ic.nome);
      doc.texto(`Arranjo: ${TIPOS[ic.tipo].nome}` + (TIPOS[ic.tipo].pernas > 2 ? ` · hipótese: ${r.hipotese}` : ""));
      const incM = inclinacaoDe(ic);
      if (incM && incM.dobrada) doc.texto(`Estrutura em V (dobrada): trecho de P1 a φ₁ = ${F.grau(incM.phi[0])} e trecho de P2 a `
        + `φ₂ = ${F.grau(incM.phi[1])} com a horizontal (+ = ponto acima da dobra) · olhais em pé sobre o trecho`);
      else if (incM) doc.texto(`Estrutura inclinada: φ = ${F.grau(incM.phi[1])} com a horizontal · olhais em pé sobre a peça`);
      if (TIPOS[ic.tipo].pilar) doc.texto("Pilar em pé: olhais soldados nas faces, com o eixo na horizontal, apontando para fora · "
        + "o olhal é verificado com o ângulo entre a linga e o eixo dele (θ com a base = ângulo da perna com a vertical)");
      doc.texto("Coordenadas dos pontos de içamento a partir do centro de massa: x no comprimento, y na largura e z na altura.");
      definirGeometria(d);
      if (!TIPOS[ic.tipo].unica)
        mem.definir("α", `${F.num(ic.angulo, 2)} °`, `Ângulo da perna ${P[Math.min(ic.pernaAngulo || 0, P.length - 1)].nome} com a `
          + (incM || TIPOS[ic.tipo].pilar ? "horizontal" : "estrutura"));
      await figuraSm(doc, IC.iso3d.desenhar(r, { modo: "medidas", comp: txtComp }), 560,
        `${ic.nome} — geometria do içamento (distâncias a partir do CG)`, 480);
    }

    /* ---- fatores e peso de projeto */
    capitulo("Fatores de projeto e peso de projeto");
    for (const d of dados) {
      const { ic, r } = d;
      secao(ic.nome);
      doc.texto(`Base normativa: ${(FAT.bases[ic.base] || {}).nome || ic.base}`);
      contexto(d);
      definirFatores(d);
      mem.secao("Peso de projeto", passosPeso(ic, r).map((p, i) => passoSm(i ? "Peso de projeto" : "Peso do corpo", p)), nv4);
    }

    /* ---- cargas nas eslingas */
    capitulo("Cálculo do carregamento nas eslingas");
    for (const d of dados) {
      const { ic, r, P, H } = d;
      secao(ic.nome);
      contexto(d);
      if (r.pernas.length > 2) doc.texto(r.hipotese === "pares diagonais"
        ? "Hipótese: pares diagonais — um par diagonal sustenta sozinho o peso inteiro e o outro fica frouxo (envoltória, sem SKL)."
        : "Hipótese: elástica × SKL (DNV-ST-N001) — corpo rígido sobre quatro molas, rigidez vertical k = EA·cos²β/L; "
          + `equilíbrio (ΣV = W, ΣM = 0) mais compatibilidade de deslocamentos, e depois × SKL ${F.num(r.fatores.skl, 2)}.`);
      const passos = [];
      r.pernas.forEach((p, i) => {
        const [comp, ang, trac] = passosPerna(r, p, P[i], H);
        passos.push(
          passoSm(`Eslinga ${p.nome} — comprimento`, comp),
          passoSm(`Eslinga ${p.nome} — ângulo com a vertical`, ang),
          { t: `Eslinga ${p.nome} — componente vertical (equilíbrio do sistema)`, r: `V_${p.nome} = ${F.num(p.vertical, 3)} kN` },
          passoSm(`Eslinga ${p.nome} — tração`, trac));
      });
      passos.push({ t: "Carga no gancho", r: `F_gancho = ${F.num(r.cargaGanchoKN, 2)} kN` },
        { t: "Maior tração por eslinga", r: `T_max = ${F.num(r.maiorTracaoKN, 2)} kN` });
      mem.secao("Cargas em cada eslinga", passos, nv4);
      mem.tabela(["Eslinga", "Comprimento (mm)", "Ângulo c/ horizontal", "Vertical (kN)", "Tração (kN)", "Tração (t)"],
        r.pernas.map(p => [p.nome, F.num(p.comprimento, 1), F.grau(90 - p.angulo), F.num(p.vertical, 2), F.num(p.tracao, 2), F.num(p.toneladas, 2)]));
      if (r.comparacao) {
        const c = r.comparacao, adot = r.hipotese === "pares diagonais";
        sub("Comparação das hipóteses nas quatro pernas");
        mem.tabela(["Hipótese", "SKL", "Maior tração (kN)", "Maior tração (t)"], [
          [`Elástica × SKL (DNV-ST-N001)${adot ? "" : " — adotada"}`, F.num(c.elastica.skl, 2),
            F.num(c.elastica.maiorTracaoKN, 2), F.num(c.elastica.maiorTracaoKN / G, 2)],
          [`Pares diagonais (envoltória)${adot ? " — adotada" : ""}`, "1,00",
            F.num(c.diagonais.maiorTracaoKN, 2), F.num(c.diagonais.maiorTracaoKN / G, 2)]]);
      }
      await figuraSm(doc, IC.fbd.elevacao(r), 460, `${ic.nome} — diagrama de corpo livre (elevação)`, 440);
      if (P.length > 2) await figuraSm(doc, IC.fbd.planta(r), 420, `${ic.nome} — pontos de içamento em planta`, 380);
    }

    /* ---- eslinga */
    capitulo("Dados da eslinga");
    for (const d of dados) {
      const { ic, rig } = d, l = rig.linga;
      secao(ic.nome);
      contexto(d);
      if (!l.ok) {
        doc.texto(`Nenhum cabo da tabela atende à MBL requerida (${F.kn(l.mblReqKN)}).`, { negrito: true, cor: "#A1332C" });
        continue;
      }
      const mblCabo = l.linha && l.linha["ruptura" + l.categoria];
      const passos = l.formula.map(st => passoSm(st.titulo, st));
      if (mblCabo) passos.push(
        { t: `Cabo escolhido — ${IC.lingas.tipos[l.tipo].nome}, Ø ${F.num(l.diametro, 1)} mm, categoria ${l.categoria} N/mm²`,
          r: `MBL = ${F.num(mblCabo, 2)} kN` },
        { t: "Utilização da linga", f: "u = MBL_req / MBL", r: `u = ${F.num(l.utilizacao * 100, 1)} %` });
      mem.secao("Carga de ruptura mínima", passos, nv4);
      doc.texto(`Eslinga escolhida: ${IC.lingas.tipos[l.tipo].nome}, Ø ${F.num(l.diametro, 1)} mm, categoria ${l.categoria} N/mm²`
        + (mblCabo ? ` · MBL ${F.num(mblCabo, 2)} kN ≥ MBL requerida ${F.num(l.mblReqKN, 2)} kN` : ""));
      if (mblCabo) criterio(l.utilizacao <= 1);
    }

    /* ---- manilha */
    capitulo("Cálculo da manilha");
    for (const d of dados) {
      const { ic, rig } = d, m = rig.manilha;
      secao(ic.nome);
      if (!m.ok) {
        doc.texto(`Nenhuma manilha do tipo escolhido atende à carga de ${F.ton(m.cargaT)}.`, { negrito: true, cor: "#A1332C" });
        continue;
      }
      doc.texto(`Tipo de manilha escolhida: ${IC.manilhas.tipos[m.tipo].nome} · código ${m.manilha.codigo}`);
      mem.secao("Carga no pino e CMT", [
        passoSm("Carga no pino", m.formula),
        passoSm(`CMT da manilha ${m.manilha.codigo}`, m.formulaCmt)
      ], nv4);
      doc.texto(`CMT ${F.num(m.manilha.cmt, 2)} t ≥ carga ${F.num(m.cargaT, 2)} t`);
      criterio(m.manilha.cmt >= m.cargaT);
      await figuraSm(doc, FIG.manilha(m.manilha), 360, `Manilha ${IC.manilhas.tipos[m.tipo].nome} — ${m.manilha.codigo}`, 300);
    }

    /* ---- sapatilho e casos de encaixe */
    capitulo("Cálculo do sapatilho e encaixe com a manilha");
    for (const d of dados) {
      const { ic, rig } = d, s = rig.sapatilho, m = rig.manilha;
      secao(ic.nome);
      if (!s.ok) { doc.texto("Nenhum sapatilho da tabela serve para o cabo escolhido.", { negrito: true, cor: "#A1332C" }); continue; }
      doc.texto(`Diâmetro da eslinga: ${F.num(rig.linga.diametro, 1)} mm · sapatilho escolhido: ${s.sapatilho.codigo}`);
      await figuraSm(doc, FIG.sapatilho(s.sapatilho), 360, `Dimensões do sapatilho ${s.sapatilho.codigo}`, 300);
      if (!rig.casos.length) continue;
      sub("Verificando condições de encaixe");
      if (m.ok) await figuraSm(doc, FIG.encaixe(rig.casos, s.sapatilho, m.manilha, rig.linga.diametro), 600,
        "Casos de encaixe do sapatilho e da manilha", 360);
      rig.casos.forEach(c => doc.texto(`Caso ${c.n}: ${c.formula} — ${c.nome}\n`
        + `${F.num(c.a, 1)} mm ${c.ok ? ">" : "≤"} ${F.num(c.b, 1)} mm → `
        + (c.ok ? `Ok (folga de ${F.num(c.a - c.b, 1)} mm)` : `NÃO PASSA (faltam ${F.num(c.b - c.a, 1)} mm)`),
        { negrito: !c.ok, cor: c.ok ? null : "#A1332C" }));
      criterio(rig.casos.every(c => c.ok));
    }

    /* ---- olhais */
    capitulo("Verificação dos olhais");
    for (const d of dados) {
      const { ic, rig, o } = d;
      secao(ic.nome);
      contexto(d);
      const quais = `${o.qtd} olhal(is) iguais (${o.nomes.join(", ")}), dimensionados pela perna ${o.governante.nome}`
        + (o.modo === "fabricado" ? " (a mais solicitada no olhal)" : " (a mais tracionada)");
      if (o.modo === "comprado") {
        const rc = o.resultado;
        doc.texto(quais);
        if (rc.ok) {
          doc.texto(`Olhal comercial ${rc.olhal.codigo}: CMT ${F.num(rc.olhal.cmt, 2)} t ≥ carga ${F.num(rc.cargaT, 2)} t `
            + `(utilização ${F.num(rc.utilizacao * 100, 0)} %)`);
          criterio(true);
        } else doc.texto(`Nenhum olhal comercial atende ${F.ton(rc.cargaT)} com pino Ø ${F.num(rc.pinoMm, 1)} mm.`, { negrito: true, cor: "#A1332C" });
        continue;
      }
      const g = o.geom, mn = rig.manilha.ok ? rig.manilha.manilha : null;
      mem.secao("Força de reação no olhal", [
        { t: quais, r: `F_linga = ${F.num(o.governante.tracao, 3)} kN` },
        { t: "Carga no pino (N-2683 5.2 a; DNV-ST-N001 Tabela 16-5)", f: "F_pino = 1,30 · F_linga",
          s: `F_pino = 1,30 × ${F.num(o.governante.tracao, 3)}`, r: `F_pino = ${F.num(o.verif.FpinoKN, 3)} kN` },
        { t: `Ângulo da linga com o olhal na perna ${o.governante.nome}`, f: "θ = 90° − ∠(linga, eixo do olhal)",
          s: `θ = 90° − ${F.grau(o.angulo.eixo)}`, r: `θ = ${F.grau(o.angulo.base)}` }], nv4);
      doc.texto(`Material do olhal: Fy = ${F.num(fyDoOlhal(ic), 0)} MPa`);
      if (mn) mem.secao("Diâmetro do furo e raio do olhal", passosFuro(mn, g).map((st, i) =>
        passoSm(["Diâmetro do furo", "Raio do topo", "Raio do anel de reforço"][i], st)), nv4);
      sub("Geometria do olhal");
      doc.texto(["t", "tAnel", "base", "h", "R", "rAnel", "dFuro"].filter(k => k in g)
        .map(k => `${ROTULOS_GEOM[k]}: ${F.num(g[k], 2)}`).join("\n"));
      if (!(g.tAnel > 0)) doc.texto("Sem anel de reforço: as medidas do anel ficam zeradas.");
      await figuraSm(doc, FIG.olhal(g), 420, `${ic.nome} — dimensões do olhal`, 360);
      const ch = RIG.encaixeChapa(mn, espessuraChapa(ic));
      if (ch) {
        sub("Encaixe da chapa na boca da manilha");
        doc.texto(`0 < W − (t + 2·t_anel) ≤ mín(0,25·W ; 12 mm) = ${F.num(ch.folgaMax, 2)} mm (N-2683 4.2.3.2): `
          + `${F.num(ch.boca, 1)} − ${F.num(ch.espessura, 1)} = ${F.num(ch.folga, 1)} mm`);
        criterio(ch.ok);
      }
      sub("Verificação do olhal de içamento");
      o.verif.checks.forEach(c => {
        mem.secao(c.nome, [passoSm(c.nome, c.formula)], nv5);
        doc.texto(`${valorCheck(c, c.tensao)} ${c.ok ? "≤" : ">"} limite ${valorCheck(c, c.admissivel)} · utilização ${F.num(c.utilizacao * 100, 0)} %`);
        criterio(c.ok);
      });
      if (o.verif.soldaBase.tipo === "penetracao") doc.texto("Solda do olhal na estrutura: penetração total — resistência igual à da chapa, "
        + "verificada pelos itens de força axial, flexões, tensões combinadas e cisalhamento na base (N-2683 5.4.10).", { negrito: true });
    }

    /* ---- lista de material */
    capitulo("Lista de material");
    for (const d of dados) {
      secao(d.ic.nome);
      mem.tabela(["Item", "Qtd.", "Título", "Especificação", "Material", "Massa (kg)"],
        materialDe(d.ic).itens.map((it, i) => [i + 1, F.num(it.qtd, 0), it.titulo, it.especificacao, it.material,
          it.massa == null ? "-" : F.num(it.massa, 2)]));
    }

    /* ---- resumo */
    capitulo("Resumo dos parâmetros e critérios");
    mem.tabela(["Içamento", "Massa", "Arranjo", "Carga no gancho (kN)", "Maior tração (t)"],
      dados.map(({ ic, r }) => [ic.nome, `${F.num(massaParaTela(ic.massa), 2)} ${uMassa()}`, TIPOS[ic.tipo].nome,
        F.num(r.cargaGanchoKN, 1), F.num(r.maiorTracaoT, 2)]));
    for (const d of dados) {
      const { ic, r, rig, o } = d, l = rig.linga, m = rig.manilha, s = rig.sapatilho;
      secao(`Critérios adotados — ${ic.nome}`);
      mem.tabela(["Eslinga", "Comprimento (mm)", "Ângulo c/ horizontal", "Tração (kN)", "Tração (t)"],
        r.pernas.map(p => [p.nome, F.num(p.comprimento, 1), F.grau(90 - p.angulo), F.num(p.tracao, 2), F.num(p.toneladas, 2)]));
      const casos = rig.casos.length ? (rig.casos.every(c => c.ok) ? "Ok" : "NÃO PASSA") : "—";
      doc.texto([
        `Carga no gancho: ${F.kn(r.cargaGanchoKN)} · maior tração por eslinga: ${F.kn(r.maiorTracaoKN)}`,
        l.ok ? `Eslinga: ${IC.lingas.tipos[l.tipo].nome}, Ø ${F.num(l.diametro, 1)} mm, categoria ${l.categoria} N/mm²` : "Eslinga: nenhum cabo atende",
        m.ok ? `Manilha: ${IC.manilhas.tipos[m.tipo].nome} ${m.manilha.codigo} (CMT ${F.num(m.manilha.cmt, 2)} t)` : "Manilha: nenhuma atende",
        s.ok ? `Sapatilho: ${s.sapatilho.codigo} · casos de encaixe: ${casos}` : "Sapatilho: nenhum serve",
        o.modo === "comprado"
          ? (o.resultado.ok ? `Olhal comercial: ${o.resultado.olhal.codigo}` : "Olhal comercial: nenhum atende")
          : `Olhal fabricado: t ${F.num(o.geom.t, 1)} mm, base ${F.num(o.geom.base, 0)} mm, h ${F.num(o.geom.h, 0)} mm, `
            + `Ø furo ${F.num(o.geom.dFuro, 2)} mm, R ${F.num(o.geom.R, 1)} mm · maior utilização `
            + `${F.num(Math.max(...o.verif.checks.map(c => c.utilizacao)) * 100, 0)} %`
            + (o.verif.checks.every(c => c.ok) ? " — critérios aceitos" : " — NÃO ATENDE")
      ].join("\n"), { negrito: true });
    }

    if (T.referencias) { capitulo("Referências"); doc.texto(T.referencias); }

    return { doc, stats: mem.stats };
  }

  async function relatorioSmath() {
    const { doc, stats } = await montarSmath();
    window.SMathExport.baixar(`${(E.nome || "icamento").replace(/[^\w-]+/g, "_")}.sm`, doc);
    return stats;
  }

  /* ------------------------------------------------------------ recolher as caixas */
  // Quais caixas estão fechadas. Fica no navegador, separado do estudo: é preferência de
  // quem está olhando a tela, não dado do cálculo.
  const CHAVE_DOBRA = "ic-caixas-fechadas";
  function fechadas() {
    try { return new Set(JSON.parse(localStorage.getItem(CHAVE_DOBRA) || "[]")); }
    catch (e) { return new Set(); }
  }
  function gravarFechadas(conj) {
    try { localStorage.setItem(CHAVE_DOBRA, JSON.stringify([...conj])); } catch (e) {}
  }
  // Escolha de cada caixa sobre o seu memorial: true = mostrar, false = esconder. A caixa que
  // não tem escolha segue o botão geral do topo.
  const CHAVE_MEM_CAIXA = "ic-memorial-caixas";
  function memEscolhas() {
    try { return JSON.parse(localStorage.getItem(CHAVE_MEM_CAIXA) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function gravarMemEscolhas(obj) {
    try { localStorage.setItem(CHAVE_MEM_CAIXA, JSON.stringify(obj)); } catch (e) {}
  }
  /** o memorial desta caixa está à vista? */
  function memVisivel(id, escolhas) {
    const e = escolhas || memEscolhas();
    if (Object.prototype.hasOwnProperty.call(e, id)) return !!e[id];
    return !document.body.classList.contains("sem-memorial");
  }

  function pintarDobra() {
    const fech = fechadas();
    const escolhas = memEscolhas();
    const caixas = [...document.querySelectorAll(".etapa[data-etapa]")];
    caixas.forEach(sec => {
      const fechada = fech.has(sec.dataset.etapa);
      sec.classList.toggle("fechada", fechada);
      const b = sec.querySelector("[data-dobra]");
      if (b) {
        b.textContent = fechada ? "+" : "\u2212";
        b.setAttribute("aria-expanded", fechada ? "false" : "true");
        b.title = fechada ? "Abrir esta caixa" : "Recolher esta caixa";
      }
      // botão do memorial: só existe onde há cálculo para esconder
      const temCalculo = !!sec.querySelector(".formulas");
      let bm = sec.querySelector("[data-dobra-mem]");
      if (temCalculo && !bm && b) {
        bm = document.createElement("button");
        bm.type = "button";
        bm.className = "etapa__dobra etapa__dobra--mem";
        bm.dataset.dobraMem = "";
        b.parentElement.insertBefore(bm, b);
      }
      if (bm) {
        const visivel = memVisivel(sec.dataset.etapa, escolhas);
        // as duas classes são explícitas: uma vence o "esconder tudo" do topo, a outra o
        // "mostrar tudo" — é isso que faz o botão funcionar nos dois estados gerais
        sec.classList.toggle("com-calculo", visivel);
        sec.classList.toggle("sem-calculo", !visivel);
        bm.textContent = "\u0192x";
        bm.classList.toggle("is-on", visivel);
        bm.setAttribute("aria-pressed", visivel ? "true" : "false");
        bm.title = visivel ? "Esconder o cálculo desta caixa" : "Mostrar o cálculo desta caixa";
      }
    });
    const tudo = $("bt-dobrar-tudo");
    if (tudo) tudo.textContent = fech.size >= caixas.length ? "Abrir tudo" : "Recolher tudo";
  }
  // memoriais de cálculo: começam ocultos para a tela caber; no relatório impresso saem sempre
  const CHAVE_MEM = "ic-memoriais";
  function pintarMemorial() {
    let mostrar = false;
    try { mostrar = localStorage.getItem(CHAVE_MEM) === "1"; } catch (e) {}
    document.body.classList.toggle("sem-memorial", !mostrar);
    // ligar/desligar tudo zera as escolhas por caixa, senão o estado fica contraditório
    try { localStorage.removeItem(CHAVE_MEM_CAIXA); } catch (e) {}
    document.querySelectorAll(".etapa.sem-calculo, .etapa.com-calculo")
      .forEach(el => el.classList.remove("sem-calculo", "com-calculo"));
    if (typeof pintarDobra === "function") pintarDobra();
    const b = $("bt-memorial");
    if (b) {
      b.classList.toggle("bt--ligado", mostrar);
      b.textContent = mostrar ? "Memoriais \u25be" : "Memoriais";
      b.setAttribute("aria-pressed", mostrar ? "true" : "false");
    }
  }
  function ligarMemorial() {
    const b = $("bt-memorial");
    if (b) b.addEventListener("click", () => {
      let mostrar = false;
      try { mostrar = localStorage.getItem(CHAVE_MEM) === "1"; localStorage.setItem(CHAVE_MEM, mostrar ? "0" : "1"); } catch (e) {}
      pintarMemorial();
    });
    pintarMemorial();
  }

  function ligarDobra() {
    document.getElementById("etapas").addEventListener("click", e => {
      // o botão do memorial não recolhe a caixa
      const bm = e.target.closest("[data-dobra-mem]");
      if (bm) {
        e.stopPropagation();
        const sec = bm.closest(".etapa[data-etapa]");
        const id = sec.dataset.etapa;
        const escolhas = memEscolhas();
        escolhas[id] = !memVisivel(id, escolhas);     // inverte o que está valendo agora
        gravarMemEscolhas(escolhas);
        return pintarDobra();
      }
      const h = e.target.closest(".etapa > h2");
      if (!h) return;
      // não recolhe ao clicar em algo dentro do título que não seja o botão
      if (e.target.closest("input, select, a") ) return;
      const sec = h.parentElement;
      const fech = fechadas();
      const id = sec.dataset.etapa;
      if (fech.has(id)) fech.delete(id); else fech.add(id);
      gravarFechadas(fech);
      pintarDobra();
    });
    const tudo = $("bt-dobrar-tudo");
    if (tudo) tudo.addEventListener("click", () => {
      const caixas = [...document.querySelectorAll(".etapa[data-etapa]")];
      const fech = fechadas();
      gravarFechadas(fech.size >= caixas.length ? new Set() : new Set(caixas.map(c => c.dataset.etapa)));
      pintarDobra();
    });
    pintarDobra();
  }

  /* ------------------------------------------------------------ eventos */
  function ligar() {
    [["est-nome", "nome"], ["est-doc", "doc"], ["est-resp", "resp"]].forEach(([id, k]) => {
      $(id).value = E[k] || "";
      $(id).addEventListener("input", () => {
        E[k] = $(id).value; gravar();
        $("topo-sub").textContent = E.nome || "memorial de cálculo e lista de material";
        pintarCapa();       // a capa só sai no papel: sem isto o relatório levava o valor antigo
      });
    });

    $("abas").addEventListener("click", e => {
      const lixo = e.target.closest("[data-remover]");
      if (lixo) {
        e.stopPropagation();
        const i = Number(lixo.dataset.remover);
        const nome = E.icamentos[i] ? E.icamentos[i].nome : "";
        if (!confirm(`Excluir o içamento "${nome}"? Isso apaga as medidas e as escolhas dele.`)) return;
        E.icamentos.splice(i, 1);
        if (E.atual >= E.icamentos.length) E.atual = E.icamentos.length - 1;
        return pintar();
      }
      const b = e.target.closest("[data-aba]");
      if (b) { E.atual = Number(b.dataset.aba); return pintar(); }
      if (e.target.closest("[data-novo]")) {
        E.icamentos.push(novoIcamento(E.icamentos.length + 1));
        E.atual = E.icamentos.length - 1;
        pintar();
      }
    });

    document.addEventListener("change", e => {
      const ic = atual(), el = e.target;
      const mod = modeloDe(ic);      // linga, manilha e olhal compartilhados vão para o de maior carga
      if (el.id === "un-comp") E.unid.comp = el.value;
      else if (el.id === "un-massa") E.unid.massa = el.value;
      else if (el.id === "ic-nome") ic.nome = el.value || ic.nome;
      else if (el.id === "ic-massa") ic.massa = lerMassa(el.value);
      else if (el.id === "ic-origem") { ic.origem = el.value; ic.fatores = null; }
      else if (el.id === "ic-local") { ic.local = el.value; ic.fatores = null; }
      else if (el.id === "ic-base") { ic.base = el.value; ic.fatores = null; }
      else if (el.id === "ic-cons") { ic.consequencia = el.value; ic.fatores = null; }
      else if (el.id === "ic-angulo") ic.angulo = Math.max(1, Math.min(89, numCampoOu(el.value, 60)));
      else if (el.id === "ic-perna-ang") ic.pernaAngulo = Number(el.value) || 0;
      else if (el.id === "ic-hipotese") ic.hipotese4 = el.value;
      else if (el.id === "ic-linga") ic.lingaPropria = el.value === "propria";
      else if (el.id === "ic-linga-tipo") mod.linga.tipo = el.value;
      else if (el.id === "ic-linga-cat") mod.linga.categoria = el.value;
      else if (el.id === "ic-linga-term") mod.linga.terminacao = el.value;
      else if (el.id === "ic-linga-topo") mod.linga.topo = el.value;
      else if (el.id === "ic-linga-dtopo") mod.linga.dTopo = Math.max(0, numCampoOu(el.value, 0));
      else if (el.dataset.olhalSolda) {
        const sd = soldaDe(mod), k = el.dataset.olhalSolda;
        sd[k] = k === "a" ? Math.max(0, numCampoOu(el.value, 0)) : el.value;
      }
      else if (el.id === "ic-manilha-tipo") { mod.manilhaTipo = el.value; mod.manilhaCodigo = null; }
      else if (el.id === "ic-manilha-codigo") mod.manilhaCodigo = el.value || null;
      else if (el.id === "ic-olhal-modo") mod.olhal.modo = el.value;
      else if (el.id === "ic-olhal-tipo") mod.olhal.tipoComprado = el.value;
      else if (el.id === "ic-olhal-aco") mod.olhal.aco = el.value;
      else if (el.id === "ic-olhal-fy") mod.olhal.fy = numCampoOu(el.value, 0) || 355;
      else if (el.id === "ic-material-modo") { pintarMaterial(); return; }
      else if (el.dataset.olhalCampo) {
        // um olhal só para o içamento inteiro
        if (!mod.olhal.geom) olhalDe(mod, riggingDe(mod));
        // espessura e reforço vêm de <select> (valor com ponto); o resto, do campo de texto
        const v = Math.max(0, numCampoOu(el.value, 0));
        mod.olhal.geom[el.dataset.olhalCampo] = v;
        // R mudou: o reforço acompanha
        if (el.dataset.olhalCampo === "R") mod.olhal.geom.rAnel = v;
      }
      else if (el.dataset.medida) ic.medidas[el.dataset.medida] = lerComp(el.value);
      else if (el.id === "ic-inclinada") { ic.inclinada = el.value !== "horizontal"; ic.dobrada = el.value === "dobrada"; }
      else if (el.dataset.incl) {
        if (!ic.inclinacao) ic.inclinacao = {};
        ic.inclinacao[el.dataset.incl] = numCampoOu(el.value, 0);
      }
      else if (el.dataset.fator) ic.fatores = Object.assign(fatoresDe(ic), { [el.dataset.fator]: numCampoOu(el.value, 0) },
        el.dataset.fator === "daf" ? { dafManual: true } : {});
      else return;
      // o "change" de um campo numérico só sai quando a pessoa termina de digitar (Enter, Tab ou
      // clique fora); a repintura espera o foco chegar ao campo seguinte para não puxá-lo de volta
      setTimeout(() => comFocoPreservado(pintar), 0);
    });

    $("tipos").addEventListener("click", e => {
      const b = e.target.closest("[data-tipo]");
      if (!b) return;
      const ic = atual();
      ic.tipo = b.dataset.tipo;
      ic.medidas = Object.assign({}, TIPOS[ic.tipo].padrao, ic.medidas);
      ic.pernaAngulo = 0;
      ic.fatores = null;
      pintar();
    });

    $("resumo").addEventListener("click", e => {
      // clicar na caixa de outro içamento abre ele (os botões seguem adiante)
      const cx = e.target.closest("[data-resumo]");
      if (cx && !e.target.closest("button, select, input")) {
        const i = Number(cx.dataset.resumo);
        if (i !== E.atual) { E.atual = i; return pintar(); }
      }
      if (e.target.id === "bt-duplicar") {
        const copia = JSON.parse(JSON.stringify(atual()));
        copia.nome += " (cópia)";
        E.icamentos.splice(E.atual + 1, 0, copia);
        E.atual++;
        pintar();
      }
      if (e.target.id === "bt-remover") {
        if (E.icamentos.length === 1 || !confirm("Remover este içamento do estudo?")) return;
        E.icamentos.splice(E.atual, 1);
        E.atual = Math.max(0, E.atual - 1);
        pintar();
      }
    });

    $("bt-salvar").addEventListener("click", () =>
      baixar(`${(E.nome || "icamento").replace(/[^\w-]+/g, "_")}.json`, JSON.stringify(E, null, 1), "application/json"));

    $("bt-abrir").addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".json";
      inp.addEventListener("change", () => {
        const f = inp.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const j = JSON.parse(rd.result);
            if (!j.icamentos || !j.icamentos.length) throw new Error("arquivo sem içamentos");
            E = j; E.atual = 0;
            if (!E.unid) E.unid = { comp: "mm", massa: "kg" };
            E.icamentos.forEach(migrar);
            pintar();
          } catch (err) { alert("Não foi possível abrir: " + err.message); }
        };
        rd.readAsText(f);
      });
      inp.click();
    });

    // a capa é refeita na hora de imprimir (botão ou Ctrl+P), com o que está no cabeçalho agora
    const lerCabecalho = () => {
      [["est-nome", "nome"], ["est-doc", "doc"], ["est-resp", "resp"]].forEach(([id, k]) => { E[k] = $(id).value; });
      gravar(); pintarCapa(); espelharCampos();
    };
    window.addEventListener("beforeprint", lerCabecalho);
    // textos livres do relatório: gravados no estudo a cada tecla
    const dlgT = $("dlg-textos");
    $("bt-textos").addEventListener("click", () => {
      const T = textosRelatorio();
      $("textos-campos").innerHTML = TEXTOS_RELATORIO.map(([k, rot, dica]) =>
        `<label class="campo campo--texto"><span>${rot}</span>
          <textarea rows="${k === "referencias" ? 5 : 3}" data-texto="${k}" placeholder="${F.esc(dica)}">${F.esc(T[k] || "")}</textarea></label>`).join("");
      dlgT.showModal();
    });
    $("textos-campos").addEventListener("input", e => {
      const k = e.target.dataset.texto;
      if (!k) return;
      E.textos = Object.assign({}, E.textos, { [k]: e.target.value });
      gravar(); pintarCapa();
    });
    // com mais de um içamento, pergunta se o relatório leva só o aberto ou todos
    const dlg = $("dlg-relatorio");
    $("bt-relatorio").addEventListener("click", () => {
      if (E.icamentos.length < 2) { lerCabecalho(); window.print(); return; }
      $("rel-todos").textContent = `Todos os içamentos (${E.icamentos.length})`;
      $("rel-atual").textContent = `Só "${atual().nome}"`;
      dlg.returnValue = "";
      dlg.showModal();
    });
    dlg.addEventListener("close", () => {
      const v = dlg.returnValue;
      if (v !== "atual" && v !== "todos") return;
      lerCabecalho();
      if (v === "todos") { montarTodos(); document.body.classList.add("rel-todos"); }
      setTimeout(() => window.print(), 0);   // deixa o diálogo sair da tela antes
    });
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("rel-todos");
      $("impressao-todos").innerHTML = "";
    });
    $("bt-smath").addEventListener("click", () => {
      lerCabecalho();
      relatorioSmath().catch(err => { console.error(err); alert("Não foi possível gerar o arquivo SMath: " + err.message); });
    });
    const btXlsx = $("bt-material-xlsx");
    if (btXlsx) btXlsx.addEventListener("click", baixarMaterialXlsx);
    const btSw = $("bt-material-sw");
    if (btSw) btSw.addEventListener("click", baixarPecasSolidworks);
  }

  function baixar(nome, conteudo, tipo) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ------------------------------------------------------------ início */
  /** completa campos que não existiam em estudos salvos por uma versão anterior do programa */
  function migrar(ic) {
    if (!ic.medidas) {
      ic.tipo = ic.tipo || "quatroSim";
      ic.medidas = Object.assign({}, TIPOS[ic.tipo].padrao);
      ic.angulo = ic.angulo || 60;
      ic.pernaAngulo = 0;
    }
    // "quatro pernas diferentes" trocou de a/b (distância + quadrante fixo por ponto) para x/y
    // (coordenada com sinal) — reproduz o sinal antigo (P1:+,+ · P2:-,+ · P3:-,- · P4:+,-)
    // para estudos salvos antes dessa mudança não pularem de posição.
    if (ic.tipo === "quatroDif" && ic.medidas && ic.medidas.x1 === undefined && ic.medidas.a1 !== undefined) {
      const sinais = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
      const m = ic.medidas, novo = {};
      [1, 2, 3, 4].forEach((n, idx) => {
        novo[`x${n}`] = sinais[idx][0] * Math.abs(m[`a${n}`] || 0);
        novo[`y${n}`] = sinais[idx][1] * Math.abs(m[`b${n}`] || 0);
        novo[`z${n}`] = m[`h${n}`] || 0;
      });
      ic.medidas = novo;
    }
    if (!ic.linga) ic.linga = { tipo: "6x19-aco", categoria: "1960" };
    if (!ic.linga.terminacao) ic.linga.terminacao = "manual";
    // "severa" era um fator sobre a carga; na N001 o γc é da eslinga (16.4.5) e vale 1,30
    if (ic.consequencia !== "reduzida") ic.consequencia = "normal";
    // fatores digitados antes da cadeia da N001 (γ_cons sobre a carga, DAF por faixa antiga)
    if (ic.fatores && ("consequencia" in ic.fatores || !("cog" in ic.fatores))) ic.fatores = null;
    if (!ic.manilhaTipo) ic.manilhaTipo = "G-4163";
    if (ic.manilhaCodigo === undefined) ic.manilhaCodigo = null;
    if (!ic.olhal) ic.olhal = { modo: "fabricado", tipoComprado: "GPAL-UNC", fy: 355, porPerna: [] };
    if (!ic.olhal.porPerna) ic.olhal.porPerna = [];
    if (ic.lingaPropria === undefined) ic.lingaPropria = true;
    // gravado quando φ₁ e φ₂ ficavam dentro de "inclinada": é a peça em V
    const incl = ic.inclinacao;
    if (ic.dobrada === undefined && incl && incl.phi === undefined && incl.phi1 !== undefined) ic.dobrada = true;
    // inclinada ou em V gravada com a₁, a₂ ao longo da peça, h (e e): passa para x (a1, a2) e
    // y (z1, z2) — os mesmos furos, nas medidas de agora
    if (ic.inclinada && incl && ic.medidas && ic.medidas.z1 === undefined) {
      const m = ic.medidas, h = Number(m.h) || 0, e = ic.dobrada ? Number(m.e) || 0 : 0;
      const phis = ic.dobrada ? [numOu(incl.phi1, 30), numOu(incl.phi2, 30)] : [-numOu(incl.phi, 30), numOu(incl.phi, 30)];
      [[phis[0], m.a1, -1], [phis[1], m.a2, 1]].forEach(([phi, a, lado], i) => {
        const f = phi * Math.PI / 180, s = Math.abs(Number(a) || 0);
        const x = e + lado * Math.cos(f) * s + -lado * Math.sin(f) * h, z = Math.sin(f) * s + Math.cos(f) * h;
        m[`a${i + 1}`] = Math.round(Math.abs(x) * 10) / 10;
        m[`z${i + 1}`] = Math.round(z * 10) / 10;
      });
    }
  }
  E.icamentos.forEach(migrar);
  ligar();
  // O botão de portfólio (bloco padrão dos projetos publicados) entra na barra de ações, em
  // vez de flutuar no canto — assim a barra não precisa reservar uma faixa vazia para ele.
  // O bloco fica no fim do <body>, depois destes scripts, então na primeira passada ele ainda
  // não existe: a mudança se repete quando o documento termina de carregar.
  function botaoNaBarra() {
    const btn = document.getElementById("mr-portfolio-btn");
    const acoes = document.querySelector(".topo__acoes");
    if (btn && acoes && btn.parentElement !== acoes) acoes.appendChild(btn);
  }
  botaoNaBarra();
  document.addEventListener("DOMContentLoaded", botaoNaBarra);
  addEventListener("load", botaoNaBarra);

  ligarDobra();
  ligarMemorial();
  pintar();

  window.ICapp = { get estudo() { return E; }, montarSmath, resolver, atual, pintar, pontosDe, alturaGancho, eixosOlhalDe, angulosOlhal,
    material: () => materialDe(atual()).itens, materialConsolidado, olhalDe, riggingDe,
    pecasSolidworks: () => pecasSolidworks(atual()) };
})();
