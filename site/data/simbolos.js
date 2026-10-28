/*
 * O que cada letra das fórmulas quer dizer, e em que unidade.
 *
 * O memorial mostra a legenda ao lado da conta: quem lê não precisa decorar a notação nem
 * caçar o significado em outra parte da página.
 *
 * Cada entrada tem a chave como ela aparece escrita na fórmula. `re` existe para os símbolos
 * cuja escrita varia (índice do ponto, por exemplo T_P1, T_P2 …).
 */
window.IC = window.IC || {};

IC.simbolos = (function () {
  const S = [
    // ---------------------------------------------------------------- cargas
    { k: "W_proj", desc: "peso de projeto — o peso já com os fatores", un: "kN" },
    { k: "W", desc: "peso do corpo a içar", un: "kN" },
    { k: "m", desc: "massa do corpo a içar", un: "kg" },
    { k: "g", desc: "aceleração da gravidade (9,80665)", un: "m/s²" },
    { k: "γ_peso", desc: "margem de peso — incerteza da massa informada (DNV-ST-N001 5.6.2.2)", un: "—" },
    { k: "γ_CoG", desc: "imprecisão do centro de gravidade (DNV-ST-N001 5.6.2.3)", un: "—" },
    { k: "DAF", desc: "amplificação dinâmica (DNV-ST-N001 Tabela 16-1)", un: "—" },
    { k: "SHL", desc: "carga estática no gancho", un: "t" },
    { k: "SKL", desc: "distribuição desigual entre as pernas", un: "—" },

    // ---------------------------------------------------------------- pernas
    { k: "L", re: /\bL_\w+/g, desc: "comprimento da perna", un: "mm" },
    { k: "T", re: /\bT_\w+/g, desc: "tração na perna", un: "kN" },
    { k: "V", re: /\bV_\w+/g, desc: "componente vertical da perna", un: "kN" },
    { k: "β", re: /β_\w+/g, desc: "ângulo da perna com a vertical", un: "°" },
    { k: "H", desc: "altura do gancho acima do centro de massa", un: "mm" },
    { k: "G", desc: "centro de massa (origem das medidas)", un: "—" },
    { k: "z", desc: "altura do ponto de içamento em relação ao CG", un: "mm" },

    // ---------------------------------------------------------------- linga e manilha
    { k: "MBL_req", desc: "carga de ruptura mínima exigida do cabo", un: "kN" },
    { k: "carga_governante", desc: "a maior tração de perna que dimensiona o cabo", un: "kN" },
    { k: "FS_linga", desc: "fator de segurança da linga", un: "—" },
    { k: "F_SD", desc: "carga de projeto da eslinga (DNV-ST-N001 16.3.4)", un: "kN" },
    { k: "γsf", desc: "fator de segurança nominal da eslinga (16.4.3)", un: "—" },
    { k: "γb", desc: "fator de dobra do cabo no sapatilho (16.4.8)", un: "—" },
    { k: "γr", desc: "fator de redução: o maior entre γs e γb (16.4.6)", un: "—" },
    { k: "γs", desc: "fator de terminação da eslinga (Tabela 16-3)", un: "—" },
    { k: "γh", desc: "fator de içamento (16.4.4)", un: "—" },
    { k: "γc", desc: "fator de consequência (16.4.5)", un: "—" },
    { k: "γw", desc: "fator de desgaste e aplicação (16.4.10)", un: "—" },
    { k: "γm", desc: "fator de material (16.4.9)", un: "—" },
    { k: "D", desc: "diâmetro de dobra: altura interna do sapatilho", un: "mm" },
    { k: "d", desc: "diâmetro do cabo", un: "mm" },
    { k: "CMT", desc: "carga máxima de trabalho da peça, de catálogo", un: "t" },
    { k: "F_pino", desc: "carga no pino para o olhal — 1,30 × F_linga (N-2683 5.2)", un: "kN" },
    { k: "F_linga", desc: "força da linga no olhal — tração de projeto da perna", un: "kN" },

    // ---------------------------------------------------------------- olhal
    { k: "f_p", desc: "tensão de esmagamento no furo", un: "MPa" },
    { k: "f_v", desc: "tensão de cisalhamento na área efetiva", un: "MPa" },
    { k: "f_a1", desc: "tensão de tração na área líquida", un: "MPa" },
    { k: "f_a", desc: "tensão axial na base do olhal", un: "MPa" },
    { k: "f_a3", desc: "tensão na seção bruta logo abaixo do furo", un: "MPa" },
    { k: "f_vb", desc: "tensão de cisalhamento na base do olhal", un: "MPa" },
    { k: "f_n", desc: "tensão normal na garganta da solda", un: "MPa" },
    { k: "f_s", desc: "tensão de cisalhamento na garganta da solda", un: "MPa" },
    { k: "f_r", desc: "tensão resultante na garganta da solda", un: "MPa" },
    { k: "Fw", desc: "tensão admissível da solda: mín(0,30·Fwu ; 0,40·Fy·√2)", un: "MPa" },
    { k: "Fwu", desc: "tensão de ruptura do eletrodo (E60 415, E70 485)", un: "MPa" },
    { k: "F_anel", desc: "parcela da carga no anel de reforço", un: "N" },
    { k: "g_solda", desc: "garganta do filete de solda", un: "mm" },
    { k: "a_mín", desc: "lado mínimo do filete (N-2683 Tabela 1)", un: "mm" },
    { k: "A_w", desc: "área de garganta dos filetes", un: "mm²" },
    { k: "d_pino", desc: "diâmetro do pino da manilha", un: "mm" },
    { k: "d_furo", desc: "diâmetro do furo do olhal", un: "mm" },
    { k: "d_anel", desc: "diâmetro externo do anel de reforço", un: "mm" },
    { k: "f_man", desc: "comprimento interno da manilha, do eixo do pino ao topo interno do arco", un: "mm" },
    { k: "c_sap", desc: "altura total do sapatilho", un: "mm" },
    { k: "d_sap", desc: "altura interna do sapatilho", un: "mm" },
    { k: "γb_inf", desc: "fator de dobra no olho inferior, sobre o sapatilho (16.4.8)", un: "—" },
    { k: "γb_sup", desc: "fator de dobra no olho superior (16.4.8)", un: "—" },
    { k: "D_sup", desc: "diâmetro do gancho ou elo onde apoia o olho superior", un: "mm" },
    { k: "f_ipb", desc: "tensão de flexão no plano do olhal", un: "MPa" },
    { k: "f_opb", desc: "tensão de flexão fora do plano", un: "MPa" },
    { k: "Fy", desc: "tensão de escoamento do aço da chapa", un: "MPa" },
    { k: "D_pino", desc: "diâmetro do pino da manilha", un: "mm" },
    { k: "t_total", desc: "espessura da chapa com os reforços", un: "mm" },
    { k: "t_anel", desc: "espessura do reforço, de cada lado", un: "mm" },
    { k: "t", desc: "espessura da chapa do olhal", un: "mm" },
    { k: "R", desc: "raio do topo do olhal", un: "mm" },
    { k: "r_anel", desc: "raio do reforço", un: "mm" },
    { k: "r_furo", desc: "raio do furo", un: "mm" },
    { k: "b1", desc: "largura efetiva da chapa no furo: mín(4T ; 0,8·d_furo ; R − r_furo)", un: "mm" },
    { k: "b2", desc: "largura efetiva do anel no furo: mín(r_anel − r_furo ; b1)", un: "mm" },
    { k: "b3", desc: "largura efetiva da chapa abaixo do furo", un: "mm" },
    { k: "T", desc: "espessura total do olhal: t + 2·t_anel", un: "mm" },
    { k: "A_base", desc: "área da base do olhal", un: "mm²" },
    { k: "W_ipb", desc: "módulo de resistência à flexão no plano", un: "mm³" },
    { k: "W_opb", desc: "módulo de resistência à flexão fora do plano", un: "mm³" },
    { k: "h", desc: "do pé da chapa ao centro do furo", un: "mm" },
    { k: "θ", desc: "ângulo da linga com a base do olhal", un: "°" },

    // ---------------------------------------------------------------- encaixe
    { k: "d(sapatilho)", desc: "altura interna do sapatilho", un: "mm" },
    { k: "b(sapatilho)", desc: "comprimento interno do sapatilho", un: "mm" },
    { k: "e(sapatilho)", desc: "largura total do sapatilho", un: "mm" },
    { k: "a(manilha)", desc: "diâmetro do corpo da manilha", un: "mm" },
    { k: "c(manilha)", desc: "largura do corpo da manilha, de lado", un: "mm" },
    { k: "e(manilha)", desc: "boca da manilha", un: "mm" },
    { k: "g(manilha)", desc: "diâmetro interno do arco da manilha", un: "mm" }
  ];

  /** escapa o que for especial numa expressão regular */
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /**
   * Os símbolos que aparecem neste texto de fórmula, na ordem do glossário.
   * Os de chave mais longa são testados primeiro, para "t_anel" não virar "t".
   */
  function noTexto(texto) {
    // a unidade logo depois de um número ("2,41 t", "23,6 kN") não é símbolo: sem isto o "t"
    // de tonelada aparecia na legenda como a espessura da chapa
    const t = String(texto || "").replace(/(\d)\s*(kN|kgf|kg|mm|cm|MPa|m\/s²|t|N|m)(?![\wÀ-ú])/gu, "$1");
    const achados = [];
    const ordem = S.slice().sort((a, b) => b.k.length - a.k.length);
    let sobra = t;
    for (const s of ordem) {
      const re = s.re || new RegExp(`(^|[^\\wÀ-ú_])${esc(s.k)}(?![\\wÀ-ú])`, "u");
      if (!re.test(sobra)) continue;
      achados.push(s);
      // tira o que já foi reconhecido, para um símbolo curto não casar dentro de um longo
      sobra = sobra.replace(s.re || new RegExp(esc(s.k), "g"), " ");
    }
    return S.filter(s => achados.includes(s));
  }

  return { lista: S, noTexto };
})();
