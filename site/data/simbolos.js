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
    { k: "γ_peso", desc: "margem de peso — incerteza da massa informada", un: "—" },
    { k: "DAF", desc: "amplificação dinâmica — o balanço do içamento", un: "—" },
    { k: "γ_cons", desc: "fator de consequência da falha", un: "—" },
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
    { k: "CMT", desc: "carga máxima de trabalho da peça, de catálogo", un: "t" },
    { k: "F_pino", desc: "força que chega ao pino — a tração da perna", un: "kN" },

    // ---------------------------------------------------------------- olhal
    { k: "f_p", desc: "tensão de esmagamento no furo", un: "MPa" },
    { k: "f_v", desc: "tensão de cisalhamento na área efetiva", un: "MPa" },
    { k: "f_a1", desc: "tensão de tração na área líquida", un: "MPa" },
    { k: "f_a", desc: "tensão axial na base do olhal", un: "MPa" },
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
    { k: "b1", desc: "largura resistente da chapa (R − r.furo)", un: "mm" },
    { k: "b2", desc: "largura resistente do reforço (r.anel − r.furo)", un: "mm" },
    { k: "A_base", desc: "área da base do olhal", un: "mm²" },
    { k: "W_ipb", desc: "módulo de resistência à flexão no plano", un: "mm³" },
    { k: "W_opb", desc: "módulo de resistência à flexão fora do plano", un: "mm³" },
    { k: "h", desc: "do pé da chapa ao centro do furo", un: "mm" },
    { k: "θ", desc: "ângulo da perna com a vertical", un: "°" },

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
    const t = String(texto || "");
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
