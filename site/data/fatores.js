/*
 * Fatores de projeto do içamento.
 *
 * Bases normativas:
 *   DNV-ST-N001   operações marítimas (ed. set/2018, emenda jan/2020), cap. 16 — içamento.
 *                 Valores tirados do texto da norma (item citado em cada um).
 *   DNV-2.7-1     contêineres offshore (ST-E271)
 *   livre         todos os fatores digitados
 *
 * Cadeia de cargas (N001 16.3): W_proj = W · γ_peso · γ_CoG · DAF, distribuída nas pernas com
 * o SKL. A eslinga é verificada por MBL ≥ F_SD · γsf (16.4.2.1), com
 * γsf = máx(γh·γc·γr·γw·γm ; 2,3·γr·γw) e γr = máx(γs ; γb) (16.4.3, 16.4.6).
 * O olhal leva o fator de consequência 1,30 da N-2683 (5.2 a) e da N001 (Tabela 16-5).
 */
window.IC = window.IC || {};

IC.fatores = {
  bases: {
    "N001": {
      nome: "DNV-ST-N001 — operações marítimas (cap. 16)",
      referencia: "DNV-ST-N001, Lifting operations",
      /** DAF da Tabela 16-1 por carga estática no gancho SHL (t); até 100 t a norma dá fórmula */
      daf: {
        onshore: [[100, 1.10], [300, 1.05], [1000, 1.05], [2500, 1.03], [Infinity, 1.03]],
        inshore: [[100, shl => 1.07 + 0.05 * Math.sqrt(100 / shl)], [300, 1.12], [1000, 1.10], [2500, 1.08], [Infinity, 1.05]],
        offshore: [[100, shl => 1 + 0.25 * Math.sqrt(100 / shl)], [300, 1.25], [1000, 1.20], [2500, 1.15], [Infinity, 1.10]]
      },
      /** Tabela 16-1, nota 1: abaixo de 3 t o cálculo usa 3 t */
      shlMin: 3,
      /** 16.2.6.9 e 16.2.6.12/13: determinado 1,00; quatro pernas indeterminado 1,25 */
      skl: { duas: 1.00, quatro: 1.25 },
      /** 5.6.2.2 / Tabela 5-2: pesado (imprecisão da balança), classe A 1,05, classes B e C 1,10 */
      peso: { pesado: 1.03, calculado: 1.05, estimado: 1.10 },
      /** 5.6.2.3 c): sem envelope de CoG, fator de imprecisão do CoG de 1,10 sobre o peso */
      cog: 1.10,
      /** fatores parciais da eslinga (16.4) */
      linga: {
        modelo: "N001",
        gh: 1.30,                                  // 16.4.4.1
        gc: { normal: 1.30, reduzida: 1.00 },      // 16.4.5.1 / 16.4.5.2
        gm: 1.50,                                  // 16.4.9.1
        gw: 1.10                                   // 16.4.10.2
      },
      fsLinga: { padrao: 3.0, sobrePessoas: 5.0 },
      nota: "DNV-ST-N001: DAF da Tabela 16-1, γ_CoG 1,10 (5.6.2.3), SKL 1,25 nas quatro pernas (16.2.6) "
        + "e fator de segurança da eslinga γsf calculado pelos fatores parciais de 16.4."
    },

    "2.7-1": {
      nome: "DNV-2.7-1 / ST-E271 — contêineres offshore",
      referencia: "DNV-2.7-1 (ST-E271), Offshore containers",
      daf: {
        offshore: [[Infinity, 2.50]],           // içamento certificado de contêiner offshore
        inshore: [[Infinity, 1.30]],
        onshore: [[Infinity, 1.10]]
      },
      skl: { duas: 1.00, quatro: 1.00 },        // a norma já prevê a distribuição nas pernas
      peso: { pesado: 1.03, calculado: 1.05, estimado: 1.10 },
      cog: 1.00,
      linga: { modelo: "fs" },
      fsLinga: { padrao: 3.0, sobrePessoas: 5.0 },
      nota: "Fator dinâmico único do conjunto de içamento de contêiner; ângulo da perna limitado pela norma."
    },

    "livre": {
      nome: "Fatores informados pelo usuário",
      referencia: "definido no projeto",
      daf: { offshore: [[Infinity, 1.30]], inshore: [[Infinity, 1.15]], onshore: [[Infinity, 1.10]] },
      skl: { duas: 1.00, quatro: 1.25 },
      peso: { pesado: 1.03, calculado: 1.05, estimado: 1.10 },
      cog: 1.00,
      linga: { modelo: "fs" },
      fsLinga: { padrao: 3.0, sobrePessoas: 5.0 },
      nota: "Todos os fatores são digitados e ficam registrados no memorial."
    }
  },

  /** terminação da eslinga — fator γs da Tabela 16-3 (DNV-ST-N001) */
  terminacoes: {
    manual: { nome: "emenda manual (EN 13411-2)", gs: 1.25 },
    presilha: { nome: "presilha / ferrule (EN 13411-3)", gs: 1.12 },
    soquete: { nome: "soquete fundido ou de resina (EN 13411-4)", gs: 1.00 }
  },

  /** DAF da base para o local e a carga estática no gancho (t) */
  daf(base, local, cargaT) {
    const b = this.bases[base] || this.bases.N001;
    const faixas = b.daf[local] || [];
    const shl = Math.max(Number(cargaT) || 0, b.shlMin || 0);
    const f = faixas.find(([lim]) => shl <= lim) || faixas[faixas.length - 1];
    if (!f) return 1.3;
    return typeof f[1] === "function" ? f[1](shl) : f[1];
  },

  /** γb da N001 16.4.8.1: 1 / (1 − 0,5/√(D/d)). Abaixo de D/d = 1 só o olho pode dobrar
   *  (16.4.8.5) e o fator passa de 2,0; a fórmula vale até D/d > 0,25 */
  gamaB(Ddobra, dCabo) {
    const r = Ddobra / dCabo;
    if (!(r > 0.25)) return null;
    return 1 / (1 - 0.5 / Math.sqrt(r));
  },

  /** ângulo máximo da perna com a vertical (°) */
  anguloMaximo: 60,

  /** folgas de encaixe usadas nas verificações (mm) */
  folgas: {
    pinoFuroMin: 3,
    pinoFuroMax: 6,
    bocaLateral: 2,
    bocaMaxFolga: 0.25
  }
};
