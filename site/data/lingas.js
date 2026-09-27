/*
 * Lingas (eslingas de cabo de aço) — tabela extraída de
 * planilha de eslingas do projeto de referência (aba "Eslinga").
 *
 * A planilha de origem traz 4 blocos de colunas, dois deles rotulados (por erro de digitação
 * da planilha) como "alma de fibra". Pelo padrão de peso e carga de ruptura — sempre maior no
 * segundo bloco de cada construção — e pela conferência cruzada com o memorial de referência
 * (que usa 6x19 alma de aço, categoria 1960 N/mm², e bate exatamente com os valores de
 * 41,3 mm / 6,82 kgf/m usados nos módulos), os blocos corrigidos são:
 *
 *   6x19-fibra   6x19 com alma de fibra (têxtil)
 *   6x19-aco     6x19 com alma de aço (IWRC)      ← construção usada no memorial de referência
 *   6x36-fibra   6x36 com alma de fibra
 *   6x36-aco     6x36 com alma de aço (IWRC)
 *
 * Carga de ruptura mínima (MBL) em kN, para 3 categorias (grade do arame, em N/mm²): 1770,
 * 1960 e 2160. `dimB`/`dimC` são as dimensões mínimas do olho da eslinga (mm) — usadas para
 * verificar a folga do sapatilho e da manilha na boca. Norma: ABNT NBR ISO 2408:2019.
 *
 * Conferir sempre com o catálogo do fabricante (planilha aponta Cimaf) antes de comprar —
 * em especial o diâmetro 31,8 mm do bloco "6x19-aco", cuja célula de ruptura 1960/2160 e
 * dimB/dimC na planilha de origem repete os valores da linha de 34,9 mm (erro de cópia
 * aparente na planilha original, mantido aqui como está e sinalizado em `conferir`).
 */
window.IC = window.IC || {};

IC.lingas = {
  fonte: "Cimaf — cabos de aço 6x19 / 6x36 (planilha do projeto de referência)",
  norma: "ABNT NBR ISO 2408:2019",
  campos: ["diametro", "peso", "ruptura1770", "ruptura1960", "ruptura2160", "dimB", "dimC"],

  tipos: {
    "6x19-fibra": {
      nome: "Cabo 6x19, alma de fibra",
      // [diâmetro mm, peso kgf/m, ruptura 1770 kN, ruptura 1960 kN, ruptura 2160 kN, dimB mm, dimC mm]
      linhas: [
        [12.7, 0.58, 94.2, 104.3, 115.0, 210, 105],
        [14.3, 0.73, 119.4, 132.3, 145.8, 236, 118],
        [15.8, 0.90, 145.8, 161.5, 177.9, 261, 130],
        [19.0, 1.30, 211.0, 233.0, 257.0, 314, 157],
        [22.0, 1.74, 283.0, 313.0, 345.0, 363, 182],
        [25.4, 2.32, 376.8, 417.3, 459.9, 419, 210],
        [28.6, 2.94, 477.8, 529.1, 583.0, 472, 236],
        [31.8, 3.63, 590.7, 654.1, 720.8, 525, 262],
        [34.9, 4.37, 711.4, 787.8, 868.2, 576, 288],
        [38.0, 5.18, 843.0, 934.0, 1030.0, 627, 314],
        [41.3, 6.12, 996.3, 1103.2, 1215.8, 681, 341],
        [44.5, 7.11, 1156.7, 1280.8, 1411.5, 734, 367],
        [47.6, 8.14, 1323.4, 1465.5, 1615.0, 785, 393],
        [50.8, 9.27, 1507.4, 1669.2, 1839.5, 838, 419],
        [54.0, 10.47, 1703.2, 1886.1, 2078.5, 891, 446],
        [57.2, 11.75, 1911.1, 2116.2, 2332.2, 944, 472],
        [60.0, 11.75, 2100.0, 2330.0, 2570.0, 990, 495]
      ]
    },

    "6x19-aco": {
      nome: "Cabo 6x19, alma de aço (IWRC)",
      descricao: "Construção usada no memorial de referência (categoria 1960 N/mm²)",
      linhas: [
        [12.7, 0.64, 101.6, 112.5, 124.0, 210, 105],
        [14.3, 0.82, 128.3, 142.7, 157.5, 236, 118],
        [15.8, 1.00, 157.3, 174.2, 192.0, 261, 130],
        [19.0, 1.44, 227.0, 252.0, 278.0, 314, 157],
        [22.0, 1.94, 305.0, 338.0, 372.0, 363, 182],
        [25.4, 2.58, 406.5, 450.2, 496.1, 419, 210],
        [28.6, 3.27, 515.4, 570.7, 629.0, 472, 236],
        [31.8, 4.05, 637.2, 849.9, 936.6, 576, 288],
        [34.9, 4.87, 767.5, 849.9, 936.8, 576, 288],
        [38.0, 5.78, 910.0, 1010.0, 1110.0, 627, 314],
        [41.3, 6.82, 1074.8, 1190.2, 1311.6, 681, 341],
        [44.5, 7.92, 1247.8, 1381.7, 1522.7, 734, 367],
        [47.6, 9.06, 1427.7, 1581.0, 1742.3, 785, 393],
        [50.8, 10.31, 1626.1, 1800.7, 1984.4, 838, 419],
        [54.0, 11.65, 1837.4, 2034.7, 2242.3, 891, 446],
        [57.2, 13.07, 2061.7, 2283.0, 2515.9, 944, 472],
        [60.0, 14.40, 2270.0, 2510.0, 2770.0, 990, 495]
      ],
      conferir: ["31,8 mm: ruptura 1960/2160 e dimB/dimC repetem a linha de 34,9 mm na planilha de origem — conferir no catálogo Cimaf"]
    },

    "6x36-fibra": {
      nome: "Cabo 6x36, alma de fibra",
      linhas: [
        [12.7, 0.59, 94.2, 104.3, 115.0, 210, 105],
        [14.3, 0.75, 119.4, 132.3, 145.8, 236, 118],
        [15.8, 0.92, 145.8, 161.5, 177.9, 261, 130],
        [19.0, 1.32, 211.0, 233.0, 257.0, 314, 157],
        [22.0, 1.78, 283.0, 313.0, 345.0, 363, 182],
        [25.4, 2.37, 376.8, 417.3, 459.9, 419, 210],
        [28.6, 3.00, 477.8, 529.1, 583.0, 472, 236],
        [31.8, 3.71, 590.7, 654.1, 720.8, 525, 262],
        [34.9, 4.74, 711.4, 787.8, 868.2, 576, 288],
        [38.0, 5.30, 843.0, 934.0, 1030.0, 627, 314],
        [41.3, 6.26, 996.3, 1103.2, 1215.8, 681, 341],
        [44.5, 7.27, 1156.7, 1280.8, 1411.5, 734, 367],
        [47.6, 8.32, 1323.4, 1465.5, 1615.0, 785, 393],
        [50.8, 9.47, 1507.4, 1669.2, 1839.5, 838, 419],
        [54.0, 10.70, 1703.2, 1886.1, 2078.5, 891, 446],
        [57.2, 12.00, 1911.1, 2116.2, 2332.2, 944, 472],
        [60.0, 13.20, 2100.0, 2330.0, 2570.0, 990, 495]
      ]
    },

    "6x36-aco": {
      nome: "Cabo 6x36, alma de aço (IWRC)",
      descricao: "Não fabricado em 22 mm nesta série — pula de 19 para 25,4 mm",
      linhas: [
        [12.7, 0.69, 101.6, 115.2, 124.0, 210, 105],
        [14.3, 0.84, 128.9, 142.7, 157.2, 236, 118],
        [15.8, 1.02, 157.3, 174.2, 192.2, 261, 130],
        [19.0, 1.48, 227.0, 252.0, 278.0, 314, 157],
        [25.4, 2.64, 406.5, 450.2, 496.1, 419, 210],
        [28.6, 3.35, 515.4, 570.7, 629.0, 472, 236],
        [31.8, 4.14, 637.2, 705.6, 777.6, 525, 262],
        [34.9, 4.98, 767.5, 849.9, 936.6, 576, 288],
        [38.0, 5.91, 910.0, 1010.0, 1110.0, 627, 314],
        [41.3, 6.98, 1074.8, 1190.2, 1311.6, 681, 341],
        [44.5, 8.10, 1247.8, 1381.7, 1522.7, 734, 367],
        [47.6, 9.26, 1427.7, 1581.0, 1742.3, 785, 393],
        [50.8, 10.55, 1626.1, 1800.7, 1984.4, 838, 419],
        [54.0, 11.92, 1837.4, 2034.7, 2242.3, 891, 446],
        [57.2, 13.37, 2061.7, 2283.0, 2515.9, 944, 472]
      ]
    }
  },

  /** todas as lingas de uma construção como objetos */
  lista(tipo) {
    const t = this.tipos[tipo];
    if (!t) return [];
    return t.linhas.map(l => {
      const o = { tipo, tipoNome: t.nome };
      this.campos.forEach((c, i) => { o[c] = l[i]; });
      return o;
    });
  },

  /** menor cabo da construção/categoria cuja MBL atende a carga requerida (kN) */
  escolher(tipo, categoria, mblReqKN) {
    const campo = "ruptura" + categoria;   // categoria: 1770 | 1960 | 2160
    return this.lista(tipo).find(l => l[campo] >= mblReqKN) || null;
  }
};
