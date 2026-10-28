/*
 * Gera site/data/sldprt-modelo.js a partir de tools/sldprt/modelo_vazio.SLDPRT.
 *
 *   node tools/sldprt/gerar_modelo.js
 *
 * O modelo é uma peça vazia salva pelo próprio SolidWorks (2023), com as propriedades
 * TitlePT, SpecPT, MaterialPT, Mass, LENGTHM e BBOX preenchidas com marcadores longos e
 * aleatórios (tools/sldprt/marcadores.txt). Aleatórios para o deflate não encolher: o espaço
 * comprimido que eles ocupam é o espaço que a página tem para escrever os valores reais.
 *
 * O que se sabe do .SLDPRT (conferido abrindo no SolidWorks — ver js/core/sldprt.js):
 *   - é uma sequência de blocos: 4 bytes + marca 14 00 06 00 08 00 + (u32 id, u32 crc32 dos
 *     dados descomprimidos, u32 tamanho comprimido, u32 tamanho descomprimido, u32 tamanho do
 *     nome) + nome com os nibbles trocados + dados em deflate cru;
 *   - no fim, um índice repete o cabeçalho de cada bloco (com 10 bytes a mais e a posição do
 *     bloco − 8) e o SolidWorks confere o arquivo por ele;
 *   - as propriedades são lidas de docProps/custom.xml; Contents/CusProps (MFC) leva a mesma
 *     coisa e é atualizado junto;
 *   - mudar um bloco de lugar faz o SolidWorks recusar o arquivo ("precisa de reparo"); trocar
 *     os dados no mesmo lugar, menores que o espaço, completando com zeros e acertando crc e
 *     tamanhos no bloco e no índice, ele aceita.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const AQUI = __dirname;
const SAIDA = path.join(AQUI, "..", "..", "site", "data", "sldprt-modelo.js");
const MARCA = Buffer.from([0x14, 0x00, 0x06, 0x00, 0x08, 0x00]);
const troca = buf => Buffer.from(buf.map(x => ((x >> 4) | (x << 4)) & 0xff));

const modelo = fs.readFileSync(path.join(AQUI, "modelo_vazio.SLDPRT"));
const marcadores = Object.fromEntries(fs.readFileSync(path.join(AQUI, "marcadores.txt"), "utf8")
  .split(/\r?\n/).filter(Boolean).map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));

/** entrada do índice de um bloco: o nome (trocado) vem 40 bytes depois da marca */
function entradaIndice(nome) {
  let achada = -1;
  for (let i = modelo.indexOf(MARCA); i >= 0; i = modelo.indexOf(MARCA, i + 1)) {
    const nl = modelo.readUInt32LE(i + 22);
    if (i + 40 + nl <= modelo.length && troca(modelo.subarray(i + 40, i + 40 + nl)).toString("latin1") === nome) achada = i;
  }
  if (achada < 0) throw new Error("sem entrada no índice: " + nome);
  return achada;
}

const secoes = ["docProps/custom.xml", "Contents/CusProps"].map(nome => {
  const toc = entradaIndice(nome);
  const secao = modelo.readUInt32LE(toc + 36) + 12;          // posição gravada = marca − 12
  const nl = modelo.readUInt32LE(secao + 22);
  if (troca(modelo.subarray(secao + 26, secao + 26 + nl)).toString("latin1") !== nome)
    throw new Error("o índice não aponta para o bloco " + nome);
  const slot = modelo.readUInt32LE(secao + 14);
  const dados = zlib.inflateRawSync(modelo.subarray(secao + 26 + nl, secao + 26 + nl + slot));
  if (zlib.crc32 && zlib.crc32(dados) !== modelo.readUInt32LE(secao + 10)) throw new Error("crc não confere: " + nome);
  return { nome, secao, toc, inicioDados: secao + 26 + nl, slot, dados: dados.toString("base64") };
});

const js = `/*
 * Modelo de peça SolidWorks vazia — GERADO por tools/sldprt/gerar_modelo.js, não editar.
 * Origem: tools/sldprt/modelo_vazio.SLDPRT (SOLIDWORKS 2023). Uso: js/core/sldprt.js.
 */
window.IC = window.IC || {};
IC.sldprtModelo = ${JSON.stringify({
  versao: "SOLIDWORKS 2023",
  marcadores,
  secoes,
  arquivo: modelo.toString("base64")
}, null, 1)};
`;
fs.writeFileSync(SAIDA, js);
console.log("gravado", path.relative(process.cwd(), SAIDA),
  secoes.map(s => `${s.nome}: espaço ${s.slot} B, ${Buffer.from(s.dados, "base64").length} B descomprimido`).join(" · "));
