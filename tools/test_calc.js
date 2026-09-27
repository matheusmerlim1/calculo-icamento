/*
 * Confere a estática do içamento contra casos de resultado conhecido.
 * Uso: node tools/test_calc.js
 */
const fs = require("fs"), vm = require("vm"), path = require("path");
const SITE = path.join(__dirname, "..", "site");
global.window = global;
for (const f of ["data/fatores.js", "js/calc/cargas.js"])
  vm.runInThisContext(fs.readFileSync(path.join(SITE, f), "utf8"), { filename: f });

const C = IC.cargas, g = C.G;
let ok = 0; const falhas = [];
const perto = (a, b, tol, oque) => {
  if (Math.abs(a - b) <= tol) { ok++; return; }
  falhas.push(`${oque}: esperado ${b.toFixed(3)}, obtido ${a.toFixed(3)}`);
};

/* 1 — quatro pernas simétricas, CG no centro, sem fatores.
      Hipótese de pares diagonais: cada par sustenta tudo -> V = W/2 por perna. */
const sim = C.resolver({
  massa: 10000, alturaGancho: 3000, pontos: C.retangulo(2000, 2000, 0),
  fatores: { peso: 1, daf: 1, consequencia: 1, skl: 1 }
});
const W = 10000 * g / 1000;
perto(sim.pesoKN, W, 1e-6, "peso do corpo (kN)");
sim.pernas.forEach((p, i) => perto(p.vertical, W / 2, 1e-6, `4 pernas simétricas · vertical da perna ${i + 1}`));
// ângulo: ponto (1000,1000,0) e gancho (0,0,3000) -> tan β = √2·1000/3000
const betaEsp = Math.atan(Math.hypot(1000, 1000) / 3000) * 180 / Math.PI;
perto(sim.pernas[0].angulo, betaEsp, 1e-6, "ângulo da perna com a vertical");
perto(sim.pernas[0].tracao, (W / 2) / Math.cos(betaEsp * Math.PI / 180), 1e-6, "tração pela abertura da perna");

/* 2 — duas pernas com o CG deslocado: a perna mais próxima pega mais carga.
      Pontos em x = −1000 e x = +3000 -> V1 = W·3/4, V2 = W·1/4 */
const duas = C.resolver({
  massa: 4000, alturaGancho: 4000,
  pontos: [{ nome: "A", x: -1000, y: 0, z: 0 }, { nome: "B", x: 3000, y: 0, z: 0 }],
  fatores: { peso: 1, daf: 1, consequencia: 1, skl: 1 }
});
const W2 = 4000 * g / 1000;
perto(duas.pernas[0].vertical, W2 * 0.75, 1e-6, "2 pernas · vertical do ponto mais próximo do CG");
perto(duas.pernas[1].vertical, W2 * 0.25, 1e-6, "2 pernas · vertical do ponto mais afastado");
perto(duas.pernas[0].vertical + duas.pernas[1].vertical, W2, 1e-6, "2 pernas · soma das verticais");

/* 3 — fatores multiplicam o peso de projeto e o SKL só entra com quatro pernas */
const comFat = C.resolver({
  massa: 10000, alturaGancho: 3000, pontos: C.retangulo(2000, 2000, 0),
  fatores: { peso: 1.05, daf: 1.3, consequencia: 1, skl: 1.25 }
});
perto(comFat.pesoProjKN, W * 1.05 * 1.3, 1e-6, "peso de projeto com γpeso e DAF");
perto(comFat.pernas[0].vertical, W * 1.05 * 1.3 / 2 * 1.25, 1e-6, "vertical com SKL nas quatro pernas");

/* 4 — distribuição elástica: simétrico dá W/4 por perna */
const elast = C.resolver({
  massa: 10000, alturaGancho: 3000, pontos: C.retangulo(2000, 2000, 0),
  hipotese4: "elastica", fatores: { peso: 1, daf: 1, consequencia: 1, skl: 1 }
});
elast.pernas.forEach((p, i) => perto(p.vertical, W / 4, 1e-6, `elástica · vertical da perna ${i + 1}`));

/* 5 — avisos: ângulo grande e CG fora da linha */
const aberto = C.resolver({
  massa: 5000, alturaGancho: 800, pontos: C.retangulo(4000, 4000, 0),
  fatores: { peso: 1, daf: 1, consequencia: 1, skl: 1, anguloMax: 60 }
});
if (!aberto.avisos.some(a => /ângulo/.test(a))) falhas.push("faltou o aviso de ângulo acima do limite");
else ok++;
const fora = C.resolver({
  massa: 5000, alturaGancho: 3000,
  pontos: [{ x: 0, y: 1000, z: 0 }, { x: 0, y: 2000, z: 0 }],
  fatores: { peso: 1, daf: 1, consequencia: 1, skl: 1 }
});
if (!fora.avisos.some(a => /fora do trecho/.test(a))) falhas.push("faltou o aviso de CG fora do trecho entre os pontos");
else ok++;

/* 6 — tabelas de fatores e de acessórios respondem */
perto(IC.fatores.daf("N001", "offshore", 50), 1.25, 1e-9, "DAF N001 offshore 50 t");
perto(IC.fatores.daf("N001", "offshore", 2), 1.30, 1e-9, "DAF N001 offshore 2 t");
perto(IC.fatores.daf("2.7-1", "offshore", 5), 2.50, 1e-9, "DAF 2.7-1 offshore");

console.log(`verificações ok: ${ok}`);
if (falhas.length) { console.log("FALHAS:"); falhas.forEach(f => console.log("  ✗", f)); process.exit(1); }
console.log("estática do içamento conferida");
