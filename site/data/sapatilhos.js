/*
 * Sapatilhos (thimbles) — "Sapatilha Pesada, Aço Estampado", tabela extraída de
 * `Referencia/Tabelas MC - Içamento.xlsx` (aba "Sapatilho").
 *
 * Cada código cobre uma faixa de diâmetro de cabo (polegada); a coluna `g` é o diâmetro do
 * cabo em mm (a mesma medida da coluna "polegada", só que exata) e `h` é o peso em kg.
 *
 * As letras a-f, pela folha de dimensões do fabricante (e os números batem: a > b, c > d,
 * e > f em toda a tabela):
 *
 *   a  comprimento total     b  comprimento interno
 *   c  altura total          d  altura interna (é ela que passa pelo corpo da manilha)
 *   e  largura total         f  largura da ranhura, onde o cabo assenta
 *
 * Padrão equivalente à DIN 3091, serviço pesado — conferir com o catálogo do fabricante.
 *
 * As verificações de encaixe do memorial de referência (docs/METODO.md, item 6) usam:
 *   Caso 1  c (garganta) > d_manilha
 *   Caso 2  e (boca)     > d_manilha + 2·a_manilha
 *   Caso 3  a_manilha    > a (sapatilho) + d_cabo
 *   Caso 4  b_manilha    > f (sapatilho)
 */
window.IC = window.IC || {};

IC.sapatilhos = {
  fonte: "Tabelas MC - Içamento.xlsx, aba Sapatilho",
  campos: ["codigo", "cabo", "a", "b", "c", "d", "e", "f", "diametroCabo", "peso"],

  // [código, cabo (polegada), a, b, c, d, e, f, diâmetro do cabo (mm), peso (kg)]
  linhas: [
    ["SP-05", '3/16"', 47.5, 35.6, 28.2, 17.0, 9.7, 7.1, 4.76, 0.03],
    ["SP-06", '1/4"', 55.6, 41.4, 38.1, 22.4, 10.4, 7.1, 6.35, 0.04],
    ["SP-08", '5/16"', 63.5, 47.8, 46.0, 26.9, 12.7, 8.6, 7.94, 0.04],
    ["SP-10", '3/8"', 73.2, 54.1, 54.1, 28.7, 16.0, 10.4, 10.00, 0.09],
    ["SP-11", '7/16"', 82.6, 60.5, 60.5, 31.8, 18.3, 11.9, 11.00, 0.21],
    ["SP-13", '1/2"-9/16"', 92.2, 69.9, 68.3, 38.1, 22.4, 15.0, 12.70, 0.21],
    ["SP-13", '1/2"-9/16"', 92.2, 69.9, 68.3, 38.1, 22.4, 15.0, 13.00, 0.21],
    ["SP-13", '1/2"-9/16"', 92.2, 69.9, 68.3, 38.1, 22.4, 15.0, 14.00, 0.21],
    ["SP-13", '1/2"-9/16"', 92.2, 69.9, 68.3, 38.1, 22.4, 15.0, 14.30, 0.21],
    ["SP-16", '5/8"', 108.0, 82.6, 79.5, 44.5, 24.6, 16.8, 15.88, 0.38],
    ["SP-19", '3/4"', 127.0, 95.3, 96.8, 50.8, 31.0, 19.8, 19.00, 0.52],
    ["SP-22", '7/8"', 139.7, 108.0, 108.0, 57.2, 35.1, 23.9, 22.23, 0.81],
    ["SP-25", '1"', 155.7, 114.3, 125.5, 63.5, 39.6, 26.9, 25.40, 1.11],
    ["SP-29", '1.1/8"-1.1/4"', 177.8, 130.3, 149.4, 73.2, 46.0, 33.3, 28.60, 1.30],
    ["SP-29", '1.1/8"-1.1/4"', 177.8, 130.3, 149.4, 73.2, 46.0, 33.3, 31.80, 1.30],
    ["SP-32", '1.1/4"-1.3/8"', 230.1, 165.1, 173.0, 88.9, 65.0, 39.6, 31.80, 1.85],
    ["SP-32", '1.1/4"-1.3/8"', 230.1, 165.1, 173.0, 88.9, 65.0, 39.6, 32.00, 1.85],
    ["SP-32", '1.1/4"-1.3/8"', 230.1, 165.1, 173.0, 88.9, 65.0, 39.6, 34.90, 1.85],
    ["SP-35", '1.1/2"', 228.6, 158.8, 181.1, 88.9, 65.0, 39.6, 35.00, 3.20],
    ["SP-35", '1.1/2"', 228.6, 158.8, 181.1, 88.9, 65.0, 39.6, 36.00, 3.20],
    ["SP-35", '1.1/2"', 228.6, 158.8, 181.1, 88.9, 65.0, 39.6, 38.00, 3.20],
    ["SP-41", '1.5/8"', 285.8, 203.2, 206.5, 101.6, 69.1, 43.7, 40.00, 4.00],
    ["SP-41", '1.5/8"', 285.8, 203.2, 206.5, 101.6, 69.1, 43.7, 41.30, 4.00],
    ["SP-44", '1.3/4"', 309.6, 228.6, 215.9, 114.3, 72.1, 46.7, 44.00, 4.00],
    ["SP-44", '1.3/4"', 309.6, 228.6, 215.9, 114.3, 72.1, 46.7, 44.50, 4.00],
    ["SP-51", '1.7/8"-2"', 384.3, 304.8, 263.7, 152.4, 78.5, 53.1, 45.00, 4.70],
    ["SP-51", '1.7/8"-2"', 384.3, 304.8, 263.7, 152.4, 78.5, 53.1, 47.60, 4.70],
    ["SP-51", '1.7/8"-2"', 384.3, 304.8, 263.7, 152.4, 78.5, 53.1, 48.00, 4.70],
    ["SP-51", '1.7/8"-2"', 384.3, 304.8, 263.7, 152.4, 78.5, 53.1, 50.80, 4.70],
    ["SP-57", '2.1/4"', 435.1, 355.6, 301.8, 177.8, 92.2, 60.5, 51.00, 9.60],
    ["SP-57", '2.1/4"', 435.1, 355.6, 301.8, 177.8, 92.2, 60.5, 52.00, 9.60],
    ["SP-57", '2.1/4"', 435.1, 355.6, 301.8, 177.8, 92.2, 60.5, 54.00, 9.60],
    ["SP-57", '2.1/4"', 435.1, 355.6, 301.8, 177.8, 92.2, 60.5, 56.00, 9.60],
    ["SP-57", '2.1/4"', 435.1, 355.6, 301.8, 177.8, 92.2, 60.5, 57.20, 9.60],
    ["SP-64", '2.1/2"', 477.5, 355.6, 320.0, 177.8, 110.0, 67.1, 60.00, 17.30],
    ["SP-64", '2.1/2"', 477.5, 355.6, 320.0, 177.8, 110.0, 67.1, 63.50, 17.30],
    ["SP-70", '2.3/4"', 457.2, 355.6, 315.0, 177.8, 119.4, 85.1, 69.85, 31.90],
    ["SP-76", '3"', 508.0, 374.7, 348.0, 189.2, 124.5, 80.0, 76.20, 31.90],
    ["SP-83", '3.1/4"', 515.1, 406.4, 359.9, 210.1, 130.0, 85.1, 82.55, 44.00],
    ["SP-90", '3.1/2"', 549.9, 435.1, 359.9, 210.1, 130.0, 89.9, 88.90, 44.00],
    ["SP-100", '4"', 659.9, 519.9, 404.9, 229.9, 151.9, 112.8, 101.60, 44.00]
  ],

  /** todos os sapatilhos como objetos */
  lista() {
    return this.linhas.map(l => {
      const o = {};
      this.campos.forEach((c, i) => { o[c] = l[i]; });
      return o;
    });
  },

  /** o(s) sapatilho(s) cadastrados para um diâmetro de cabo (mm) */
  paraCabo(diametroMm) {
    return this.lista().filter(s => Math.abs(s.diametroCabo - diametroMm) < 1e-6);
  },

  /** menor sapatilho cujo diâmetro de cabo é ≥ ao informado (mm) */
  escolher(diametroMm) {
    const l = this.lista().sort((a, b) => a.diametroCabo - b.diametroCabo);
    return l.find(s => s.diametroCabo >= diametroMm) || null;
  }
};
