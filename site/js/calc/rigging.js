/*
 * Escolha de linga, sapatilho e manilha, e verificação do olhal — docs/METODO.md, itens 4-7.
 *
 * Regra que corrige o erro encontrado no memorial de referência (METODO.md, item 6):
 *   - a LINGA (cabo) é dimensionada por MBL_req = carga_da_perna × fsLinga;
 *   - a MANILHA e o OLHAL usam a carga da perna DIRETO (F_pino), nunca MBL_req.
 * Quem chama estas funções decide qual carga entra em cada uma — este módulo não aplica
 * fsLinga sozinho, para deixar esse ponto explícito em quem monta a chamada (site/js/ui/app.js).
 */
window.IC = window.IC || {};

IC.rigging = (function () {
  const G = IC.cargas.G;   // 9,80665 m/s² — mesma constante da física do içamento

  /* ------------------------------------------------------------ linga (cabo de aço) */

  /**
   * cargaKN — carga da perna (S_i), sem fsLinga aplicado ainda.
   * fsLinga — fator de segurança da linga (fatores.js, base normativa escolhida).
   * tipo — chave de IC.lingas.tipos (ex.: "6x19-aco").
   * categoria — grade do arame: "1770" | "1960" | "2160".
   */
  function escolherLinga({ cargaKN, fsLinga, tipo, categoria }) {
    const mblReqKN = cargaKN * fsLinga;
    const linha = IC.lingas.escolher(tipo, categoria, mblReqKN);
    const campo = "ruptura" + categoria;
    const N = IC.fmt.num;
    return {
      ok: !!linha, tipo, categoria, fsLinga, cargaKN, mblReqKN,
      diametro: linha ? linha.diametro : null,
      peso: linha ? linha.peso : null,
      mblKN: linha ? linha[campo] : null,
      utilizacao: linha ? mblReqKN / linha[campo] : null,
      formula: {
        formula: "MBL_req = carga_governante × FS_linga",
        sub: `MBL_req = ${N(cargaKN)} kN × ${N(fsLinga, 2)}`,
        resultado: `MBL_req = ${N(mblReqKN)} kN`
      },
      linha
    };
  }

  /* ------------------------------------------------------------ sapatilho (thimble) */

  function escolherSapatilho(diametroCaboMm) {
    const s = diametroCaboMm ? IC.sapatilhos.escolher(diametroCaboMm) : null;
    return { ok: !!s, diametroCaboMm, sapatilho: s };
  }

  /* ------------------------------------------------------------ manilha (shackle) */

  /**
   * Escolhe a manilha pela carga no pino (F_pino — NUNCA o MBL_req da linga, ver nota no topo
   * do arquivo) e, sempre que der o sapatilho e o cabo, procura a menor manilha (por CMT) que
   * também passe nos 4 casos de encaixe — não faz sentido escolher só pela carga e devolver
   * uma combinação que não encaixa fisicamente.
   *
   * codigo — força uma manilha específica (escolha manual do usuário), ignorando a busca.
   */
  function escolherManilha({ cargaKN, tipo, sapatilho, diametroCaboMm, codigo }) {
    const cargaT = cargaKN / G;
    const todas = IC.manilhas.lista(tipo);
    const cabem = todas.filter(m => m.cmt >= cargaT).sort((a, b) => a.cmt - b.cmt);
    const N = IC.fmt.num;
    const formulaCarga = {
      formula: "F_pino = carga da perna (item 2b do método)",
      resultado: `F_pino = ${N(cargaKN)} kN = ${N(cargaT, 2)} t`
    };
    const formulaCmt = m => ({
      formula: "CMT ≥ F_pino",
      sub: `${N(m.cmt, 2)} t ≥ ${N(cargaT, 2)} t`,
      resultado: m.cmt >= cargaT ? "atende" : "não atende"
    });

    if (codigo) {
      const manilha = todas.find(x => x.codigo === codigo) || null;
      const casos = casosEncaixe({ sapatilho, manilha, diametroCaboMm });
      return {
        ok: !!manilha, tipo, cargaKN, cargaT, manilha, codigo, manual: true,
        utilizacao: manilha ? cargaT / manilha.cmt : null,
        formula: formulaCarga, formulaCmt: manilha ? formulaCmt(manilha) : null,
        casos, encaixeCompleto: casos.length > 0 && casos.every(c => c.ok),
        candidatos: cabem
      };
    }

    let escolhida = null, casos = [], encaixeCompleto = false;
    for (const m of cabem) {
      const c = casosEncaixe({ sapatilho, manilha: m, diametroCaboMm });
      if (c.length === 0 || c.every(x => x.ok)) { escolhida = m; casos = c; encaixeCompleto = true; break; }
    }
    if (!escolhida) {
      escolhida = cabem[0] || null;
      casos = escolhida ? casosEncaixe({ sapatilho, manilha: escolhida, diametroCaboMm }) : [];
    }
    return {
      ok: !!escolhida, tipo, cargaKN, cargaT, manilha: escolhida, manual: false,
      utilizacao: escolhida ? cargaT / escolhida.cmt : null,
      formula: formulaCarga, formulaCmt: escolhida ? formulaCmt(escolhida) : null,
      casos, encaixeCompleto, candidatos: cabem
    };
  }

  /**
   * Casos de encaixe sapatilho × manilha — conferidos direto na fórmula executável do
   * arquivo-fonte do memorial (memorial de referência, região "Verificando condições
   * de encaixe", variáveis Caso1.P a Caso4.P) — não no resumo em texto/PDF, que citava
   * fórmulas diferentes (e erradas: com essas, nenhuma manilha nunca encaixava). As letras
   * batem com as colunas de cada tabela de origem (a-k da manilha, a-h do sapatilho); o
   * significado físico exato de cada coluna do sapatilho não vem detalhado na planilha de
   * origem — conferir com o catálogo antes de fechar a compra.
   */
  function casosEncaixe({ sapatilho, manilha, diametroCaboMm }) {
    if (!sapatilho || !manilha || !diametroCaboMm) return [];
    const casos = [
      { n: 1, nome: "Sapatilho × diâmetro do corpo da manilha", a: sapatilho.d, b: manilha.a, formula: "d(sapatilho) > a(manilha)" },
      { n: 2, nome: "Largura do corpo da manilha × sapatilho", a: manilha.g, b: sapatilho.e, formula: "g(manilha) > e(sapatilho)" },
      { n: 3, nome: "Boca da manilha × sapatilho", a: manilha.e, b: sapatilho.e, formula: "e(manilha) > e(sapatilho)" },
      { n: 4, nome: "Sapatilho × diâmetro do olhal da manilha", a: sapatilho.b, b: manilha.c, formula: "b(sapatilho) > c(manilha)" }
    ];
    return casos.map(c => ({ ...c, ok: c.a > c.b }));
  }

  /* ------------------------------------------------------------ olhal (padeye) */

  /** olhal comercial — CMT ≥ carga no pino e o pino da manilha cabe no furo do olhal. */
  function escolherOlhalComprado({ cargaKN, tipo, pinoMm }) {
    const cargaT = cargaKN / G;
    const o = IC.olhais.escolher(tipo, cargaT, pinoMm);
    return { ok: !!o, tipo, cargaKN, cargaT, pinoMm, olhal: o, utilizacao: o ? cargaT / o.cmt : null };
  }

  /**
   * Geometria de partida do olhal fabricado, a partir da manilha escolhida — docs/METODO.md,
   * item 7: R = f_manilha − g_manilha + b_manilha/2 + 5 mm; furo = pino da manilha + folga.
   * São só valores iniciais para o engenheiro ajustar — este módulo não dimensiona sozinho,
   * só verifica a geometria informada (ver verificarOlhalFabricado).
   */
  function geometriaOlhalPartida(manilha) {
    if (!manilha) return null;
    const R = manilha.f - manilha.g + manilha.b / 2 + 5;
    const dFuro = manilha.b + 1.15;
    return {
      t: 25, tAnel: 0, base: Math.round(2 * R), h: Math.round(2 * R),
      R: Math.round(R * 10) / 10, rAnel: Math.round(R * 10) / 10,
      dFuro: Math.round(dFuro * 100) / 100
    };
  }

  /**
   * Verificação de resistência do olhal fabricado (docs/METODO.md, item 7).
   * Fpino em kN, thetaGraus = ângulo da perna com a vertical, geom em mm, Fy em MPa.
   * Não inclui a verificação de solda (item 8 do método) — fazer à parte.
   */
  function verificarOlhalFabricado({ Fpino, thetaGraus, geom, Fy = 355 }) {
    const t = Number(geom.t) || 0, tAnel = Number(geom.tAnel) || 0;
    const base = Number(geom.base) || 0, h = Number(geom.h) || 0;
    const R = Number(geom.R) || 0, rAnel = Number(geom.rAnel) || R;
    const dFuro = Number(geom.dFuro) || 0, rFuro = dFuro / 2;
    const dPino = Math.max(dFuro - 1.15, 0);
    const theta = (Number(thetaGraus) || 0) * Math.PI / 180;

    const b1 = Math.max(R - rFuro, 0);
    const b2 = Math.max(rAnel - rFuro, 0);
    const tTotal = t + 2 * tAnel;
    const FpinoN = (Number(Fpino) || 0) * 1000;   // kN -> N

    const Wipb = t * base * base / 6;             // mm³
    const Wopb = base * t * t / 6;                // mm³
    const Abase = base * t;                       // mm²

    const areaEsmag = dPino * tTotal;
    const areaCis = 2 * (b1 * t + b2 * 2 * tAnel);
    const areaTracao = 2 * b1 * t + 4 * b2 * tAnel;

    const div = (num, den) => (den > 0 ? num / den : Infinity);

    const fP = div(FpinoN, areaEsmag);
    const fV = div(FpinoN, areaCis);
    const fA1 = div(FpinoN, areaTracao);
    const fA = div(FpinoN * Math.sin(theta), Abase);
    const fIpb = div(FpinoN * Math.cos(theta) * h, Wipb);
    const fOpb = div(0.05 * FpinoN * Math.cos(theta) * h, Wopb);

    const N = (v, d = 1) => IC.fmt.num(v, d);
    const checks = [
      { n: 1, nome: "Esmagamento no furo (contato do pino)", tensao: fP, admissivel: 0.9 * Fy,
        formula: { formula: "f_p = F_pino / (D_pino·t_total)", sub: `f_p = ${N(FpinoN, 0)} N / (${N(dPino)}×${N(tTotal)} mm²)`, resultado: `f_p = ${N(fP)} MPa` } },
      { n: 2, nome: "Cisalhamento na área efetiva", tensao: fV, admissivel: 0.4 * Fy,
        formula: { formula: "f_v = F_pino / (2·[(R−r_furo)·t + (r_anel−r_furo)·2·t_anel])", sub: `f_v = ${N(FpinoN, 0)} N / ${N(areaCis)} mm²`, resultado: `f_v = ${N(fV)} MPa` } },
      { n: 3, nome: "Tração na área líquida efetiva", tensao: fA1, admissivel: 0.45 * Fy,
        formula: { formula: "f_a1 = F_pino / (2·b1·t + 4·b2·t_anel)", sub: `f_a1 = ${N(FpinoN, 0)} N / ${N(areaTracao)} mm²`, resultado: `f_a1 = ${N(fA1)} MPa` } },
      { n: 4, nome: "Força axial na base", tensao: fA, admissivel: 0.6 * Fy,
        formula: { formula: "f_a = F_pino·sen(θ) / A_base", sub: `f_a = ${N(FpinoN, 0)}×sen(${N(thetaGraus)}°) / ${N(Abase)} mm²`, resultado: `f_a = ${N(fA)} MPa` } },
      { n: 5, nome: "Flexão no plano do olhal", tensao: fIpb, admissivel: 0.6 * Fy,
        formula: { formula: "f_ipb = F_pino·cos(θ)·h / W_ipb", sub: `f_ipb = ${N(FpinoN, 0)}×cos(${N(thetaGraus)}°)×${N(h)} / ${N(Wipb, 0)} mm³`, resultado: `f_ipb = ${N(fIpb)} MPa` } },
      { n: 6, nome: "Flexão fora do plano do olhal", tensao: fOpb, admissivel: 0.75 * Fy,
        formula: { formula: "f_opb = 0,05·F_pino·cos(θ)·h / W_opb", sub: `f_opb = 0,05×${N(FpinoN, 0)}×cos(${N(thetaGraus)}°)×${N(h)} / ${N(Wopb, 0)} mm³`, resultado: `f_opb = ${N(fOpb)} MPa` } }
    ];
    const interacao = fA / (0.6 * Fy) + fIpb / (0.6 * Fy) + fOpb / (0.75 * Fy);
    checks.push({
      n: 7, nome: "Tensão combinada (interação linear)", tensao: interacao, admissivel: 1, semUnidade: true,
      formula: {
        formula: "f_a/(0,6Fy) + f_ipb/(0,6Fy) + f_opb/(0,75Fy)",
        sub: `${N(fA)}/${N(0.6 * Fy)} + ${N(fIpb)}/${N(0.6 * Fy)} + ${N(fOpb)}/${N(0.75 * Fy)}`,
        resultado: N(interacao, 2)
      }
    });

    checks.forEach(c => { c.utilizacao = c.admissivel > 0 ? c.tensao / c.admissivel : Infinity; c.ok = c.utilizacao <= 1.0001; });

    return {
      checks, ok: checks.every(c => c.ok),
      geom: { t, tAnel, base, h, R, rAnel, dFuro, dPino, b1, b2, tTotal }
    };
  }

  return {
    escolherLinga, escolherSapatilho, escolherManilha, casosEncaixe,
    escolherOlhalComprado, geometriaOlhalPartida, verificarOlhalFabricado
  };
})();
