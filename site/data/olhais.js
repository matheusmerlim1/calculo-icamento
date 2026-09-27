/*
 * Olhais comerciais — tabela Green Pin (informada pelo usuário).
 *
 * Série GPAL…UNC — olhal de elevação com rosca UNC, grau 8.
 * Medidas em mm (exceto a rosca, em polegada); carga máxima de trabalho (CMT) em toneladas.
 *
 *   a  diâmetro da rosca (pol)     e  comprimento
 *   b  diâmetro da base            f  espessura da base
 *   c  diâmetro externo do olhal   g  diâmetro (haste do olhal)
 *   d  diâmetro interno do olhal   peso em kg
 *
 * O diâmetro interno (d) é o que recebe o pino da manilha: é ele que manda na verificação
 * de encaixe. Conferir com o catálogo vigente do fabricante antes de comprar.
 */
window.IC = window.IC || {};

IC.olhais = {
  fonte: "Green Pin — olhal de elevação UNC grau 8 (série GPAL…UNC)",
  tipos: {
    "GPAL-UNC": {
      nome: "Green Pin — olhal de elevação UNC GR8",
      descricao: "Olhal rosqueado, grau 8, rosca UNC",
      produto: "ALUNC",
      material: "aço liga, grau 8, temperado e revenido",
      fatorSeguranca: 5,                       // MBL = 5 × CMT
      temperatura: "−40 °C a +200 °C",
      certificacao: "2.1, 2.2, 3.1, MTCa, MPIb, CE",
      campos: ["codigo", "cmt", "rosca", "b", "c", "d", "e", "f", "g", "peso"],
      linhas: [
        ["GPAL06UNC", 0.2, "1/4", 20, 34, 20, 20, 17, 7, 0.05],
        ["GPAL10UNC", 0.7, "3/8", 20, 38, 22, 30, 19, 8, 0.08],
        ["GPAL12UNC", 1, "1/2", 25, 47, 27, 36, 23, 10, 0.14],
        ["GPAL16UNC", 1.5, "5/8", 36, 63, 35, 53, 31, 14, 0.38],
        ["GPAL20UNC", 2.5, "3/4", 40, 72, 40, 58, 34, 16, 0.55],
        ["GPAL22UNC", 3, "7/8", 42, 82, 45, 64, 38, 19, 0.81],
        ["GPAL24UNC", 4, "1", 55, 95, 55, 84, 40, 20, 1.14],
        ["GPAL27UNC", 5, "1 1/8", 55, 95, 55, 84, 40, 20, 1.21],
        ["GPAL30UNC", 6, "1 1/4", 60, 108, 60, 99, 51, 24, 1.90],
        ["GPAL36UNC", 8, "1 1/2", 65, 118, 68, 117, 48, 25, 2.52],
        ["GPAL42UNC", 10, "1 3/4", 70, 142, 80, 135, 61, 31, 4.26],
        ["GPAL45UNC", 15, "2", 70, 142, 80, 135, 61, 31, 4.66],
        ["GPAL56UNC", 25, "2 1/2", 95, 181, 97, 150, 69, 42, 9.55]
      ]
    },

    "GPAL-M": {
      nome: "Green Pin — olhal de elevação GR8 (rosca métrica)",
      descricao: "Olhal rosqueado, grau 8, rosca métrica",
      produto: "AL",
      material: "aço liga, grau 8, temperado e revenido",
      fatorSeguranca: 5,                       // MBL = 5 × CMT
      temperatura: "−40 °C a +200 °C",
      certificacao: "2.1, 2.2, 3.1, MTCa, MPIb, CE",
      campos: ["codigo", "cmt", "rosca", "b", "c", "d", "e", "f", "g", "peso"],
      linhas: [
        ["GPAL06", 0.2, "M6", 20, 34, 20, 20, 17, 7, 0.05],
        ["GPAL08", 0.4, "M8", 20, 34, 20, 24, 17, 7, 0.06],
        ["GPAL10", 0.7, "M10", 20, 38, 22, 30, 19, 8, 0.08],
        ["GPAL12", 1, "M12", 25, 47, 27, 36, 23, 10, 0.14],
        ["GPAL14", 1.2, "M14", 30, 57, 30, 40, 27, 14, 0.25],
        ["GPAL16", 1.5, "M16", 36, 63, 35, 55, 31, 14, 0.39],
        ["GPAL18", 2, "M18", 36, 63, 35, 55, 31, 14, 0.40],
        ["GPAL20", 2.5, "M20", 40, 72, 40, 59, 34, 16, 0.58],
        ["GPAL22", 3, "M22", 42, 82, 45, 66, 38, 19, 0.77],
        ["GPAL24", 4, "M24", 55, 95, 55, 84, 40, 20, 1.12],
        ["GPAL27", 5, "M27", 55, 95, 55, 84, 40, 20, 1.19],
        ["GPAL30", 6, "M30", 60, 108, 60, 99, 51, 24, 1.87],
        ["GPAL33", 7, "M33", 60, 108, 60, 99, 51, 24, 1.96],
        ["GPAL36", 8, "M36", 65, 118, 68, 117, 48, 25, 2.44],
        ["GPAL39", 9, "M39", 65, 118, 68, 117, 48, 25, 2.59],
        ["GPAL42", 10, "M42", 70, 142, 80, 135, 61, 31, 4.14],
        ["GPAL45", 15, "M45", 70, 142, 80, 135, 61, 31, 4.15],
        ["GPAL48", 18, "M48", 95, 181, 97, 150, 69, 42, 8.22],
        ["GPAL52", 20, "M52", 95, 181, 97, 150, 69, 42, 8.55],
        ["GPAL56", 25, "M56", 95, 181, 97, 150, 69, 42, 8.85],
        ["GPAL60", 30, "M60", 95, 181, 97, 150, 69, 42, 9.16],
        ["GPAL64", 36, "M64", 95, 181, 97, 150, 69, 42, 9.55]
      ]
    }
  },

  /** olhais de um tipo como objetos */
  lista(tipo) {
    const t = this.tipos[tipo];
    if (!t) return [];
    return t.linhas.map(l => {
      const o = { tipo, tipoNome: t.nome };
      t.campos.forEach((c, i) => { o[c] = l[i]; });
      return o;
    });
  },

  /** menor olhal do tipo que atende a carga (t) e recebe o pino da manilha (mm) */
  escolher(tipo, cargaT, pinoMm) {
    return this.lista(tipo).find(o => o.cmt >= cargaT && (!pinoMm || o.d >= pinoMm)) || null;
  }
};
