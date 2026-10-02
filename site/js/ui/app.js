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
  const paraCampo = (v, dec) => F.num(v, dec).replace(",", ".");

  /* ---------------------------------------------------------- valor com unidade digitada
   * O campo aceita "5000", "5 t", "5t", "12,5 kN". Quando vem unidade junto, é ela que vale
   * — e não a escolhida no topo. É o jeito natural de corrigir a unidade sem ter que trocar
   * o seletor e recalcular de cabeça.
   */
  const FATOR_MASSA = {                       // para kg
    kg: 1, kgf: 1, g: 0.001, t: 1000, ton: 1000, tf: 1000,
    n: 1 / G, kn: 1000 / G
  };
  const FATOR_COMP = { mm: 1, cm: 10, m: 1000 };   // para mm

  /** separa o número da unidade; devolve null na unidade quando não veio nenhuma */
  function partesDoCampo(texto) {
    const t = String(texto == null ? "" : texto).trim().toLowerCase().replace(/\s+/g, "");
    const m = t.match(/^([-+]?[\d.,]+)([a-zçãéê]*)$/i);
    if (!m) return { num: NaN, unid: null };
    const num = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    return { num, unid: m[2] || null };
  }

  /** texto do campo -> kg */
  function lerMassa(texto) {
    const { num, unid } = partesDoCampo(texto);
    if (!isFinite(num)) return 0;
    const f = unid ? FATOR_MASSA[unid] : null;
    return f ? num * f : massaParaKg(num);
  }

  /** texto do campo -> mm */
  function lerComp(texto) {
    const { num, unid } = partesDoCampo(texto);
    if (!isFinite(num)) return 0;
    const f = unid ? FATOR_COMP[unid] : null;
    return f ? num * f : compParaMm(num);
  }

  /* ------------------------------------------------------------ tipos de arranjo
   * Cada tipo diz quais medidas o usuário informa (sempre DISTÂNCIAS do CG até o ponto)
   * e como elas viram coordenadas — o sentido de cada uma está na figura das medidas.
   */
  const TIPOS = {
    duas: {
      nome: "Duas pernas", resumo: "duas lingas, corpo alongado", pernas: 2,
      medidas: [["a1", "a₁ — do CG até P1"], ["a2", "a₂ — do CG até P2"], ["h", "h — altura dos pontos em relação ao CG"]],
      padrao: { a1: 1000, a2: 1000, h: 0 },
      pontos: m => [
        { nome: "P1", x: -Math.abs(m.a1), y: 0, z: m.h },
        { nome: "P2", x: +Math.abs(m.a2), y: 0, z: m.h }
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
      linga: { tipo: "6x19-aco", categoria: "1960" },
      manilhaTipo: "G-4163", manilhaCodigo: null,   // null = escolha automática (menor manilha que encaixa em tudo)
      olhal: { modo: "fabricado", tipoComprado: "GPAL-UNC", fy: 355, porPerna: [] }
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
  const pontosDe = ic => TIPOS[ic.tipo].pontos(ic.medidas);

  /** altura do gancho: sai do ângulo informado na perna escolhida */
  function alturaGancho(ic) {
    const P = pontosDe(ic);
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
      daf: FAT.daf(ic.base, ic.local, (Number(ic.massa) || 0) / 1000),
      consequencia: b.consequencia[ic.consequencia] ?? 1,
      skl: TIPOS[ic.tipo].pernas > 2 ? b.skl.quatro : b.skl.duas,
      fsLinga: b.fsLinga.padrao,
      anguloMax: FAT.anguloMaximo
    };
    return Object.assign(padrao, ic.fatores || {});
  }

  const resolver = ic => C.resolver({
    massa: ic.massa, alturaGancho: alturaGancho(ic), pontos: pontosDe(ic),
    hipotese4: ic.hipotese4, fatores: fatoresDe(ic)
  });

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

  function riggingDe(ic) {
    const f = fatoresDe(ic);
    const cargaGov = cargaGovernanteKN(ic);
    const linga = RIG.escolherLinga({ cargaKN: cargaGov, fsLinga: f.fsLinga, tipo: ic.linga.tipo, categoria: ic.linga.categoria });
    const sapatilho = RIG.escolherSapatilho(linga.diametro);
    const manilha = RIG.escolherManilha({
      cargaKN: cargaGov, tipo: ic.manilhaTipo, sapatilho: sapatilho.sapatilho,
      diametroCaboMm: linga.diametro, codigo: ic.manilhaCodigo || null
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
    ic.olhal.geom.rAnel = Number(ic.olhal.geom.R) || 0;
    return ic.olhal.geom;
  }

  /** a perna que manda no olhal: a mais tracionada */
  function pernaGovernante(ic) {
    const pernas = resolver(ic).pernas;
    return pernas.reduce((a, b) => (b.tracao > a.tracao ? b : a), pernas[0]);
  }

  /** o olhal do içamento (um só), já verificado pela perna mais carregada */
  function olhalDe(ic, rig) {
    const pernas = resolver(ic).pernas;
    const gov = pernaGovernante(ic);
    const nomes = pernas.map(p => p.nome);
    if (ic.olhal.modo === "comprado") {
      const pinoMm = rig.manilha.manilha ? rig.manilha.manilha.b : null;
      const resultado = RIG.escolherOlhalComprado({ cargaKN: gov.tracao, tipo: ic.olhal.tipoComprado, pinoMm });
      return { nomes, qtd: pernas.length, governante: gov, modo: "comprado", resultado };
    }
    const geom = olhalGeomDe(ic, rig.manilha.manilha);
    const verif = RIG.verificarOlhalFabricado({
      Fpino: gov.tracao, thetaGraus: gov.angulo, geom, Fy: fyDoOlhal(ic)
    });
    return { nomes, qtd: pernas.length, governante: gov, modo: "fabricado", geom, verif };
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
        + `${pernas.length} pernas de ${pernas.map(p => F.num(p.comprimento, 0)).join(" / ")} mm`,
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

  /** massa aproximada do olhal fabricado: a chapa (base × h) menos o furo, a 7,85 kg/dm³.
   *  É estimativa — a chapa real é recortada e pode levar reforço; serve para o peso total
   *  do conjunto não sair vazio. */
  function massaOlhalFabricado(g) {
    const base = Number(g.base), h = Number(g.h), t = Number(g.t), d = Number(g.dFuro) || 0;
    if (!(base > 0 && h > 0 && t > 0)) return null;
    const areaMm2 = base * h - Math.PI * d * d / 4;
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
    $("ic-massa").value = paraCampo(massaParaTela(ic.massa), UNID.massa[uMassa()].dec);
    $("ic-massa").title = `Dá para digitar a unidade junto: "5 t", "800 kg", "50 kN".`;
    $("rot-massa").textContent = `Massa (${uMassa()})`;
    $("ic-origem").value = ic.origem;
    $("ic-local").value = ic.local;
    $("ic-cons").value = ic.consequencia;
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
    $("dica-base").innerHTML = `${F.esc(b.nota)} ${b.conferir
      ? "<b>Os valores das tabelas da norma precisam ser conferidos com a edição contratada.</b>" : ""}`;

    // cartões dos tipos, cada um com o seu desenho
    $("tipos").innerHTML = Object.entries(TIPOS).map(([k, tp]) =>
      `<button type="button" class="tipo${k === ic.tipo ? " on" : ""}" data-tipo="${k}" role="radio" aria-checked="${k === ic.tipo}">
        <div class="tipo__fig">${FIG.icone(k)}</div>
        <b>${F.esc(tp.nome)}</b><span>${F.esc(tp.resumo)}</span></button>`).join("");

    // figuras no alto da etapa das medidas: o 3D com as distâncias reais e o esquema do que informar
    $("fig-3d-medidas").innerHTML = IC.iso3d.desenhar(resolver(ic), { modo: "medidas", comp: txtComp });
    $("fig-medidas").innerHTML = FIG.medidas(ic.tipo);

    const numCampo = k => `<input type="text" inputmode="decimal" data-medida="${k}"
      data-key="medida-${k}" title="Dá para digitar a unidade junto: &quot;2,5 m&quot;, &quot;2500 mm&quot;."
      value="${paraCampo(compParaTela(ic.medidas[k]), decComp())}">`;
    if (t.porPonto) {
      $("campos-medidas").innerHTML = `<table class="tab tab--pontos"><thead><tr>
          <th>Ponto</th><th>x (${uComp()})</th><th>y (${uComp()})</th>
          <th>z — altura (${uComp()})</th><th>distância horizontal</th></tr></thead>
        <tbody>${[1, 2, 3, 4].map(i => `<tr><td>P${i}</td>
          <td>${numCampo(`x${i}`)}</td><td>${numCampo(`y${i}`)}</td><td>${numCampo(`z${i}`)}</td>
          <td class="num som">${txtComp(Math.hypot(ic.medidas[`x${i}`], ic.medidas[`y${i}`]))}</td></tr>`).join("")}</tbody></table>`;
    } else {
      $("campos-medidas").innerHTML = `<div class="grade">${t.medidas.map(([k, rot]) =>
        `<label class="campo"><span>${F.esc(rot)} (${uComp()})</span>${numCampo(k)}</label>`).join("")}</div>`;
    }

    // ângulo da perna com a estrutura (substitui a altura do gancho)
    const P = pontosDe(ic);
    const iAng = Math.min(ic.pernaAngulo || 0, P.length - 1);
    $("ic-angulo").value = ic.angulo;
    $("ic-perna-ang").innerHTML = P.map((p, i) =>
      `<option value="${i}"${i === iAng ? " selected" : ""}>${F.esc(p.nome)}</option>`).join("");
    const H = alturaGancho(ic);
    const Lp = Math.hypot(P[iAng].x, P[iAng].y, H - P[iAng].z);
    $("saida-altura").innerHTML = `Altura do gancho acima do CG: <b>${txtComp(H)}</b> · comprimento da perna ${F.esc(P[iAng].nome)}: <b>${txtComp(Lp)}</b>`;

    // fatores
    const f = fatoresDe(ic);
    const rotulos = {
      peso: "Margem de peso γ", daf: "Amplificação dinâmica DAF", consequencia: "Consequência γc",
      skl: "Distribuição desigual SKL", fsLinga: "FS da linga", anguloMax: "Ângulo máx. c/ a vertical (°)"
    };
    $("campos-fatores").innerHTML = Object.entries(rotulos).map(([k, rot]) =>
      `<label class="campo"><span>${rot}</span><input type="number" step="0.05" data-fator="${k}" data-key="fator-${k}" value="${f[k]}"></label>`).join("");
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
      <p class="dica">Razão diagonais / elástica × SKL = <b>${F.num(dg / el, 2)}</b>.
        A elástica × SKL é o modelo da norma para lingas de comprimento controlado (conjunto
        casado, tolerância de fabricação conhecida). Use pares diagonais quando as lingas não
        forem casadas, o corpo for muito rígido e não houver controle do comprimento, ou quando
        o cliente/certificadora exigir a envoltória.</p>`;
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
        formula: "W_proj = W · γ_peso · DAF · γ_cons",
        sub: `W_proj = ${F.num(r.pesoKN, 2)} × ${F.num(r.fatores.peso, 2)} × ${F.num(r.fatores.daf, 2)} × ${F.num(r.fatores.consequencia, 2)}`,
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
      <thead><tr><th>Perna</th><th>Comprimento</th><th>Ângulo c/ a estrutura</th><th>Ângulo c/ a vertical</th>
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
    $("fig-planta").innerHTML = IC.fbd.planta(r);
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
            <div class="item"><span>Ângulo da perna</span><b>${F.grau(x.angulo)} c/ a estrutura</b></div>
            <div class="item"><span>Altura do gancho</span><b>${txtComp(alturaGancho(x))}</b></div>
            <div class="item"><span>γ peso × DAF × γc</span><b>${F.num(fx.peso, 2)} × ${F.num(fx.daf, 2)} × ${F.num(fx.consequencia, 2)}</b></div>
            <div class="item"><span>SKL</span><b>${F.num(fx.skl, 2)}</b></div>` : ""}
        </div>
        ${aberto ? `
          <label class="campo"><span>Linga</span>
            <select id="ic-linga">
              <option value="propria"${x.lingaPropria ? " selected" : ""}>dimensionar para este içamento</option>
              <option value="padrao"${x.lingaPropria ? "" : " selected"}>usar a maior carga do estudo (${F.num(maiorEstudo, 2)} t)</option>
            </select></label>
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

    const rig = riggingDe(ic);
    const l = rig.linga;
    if (!l.ok) {
      $("resultado-linga").innerHTML = `<div class="aviso aviso--erro">Nenhum cabo da tabela atende à MBL requerida (${F.kn(l.mblReqKN)}).</div>`;
      return;
    }
    $("resultado-linga").innerHTML = `
      <div class="painel">
        <div class="item"><span>Carga governante</span><b>${F.kn(rig.cargaGov)} · ${F.ton(rig.cargaGov / G)}</b></div>
        <div class="item"><span>FS da linga</span><b>${F.num(l.fsLinga, 2)}</b></div>
        <div class="item"><span>MBL requerida</span><b>${F.kn(l.mblReqKN)}</b></div>
        <div class="item"><span>Utilização (MBL requerida / MBL do cabo)</span><b>${F.num(l.utilizacao * 100, 0)} %</b></div>
      </div>
      ${memorial(l.formula)}
      ${ficha(`Cabo escolhido — ${IC.lingas.tipos[l.tipo].nome}`, l.linha,
        ["diametro", "peso", "ruptura" + l.categoria, "dimB", "dimC"], ROTULOS_LINGA)}`;
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
    let html = `<div class="pecas-par">`;
    html += s.ok
      ? `<div class="peca-bloco"><h4 class="peca-bloco__t">Sapatilho</h4>
         <div class="ficha-par ficha-par--col">
          <figure class="fig-topo">${FIG.sapatilho(s.sapatilho)}</figure>
          ${ficha("Sapatilho escolhido", s.sapatilho, ["codigo", "cabo", "diametroCabo", "a", "b", "c", "d", "e", "f", "peso"], ROTULOS_SAPATILHO)}
        </div></div>`
      : `<div class="peca-bloco"><div class="aviso aviso--erro">Nenhum sapatilho cadastrado para Ø ${F.num(rig.linga.diametro, 1)} mm.</div></div>`;

    // a manilha começa a sua coluna, com a escolha do tipo dentro dela
    html += `<div class="peca-bloco"><h4 class="peca-bloco__t">Manilha</h4>
      <label class="campo"><span>Tipo de manilha</span>
        <select id="ic-manilha-tipo">${opcoesTipo}</select></label>`;

    // seletor manual: automático (o programa já procura a menor manilha que passa em todos os
    // casos de encaixe) ou uma manilha específica, escolhida à mão
    const opcoes = [`<option value="">automático — ${m.manilha ? F.esc(m.manilha.codigo) : "nenhuma atende"}${m.encaixeCompleto ? "" : " (não encaixa em tudo)"}</option>`]
      .concat((m.candidatos || []).map(c => {
        const casosC = RIG.casosEncaixe({ sapatilho: s.sapatilho, manilha: c, diametroCaboMm: rig.linga.diametro });
        const tag = casosC.length && casosC.every(x => x.ok) ? "✓ encaixa em tudo" : casosC.length ? "✗ falha em algum caso" : "";
        return `<option value="${F.esc(c.codigo)}"${ic.manilhaCodigo === c.codigo ? " selected" : ""}>${F.esc(c.codigo)} — CMT ${F.num(c.cmt, 2)} t ${tag}</option>`;
      }));
    html += `<label class="campo"><span>Manilha (código)</span><select id="ic-manilha-codigo">${opcoes.join("")}</select></label>`;

    html += m.ok
      ? `<div class="painel">
          <div class="item"><span>Carga no pino (F.pino)</span><b>${F.kn(m.cargaKN)} · ${F.ton(m.cargaT)}</b></div>
          <div class="item"><span>Utilização (carga / CMT)</span><b>${F.num(m.utilizacao * 100, 0)} %</b></div>
        </div>
        ${memorial([m.formula, m.formulaCmt])}
        <div class="ficha-par ficha-par--col">
          <figure class="fig-topo">${FIG.manilha(rig.manilha.ok ? rig.manilha.manilha : null)}</figure>
          ${ficha(`Manilha escolhida — ${IC.manilhas.tipos[m.tipo].nome}`, m.manilha,
            IC.manilhas.tipos[m.tipo].campos, ROTULOS_MANILHA)}
        </div>`
      : `<div class="aviso aviso--erro">Nenhuma manilha do tipo escolhido atende à carga de ${F.ton(m.cargaT)}.</div>`;
    html += `</div></div>`;     // fecha a coluna da manilha e o par
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
    $("ic-olhal-fy").value = fyDoOlhal(ic);
    $("ic-olhal-fy").disabled = !fyLivre;
    $("ic-olhal-fy").title = fyLivre
      ? "Aço fora da lista: informe o Fy do certificado do material."
      : `Vem do aço escolhido (${aco.nome}).`;
    $("campo-olhal-fy").style.display = ic.olhal.modo === "comprado" ? "none" : "";
    $("ic-olhal-aco").parentElement.style.display = ic.olhal.modo === "comprado" ? "none" : "";

    const rig = riggingDe(ic);
    const o = olhalDe(ic, rig);
    const gov = o.governante;
    const quais = `${o.qtd} olhal(is) iguais — ${o.nomes.join(", ")}`;

    if (o.modo === "comprado") {
      const r = o.resultado;
      $("resultado-olhal").innerHTML = !r.ok
        ? `<div class="aviso aviso--erro">Nenhum olhal comercial atende ${F.ton(r.cargaT)} com pino Ø ${F.num(r.pinoMm, 1)} mm.</div>`
        : `<div class="olhal-par">
            <figure class="fig-topo" id="fig-olhal">${FIG.olhalComprado(r.olhal)}</figure>
            <div class="olhal-bloco"><h4>${F.esc(quais)}</h4>
              <div class="painel">
                <div class="item"><span>Dimensionado pela perna</span><b>${F.esc(gov.nome)} — a mais carregada</b></div>
                <div class="item"><span>Carga</span><b>${F.kn(gov.tracao)} · ${F.ton(r.cargaT)}</b></div>
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
    // input[type=number] não aceita vírgula: o valor vai cru, com ponto
    const cru = v => String(Math.round((Number(v) || 0) * 100) / 100);
    const campo = k => `<label class="campo"><span>${ROTULOS_GEOM[k]}</span>
      <input type="number" step="any" min="0" data-olhal-campo="${k}" data-key="olhal-${k}" value="${cru(g[k])}"></label>`;

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

    // a chapa, com o reforço, tem que entrar na boca da manilha
    const espTotal = (Number(g.t) || 0) + 2 * (Number(g.tAnel) || 0);
    const boca = mn ? mn.e : null;
    const cabeNaBoca = boca == null ? null : espTotal < boca;

    $("resultado-olhal").innerHTML = `
      <div class="olhal-bloco">
        <h4>${F.esc(quais)}</h4>
        <div class="painel">
          <div class="item"><span>Dimensionado pela perna</span><b>${F.esc(gov.nome)} — a mais carregada</b></div>
          <div class="item"><span>Carga no pino (F.pino)</span><b>${F.kn(gov.tracao)}</b></div>
          <div class="item"><span>Ângulo com a vertical</span><b>${F.grau(gov.angulo)}</b></div>
        </div>
      </div>

      <div class="olhal-par">
        <figure class="fig-topo" id="fig-olhal">${FIG.olhal(g)}</figure>
        <div>
          <div class="olhal-bloco">
            <h4>Medidas que você escolhe</h4>
            <div class="olhal-geom">${GEOM_ESPESSURA.map(campoEspessura).join("")}${GEOM_ESCOLHA.map(campo).join("")}</div>
            <p class="dica">A <b>espessura</b> vem da lista de chapa comercial — é a bitola que se
              compra — e é limitada pela boca da manilha. <b>Base</b> e <b>altura</b> definem o
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
            ${mn ? memorial({
              formula: "Ø furo = b(pino) + folga · R = f − g + b/2 + 5 · R.anel = R",
              sub: `Ø furo = ${F.num(mn.b, 1)} + 1,15 · R = ${F.num(mn.f, 1)} − ${F.num(mn.g, 1)} + ${F.num(mn.b / 2, 1)} + 5`,
              resultado: `Ø furo = ${F.num(g.dFuro, 2)} mm · R = R.anel = ${F.num(g.R, 1)} mm`
            }) : ""}
            <p class="dica">São calculadas a partir da manilha — mudou a manilha na etapa 7,
              mudam aqui e no desenho.</p>
          </div>
      </div>

      ${boca == null ? "" : `<div class="${cabeNaBoca ? "aviso" : "aviso aviso--erro"}">
        <span class="selo ${cabeNaBoca ? "selo--ok" : "selo--erro"}">${cabeNaBoca ? "OK" : "falha"}</span>
        A chapa do olhal tem que entrar na boca da manilha:
        t + 2·t.anel = ${F.num(espTotal, 1)} mm ${cabeNaBoca ? "<" : "≥"} boca = ${F.num(boca, 1)} mm.</div>`}

      <table class="tab">
        <thead><tr><th>#</th><th>Verificação</th><th>Tensão</th><th>Admissível</th><th>Utilização</th><th></th></tr></thead>
        <tbody>${v.checks.map(c => `<tr>
          <td>${c.n}</td><td>${F.esc(c.nome)}</td>
          <td class="num">${c.semUnidade ? F.num(c.tensao, 2) : F.num(c.tensao, 1) + " MPa"}</td>
          <td class="num">${c.semUnidade ? "1" : F.num(c.admissivel, 1) + " MPa"}</td>
          <td class="num"><div class="barra${c.utilizacao > 1 ? " estourou" : ""}"><i style="width:${Math.min(100, c.utilizacao * 100)}%"></i></div>${F.num(c.utilizacao * 100, 0)}%</td>
          <td class="selo-cel"><span class="selo ${c.ok ? "selo--ok" : "selo--erro"}">${c.ok ? "OK" : "falha"}</span></td>
        </tr>
        <tr class="linha-formula"><td colspan="6">${memorial(c.formula)}</td></tr>`).join("")}</tbody>
      </table>
      <p class="dica">Solda não é verificada automaticamente — conferir à parte pela NBR 8800.</p>`;


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

  /** capa do relatório — só sai no papel */
  function pintarCapa() {
    const alvo = $("capa");
    if (!alvo) return;
    const hoje = new Date().toLocaleDateString("pt-BR");
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
      <p class="capa__nota">Roteiro do documento: cada etapa traz o que foi informado, a fórmula
        usada, a substituição dos valores e o resultado. Os fatores de projeto vêm da base
        normativa escolhida e estão registrados na etapa 4. Valores de catálogo e de norma
        devem ser conferidos com a edição contratada antes da emissão.</p>`;
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

  const pintar = () => {
    pintarAbas(); pintarEntrada(); pintarResultado();
    pintarLinga(); pintarSapatilhoManilha(); pintarOlhal(); pintarMaterial(); pintarCapa();
    espelharCampos();
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

  function relatorioSmath() {
    const S = window.SMathExport;
    const doc = new S.Documento({ autor: E.resp || "", casas: 3 });
    const mem = new S.Memorial(doc, { descricao: descricaoSimbolo });
    doc.titulo("Memorial de cálculo de içamento", 1);
    doc.texto([`Estudo: ${E.nome || "—"}`, `Documento: ${E.doc || "—"}`, `Responsável: ${E.resp || "—"}`,
      `Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, `Içamentos: ${E.icamentos.length}`].join("\n"));

    E.icamentos.forEach(ic => {
      const r = resolver(ic), f = r.fatores, P = pontosDe(ic), H = alturaGancho(ic);
      const rig = riggingDe(ic), o = olhalDe(ic, rig);
      doc.espaco(18);
      doc.titulo(ic.nome, 1);

      /* dados */
      doc.titulo("Dados do içamento", 2);
      doc.texto(`Arranjo: ${TIPOS[ic.tipo].nome}` + (TIPOS[ic.tipo].pernas > 2 ? ` · hipótese: ${r.hipotese}` : "")
        + ` · base: ${(FAT.bases[ic.base] || {}).nome || ic.base}`);
      mem.definir("m", `${F.num(ic.massa, 3)} kg`);
      mem.definir("g", "9,80665 m/s²");
      mem.definir("γ_peso", F.num(f.peso, 3));
      mem.definir("DAF", F.num(f.daf, 3));
      mem.definir("γ_cons", F.num(f.consequencia, 3));
      mem.definir("SKL", F.num(f.skl, 3));
      mem.definir("FS_linga", F.num(f.fsLinga, 3), "fator de segurança da linga");
      doc.texto(P.map(p => `${p.nome}: x = ${F.num(p.x, 0)} mm · y = ${F.num(p.y, 0)} mm · z = ${F.num(p.z, 0)} mm`).join("\n"));
      mem.definir("H", `${F.num(H, 1)} mm`);

      /* cargas */
      mem.secao("Peso de projeto", passosPeso(ic, r).map((p, i) => passoSm(i ? "Peso de projeto" : "Peso do corpo", p)));
      const passosCargas = [];
      r.pernas.forEach((p, i) => {
        const [comp, ang, trac] = passosPerna(r, p, P[i], H);
        passosCargas.push(
          passoSm(`Perna ${p.nome} — comprimento`, comp),
          passoSm(`Perna ${p.nome} — ângulo com a vertical`, ang),
          { t: `Perna ${p.nome} — componente vertical (equilíbrio do sistema)`, r: `V_${p.nome} = ${F.num(p.vertical, 3)} kN` },
          passoSm(`Perna ${p.nome} — tração`, trac));
      });
      passosCargas.push({ t: "Carga no gancho", r: `F_gancho = ${F.num(r.cargaGanchoKN, 2)} kN` },
        { t: "Maior tração por perna", r: `T_max = ${F.num(r.maiorTracaoKN, 2)} kN` });
      mem.secao("Cargas nas pernas", passosCargas);

      /* linga */
      const l = rig.linga;
      if (l.ok) {
        const mblCabo = l.linha && l.linha["ruptura" + l.categoria];
        const passos = [passoSm("MBL requerida", l.formula)];
        if (mblCabo) passos.push(
          { t: `Cabo escolhido — ${IC.lingas.tipos[l.tipo].nome}, Ø ${F.num(l.diametro, 1)} mm, categoria ${l.categoria} N/mm²`,
            r: `MBL = ${F.num(mblCabo, 2)} kN` },
          { t: "Utilização da linga", f: "u = MBL_req / MBL", r: `u = ${F.num(l.utilizacao * 100, 1)} %`, ok: l.utilizacao <= 1 });
        mem.secao("Linga", passos);
      } else {
        doc.titulo("Linga", 2);
        doc.texto(`Nenhum cabo da tabela atende à MBL requerida (${F.kn(l.mblReqKN)}).`, { negrito: true, cor: "#A1332C" });
      }

      /* manilha e encaixe */
      const m = rig.manilha;
      if (m.ok) {
        mem.secao(`Manilha — ${m.manilha.codigo}`, [
          passoSm("Carga no pino", m.formula),
          passoSm(`CMT da manilha ${m.manilha.codigo}`, m.formulaCmt, { ok: m.manilha.cmt >= m.cargaT })
        ]);
      } else {
        doc.titulo("Manilha", 2);
        doc.texto(`Nenhuma manilha do tipo escolhido atende à carga de ${F.ton(m.cargaT)}.`, { negrito: true, cor: "#A1332C" });
      }
      if (rig.casos.length) {
        mem.secao(`Encaixe sapatilho ${rig.sapatilho.ok ? rig.sapatilho.sapatilho.codigo : ""} × manilha`, rig.casos.map(c => ({
          t: `Caso ${c.n} — ${c.nome}`, f: c.formula,
          s: `${F.num(c.a, 1)} mm ${c.ok ? ">" : "≤"} ${F.num(c.b, 1)} mm`,
          r: c.ok ? `passa, com folga de ${F.num(c.a - c.b, 1)} mm` : `não passa — faltam ${F.num(c.b - c.a, 1)} mm`,
          ok: c.ok
        })));
      }

      /* olhal */
      const quais = `${o.qtd} olhal(is) iguais (${o.nomes.join(", ")}), dimensionados pela perna ${o.governante.nome}`;
      if (o.modo === "comprado") {
        const rc = o.resultado;
        mem.secao("Olhal comercial", [rc.ok
          ? { t: `${rc.olhal.codigo} — ${quais}`, f: "CMT ≥ carga", s: `${F.num(rc.olhal.cmt, 2)} t ≥ ${F.num(rc.cargaT, 2)} t`,
              r: `utilização = ${F.num(rc.utilizacao * 100, 0)} %`, ok: true }
          : { t: quais, r: `Nenhum olhal comercial atende ${F.ton(rc.cargaT)} com pino Ø ${F.num(rc.pinoMm, 1)} mm.`, ok: false }]);
      } else {
        const g = o.geom, mn = rig.manilha.ok ? rig.manilha.manilha : null;
        const passos = [{ t: quais, r: `F_pino = ${F.num(o.governante.tracao, 3)} kN` }];
        if (mn) passos.push({
          t: "Medidas que vêm da manilha",
          f: "Ø furo = b(pino) + folga · R = f − g + b/2 + 5 · R.anel = R",
          s: `Ø furo = ${F.num(mn.b, 1)} + 1,15 · R = ${F.num(mn.f, 1)} − ${F.num(mn.g, 1)} + ${F.num(mn.b / 2, 1)} + 5`,
          r: `Ø furo = ${F.num(g.dFuro, 2)} mm · R = R.anel = ${F.num(g.R, 1)} mm`
        });
        const espTotal = (Number(g.t) || 0) + 2 * (Number(g.tAnel) || 0);
        if (mn) passos.push({ t: "A chapa tem que entrar na boca da manilha", f: "t + 2·t_anel < boca",
          s: `${F.num(espTotal, 1)} mm ${espTotal < mn.e ? "<" : "≥"} ${F.num(mn.e, 1)} mm`, ok: espTotal < mn.e });
        o.verif.checks.forEach(c => passos.push(passoSm(`${c.n}. ${c.nome}`, c.formula,
          { ok: c.ok, n: `Utilização: ${F.num(c.utilizacao * 100, 0)} %` })));
        doc.titulo("Olhal fabricado — geometria", 2);
        doc.texto(["t", "tAnel", "base", "h", "R", "rAnel", "dFuro"].filter(k => k in g)
          .map(k => `${ROTULOS_GEOM[k]}: ${F.num(g[k], 2)}`).join("\n"));
        mem.secao("Olhal fabricado — verificação", passos);
      }

      /* material */
      doc.titulo("Lista de material", 2);
      mem.tabela(["Item", "Qtd.", "Título", "Especificação", "Material", "Massa (kg)"],
        materialDe(ic).itens.map((it, i) => [i + 1, F.num(it.qtd, 0), it.titulo, it.especificacao, it.material,
          it.massa == null ? "-" : F.num(it.massa, 2)]));
    });

    doc.espaco(9);
    doc.texto("Valores de catálogo e de norma devem ser conferidos com a edição contratada antes da emissão. "
      + "Solda não é verificada automaticamente — conferir à parte pela NBR 8800.", { italico: true });
    S.baixar(`${(E.nome || "icamento").replace(/[^\w-]+/g, "_")}.sm`, doc);
    return mem.stats;
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
      if (el.id === "un-comp") E.unid.comp = el.value;
      else if (el.id === "un-massa") E.unid.massa = el.value;
      else if (el.id === "ic-nome") ic.nome = el.value || ic.nome;
      else if (el.id === "ic-massa") ic.massa = lerMassa(el.value);
      else if (el.id === "ic-origem") { ic.origem = el.value; ic.fatores = null; }
      else if (el.id === "ic-local") { ic.local = el.value; ic.fatores = null; }
      else if (el.id === "ic-base") { ic.base = el.value; ic.fatores = null; }
      else if (el.id === "ic-cons") { ic.consequencia = el.value; ic.fatores = null; }
      else if (el.id === "ic-angulo") ic.angulo = Math.max(1, Math.min(89, Number(el.value) || 60));
      else if (el.id === "ic-perna-ang") ic.pernaAngulo = Number(el.value) || 0;
      else if (el.id === "ic-hipotese") ic.hipotese4 = el.value;
      else if (el.id === "ic-linga") ic.lingaPropria = el.value === "propria";
      else if (el.id === "ic-linga-tipo") ic.linga.tipo = el.value;
      else if (el.id === "ic-linga-cat") ic.linga.categoria = el.value;
      else if (el.id === "ic-manilha-tipo") { ic.manilhaTipo = el.value; ic.manilhaCodigo = null; }
      else if (el.id === "ic-manilha-codigo") ic.manilhaCodigo = el.value || null;
      else if (el.id === "ic-olhal-modo") ic.olhal.modo = el.value;
      else if (el.id === "ic-olhal-tipo") ic.olhal.tipoComprado = el.value;
      else if (el.id === "ic-olhal-aco") ic.olhal.aco = el.value;
      else if (el.id === "ic-olhal-fy") ic.olhal.fy = Number(el.value) || 355;
      else if (el.id === "ic-material-modo") { pintarMaterial(); return; }
      else if (el.dataset.olhalCampo) {
        // um olhal só para o içamento inteiro
        if (!ic.olhal.geom) olhalDe(ic, riggingDe(ic));
        ic.olhal.geom[el.dataset.olhalCampo] = Number(el.value) || 0;
        // R mudou: o reforço acompanha
        if (el.dataset.olhalCampo === "R") ic.olhal.geom.rAnel = Number(el.value) || 0;
      }
      else if (el.dataset.medida) ic.medidas[el.dataset.medida] = lerComp(el.value);
      else if (el.dataset.fator) ic.fatores = Object.assign(fatoresDe(ic), { [el.dataset.fator]: Number(el.value) || 0 });
      else return;
      comFocoPreservado(pintar);
    });

    // digitar num campo numérico já recalcula
    document.addEventListener("input", e => {
      if (e.target.matches('input[type="number"]')) e.target.dispatchEvent(new Event("change", { bubbles: true }));
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
    $("bt-relatorio").addEventListener("click", () => { lerCabecalho(); window.print(); });
    $("bt-smath").addEventListener("click", () => {
      lerCabecalho();
      try { relatorioSmath(); }
      catch (err) { console.error(err); alert("Não foi possível gerar o arquivo SMath: " + err.message); }
    });
    const btXlsx = $("bt-material-xlsx");
    if (btXlsx) btXlsx.addEventListener("click", baixarMaterialXlsx);
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
    if (!ic.manilhaTipo) ic.manilhaTipo = "G-4163";
    if (ic.manilhaCodigo === undefined) ic.manilhaCodigo = null;
    if (!ic.olhal) ic.olhal = { modo: "fabricado", tipoComprado: "GPAL-UNC", fy: 355, porPerna: [] };
    if (!ic.olhal.porPerna) ic.olhal.porPerna = [];
    if (ic.lingaPropria === undefined) ic.lingaPropria = true;
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

  window.ICapp = { get estudo() { return E; }, resolver, atual, pintar, pontosDe, alturaGancho,
    material: () => materialDe(atual()).itens, materialConsolidado, olhalDe, riggingDe };
})();
