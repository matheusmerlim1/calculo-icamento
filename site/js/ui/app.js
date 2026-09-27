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
      hipotese4: "diagonais", fatores: null, lingaPropria: true,
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
      Fpino: gov.tracao, thetaGraus: gov.angulo, geom, Fy: Number(ic.olhal.fy) || 355
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
        material: `Aço estrutural fy ${F.num(Number(ic.olhal.fy) || 355, 0)} MPa`,
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
    $("ic-massa").step = passoMassa();
    $("rot-massa").textContent = `Massa (${uMassa()})`;
    $("ic-origem").value = ic.origem;
    $("ic-local").value = ic.local;
    $("ic-cons").value = ic.consequencia;
    $("ic-hipotese").value = ic.hipotese4;
    $("ic-hipotese").closest(".campo").style.display = t.pernas > 2 ? "" : "none";
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

    const numCampo = k => `<input type="number" step="${passoComp()}" data-medida="${k}" data-key="medida-${k}" value="${paraCampo(compParaTela(ic.medidas[k]), decComp())}">`;
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

  /* ------------------------------------------------------------ resultado */
  function pintarResultado() {
    const ic = atual();
    const r = resolver(ic);
    const P = pontosDe(ic), H = alturaGancho(ic);

    $("avisos").innerHTML = r.avisos.map(a => `<div class="aviso">⚠ ${F.esc(a)}</div>`).join("");

    $("memorial-peso").innerHTML = memorial([
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
    ]);

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
      <tr class="linha-formula"><td colspan="8">${memorial([
        {
          formula: `L_${p.nome} = |G − ${p.nome}|`,
          sub: `L_${p.nome} = |(0,0,${F.num(H, 0)}) − (${F.num(P[i].x, 0)},${F.num(P[i].y, 0)},${F.num(P[i].z, 0)})|`,
          resultado: `L_${p.nome} = ${F.num(p.comprimento, 0)} mm`
        },
        {
          formula: `cos(β_${p.nome}) = (H − z)/L_${p.nome}`,
          sub: `cos(β_${p.nome}) = (${F.num(H, 0)} − ${F.num(P[i].z, 0)})/${F.num(p.comprimento, 0)} = ${F.num(Math.cos(p.angulo * Math.PI / 180), 3)}`,
          resultado: `β_${p.nome} = ${F.grau(p.angulo)}`
        },
        {
          formula: `T_${p.nome} = V_${p.nome} / cos(β_${p.nome})   — V_${p.nome} do equilíbrio do sistema (hipótese: ${r.hipotese})`,
          sub: `T_${p.nome} = ${F.kn(p.vertical)} / ${F.num(Math.cos(p.angulo * Math.PI / 180), 3)}`,
          resultado: `T_${p.nome} = ${F.kn(p.tracao)}`
        }
      ])}</td></tr>`).join("")}</tbody>
      <tfoot>
        <tr><td>Soma das verticais de projeto</td><td colspan="3"></td>
          <td class="num">${F.kn(r.somaVerticaisProjKN)}</td>
          <td colspan="3" class="som">${r.pernas.length > 2 && r.hipotese === "pares diagonais"
            ? "na hipótese de pares diagonais cada par sustenta a carga inteira" : ""}</td></tr>
        <tr><td>Carga no gancho</td><td colspan="3"></td>
          <td class="num">${F.kn(r.cargaGanchoKN)}</td>
          <td class="num">${F.ton(r.cargaGanchoKN / G)}</td><td colspan="2" class="som">peso de projeto</td></tr>
      </tfoot>`;

    $("fig-3d-cargas").innerHTML = IC.iso3d.desenhar(r, { modo: "cargas", comp: txtComp });
    $("fig-planta").innerHTML = IC.fbd.planta(r);
    $("fig-elevacao").innerHTML = IC.fbd.elevacao(r);

    const f = r.fatores;
    const maiorEstudo = Math.max(...E.icamentos.map(x => resolver(x).maiorTracaoT));
    $("resumo").innerHTML = `
      <h3>Resumo — ${F.esc(ic.nome)}</h3>
      <div class="destaque">
        <div class="rot">Maior tração por perna</div>
        <div class="valor">${F.num(r.maiorTracaoT, 2)} t</div>
        <div class="rot">${F.kn(r.maiorTracaoKN)} · ${F.esc(r.hipotese)}</div>
      </div>
      <div class="painel">
        <div class="item"><span>Massa</span><b>${F.num(massaParaTela(ic.massa), 2)} ${uMassa()}</b></div>
        <div class="item"><span>Peso do corpo</span><b>${F.kn(r.pesoKN)}</b></div>
        <div class="item"><span>Peso de projeto</span><b>${F.kn(r.pesoProjKN)}</b></div>
        <div class="item"><span>Ângulo da perna</span><b>${F.grau(ic.angulo)} c/ a estrutura</b></div>
        <div class="item"><span>Altura do gancho</span><b>${txtComp(alturaGancho(ic))}</b></div>
        <div class="item"><span>γ peso × DAF × γc</span><b>${F.num(f.peso, 2)} × ${F.num(f.daf, 2)} × ${F.num(f.consequencia, 2)}</b></div>
        <div class="item"><span>SKL</span><b>${F.num(f.skl, 2)}</b></div>
      </div>
      <h3>Estudo</h3>
      <div class="painel">
        <div class="item"><span>Içamentos</span><b>${E.icamentos.length}</b></div>
        <div class="item"><span>Maior carga de perna</span><b>${F.num(maiorEstudo, 2)} t</b></div>
      </div>
      <label class="campo"><span>Linga</span>
        <select id="ic-linga">
          <option value="propria"${ic.lingaPropria ? " selected" : ""}>dimensionar para este içamento</option>
          <option value="padrao"${ic.lingaPropria ? "" : " selected"}>usar a maior carga do estudo (${F.num(maiorEstudo, 2)} t)</option>
        </select></label>
      <div class="linha-campos">
        <button type="button" class="bt bt--peq bt--fantasma" id="bt-duplicar">Duplicar</button>
        <button type="button" class="bt bt--peq bt--risco" id="bt-remover">Remover</button>
      </div>
      <span class="etiqueta">${F.esc((FAT.bases[ic.base] || {}).referencia || "")}</span>`;

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
  function memorial(passos) {
    const arr = (Array.isArray(passos) ? passos : [passos]).filter(Boolean)
      .map(p => (typeof p === "string" ? { resultado: p } : p));
    if (!arr.length) return "";
    return `<div class="formulas"><div class="formulas__titulo">Memorial de cálculo</div>
      ${arr.map(p => `<div class="passo">
        ${p.formula ? `<div class="passo__formula">${F.mat(p.formula)}</div>` : ""}
        ${p.sub ? `<div class="passo__sub">${F.mat(p.sub)}</div>` : ""}
        ${p.resultado ? `<div class="passo__resultado">${F.mat(p.resultado)}</div>` : ""}
      </div>`).join("")}</div>`;
  }

  /** tabela de 2 colunas (campo, valor) — uma ficha técnica, campo a campo */
  function ficha(titulo, obj, campos, rotulos) {
    if (!obj) return "";
    const val = v => typeof v === "number" ? F.num(v, 2) : F.esc(String(v));
    return `<table class="tab tab--ficha"><caption>${F.esc(titulo)}</caption><tbody>
      ${campos.filter(c => c in obj).map(c => `<tr><td>${F.esc(rotulos[c] || c)}</td><td class="num">${val(obj[c])}</td></tr>`).join("")}
    </tbody></table>`;
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
    $("ic-manilha-tipo").innerHTML = Object.entries(IC.manilhas.tipos)
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

    // a manilha começa a sua coluna
    html += `<div class="peca-bloco"><h4 class="peca-bloco__t">Manilha</h4>`;

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
      </tr>`).join("")}</tbody>` : "";

    // a mesma verificação, desenhada: o vão de que se dispõe e a peça que precisa passar
    const figEnc = $("fig-encaixe");
    // caso 1 e 4 comparam medidas redondas (corpo/olhal da manilha em furo); 2 e 3 são a
    // chapa do sapatilho entre duas faces
    const FORMA = { 1: "furo", 2: "boca", 3: "boca", 4: "furo" };
    const ROT = {
      1: ["altura interna do sapatilho", "corpo da manilha"],
      2: ["interno do arco", "largura do sapatilho"],
      3: ["boca da manilha", "largura do sapatilho"],
      4: ["interno do sapatilho", "corpo da manilha"]
    };
    if (figEnc) figEnc.innerHTML = rig.casos.length
      ? FIG.encaixe(rig.casos.map(c => ({
          n: c.n, rotulo: c.nome, vao: c.a, peca: c.b, ok: c.ok,
          forma: FORMA[c.n] || "boca",
          rotVao: (ROT[c.n] || [])[0], rotPeca: (ROT[c.n] || [])[1]
        })))
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
    R: "R — raio do topo (mm)", rAnel: "R.anel — raio do reforço (mm)",
    dFuro: "Ø furo — recebe o pino (mm)"
  };

  // o que a pessoa escolhe e o que sai da manilha — a confusão era tudo aparecer junto
  const GEOM_ESCOLHA = ["t", "base", "h", "tAnel", "rAnel"];
  const GEOM_DA_MANILHA = ["dFuro", "R"];

  function pintarOlhal() {
    const ic = atual();
    $("ic-olhal-modo").value = ic.olhal.modo;
    $("campo-olhal-comprado").style.display = ic.olhal.modo === "comprado" ? "" : "none";
    $("ic-olhal-tipo").innerHTML = Object.entries(IC.olhais.tipos)
      .map(([k, t]) => `<option value="${k}"${k === ic.olhal.tipoComprado ? " selected" : ""}>${F.esc(t.nome)}</option>`).join("");
    $("ic-olhal-fy").value = ic.olhal.fy;

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
            <div class="olhal-geom">${GEOM_ESCOLHA.map(campo).join("")}</div>
            <p class="dica">A <b>espessura</b> é o que costuma mudar, e ela é limitada pela boca da
              manilha. <b>Base</b> e <b>altura</b> definem o tamanho da chapa. O reforço (t.anel/R.anel)
              é opcional: deixe zerado se o olhal não tiver anel.</p>
          </div>
          <div class="olhal-bloco">
            <h4>Medidas que vêm da manilha</h4>
            <div class="olhal-geom">${GEOM_DA_MANILHA.map(campo).join("")}</div>
            ${mn ? memorial({
              formula: "Ø furo = b(pino) + folga · R = f − g + b/2 + 5",
              sub: `Ø furo = ${F.num(mn.b, 1)} + 1,15 · R = ${F.num(mn.f, 1)} − ${F.num(mn.g, 1)} + ${F.num(mn.b / 2, 1)} + 5`,
              resultado: `Ø furo = ${F.num(mn.b + 1.15, 2)} mm · R = ${F.num(mn.f - mn.g + mn.b / 2 + 5, 1)} mm`
            }) : ""}
            <p class="dica">Saem da manilha escolhida — mexa só se o desenho de fabricação pedir outra coisa.
              <button type="button" class="bt bt--peq bt--fantasma" id="bt-olhal-manilha">Recalcular pela manilha</button></p>
          </div>
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

    const btRecalc = $("bt-olhal-manilha");
    if (btRecalc) btRecalc.addEventListener("click", () => {
      const partida = RIG.geometriaOlhalPartida(mn);
      if (!partida) return;
      ic.olhal.geom.dFuro = partida.dFuro;
      ic.olhal.geom.R = partida.R;
      pintar();
    });
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

  const pintar = () => {
    pintarAbas(); pintarEntrada(); pintarResultado();
    pintarLinga(); pintarSapatilhoManilha(); pintarOlhal(); pintarMaterial(); pintarCapa();
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
  function pintarDobra() {
    const fech = fechadas();
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
      else if (el.id === "ic-massa") ic.massa = massaParaKg(el.value);
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
      else if (el.id === "ic-olhal-fy") ic.olhal.fy = Number(el.value) || 355;
      else if (el.id === "ic-material-modo") { pintarMaterial(); return; }
      else if (el.dataset.olhalCampo) {
        // um olhal só para o içamento inteiro
        if (!ic.olhal.geom) olhalDe(ic, riggingDe(ic));
        ic.olhal.geom[el.dataset.olhalCampo] = Number(el.value) || 0;
      }
      else if (el.dataset.medida) ic.medidas[el.dataset.medida] = compParaMm(el.value);
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

    $("bt-relatorio").addEventListener("click", () => window.print());
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
  ligarDobra();
  ligarMemorial();
  pintar();

  window.ICapp = { get estudo() { return E; }, resolver, atual, pintar, pontosDe, alturaGancho,
    material: () => materialDe(atual()).itens, materialConsolidado, olhalDe, riggingDe };
})();
