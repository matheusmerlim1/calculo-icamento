/*
 * Teste de interface: abre a página num Chrome sem janela e clica de verdade.
 * Usa o protocolo DevTools (sem dependências). Falha se aparecer erro no console.
 *
 * Uso: node tools/test_ui.js [--shots <pasta>]
 */
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");

const PAGINA = path.join(__dirname, "..", "site", "index.html");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome"].find(p => fs.existsSync(p));
const iShots = process.argv.indexOf("--shots");
const SHOTS = iShots > 0 ? process.argv[iShots + 1] : null;
const esperar = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!CHROME) throw new Error("Chrome não encontrado");
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "ic-ui-"));
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
    "--remote-debugging-port=9337", `--user-data-dir=${perfil}`, "--window-size=1500,1100", "about:blank"], { stdio: "ignore" });

  let alvo = null;
  for (let i = 0; i < 40 && !alvo; i++) {
    await esperar(250);
    try { alvo = (await (await fetch("http://127.0.0.1:9337/json/list")).json()).find(t => t.type === "page"); }
    catch (e) { /* ainda subindo */ }
  }
  if (!alvo) { chrome.kill(); throw new Error("Chrome não respondeu"); }

  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener("open", r));
  let id = 0; const pend = new Map(); const logs = [];
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type))
      logs.push(m.params.args.map(a => a.value || a.description || "").join(" "));
    if (m.method === "Runtime.exceptionThrown")
      logs.push("EXCEÇÃO: " + (m.params.exceptionDetails.exception || {}).description);
  });
  const send = (metodo, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: metodo, params })); });
  await send("Runtime.enable"); await send("Page.enable");

  async function rodar(expr) {
    const r = await send("Runtime.evaluate", { expression: `(function(){${expr}})()`, returnByValue: true, awaitPromise: true });
    const d = r.result || {};
    if (d.exceptionDetails) throw new Error("JS: " + (d.exceptionDetails.exception || {}).description);
    return d.result ? d.result.value : undefined;
  }
  async function foto(nome) {
    if (!SHOTS) return;
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, nome + ".png"), Buffer.from(r.result.data, "base64"));
  }
  async function abrir() {
    await send("Page.navigate", { url: encodeURI("file:///" + PAGINA.replace(/\\/g, "/")) });
    await esperar(1500);
    await rodar(`localStorage.removeItem("ic-estudo")`);
    await send("Page.reload");
    await esperar(1500);
    if (!(await rodar(`return !!window.ICapp`))) throw new Error("a página não carregou");
  }

  const ok = [], falhas = [];
  // a lixeira só existe quando há mais de um içamento — o teste dela vem depois do "+ içamento"
  const passo = async (oque, fn) => {
    try { const r = await fn(); if (r === false) falhas.push(oque); else ok.push(oque); }
    catch (e) { falhas.push(oque + " — " + String(e.message).split(/[\r\n]/)[0]); }
  };

  await abrir();

  await passo("página abre com um içamento", async () =>
    (await rodar(`return ICapp.estudo.icamentos.length`)) === 1);

  await passo("cada tipo tem o seu desenho no cartão", async () => {
    const n = await rodar(`return document.querySelectorAll('.tipo .tipo__fig svg').length`);
    if (n !== 3) throw new Error("desenhos nos cartões: " + n);
    return true;
  });

  await passo("desenho 3D e figura das medidas aparecem", async () => {
    const r = JSON.parse(await rodar(`return JSON.stringify({
      tres: !!document.querySelector("#fig-3d-medidas svg"),
      med: !!document.querySelector("#fig-medidas svg"),
      carga: !!document.querySelector("#fig-3d-cargas svg"),
      eixos: !!document.querySelector("#fig-3d-medidas svg .triedro")})`));
    if (!r.tres || !r.med || !r.carga) throw new Error("faltou figura: " + JSON.stringify(r));
    if (!r.eixos) throw new Error("faltou o triedro de eixos");
    return true;
  });

  for (const [tipo, pernas] of [["duas", 2], ["quatroDif", 4], ["quatroSim", 4]]) {
    await passo(`tipo ${tipo} calcula ${pernas} pernas`, async () => {
      await rodar(`document.querySelector('[data-tipo="${tipo}"]').click();`);
      await esperar(500);
      // cada perna traz uma linha de memorial logo abaixo — contamos só as linhas de perna
      const n = await rodar(`return document.querySelectorAll("#tab-cargas tbody tr:not(.linha-formula)").length`);
      if (n !== pernas) throw new Error(`linhas na tabela: ${n}`);
      const svg = await rodar(`return !!document.querySelector("#fig-3d-medidas svg")`);
      if (!svg) throw new Error("sem desenho 3D");
      await foto(`ic_${tipo}`);
      return true;
    });
  }

  await passo("ângulo da perna define a altura do gancho", async () => {
    await rodar(`document.querySelector('[data-tipo="quatroSim"]').click();`);
    await esperar(400);
    const alt = async () => rodar(`return Math.round(ICapp.alturaGancho(ICapp.atual()))`);
    await rodar(`const e=document.getElementById("ic-angulo"); e.value="45"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const a45 = await alt();
    await rodar(`const e=document.getElementById("ic-angulo"); e.value="60"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const a60 = await alt();
    // a 45° a altura é igual à distância horizontal; a 60° é maior
    const d = await rodar(`const p=ICapp.pontosDe(ICapp.atual())[0]; return Math.round(Math.hypot(p.x,p.y));`);
    if (Math.abs(a45 - d) > 2) throw new Error(`a 45° a altura deveria ser ${d}, deu ${a45}`);
    if (!(a60 > a45)) throw new Error("60° deveria dar gancho mais alto");
    return true;
  });

  await passo("troca de unidade converte os campos", async () => {
    const valor = () => rodar(`return document.querySelector('[data-medida="a"]').value`);
    const mm = await valor();
    await rodar(`const s=document.getElementById("un-comp"); s.value="m"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const m = await valor();
    if (Math.abs(Number(m) * 1000 - Number(mm)) > 1) throw new Error(`${mm} mm virou ${m} m`);
    const massaKg = await rodar(`return ICapp.atual().massa`);
    await rodar(`const s=document.getElementById("un-massa"); s.value="t"; s.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const massaT = await rodar(`return document.getElementById("ic-massa").value`);
    if (Math.abs(Number(massaT) * 1000 - massaKg) > 1) throw new Error(`massa ${massaKg} kg virou ${massaT} t`);
    await rodar(`const a=document.getElementById("un-comp"); a.value="mm"; a.dispatchEvent(new Event("change",{bubbles:true}));
                 const b=document.getElementById("un-massa"); b.value="kg"; b.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    return true;
  });

  await passo("afastar o ponto alonga a perna (ângulo fixo, mesma tração)", async () => {
    const info = () => rodar(`const r=ICapp.resolver(ICapp.atual()); return JSON.stringify({L:Math.round(r.pernas[0].comprimento), T:Math.round(r.maiorTracaoKN*10)/10});`);
    const antes = JSON.parse(await info());
    await rodar(`const e=document.querySelector('[data-medida="a"]'); e.value="3000"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(500);
    const depois = JSON.parse(await info());
    if (!(depois.L > antes.L)) throw new Error(`a perna deveria ficar mais longa (${antes.L} -> ${depois.L})`);
    if (Math.abs(depois.T - antes.T) > 0.2) throw new Error(`com o ângulo fixo a tração não deveria mudar (${antes.T} -> ${depois.T})`);
    await rodar(`const e=document.querySelector('[data-medida="a"]'); e.value="1000"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    return true;
  });

  await passo("ângulo menor com a estrutura aumenta a tração", async () => {
    const T = () => rodar(`return ICapp.resolver(ICapp.atual()).maiorTracaoKN`);
    await rodar(`const e=document.getElementById("ic-angulo"); e.value="60"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const t60 = await T();
    await rodar(`const e=document.getElementById("ic-angulo"); e.value="30"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const t30 = await T();
    if (!(t30 > t60 * 1.3)) throw new Error(`30° deveria puxar bem mais que 60° (${t60.toFixed(1)} -> ${t30.toFixed(1)} kN)`);
    await rodar(`const e=document.getElementById("ic-angulo"); e.value="60"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    return true;
  });

  await passo("pernas diferentes repartem carga diferente", async () => {
    await rodar(`document.querySelector('[data-tipo="quatroDif"]').click();`);
    await esperar(500);
    // neste tipo cada ponto tem as suas coordenadas (x1, y1, z1 ...), não medidas a1/a2
    await rodar(`const e=document.querySelector('[data-medida="x1"]'); e.value="2500"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(500);
    const t = JSON.parse(await rodar(`const r=ICapp.resolver(ICapp.atual()); return JSON.stringify(r.pernas.map(p=>Math.round(p.tracao*10)/10));`));
    if (new Set(t).size < 2) throw new Error("com pernas diferentes as trações deveriam diferir: " + t.join(", "));
    await foto("ic_pernas_diferentes");
    await rodar(`document.querySelector('[data-tipo="quatroSim"]').click();`);
    await esperar(400);
    return true;
  });

  await passo("memorial some e volta pelo botão", async () => {
    const visivel = async () => rodar(`return !!document.querySelector("#tab-cargas tr.linha-formula") &&
      getComputedStyle(document.querySelector("#tab-cargas tr.linha-formula")).display !== "none"`);
    if (await visivel()) throw new Error("o memorial deveria começar oculto");
    await rodar(`document.getElementById("bt-memorial").click();`);
    await esperar(300);
    if (!(await visivel())) throw new Error("o memorial não voltou ao clicar");
    await rodar(`document.getElementById("bt-memorial").click();`);
    await esperar(300);
    return true;
  });

  await passo("caixa recolhe e abre, e o estado fica gravado", async () => {
    const fechada = async () => rodar(`return document.querySelector('.etapa[data-etapa="5"]').classList.contains("fechada")`);
    await rodar(`document.querySelector('.etapa[data-etapa="5"] > h2').click();`);
    await esperar(200);
    if (!(await fechada())) throw new Error("não recolheu");
    const corpoOculto = await rodar(`const c = document.querySelector('.etapa[data-etapa="5"] .etapa__corpo');
      return getComputedStyle(c).display === "none"`);
    if (!corpoOculto) throw new Error("recolheu mas o conteúdo continuou na tela");
    await send("Page.reload"); await esperar(1500);
    if (!(await fechada())) throw new Error("o estado não sobreviveu ao recarregar");
    await rodar(`document.querySelector('.etapa[data-etapa="5"] > h2').click();`);
    await esperar(200);
    if (await fechada()) throw new Error("não abriu de novo");
    return true;
  });

  await passo("lista de material traz título, especificação, material e massa", async () => {
    const r = JSON.parse(await rodar(`const cab = [...document.querySelectorAll("#tab-material thead th")].map(t=>t.textContent.trim());
      const linhas = [...document.querySelectorAll("#tab-material tbody tr")].map(tr =>
        [...tr.children].map(td => td.textContent.trim()));
      return JSON.stringify({cab, linhas});`));
    const esperado = ["Item", "Qtd.", "Título", "Especificação", "Material", "Massa (kg)"];
    if (r.cab.join("|") !== esperado.join("|")) throw new Error("colunas: " + r.cab.join(" | "));
    if (!r.linhas.length) throw new Error("lista vazia");
    if (!r.linhas.some(l => l[2] === "Linga")) throw new Error("faltou a linga: " + JSON.stringify(r.linhas));
    // massa é número ou "-", nunca vazio
    for (const l of r.linhas) if (!l[5]) throw new Error("massa em branco na linha " + l.join(" | "));
    return true;
  });

  await passo("o olhal é um só, dimensionado pela perna mais carregada", async () => {
    const r = JSON.parse(await rodar(`const ic = ICapp.atual();
      ic.olhal.modo = "fabricado"; ICapp.pintar();
      const o = ICapp.olhalDe(ic, ICapp.riggingDe(ic));
      const pernas = ICapp.resolver(ic).pernas;
      return JSON.stringify({qtd: o.qtd, pernas: pernas.length, gov: o.governante.nome,
        maior: Math.max(...pernas.map(p=>p.tracao)), tracaoGov: o.governante.tracao,
        campos: document.querySelectorAll("[data-olhal-campo]").length,
        blocos: document.querySelectorAll("#resultado-olhal .olhal-bloco").length});`));
    if (r.qtd !== r.pernas) throw new Error("quantidade de olhais: " + r.qtd);
    if (Math.abs(r.maior - r.tracaoGov) > 0.01) throw new Error("não pegou a perna mais carregada");
    // só as medidas de escolha têm campo: t, t.anel, base e h. Furo, R e R.anel são calculados.
    if (r.campos !== 4) throw new Error("campos de geometria: " + r.campos + " (esperado 4)");
    return true;
  });

  await passo("campos do olhal aceitam decimal e o desenho acompanha", async () => {
    const vazio = await rodar(`return [...document.querySelectorAll("[data-olhal-campo]")]
      .filter(i => i.value === "").map(i => i.dataset.olhalCampo).join(",")`);
    if (vazio) throw new Error("campo em branco: " + vazio + " (vírgula em input[type=number])");
    const antes = await rodar(`return document.querySelector("#fig-olhal svg").getAttribute("viewBox")`);
    await rodar(`const e = document.querySelector('[data-olhal-campo="base"]');
      e.value = String(Number(e.value) * 2); e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const depois = await rodar(`return document.querySelector("#fig-olhal svg").getAttribute("viewBox")`);
    if (antes === depois) throw new Error("o desenho não mudou com a medida");
    return true;
  });

  await passo("espessura vem da lista, e furo/R/R.anel saem da manilha", async () => {
    const r = JSON.parse(await rodar(`const ic = ICapp.atual();
      ic.olhal.modo = "fabricado"; ICapp.pintar();
      const t = document.querySelector('[data-olhal-campo="t"]');
      const g = ICapp.olhalDe(ic, ICapp.riggingDe(ic)).geom;
      const mn = ICapp.riggingDe(ic).manilha.manilha;
      return JSON.stringify({tipoT: t.tagName, opcoes: t.options ? t.options.length : 0,
        temPolegada: t.options ? [...t.options].some(o => o.textContent.includes('"')) : false,
        semCampoFuro: !document.querySelector('[data-olhal-campo="dFuro"]'),
        semCampoR: !document.querySelector('[data-olhal-campo="R"]'),
        semCampoAnel: !document.querySelector('[data-olhal-campo="rAnel"]'),
        dFuro: g.dFuro, R: g.R, rAnel: g.rAnel,
        esperadoFuro: Math.round((mn.b + 1.15) * 100) / 100,
        esperadoR: Math.round((mn.f - mn.g + mn.b / 2 + 5) * 10) / 10});`));
    if (r.tipoT !== "SELECT") throw new Error("a espessura continua campo livre: " + r.tipoT);
    if (r.opcoes < 10) throw new Error("lista de chapas curta: " + r.opcoes);
    if (!r.temPolegada) throw new Error("a lista não traz as bitolas em polegada");
    if (!r.semCampoFuro || !r.semCampoR || !r.semCampoAnel)
      throw new Error("furo, R ou R.anel ainda têm campo para digitar");
    if (Math.abs(r.dFuro - r.esperadoFuro) > 0.02) throw new Error(`Ø furo ${r.dFuro} × ${r.esperadoFuro}`);
    if (Math.abs(r.R - r.esperadoR) > 0.2) throw new Error(`R ${r.R} × ${r.esperadoR}`);
    if (r.rAnel !== r.R) throw new Error(`R.anel ${r.rAnel} não acompanha R ${r.R}`);
    return true;
  });

  await passo("Fy vem do aço escolhido", async () => {
    const r = JSON.parse(await rodar(`const sel = document.getElementById("ic-olhal-aco");
      const fy = document.getElementById("ic-olhal-fy");
      const antes = {aco: sel.value, fy: Number(fy.value), travado: fy.disabled};
      sel.value = "A36"; sel.dispatchEvent(new Event("change",{bubbles:true}));
      return JSON.stringify(antes);`));
    if (!r.travado) throw new Error("o Fy continua aceitando digitação com aço da lista");
    await esperar(400);
    const d = JSON.parse(await rodar(`const ic = ICapp.atual();
      const v = ICapp.olhalDe(ic, ICapp.riggingDe(ic)).verif;
      return JSON.stringify({fyCampo: Number(document.getElementById("ic-olhal-fy").value),
        admissivel: v.checks[0].admissivel});`));
    if (d.fyCampo !== 250) throw new Error("trocar para A36 não trouxe Fy 250: " + d.fyCampo);
    if (Math.abs(d.admissivel - 0.9 * 250) > 0.5)
      throw new Error("a verificação não usou o Fy do aço: " + d.admissivel);
    return true;
  });

  await passo("figura da manilha e do encaixe aparecem", async () => {
    const r = JSON.parse(await rodar(`return JSON.stringify({
      manilha: (document.querySelector("#resultado-sapatilho-manilha svg")||{}).outerHTML ? true : false,
      encaixe: !!document.querySelector("#fig-encaixe svg"),
      quadros: document.querySelectorAll("#fig-encaixe svg g").length,
      casos: document.querySelectorAll("#tab-encaixe tbody tr").length});`));
    if (!r.encaixe) throw new Error("faltou a figura do encaixe");
    if (r.quadros < r.casos) throw new Error(`figura com ${r.quadros} quadros para ${r.casos} casos`);
    return true;
  });

  await passo("lista de material sai em Excel", async () => {
    const r = JSON.parse(await rodar(`const itens = ICapp.material();
      const bytes = IC.xlsx.build({name:"Lista de material", cols:[6,7,24,62,30,12],
        head:["Item","Qtd.","Título","Especificação","Material","Massa (kg)"],
        rows: itens.map((it,i)=>[i+1, it.qtd, it.titulo, it.especificacao, it.material,
          it.massa == null ? "-" : Math.round(it.massa*100)/100]), title:["teste"]});
      return JSON.stringify({bytes: bytes.length, pk: bytes[0] === 80 && bytes[1] === 75, itens: itens.length});`));
    if (!r.pk) throw new Error("o arquivo não começa com PK (não é um .xlsx)");
    if (r.bytes < 1500) throw new Error("arquivo pequeno demais: " + r.bytes);
    if (!r.itens) throw new Error("lista vazia");
    return true;
  });

  await passo("adiciona um segundo içamento", async () => {
    await rodar(`document.querySelector("[data-novo]").click();`);
    await esperar(600);
    const n = await rodar(`return ICapp.estudo.icamentos.length`);
    if (n !== 2) throw new Error("içamentos: " + n);
    await foto("ic_dois_icamentos");
    return true;
  });

  await passo("lixeira da aba exclui o içamento", async () => {
    const antes = await rodar(`return ICapp.estudo.icamentos.length`);
    if (antes < 2) throw new Error("precisa de dois içamentos para testar");
    const temLixo = await rodar(`return document.querySelectorAll("#abas [data-remover]").length`);
    if (temLixo !== antes) throw new Error(`lixeiras: ${temLixo} para ${antes} içamentos`);
    await rodar(`window.confirm = () => true; document.querySelector("#abas [data-remover]").click();`);
    await esperar(400);
    const depois = await rodar(`return ICapp.estudo.icamentos.length`);
    if (depois !== antes - 1) throw new Error("não excluiu: " + depois);
    // com um só, a lixeira some
    const sobrou = await rodar(`return document.querySelectorAll("#abas [data-remover]").length`);
    if (depois === 1 && sobrou !== 0) throw new Error("a lixeira ficou com um içamento só");
    return true;
  });

  await passo("digitar a unidade junto converte o valor", async () => {
    const por = async (campo, texto) => {
      await rodar(`const e = document.getElementById("ic-massa"); e.value = ${JSON.stringify(texto)};
        e.dispatchEvent(new Event("change",{bubbles:true}));`);
      await esperar(350);
      return Number(await rodar(`return ICapp.atual().massa`));
    };
    await rodar(`document.getElementById("un-massa").value = "kg";
      document.getElementById("un-massa").dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(300);
    const t5 = await por("massa", "5t");
    if (Math.abs(t5 - 5000) > 0.5) throw new Error(`"5t" com kg selecionado virou ${t5} kg`);
    const kg800 = await por("massa", "800");
    if (Math.abs(kg800 - 800) > 0.5) throw new Error(`"800" sem unidade virou ${kg800} kg`);
    const kn = await por("massa", "49,03 kN");
    if (Math.abs(kn - 5000) > 20) throw new Error(`"49,03 kN" virou ${kn} kg`);
    // o campo é reescrito na unidade escolhida
    const naTela = await rodar(`return document.getElementById("ic-massa").value`);
    if (!/^5\d{3}/.test(String(naTela).replace(/\D/g, "").slice(0, 4)))
      throw new Error("o campo não voltou em kg: " + naTela);
    // medida: 2,5 m num campo em mm
    await rodar(`const e = document.querySelector('[data-medida]'); e.value = "2,5 m";
      e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(350);
    const med = JSON.parse(await rodar(`const ic = ICapp.atual();
      const k = document.querySelector('[data-medida]').dataset.medida;
      return JSON.stringify({k, v: ic.medidas[k]});`));
    if (Math.abs(med.v - 2500) > 1) throw new Error(`"2,5 m" virou ${med.v} mm`);
    await por("massa", "5000");
    return true;
  });

  await passo("cada caixa esconde o seu próprio cálculo", async () => {
    // com o botão geral escondendo tudo (o padrão), o fx ainda tem que mostrar o cálculo
    await rodar(`if (!document.body.classList.contains("sem-memorial")) document.getElementById("bt-memorial").click();`);
    await esperar(300);
    const est = async () => JSON.parse(await rodar(`const sec = document.querySelector('.etapa[data-etapa="8"]');
      const bm = sec.querySelector("[data-dobra-mem]");
      const f = sec.querySelector(".formulas");
      return JSON.stringify({temBotao: !!bm, oculto: sec.classList.contains("sem-calculo"),
        visivel: f ? getComputedStyle(f).display !== "none" : null,
        outra: (() => { const o = document.querySelector('.etapa[data-etapa="5"] .formulas');
          return o ? getComputedStyle(o).display !== "none" : null; })()});`));
    const a = await est();
    if (!a.temBotao) throw new Error("a caixa do olhal não ganhou o botão do cálculo");
    if (a.visivel) throw new Error("com o botão geral desligado, o cálculo deveria estar oculto");
    // primeiro clique: mostra só o desta caixa
    await rodar(`document.querySelector('.etapa[data-etapa="8"] [data-dobra-mem]').click();`);
    await esperar(300);
    const b = await est();
    if (!b.visivel) throw new Error("o fx não mostrou o cálculo (era o defeito relatado)");
    if (b.outra) throw new Error("mostrou o cálculo das outras caixas também");
    // segundo clique: esconde de novo
    await rodar(`document.querySelector('.etapa[data-etapa="8"] [data-dobra-mem]').click();`);
    await esperar(300);
    if ((await est()).visivel) throw new Error("o cálculo não voltou a sumir");
    return true;
  });

  await passo("botão de portfólio fica na barra, sem faixa reservada", async () => {
    const r = JSON.parse(await rodar(`const b = document.getElementById("mr-portfolio-btn");
      if (!b) return JSON.stringify({falta:true});
      const c = b.getBoundingClientRect();
      // o botão agora mora dentro da barra: ele e o que está dentro dele não contam
      const bate = [...document.querySelectorAll(".topo *, .abas *")].filter(el => {
        // fora da conta: o próprio botão, o que está dentro dele e quem o contém
        if (el === b || b.contains(el) || el.contains(b)) return false;
        return true;
      }).filter(el => {
        const e = el.getBoundingClientRect();
        return e.width && e.height &&
          !(e.right <= c.left || e.left >= c.right || e.bottom <= c.top || e.top >= c.bottom);
      });
      const topo = document.querySelector(".topo").getBoundingClientRect();
      return JSON.stringify({falta:false, sobrepoe: bate.length,
        naBarra: !!b.closest(".topo__acoes"),
        folgaDireita: Math.round(topo.right - c.right),
        quem: bate.slice(0,3).map(e => e.id || e.className || e.tagName)});`));
    if (r.falta) throw new Error("o botão de portfólio não está na página");
    if (r.sobrepoe) throw new Error("o botão cobre: " + r.quem.join(", "));
    if (!r.naBarra) throw new Error("o botão não está dentro da barra de ações");
    if (r.folgaDireita > 40) throw new Error("sobrou faixa vazia à direita: " + r.folgaDireita + "px");
    return true;
  });

  ws.close(); chrome.kill();
  console.log("ok:", ok.length);
  ok.forEach(x => console.log("  ✓", x));
  if (falhas.length) { console.log("FALHAS:"); falhas.forEach(x => console.log("  ✗", x)); }
  const erros = logs.filter(l => !/favicon|DevTools/i.test(l));
  if (erros.length) { console.log("ERROS DE CONSOLE:"); erros.slice(0, 8).forEach(l => console.log("  !", l)); }
  process.exit(falhas.length || erros.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
