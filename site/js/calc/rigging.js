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
   * cargaKN — carga de projeto da perna F_SD (DNV-ST-N001 16.3.4), já com DAF e SKL.
   * fl — fatores da linga: { modelo: "N001", gh, gc, gs, gw, gm, Dtopo } ou { modelo: "fs", fs }.
   *   Dtopo — diâmetro de dobra do olho superior (gancho ou elo, mm); null = olho superior
   *   também com sapatilho. O γb da eslinga é o maior das duas pontas (16.4.8.3).
   *   N001 (16.4.2.1 / 16.4.3): MBL ≥ F_SD · γsf, γsf = máx(γh·γc·γr·γw·γm ; 2,3·γr·γw),
   *   γr = máx(γs ; γb), γb = 1/(1 − 0,5/√(D/d)) com D = diâmetro de dobra do olho da eslinga
   *   sobre o sapatilho (altura interna d do sapatilho). Como γb depende do cabo, o cabo é
   *   escolhido percorrendo a tabela do menor para o maior.
   * tipo — chave de IC.lingas.tipos (ex.: "6x19-aco").
   * categoria — grade do arame: "1770" | "1960" | "2160".
   */
  function escolherLinga({ cargaKN, fl, tipo, categoria }) {
    const campo = "ruptura" + categoria;
    const N = IC.fmt.num;
    const n001 = fl && fl.modelo === "N001";
    const fatorDe = d => {
      if (!n001) return { gsf: Number(fl && fl.fs) || 3 };
      const sap = IC.sapatilhos.escolher(d);
      const gbSap = sap ? IC.fatores.gamaB(sap.d, d) : null;
      if (gbSap == null) return null;
      const Dt = Number(fl.Dtopo) > 0 ? Number(fl.Dtopo) : null;
      const gbTopo = Dt ? IC.fatores.gamaB(Dt, d) : gbSap;
      if (gbTopo == null) return null;
      const gb = Math.max(gbSap, gbTopo);
      const gr = Math.max(fl.gs, gb);
      const p1 = fl.gh * fl.gc * gr * fl.gw * fl.gm, p2 = 2.3 * gr * fl.gw;
      return { gsf: Math.max(p1, p2, 2.3), gb, gbSap, gbTopo, Dtopo: Dt, gr, p1, p2, D: sap.d, sapatilho: sap.codigo };
    };
    const linhas = IC.lingas.lista(tipo);
    let linha = null, fx = null;
    for (const l of linhas) {
      const f = fatorDe(l.diametro);
      if (f && l[campo] >= cargaKN * f.gsf) { linha = l; fx = f; break; }
    }
    if (!fx) fx = (linhas.length && fatorDe(linhas[linhas.length - 1].diametro)) || { gsf: n001 ? NaN : Number(fl && fl.fs) || 3 };
    const mblReqKN = cargaKN * fx.gsf;
    const passos = [];
    if (n001 && linha) {
      passos.push(
        { titulo: "Dobra no sapatilho (olho inferior)",
          formula: "γb_inf = 1 / (1 − 0,5/√(D/d))   — D: altura interna do sapatilho, d: diâmetro do cabo (DNV-ST-N001 16.4.8.1)",
          sub: `γb_inf = 1 / (1 − 0,5/√(${N(fx.D, 1)}/${N(linha.diametro, 1)}))`, resultado: `γb_inf = ${N(fx.gbSap, 3)}` },
        fx.Dtopo
          ? { titulo: "Dobra no gancho ou elo (olho superior)",
              formula: "γb_sup = 1 / (1 − 0,5/√(D_sup/d))   (16.4.8.1)",
              sub: `γb_sup = 1 / (1 − 0,5/√(${N(fx.Dtopo, 1)}/${N(linha.diametro, 1)}))`, resultado: `γb_sup = ${N(fx.gbTopo, 3)}` }
          : { titulo: "Dobra no olho superior (com sapatilho)", formula: "γb_sup = γb_inf   — olho superior também com sapatilho",
              resultado: `γb_sup = ${N(fx.gbTopo, 3)}` },
        { titulo: "Fator de dobra da eslinga", formula: "γb = máx(γb_inf ; γb_sup)   — a ponta mais severa (16.4.8.3)",
          sub: `γb = máx(${N(fx.gbSap, 3)} ; ${N(fx.gbTopo, 3)})`, resultado: `γb = ${N(fx.gb, 3)}` },
        { titulo: "Fator de redução", formula: "γr = máx(γs ; γb)   (16.4.6.1)", sub: `γr = máx(${N(fl.gs, 2)} ; ${N(fx.gb, 3)})`, resultado: `γr = ${N(fx.gr, 3)}` },
        { titulo: "Fator de segurança da eslinga", formula: "γsf = máx(γh·γc·γr·γw·γm ; 2,3·γr·γw)   (16.4.3.1)",
          sub: `γsf = máx(${N(fl.gh, 2)}×${N(fl.gc, 2)}×${N(fx.gr, 3)}×${N(fl.gw, 2)}×${N(fl.gm, 2)} ; 2,3×${N(fx.gr, 3)}×${N(fl.gw, 2)}) = máx(${N(fx.p1, 3)} ; ${N(fx.p2, 3)})`,
          resultado: `γsf = ${N(fx.gsf, 3)}` });
    }
    passos.push({
      titulo: "MBL requerida",
      formula: n001 ? "MBL_req = F_SD · γsf   (16.4.2.1)" : "MBL_req = F_SD · FS_linga",
      sub: `MBL_req = ${N(cargaKN)} kN × ${N(fx.gsf, 3)}`,
      resultado: `MBL_req = ${N(mblReqKN)} kN`
    });
    return {
      ok: !!linha, tipo, categoria, fsLinga: fx.gsf, fatores: fx, fl, n001, cargaKN, mblReqKN,
      diametro: linha ? linha.diametro : null,
      peso: linha ? linha.peso : null,
      mblKN: linha ? linha[campo] : null,
      utilizacao: linha ? mblReqKN / linha[campo] : null,
      formula: passos,
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
   * espessuraChapaMm — t + 2·t.anel do olhal fabricado (null no olhal comprado): a chapa tem
   *   que entrar na boca da manilha sem sobrar mais que a folga máxima (ver encaixeChapa), então
   *   mudar a espessura pode trocar a manilha escolhida.
   */
  function escolherManilha({ cargaKN, tipo, sapatilho, diametroCaboMm, codigo, espessuraChapaMm }) {
    const cargaT = cargaKN / G;
    const todas = IC.manilhas.lista(tipo);
    const cabem = todas.filter(m => m.cmt >= cargaT).sort((a, b) => a.cmt - b.cmt);
    const N = IC.fmt.num;
    const formulaCarga = {
      formula: "F_linga = carga de projeto da perna (com γ_peso, γ_CoG, DAF e SKL)",
      resultado: `F_linga = ${N(cargaKN)} kN = ${N(cargaT, 2)} t`
    };
    const formulaCmt = m => ({
      formula: "CMT ≥ F_linga   (N-2683 4.2.2)",
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
        chapa: encaixeChapa(manilha, espessuraChapaMm), candidatos: cabem
      };
    }

    // a menor (por CMT) que encaixa no sapatilho E fica justa na chapa do olhal; se nenhuma
    // fizer as duas coisas, a menor em que ao menos a chapa entra, depois a menor que encaixa
    // no sapatilho (a tela avisa da chapa); por fim, a menor pela carga
    const encaixa = m => {
      const c = casosEncaixe({ sapatilho, manilha: m, diametroCaboMm });
      return c.length === 0 || c.every(x => x.ok);
    };
    const chapa = m => encaixeChapa(m, espessuraChapaMm);
    const escolhida = cabem.find(m => encaixa(m) && (!chapa(m) || chapa(m).ok))
      || cabem.find(m => encaixa(m) && (!chapa(m) || chapa(m).cabe))
      || cabem.find(encaixa) || cabem[0] || null;
    const casos = escolhida ? casosEncaixe({ sapatilho, manilha: escolhida, diametroCaboMm }) : [];
    return {
      ok: !!escolhida, tipo, cargaKN, cargaT, manilha: escolhida, manual: false,
      utilizacao: escolhida ? cargaT / escolhida.cmt : null,
      formula: formulaCarga, formulaCmt: escolhida ? formulaCmt(escolhida) : null,
      casos, encaixeCompleto: !!escolhida && encaixa(escolhida),
      chapa: encaixeChapa(escolhida, espessuraChapaMm), candidatos: cabem
    };
  }

  /**
   * Chapa do olhal × boca da manilha (docs/METODO.md, item 6 — folgas do memorial):
   * a chapa com o reforço (t + 2·t.anel) tem que entrar na boca `e` da manilha, e a folga
   * que sobra não pode passar de 11,75 mm (T_min = e − 11,75): manilha folgada demais na chapa
   * trabalha torta, com o pino fletido e a carga fora do plano do olhal.
   */
  // N-2683 4.2.3.2: folga máxima entre a espessura do olhal no furo e a abertura W da manilha =
  // o menor entre 25 % de W e 12 mm
  const folgaBocaMax = boca => Math.min(0.25 * boca, 12);
  function encaixeChapa(manilha, espessuraMm) {
    if (!manilha || !(Number(espessuraMm) > 0)) return null;
    const folga = manilha.e - espessuraMm, folgaMax = folgaBocaMax(manilha.e);
    return {
      boca: manilha.e, espessura: espessuraMm, folga, folgaMax,
      tMin: manilha.e - folgaMax, cabe: folga > 0, ok: folga > 0 && folga <= folgaMax
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
      // nomes conforme a folha de dimensões de cada peça (ver figuras.js):
      // sapatilho  a compr. total · b compr. interno · c altura total · d altura interna · e largura · f ranhura
      // manilha    a corpo · b pino · c largura do corpo · d orelha · e boca · f compr. interno · g interno do arco
      { n: 1, nome: "Altura interna do sapatilho × corpo da manilha", a: sapatilho.d, b: manilha.a, formula: "d(sapatilho) > a(manilha)" },
      { n: 2, nome: "Interno do arco da manilha × largura do sapatilho", a: manilha.g, b: sapatilho.e, formula: "g(manilha) > e(sapatilho)" },
      { n: 3, nome: "Boca da manilha × largura do sapatilho", a: manilha.e, b: sapatilho.e, formula: "e(manilha) > e(sapatilho)" },
      { n: 4, nome: "Comprimento interno do sapatilho × corpo da manilha", a: sapatilho.b, b: manilha.c, formula: "b(sapatilho) > c(manilha)" }
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

  /** folga do furo da N-2683 5.3.1: 1 mm até pino de 33 mm; acima, 0,03·d_pino limitado a 6 mm */
  const folgaFuro = dPino => (dPino <= 33 ? 1 : Math.min(0.03 * dPino, 6));

  /**
   * Geometria de partida do olhal fabricado, a partir da manilha escolhida:
   * furo = pino + folga (N-2683 5.3.1); R = f − g + b/2 + 5 mm (docs/METODO.md, item 7).
   * Espessura, base e altura são escolhidas na página; R e o furo acompanham a manilha.
   */
  function geometriaOlhalPartida(manilha) {
    if (!manilha) return null;
    const R = manilha.f - manilha.g + manilha.b / 2 + 5;
    const dFuro = manilha.b + folgaFuro(manilha.b);
    return {
      t: 25, tAnel: 0, base: Math.round(2 * R), h: Math.round(2 * R),
      R: Math.round(R * 10) / 10, rAnel: 0,
      dFuro: Math.round(dFuro * 100) / 100
    };
  }

  /** lado mínimo do filete de solda pela chapa mais grossa — N-2683, Tabela 1 */
  const fileteMinimo = t => (t <= 6.4 ? 3 : t <= 12.5 ? 5 : t <= 19 ? 6 : 8);
  /** tensão de ruptura do eletrodo — N-2683 5.4.8 */
  const ELETRODOS = { E60: 415, E70: 485 };

  /**
   * Verificação do olhal fabricado pela Petrobras N-2683 (rev. B), itens 5.2 a 5.4, e da base
   * pelo Anexo A.4 (AISC, tensões admissíveis).
   *   Flinga — força da linga no olhal (kN), já com γ_peso, γ_CoG, DAF e SKL;
   *   fc — fator de consequência (5.2 a): F_pino = fc · F_linga;
   *   thetaGraus — ângulo da linga com a BASE do olhal (90° = puxando no eixo);
   *   dPino — diâmetro do pino da manilha (mm); geom em mm; Fy em MPa;
   *   solda — { tipo: "penetracao" | "filete", a (lado do filete, mm), eletrodo: "E60" | "E70" };
   *   encaixe — { manilha, sapatilho } para a folga do cabo (4.2.3.1); sem ele não há essa verificação.
   */
  function verificarOlhalFabricado({ Flinga, fc = 1.3, thetaGraus, geom, Fy = 355, dPino, solda = {}, encaixe = null }) {
    const t = Number(geom.t) || 0, tAnel = Number(geom.tAnel) || 0;
    const base = Number(geom.base) || 0, h = Number(geom.h) || 0;
    const R = Number(geom.R) || 0;
    const comAnel = tAnel > 0;
    const rAnel = comAnel ? Number(geom.rAnel) || 0 : 0;
    const dFuro = Number(geom.dFuro) || 0, rFuro = dFuro / 2;
    const dP = Number(dPino) > 0 ? Number(dPino) : Math.max(dFuro - folgaFuro(dFuro), 0);
    const theta = (Number(thetaGraus) || 0) * Math.PI / 180;
    const sen = Math.sin(theta), cos = Math.cos(theta);

    const T = t + 2 * tAnel;
    const FpinoKN = fc * (Number(Flinga) || 0);
    const F = FpinoKN * 1000;                       // N
    const b1 = Math.max(Math.min(4 * T, 0.8 * dFuro, R - rFuro), 0);
    const b2 = comAnel ? Math.max(Math.min(rAnel - rFuro, b1), 0) : 0;
    const b3 = comAnel ? Math.min(2 * R, 2 * b1 + dFuro + 2 * rAnel) : Math.min(2 * R, 2 * b1 + 2 * dFuro);

    const Abase = base * t, Wipb = t * base * base / 6, Wopb = base * t * t / 6;
    const div = (num, den) => (den > 0 ? num / den : Infinity);
    const N = (v, d = 1) => IC.fmt.num(v, d);
    const Fn = N(F, 0);

    const areaCis = 2 * ((R - rFuro) * t + (comAnel ? (rAnel - rFuro) * 2 * tAnel : 0));
    const areaFuro = 2 * b1 * t + 4 * b2 * tAnel;
    const fP = div(F, dP * T), fV = div(F, areaCis), fA1 = div(F, areaFuro), fB3 = div(F, b3 * t);
    const fArr = div(F, 2 * R * t);
    const fA = div(F * sen, Abase), fIpb = div(F * cos * h, Wipb), fOpb = div(0.05 * F * h, Wopb);
    const fVb = div(1.5 * F * cos, Abase);

    const checks = [
      { nome: "Contato do pino com o olhal (N-2683 5.4.1)", tensao: fP, admissivel: 0.9 * Fy,
        formula: { formula: "f_p = F_pino / (d_pino·(t + 2·t_anel)) ≤ 0,90·Fy", sub: `f_p = ${Fn} / (${N(dP)}×${N(T)})`, resultado: `f_p = ${N(fP)} MPa` } },
      { nome: "Cisalhamento na área efetiva (N-2683 5.4.2)", tensao: fV, admissivel: 0.4 * Fy,
        formula: { formula: "f_v = F_pino / (2·[(R − r_furo)·t + (r_anel − r_furo)·2·t_anel]) ≤ 0,40·Fy",
          sub: `f_v = ${Fn} / ${N(areaCis)}`, resultado: `f_v = ${N(fV)} MPa` } },
      { nome: "Tração na área líquida efetiva na região do furo (N-2683 5.4.3)", tensao: fA1, admissivel: 0.45 * Fy,
        formula: { formula: "f_a1 = F_pino / (2·b1·t + 4·b2·t_anel) ≤ 0,45·Fy;  b1 = mín(4T ; 0,8·d_furo ; R − r_furo);  b2 = mín(r_anel − r_furo ; b1)",
          sub: `b1 = mín(${N(4 * T)} ; ${N(0.8 * dFuro)} ; ${N(R - rFuro)}) = ${N(b1, 2)} mm · b2 = ${N(b2, 2)} mm · f_a1 = ${Fn} / ${N(areaFuro)}`,
          resultado: `f_a1 = ${N(fA1)} MPa` } },
      { nome: "Escoamento da seção bruta logo abaixo do furo (N-2683 5.4.4)", tensao: fB3, admissivel: 0.6 * Fy,
        formula: { formula: comAnel ? "f_a3 = F_pino / (b3·t) ≤ 0,60·Fy;  b3 = mín(2R ; 2·b1 + d_furo + d_anel)"
            : "f_a3 = F_pino / (b3·t) ≤ 0,60·Fy;  b3 = mín(2R ; 2·b1 + 2·d_furo)",
          sub: `b3 = ${N(b3, 2)} mm · f_a3 = ${Fn} / (${N(b3)}×${N(t)})`, resultado: `f_a3 = ${N(fB3)} MPa` } },
      { nome: "Arrancamento do conjunto do olhal (N-2683 5.4.5)", tensao: fArr, admissivel: 0.6 * Fy,
        formula: { formula: "F_pino ≤ [2·R + r_anel·(γ1 + γ2)]·t·0,6·Fy, com γ1 = γ2 = 0 (a favor da segurança):  f = F_pino / (2·R·t) ≤ 0,60·Fy",
          sub: `f = ${Fn} / (2×${N(R)}×${N(t)})`, resultado: `f = ${N(fArr)} MPa` } }
    ];

    // N-2683 4.2.3.1 e Figura 1: entre o cabo (com o sapatilho, apoiado no topo interno do arco)
    // e o topo da chapa sobram pelo menos 6 mm. Medidas a partir do eixo do pino: o topo interno
    // do arco fica em f; o sapatilho ocupa (c − d)/2 abaixo dele; sob carga o pino encosta no
    // alto do furo, e o topo da chapa fica em R − (d_furo − d_pino)/2.
    let folgaCabo = null;
    if (encaixe && encaixe.manilha && encaixe.sapatilho) {
      const mn = encaixe.manilha, sp = encaixe.sapatilho;
      const paredeSap = (sp.c - sp.d) / 2;
      const topoChapa = R - (dFuro - dP) / 2;
      const folga = mn.f - paredeSap - topoChapa;
      folgaCabo = { folga, paredeSap, topoChapa };
      checks.push({ nome: "Folga para o cabo entre a manilha e o olhal ≥ 6 mm (N-2683 4.2.3.1)",
        tensao: 6, admissivel: Math.max(folga, 1e-9), unidade: "mm",
        formula: { formula: "folga = f_man − (c_sap − d_sap)/2 − [R − (d_furo − d_pino)/2] ≥ 6 mm",
          sub: `folga = ${N(mn.f)} − (${N(sp.c)} − ${N(sp.d)})/2 − [${N(R)} − (${N(dFuro, 2)} − ${N(dP)})/2]`,
          resultado: `folga = ${N(folga)} mm` } });
    }

    // anel de reforço: solda do anel na chapa principal (5.4.6 e 5.4.7)
    const fwu = ELETRODOS[solda.eletrodo] || ELETRODOS.E70;
    const Fw = Math.min(0.3 * fwu, 0.4 * Fy * Math.SQRT2);
    let anel = null;
    if (comAnel) {
      const Fanel = F * tAnel / T;
      const g = div(Fanel, Math.PI * rAnel * Fw);
      const aMin = fileteMinimo(Math.max(t, tAnel));
      const a = Math.max(Math.ceil(Math.SQRT2 * g), aMin);
      const tau = div(Fanel, Math.PI * rAnel * a / Math.SQRT2);
      anel = { Fanel, g, aMin, a };
      checks.push({ nome: `Solda do anel de reforço — filete de ${N(a, 0)} mm (N-2683 5.4.6 e 5.4.7)`, tensao: tau, admissivel: Fw,
        formula: { formula: "F_anel = F_pino·t_anel/(t + 2·t_anel);  g_solda ≥ F_anel/(π·r_anel·Fw);  a = √2·g_solda ≥ a_mín (Tabela 1)",
          sub: `F_anel = ${N(Fanel, 0)} N · Fw = mín(0,30×${fwu} ; 0,40×${N(Fy, 0)}×√2) = ${N(Fw)} MPa · g_solda ≥ ${N(g, 2)} mm · a_mín = ${aMin} mm`,
          resultado: `a = ${N(a, 0)} mm · τ = ${N(tau)} MPa` } });
    }

    // base do olhal (Anexo A.4)
    checks.push(
      { nome: "Força axial na base (N-2683 A.4.1)", tensao: fA, admissivel: 0.6 * Fy,
        formula: { formula: "f_a = F_pino·sen(θ) / (base·t) ≤ 0,60·Fy", sub: `f_a = ${Fn}×sen(${N(thetaGraus)}°) / ${N(Abase, 0)}`, resultado: `f_a = ${N(fA)} MPa` } },
      { nome: "Flexão no plano do olhal (N-2683 A.4.2)", tensao: fIpb, admissivel: 0.6 * Fy,
        formula: { formula: "f_ipb = F_pino·cos(θ)·h / W_ipb ≤ 0,60·Fy;  W_ipb = t·base²/6",
          sub: `f_ipb = ${Fn}×cos(${N(thetaGraus)}°)×${N(h)} / ${N(Wipb, 0)}`, resultado: `f_ipb = ${N(fIpb)} MPa` } },
      { nome: "Flexão fora do plano do olhal — 5 % de F_pino (N-2683 5.4.9 e A.4.3)", tensao: fOpb, admissivel: 0.75 * Fy,
        formula: { formula: "f_opb = 0,05·F_pino·h / W_opb ≤ 0,75·Fy;  W_opb = base·t²/6",
          sub: `f_opb = 0,05×${Fn}×${N(h)} / ${N(Wopb, 0)}`, resultado: `f_opb = ${N(fOpb)} MPa` } }
    );
    const interacao = fA / (0.6 * Fy) + fIpb / (0.6 * Fy) + fOpb / (0.75 * Fy);
    checks.push(
      { nome: "Tensões combinadas (N-2683 A.4.4)", tensao: interacao, admissivel: 1, semUnidade: true,
        formula: { formula: "f_a/(0,6·Fy) + f_ipb/(0,6·Fy) + f_opb/(0,75·Fy) ≤ 1",
          sub: `${N(fA)}/${N(0.6 * Fy)} + ${N(fIpb)}/${N(0.6 * Fy)} + ${N(fOpb)}/${N(0.75 * Fy)}`, resultado: N(interacao, 2) } },
      { nome: "Cisalhamento na base do olhal (N-2683 A.4.5)", tensao: fVb, admissivel: 0.4 * Fy,
        formula: { formula: "f_v = 1,5·F_pino·cos(θ) / (base·t) ≤ 0,40·Fy", sub: `f_v = 1,5×${Fn}×cos(${N(thetaGraus)}°) / ${N(Abase, 0)}`, resultado: `f_vb = ${N(fVb)} MPa` } },
      { nome: "Raio externo ≥ diâmetro do furo (DNV-ST-N001 16.9.5.1)", tensao: dFuro, admissivel: R, unidade: "mm",
        formula: { formula: "R ≥ d_furo", sub: `${N(R)} mm ≥ ${N(dFuro, 2)} mm`, resultado: R >= dFuro ? "R ≥ d_furo" : "R < d_furo" } }
    );

    // solda do olhal na estrutura (5.4.10): penetração total = resistência da chapa, já
    // verificada acima; filete nas duas faces ao longo da base, pelo método elástico
    const tipoSolda = solda.tipo === "filete" ? "filete" : "penetracao";
    let soldaBase = { tipo: tipoSolda, fwu, Fw };
    if (tipoSolda === "filete") {
      const aMin = fileteMinimo(t);
      const a = Number(solda.a) > 0 ? Number(solda.a) : aMin;
      const g = a / Math.SQRT2;
      const Aw = 2 * base * g;
      const Sipb = 2 * g * base * base / 6;
      const Iopb = 2 * base * g * Math.pow((t + g) / 2, 2);
      const Sopb = Iopb / (t / 2 + g);
      const fn = div(F * sen, Aw) + div(F * cos * h, Sipb) + div(0.05 * F * h, Sopb);
      const fs = div(Math.hypot(F * cos, 0.05 * F), Aw);
      const fr = Math.hypot(fn, fs);
      soldaBase = { tipo: tipoSolda, fwu, Fw, a, aMin, g, Aw, fn, fs, fr };
      checks.push(
        { nome: `Solda de filete do olhal na estrutura — lado ${N(a, 1)} mm (N-2683 5.4.10, AISC)`, tensao: fr, admissivel: Fw,
          formula: { formula: "filetes nas duas faces ao longo da base, garganta g_solda = a/√2;  f_n = F·sen θ/A_w + F·cos θ·h/S_ipb + 0,05·F·h/S_opb;  "
              + "f_s = √((F·cos θ)² + (0,05·F)²)/A_w;  f_r = √(f_n² + f_s²) ≤ Fw = mín(0,30·Fwu ; 0,40·Fy·√2)",
            sub: `g_solda = ${N(g, 2)} mm · A_w = ${N(Aw, 0)} mm² · f_n = ${N(fn)} MPa · f_s = ${N(fs)} MPa · Fw = ${N(Fw)} MPa`,
            resultado: `f_r = ${N(fr)} MPa` } },
        { nome: "Lado mínimo do filete (N-2683 Tabela 1)", tensao: aMin, admissivel: a, unidade: "mm",
          formula: { formula: "a ≥ a_mín", sub: `${N(a, 1)} mm ≥ ${aMin} mm`, resultado: a >= aMin ? "a ≥ a_mín" : "a < a_mín" } });
    }

    checks.forEach((c, i) => {
      c.n = i + 1;
      c.utilizacao = c.admissivel > 0 ? c.tensao / c.admissivel : Infinity;
      c.ok = c.utilizacao <= 1.0001;
    });

    return {
      checks, ok: checks.every(c => c.ok), FpinoKN, fc, soldaBase, anel, folgaCabo,
      geom: { t, tAnel, base, h, R, rAnel, dFuro, dPino: dP, b1, b2, b3, tTotal: T }
    };
  }

  return {
    escolherLinga, escolherSapatilho, escolherManilha, casosEncaixe, encaixeChapa,
    escolherOlhalComprado, geometriaOlhalPartida, verificarOlhalFabricado, folgaFuro, fileteMinimo, ELETRODOS
  };
})();
