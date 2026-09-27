/*
 * Fatores de projeto do içamento.
 *
 * Duas bases normativas, como pedido:
 *   DNV-ST-N001   operações marítimas e marine warranty (cap. 16 — içamento)
 *   DNV-2.7-1     contêineres offshore (ST-E271)
 * e uma terceira opção livre, em que todos os fatores são digitados.
 *
 * ATENÇÃO: as tabelas das normas DNV não são de livre reprodução. Os valores abaixo são os
 * usualmente citados na literatura técnica e servem de ponto de partida — TODOS são editáveis
 * na página e o memorial registra o que foi usado. Confira com a edição da norma contratada
 * para o seu projeto antes de emitir o documento.
 */
window.IC = window.IC || {};

IC.fatores = {
  bases: {
    "N001": {
      nome: "DNV-ST-N001 — operações marítimas (cap. 16)",
      referencia: "DNV-ST-N001, Lifting operations",
      conferir: true,
      /** fator de amplificação dinâmica por faixa de carga no gancho (t) */
      daf: {
        offshore: [[3, 1.30], [100, 1.25], [300, 1.20], [1000, 1.15], [Infinity, 1.10]],
        inshore: [[100, 1.15], [1000, 1.10], [Infinity, 1.05]],
        onshore: [[Infinity, 1.10]]
      },
      /** distribuição desigual entre pernas */
      skl: { duas: 1.00, quatro: 1.25 },
      /** fator de consequência aplicado ao conjunto */
      consequencia: { normal: 1.00, severa: 1.30 },
      /** margem sobre o peso informado */
      peso: { pesado: 1.03, calculado: 1.05, estimado: 1.10 },
      /** fator de segurança da linga (MBL / carga de projeto) */
      fsLinga: { padrao: 3.0, sobrePessoas: 5.0 },
      /** parcela da carga da perna aplicada fora do plano do olhal */
      foraDoPlano: 0.05,
      nota: "DAF por faixa de peso, SKL nas quatro pernas e FS ≥ 3,0 na linga."
    },

    "2.7-1": {
      nome: "DNV-2.7-1 / ST-E271 — contêineres offshore",
      referencia: "DNV-2.7-1 (ST-E271), Offshore containers",
      conferir: true,
      daf: {
        offshore: [[Infinity, 2.50]],           // içamento certificado de contêiner offshore
        inshore: [[Infinity, 1.30]],
        onshore: [[Infinity, 1.10]]
      },
      skl: { duas: 1.00, quatro: 1.00 },        // a norma já prevê a distribuição nas pernas
      consequencia: { normal: 1.00, severa: 1.30 },
      peso: { pesado: 1.03, calculado: 1.05, estimado: 1.10 },
      fsLinga: { padrao: 3.0, sobrePessoas: 5.0 },
      foraDoPlano: 0.05,
      nota: "Fator dinâmico único do conjunto de içamento de contêiner; ângulo da perna limitado pela norma."
    },

    "livre": {
      nome: "Fatores informados pelo usuário",
      referencia: "definido no projeto",
      conferir: false,
      daf: { offshore: [[Infinity, 1.30]], inshore: [[Infinity, 1.15]], onshore: [[Infinity, 1.10]] },
      skl: { duas: 1.00, quatro: 1.25 },
      consequencia: { normal: 1.00, severa: 1.30 },
      peso: { pesado: 1.03, calculado: 1.05, estimado: 1.10 },
      fsLinga: { padrao: 3.0, sobrePessoas: 5.0 },
      foraDoPlano: 0.05,
      nota: "Todos os fatores são digitados e ficam registrados no memorial."
    }
  },

  /** DAF da base para o local e a carga no gancho (t) */
  daf(base, local, cargaT) {
    const faixas = (this.bases[base] || this.bases.N001).daf[local] || [];
    const f = faixas.find(([lim]) => cargaT <= lim);
    return f ? f[1] : (faixas.length ? faixas[faixas.length - 1][1] : 1.3);
  },

  /** ângulo máximo da perna com a vertical (°) — prática usual */
  anguloMaximo: 60,

  /** folgas de encaixe usadas nas verificações (mm) */
  folgas: {
    pinoFuroMin: 3,        // furo do olhal maior que o pino, no mínimo
    pinoFuroMax: 6,        // e no máximo (pino não pode "bailar" no furo)
    bocaLateral: 2,        // folga de cada lado entre a boca da manilha e a chapa/sapatilha
    bocaMaxFolga: 0.25     // a chapa deve ocupar ao menos 75% da boca (evita flexão do pino)
  }
};
