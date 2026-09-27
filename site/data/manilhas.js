/*
 * Manilhas — tabela Green Pin (folha P-6065, informada pelo usuário).
 *
 * Série SLGPF…ROVRLLC (manilha de laço, pino com porca e contrapino, punho para ROV).
 * Todas as medidas em mm; carga máxima de trabalho (CMT / WLL) em toneladas.
 *
 *   a  diâmetro do corpo          e  largura interna (boca, junto ao pino)
 *   b  diâmetro do pino           f  comprimento interno
 *   c  diâmetro do olhal          g  largura do corpo
 *   d  largura do olhal           h  comprimento total
 *                                 i  comprimento do parafuso
 *
 * Conferir sempre com o catálogo vigente do fabricante antes de comprar.
 */
window.IC = window.IC || {};

IC.manilhas = {
  fonte: "Green Pin — folha P-6065 (série SLGPF…ROVRLLC)",
  tipos: {
    "P-6065": {
      nome: "Green Pin Sling Shackle P-6065",
      descricao: "Manilha de laço, pino com porca e contrapino, punho para ROV",
      campos: ["codigo", "cmt", "peso", "a", "b", "c", "d", "e", "f", "g", "h", "i"],
      // [código, CMT (t), peso (kg), a, b, c, d, e, f, g, h, i]
      linhas: [
        ["SLGPF0012ROVRLLC", 12.5, 4.27, 28, 28, 61, 25, 44, 121, 82, 197, 143],
        ["SLGPF0018ROVRLLC", 18, 6.85, 35, 35, 69, 30, 54, 148, 102, 239, 184],
        ["SLGPF0030ROVRLLC", 30, 12.5, 40, 42, 90, 35, 69, 165, 126, 279, 210],
        ["SLGPF0040ROVRLLC", 40, 20.3, 55, 51, 109, 45, 84, 199, 140, 331, 256],
        ["SLGPF0055ROVRLLC", 55, 30.4, 60, 57, 115, 55, 90, 240, 160, 389, 289],
        ["SLGPF0075ROVRLLC", 75, 45.0, 68, 70, 125, 54, 110, 290, 185, 473, 317],
        ["SLGPF0125ROVRLLC", 125, 92.0, 85, 80, 154, 85, 137, 366, 220, 583, 413],
        ["SLGPF0150ROVRLLC", 150, 140, 94, 95, 179, 89, 147, 391, 253, 645, 445],
        ["SLGPF0200ROVRLLC", 200, 205, 110, 105, 199, 100, 158, 481, 280, 759, 480],
        ["SLGPF0250ROVRLLC", 250, 264, 126, 120, 227, 110, 179, 542, 300, 859, 523],
        ["SLGPF0300ROVRLLC", 300, 360, 135, 134, 245, 122, 195, 601, 350, 947, 563]
      ]
    },

    "G-4163": {
      nome: "Green Pin Standard Shackle G-4163",
      descricao: "Manilha de laço (bow), pino com porca e contrapino",
      campos: ["codigo", "cmt", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
      // sem peso no catálogo; j = largura, k = espessura da porca
      // [código, CMT (t), a, b, c, d, e, f, g, h, i, j, k]
      linhas: [
        ["GPGHMB06", 0.5, 7, 8, 16, 7, 12, 29, 20, 48, 42, 34, 4],
        ["GPGHMB08", 0.75, 9, 10, 20, 9, 13.5, 32, 22, 56, 50, 40, 5],
        ["GPGHMB10", 1, 10, 11, 23, 10, 17, 37, 26, 64, 60, 46, 8],
        ["GPGHMB11", 1.5, 11, 13, 25, 11, 19, 43, 29, 73, 67, 51, 11],
        ["GPGHMB13", 2, 13.5, 16, 34, 13, 22, 51, 32, 90, 80, 59, 13],
        ["GPGHMB16", 3.25, 16, 19, 40, 16, 27, 64, 43, 110, 98, 75, 17],
        ["GPGHMB19", 4.75, 19, 22, 46, 19, 31, 76, 51, 129, 115, 89, 19],
        ["GPGHMB22", 6.5, 22, 25, 52, 22, 36, 83, 58, 144, 130, 102, 22],
        ["GPGHMB25", 8.5, 25, 28, 59, 25, 43, 95, 68, 164, 150, 118, 25],
        ["GPGHMB28", 9.5, 28, 32, 67, 28, 47, 108, 75, 186, 166, 131, 27],
        ["GPGHMB32", 12, 32, 35, 73, 32, 51, 115, 83, 201, 184, 147, 30],
        ["GPGHMB35", 13.5, 35, 38, 79, 35, 57, 133, 92, 227, 197, 162, 33],
        ["GPGHMB38", 17, 38, 42, 88, 38, 60, 146, 99, 249, 202, 175, 19],
        ["GPGHMB45", 25, 45, 50, 104, 45, 74, 178, 126, 300, 243, 216, 23],
        ["GPGHMB50", 35, 50, 57, 112, 50, 83, 197, 138, 332, 269, 238, 26],
        ["GPGHMB57", 42.5, 57, 65, 132, 57, 95, 222, 160, 378, 301, 274, 29],
        ["GPGHMB65", 55, 65, 70, 145, 65, 105, 260, 180, 433, 329, 310, 32],
        ["GPGHMB75", 85, 75, 83, 167, 75, 127, 330, 190, 530, 381, 340, 39]
      ],
      // o catálogo traz k = 19 mm para a GPGHMB38, fora da sequência (33 antes, 23 depois) — conferir
      conferir: ["GPGHMB38: espessura da porca (k)"]
    }
  },
  /** todas as manilhas de um tipo como objetos — cada tipo tem seu próprio layout de colunas */
  lista(tipo) {
    const t = this.tipos[tipo];
    if (!t) return [];
    return t.linhas.map(l => {
      const o = { tipo, tipoNome: t.nome };
      t.campos.forEach((c, i) => { o[c] = l[i]; });
      return o;
    });
  },

  /** menor manilha do tipo cuja CMT atende a carga (t) */
  escolher(tipo, cargaT) {
    return this.lista(tipo).find(m => m.cmt >= cargaT) || null;
  }
};
