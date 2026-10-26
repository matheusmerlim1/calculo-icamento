/*
 * Peça SolidWorks (.SLDPRT) vazia com propriedades personalizadas, sem o SolidWorks.
 *
 *   await IC.sldprt.gerar({ titlePT, specPT, material, mass, length, area })  ->  Uint8Array
 *
 * O .SLDPRT é formato fechado; não se escreve um do zero. Parte-se de uma peça vazia salva pelo
 * próprio SolidWorks (data/sldprt-modelo.js, gerado por tools/sldprt/gerar_modelo.js), com
 * marcadores longos no lugar de cada valor, e trocam-se os marcadores pelos valores reais nos
 * dois blocos que guardam as propriedades:
 *   docProps/custom.xml   XML — é dele que o SolidWorks lê as propriedades
 *   Contents/CusProps     serialização MFC (texto UTF-16 com prefixo ff fe ff + tamanho)
 *
 * Cada bloco é regravado NO MESMO LUGAR: o SolidWorks recusa o arquivo se um bloco muda de
 * posição, mas aceita dados menores que o espaço original, completados com zeros, desde que o
 * crc32 e os tamanhos estejam certos no cabeçalho do bloco e na sua entrada do índice.
 */
window.IC = window.IC || {};

IC.sldprt = (function () {
  const M = () => IC.sldprtModelo;
  const PROPS = ["titlePT", "specPT", "material", "mass", "length", "area"];

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const utf8 = s => new TextEncoder().encode(s);
  const escXml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

  /** CString do MFC em Unicode: ff fe ff, tamanho (1 byte, ou ff + 2 bytes), texto UTF-16LE */
  function cstring(s) {
    const n = s.length;
    const cab = n < 0xff ? [0xff, 0xfe, 0xff, n] : [0xff, 0xfe, 0xff, 0xff, n & 0xff, n >> 8];
    const out = new Uint8Array(cab.length + 2 * n);
    out.set(cab);
    for (let i = 0; i < n; i++) { const c = s.charCodeAt(i); out[cab.length + 2 * i] = c & 0xff; out[cab.length + 2 * i + 1] = c >> 8; }
    return out;
  }

  /** troca todas as ocorrências de `de` por `para` num Uint8Array */
  function trocarBytes(buf, de, para) {
    const partes = [];
    let i = 0, n = 0;
    outer: for (let j = 0; j <= buf.length - de.length; j++) {
      for (let k = 0; k < de.length; k++) if (buf[j + k] !== de[k]) continue outer;
      partes.push(buf.subarray(i, j), para);
      i = j + de.length; j = i - 1; n++;
    }
    partes.push(buf.subarray(i));
    const out = new Uint8Array(partes.reduce((t, p) => t + p.length, 0));
    let p = 0;
    for (const x of partes) { out.set(x, p); p += x.length; }
    return { out, n };
  }

  async function deflateRaw(dados) {
    if (typeof CompressionStream === "undefined")
      throw new Error("este navegador não comprime dados (CompressionStream) — use Chrome, Edge ou Firefox atualizados");
    const s = new Blob([dados]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  async function gerar(valores) {
    const modelo = M();
    if (!modelo) throw new Error("modelo de peça não carregado (data/sldprt-modelo.js)");
    const arq = b64(modelo.arquivo);
    const dv = new DataView(arq.buffer);

    for (const s of modelo.secoes) {
      let dados = b64(s.dados);
      for (const k of PROPS) {
        const v = String(valores[k] ?? "-");
        const ph = modelo.marcadores[k];
        const r = s.nome === "docProps/custom.xml"
          ? trocarBytes(dados, utf8(`>${ph}<`), utf8(`>${escXml(v)}<`))
          : trocarBytes(dados, cstring(ph), cstring(v));
        if (!r.n) throw new Error(`marcador de ${k} não encontrado em ${s.nome}`);
        dados = r.out;
      }
      const z = await deflateRaw(dados);
      if (z.length > s.slot) throw new Error(`texto longo demais para a peça (${s.nome}: ${z.length} > ${s.slot} bytes)`);
      arq.fill(0, s.inicioDados, s.inicioDados + s.slot);
      arq.set(z, s.inicioDados);
      const crc = IC.xlsx.crc32(dados);
      for (const p of [s.secao, s.toc]) {
        dv.setUint32(p + 10, crc, true);
        dv.setUint32(p + 14, z.length, true);
        dv.setUint32(p + 18, dados.length, true);
      }
    }
    return arq;
  }

  return { gerar, PROPS };
})();
