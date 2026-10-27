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
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
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
    if (n !== 5) throw new Error("desenhos nos cartões: " + n);
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

  for (const [tipo, pernas] of [["uma", 1], ["duas", 2], ["pilar", 2], ["quatroDif", 4], ["quatroSim", 4]]) {
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

  await passo("linga única: perna vertical com o peso inteiro e sem campo de ângulo", async () => {
    await rodar(`document.querySelector('[data-tipo="uma"]').click();`);
    await esperar(400);
    await rodar(`const e=document.querySelector('[data-medida="L"]'); e.value="3000"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const r = JSON.parse(await rodar(`const ic = ICapp.atual(), r = ICapp.resolver(ic); return JSON.stringify({
      ang: r.pernas[0].angulo, T: r.pernas[0].tracao, gancho: r.cargaGanchoKN, skl: r.fatores.skl,
      L: r.pernas[0].comprimento, campoAng: document.getElementById("ic-angulo").closest(".campo").style.display,
      avisos: r.avisos, fig: document.getElementById("fig-medidas").innerText })`));
    if (Math.abs(r.ang) > 1e-9) throw new Error("perna devia ser vertical, ângulo " + r.ang);
    if (Math.abs(r.T - r.gancho) > 1e-9) throw new Error("tração devia ser a carga no gancho");
    if (r.skl !== 1) throw new Error("linga única não leva SKL, veio " + r.skl);
    if (Math.abs(r.L - 3000) > 1e-6) throw new Error("comprimento devia ser 3000, deu " + r.L);
    if (r.campoAng !== "none") throw new Error("o campo de ângulo devia sumir");
    if (r.avisos.length) throw new Error("avisos inesperados: " + r.avisos.join(" | "));
    if (!/UMA LINGA/.test(r.fig)) throw new Error("figura das medidas não é a da linga única");
    await foto("ic_uma_linga");
    return true;
  });

  await passo("estrutura inclinada: pontos giram com a peça e o olhal usa o ângulo real", async () => {
    await rodar(`document.querySelector('[data-tipo="duas"]').click();`);
    await esperar(400);
    const pontos = () => rodar(`return JSON.stringify(ICapp.pontosDe(ICapp.atual()).map(p => [p.x, p.y, p.z].map(v => Math.round(v))))`);
    const reto = await pontos();
    const mudar = (sel, v) => rodar(`const e=document.querySelector('${sel}'); e.value="${v}"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    const opcoes = await rodar(`return [...document.getElementById("ic-inclinada").options].map(o => o.value).join(",")`);
    if (opcoes !== "horizontal,inclinada,dobrada") throw new Error("opções da estrutura: " + opcoes);
    await mudar("#ic-inclinada", "inclinada"); await esperar(400);
    // peça reta inclinada a 30°: cada furo por x (horizontal) e y (altura), a partir do CG
    await mudar('[data-incl="phi"]', "30"); await esperar(300);
    const camposI = await rodar(`return [...document.querySelectorAll("[data-medida]")].map(e => e.dataset.medida).join(",")`);
    if (camposI !== "a1,a2,z1,z2") throw new Error("medidas da peça inclinada (x₁, x₂, y₁, y₂): " + camposI);
    await mudar('[data-medida="a1"]', "1000"); await esperar(300);
    await mudar('[data-medida="a2"]', "1200"); await esperar(300);
    await mudar('[data-medida="z1"]', "-577"); await esperar(300);
    await mudar('[data-medida="z2"]', "693"); await esperar(400);
    const r = JSON.parse(await rodar(`const ic = ICapp.atual(); ic.olhal.modo = "fabricado"; ICapp.pintar();
      const r = ICapp.resolver(ic), P = ICapp.pontosDe(ic), ang = ICapp.angulosOlhal(ic, r);
      const o = ICapp.olhalDe(ic, ICapp.riggingDe(ic)), m = ic.medidas;
      const util = x => Math.max(...x.verif.checks.map(c => c.utilizacao));
      return JSON.stringify({ P, G: r.gancho, ang, gov: o.governante.nome,
        piorGov: util(o.porPerna.find(x => x.perna.nome === o.governante.nome)),
        piorTodas: Math.max(...o.porPerna.map(util)), fig: document.getElementById("fig-medidas").innerText,
        tela: document.getElementById("resultado-olhal").innerText, campos: document.querySelectorAll("[data-incl]").length })`));
    if (r.campos !== 1) throw new Error("campos de ângulo da peça reta (só φ): " + r.campos);
    const f = 30 * Math.PI / 180, n = [-Math.sin(f), 0, Math.cos(f)];
    const pI = r.P.map(p => [p.x, p.y, p.z]);
    if (JSON.stringify(pI) !== JSON.stringify([[-1000, 0, -577], [1200, 0, 693]])) throw new Error("inclinada: pontos " + JSON.stringify(pI));
    if (!(r.P[1].z > r.P[0].z)) throw new Error("P2 devia ficar acima de P1");
    // eixo do olhal: em pé sobre a peça nos dois pontos (→ n); ângulo com a linga conferido à mão
    const eixos = [n, n];
    r.ang.forEach((a, i) => {
      const d = [r.G[0] - r.P[i].x, r.G[1] - r.P[i].y, r.G[2] - r.P[i].z], L = Math.hypot(...d);
      const esperado = Math.acos(d.reduce((s, v, k) => s + v * eixos[i][k], 0) / L) * 180 / Math.PI;
      if (Math.abs(a.eixo - esperado) > 1e-6) throw new Error(`ângulo do olhal P${i + 1}: ${a.eixo} ≠ ${esperado}`);
      if (Math.abs(a.base - (90 - esperado)) > 1e-6) throw new Error("θ com a base devia ser 90° − ângulo com o eixo");
    });
    if (Math.abs(r.piorGov - r.piorTodas) > 1e-9) throw new Error("o olhal governante devia ser o de maior utilização");
    if (!/ESTRUTURA INCLINADA/.test(r.fig)) throw new Error("figura das medidas não é a da peça inclinada");
    if (!/eixo do olhal/.test(r.tela)) throw new Error("tela do olhal sem o ângulo com o eixo");
    await foto("ic_duas_inclinada");

    // peça em V: furos por x₁, x₂ (horizontal) e y₁, y₂ (alturas diferentes), φ só dá a direção dos trechos
    await mudar("#ic-inclinada", "dobrada"); await esperar(400);
    const camposV = await rodar(`return [document.querySelectorAll("[data-incl]").length, document.getElementById("fig-medidas").innerText,
      [...document.querySelectorAll("[data-medida]")].map(e => e.dataset.medida).join(",")]`);
    if (camposV[0] !== 2) throw new Error("campos de ângulo da peça em V (só φ₁ e φ₂): " + camposV[0]);
    if (camposV[2] !== "a1,a2,z1,z2") throw new Error("medidas da peça em V: " + camposV[2]);
    if (!/EM V/.test(camposV[1])) throw new Error("figura das medidas não é a da peça em V");
    await mudar('[data-incl="phi1"]', "37"); await esperar(300);
    await mudar('[data-incl="phi2"]', "29"); await esperar(300);
    await mudar('[data-medida="a1"]', "1400"); await esperar(300);
    await mudar('[data-medida="a2"]', "2000"); await esperar(300);
    await mudar('[data-medida="z1"]', "900"); await esperar(300);
    await mudar('[data-medida="z2"]', "700"); await esperar(400);
    const v = JSON.parse(await rodar(`const ic = ICapp.atual(), r = ICapp.resolver(ic);
      return JSON.stringify({ P: ICapp.pontosDe(ic), eixos: ICapp.eixosOlhalDe(ic), peca: r.peca, avisos: r.avisos,
        d3: document.getElementById("fig-3d-medidas").innerHTML.length })`));
    const pv = v.P.map(p => [p.x, p.y, p.z]);
    if (JSON.stringify(pv) !== JSON.stringify([[-1400, 0, 900], [2000, 0, 700]])) throw new Error("V: pontos " + JSON.stringify(pv));
    const rad = g => g * Math.PI / 180;
    const nV = [[Math.sin(rad(37)), 0, Math.cos(rad(37))], [-Math.sin(rad(29)), 0, Math.cos(rad(29))]];
    // olhal em pé sobre cada trecho: eixo = normal do trecho
    v.eixos.forEach((e, i) => { if (Math.hypot(...e.map((c, k) => c - nV[i][k])) > 1e-9) throw new Error(`V: eixo do olhal P${i + 1} devia ser a normal do trecho`); });
    // a dobra sai do cruzamento dos trechos que passam pelos furos
    const w = [[-Math.cos(rad(37)), 0, Math.sin(rad(37))], [Math.cos(rad(29)), 0, Math.sin(rad(29))]];
    [0, 1].forEach(i => {
      const q = w[i].map((c, k) => v.peca.dobra[k] + c * v.peca.a[i]);
      if (Math.hypot(...q.map((x, k) => x - pv[i][k])) > 0.01) throw new Error(`V: o trecho ${i + 1} não passa pelo furo`);
    });
    if (v.avisos.length) throw new Error("V: avisos inesperados " + v.avisos.join(" | "));
    // cada eslinga com a sua altura (furo ao gancho) e o seu comprimento
    const tabP = JSON.parse(await rodar(`const ic = ICapp.atual(), H = ICapp.alturaGancho(ic);
      return JSON.stringify({ H, linhas: [...document.querySelectorAll("#saida-pernas tbody tr")].map(tr => [...tr.cells].map(c => c.innerText)) })`));
    if (tabP.linhas.length !== 2) throw new Error("V: tabela das eslingas com " + tabP.linhas.length + " linhas");
    const num = s => Number(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    [[900, 1400], [700, 2000]].forEach(([z, a], i) => {
      const alt = tabP.H - z, L = Math.hypot(a, alt);
      if (Math.abs(num(tabP.linhas[i][1]) - alt) > 1) throw new Error(`V: altura da eslinga P${i + 1} ${tabP.linhas[i][1]}, esperado ${alt}`);
      if (Math.abs(num(tabP.linhas[i][3]) - L) > 1) throw new Error(`V: comprimento da eslinga P${i + 1} ${tabP.linhas[i][3]}, esperado ${L}`);
    });
    if (!/esquerda/.test(tabP.linhas[0][0]) || !/direita/.test(tabP.linhas[1][0])) throw new Error("V: lados das eslingas");
    if (!(v.d3 > 0)) throw new Error("V: desenho 3D vazio");
    await rodar(`document.getElementById("fig-3d-medidas").scrollIntoView()`); await esperar(200);
    await foto("ic_duas_v");
    await rodar(`window.scrollTo(0, 0)`);

    // a₁ e a₂ são as mesmas medidas da horizontal (da vertical do CG ao ponto): volta os valores de antes
    const r0 = JSON.parse(reto);
    await mudar('[data-medida="a1"]', String(Math.abs(r0[0][0]))); await esperar(300);
    await mudar('[data-medida="a2"]', String(Math.abs(r0[1][0]))); await esperar(300);
    await mudar("#ic-inclinada", "horizontal"); await esperar(400);
    if ((await pontos()) !== reto) throw new Error("desmarcar a inclinação devia voltar aos mesmos pontos");
    return true;
  });

  await passo("pilar: olhal na horizontal, θ com a base é o ângulo da perna com a vertical", async () => {
    await rodar(`document.querySelector('[data-tipo="pilar"]').click();`);
    await esperar(400);
    await rodar(`const e=document.getElementById("ic-angulo"); e.value="60"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(400);
    const r = JSON.parse(await rodar(`const ic = ICapp.atual(), r = ICapp.resolver(ic); return JSON.stringify({
      pontos: ICapp.pontosDe(ic).map(p => [p.x, p.y, p.z]), eixos: ICapp.eixosOlhalDe(ic),
      angs: ICapp.angulosOlhal(ic, r), T: r.pernas.map(p => p.tracao), W: r.pesoProjKN, skl: r.fatores.skl,
      rot: document.getElementById("ic-angulo").previousElementSibling.textContent,
      fig: document.getElementById("fig-medidas").innerText, cab: document.querySelector("#tab-cargas thead").innerText })`));
    if (JSON.stringify(r.pontos) !== JSON.stringify([[-400, 0, 3000], [400, 0, 3000]])) throw new Error("pontos: " + JSON.stringify(r.pontos));
    if (JSON.stringify(r.eixos) !== JSON.stringify([[-1, 0, 0], [1, 0, 0]])) throw new Error("eixos do olhal: " + JSON.stringify(r.eixos));
    r.angs.forEach(a => { if (Math.abs(a.eixo - 60) > 1e-6 || Math.abs(a.base - 30) > 1e-6) throw new Error("ângulo no olhal: " + JSON.stringify(a)); });
    const esperado = r.W / 2 / Math.sin(Math.PI / 3);   // duas pernas: sem SKL
    r.T.forEach(t => { if (Math.abs(t - esperado) > 1e-6) throw new Error(`tração ${t}, esperado ${esperado}`); });
    if (!/horizontal/.test(r.rot)) throw new Error("rótulo do ângulo: " + r.rot);
    if (!/PILAR/.test(r.fig)) throw new Error("figura das medidas não é a do pilar");
    if (!/horizontal/i.test(r.cab)) throw new Error("cabeçalho da tabela: " + r.cab);
    await foto("ic_pilar");
    return true;
  });

  await passo("olhal em pé: θ das fórmulas é o ângulo da linga com a horizontal", async () => {
    await rodar(`document.querySelector('[data-tipo="quatroSim"]').click();`);
    await esperar(400);
    const r = JSON.parse(await rodar(`const ic = ICapp.atual(), r = ICapp.resolver(ic);
      return JSON.stringify({ ang: ICapp.angulosOlhal(ic, r), beta: r.pernas.map(p => p.angulo) })`));
    r.ang.forEach((a, i) => {
      if (Math.abs(a.base - (90 - r.beta[i])) > 1e-6) throw new Error(`perna ${i + 1}: θ ${a.base} ≠ 90 − β ${90 - r.beta[i]}`);
    });
    return true;
  });

  await passo("espessura da chapa do olhal troca a manilha automática", async () => {
    await rodar(`document.querySelector('[data-tipo="quatroSim"]').click();`);
    await esperar(400);
    const codigo = () => rodar(`return ICapp.riggingDe(ICapp.atual()).manilha.manilha.codigo`);
    const bocaOk = () => rodar(`return ICapp.riggingDe(ICapp.atual()).manilha.chapa.ok`);
    const trocar = v => rodar(`const e=document.querySelector('[data-olhal-campo="t"]'); e.value="${v}"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    const opcoes = JSON.parse(await rodar(`return JSON.stringify([...document.querySelector('[data-olhal-campo="t"]').options].map(o => Number(o.value)))`));
    const antes = await codigo();
    if (!(await bocaOk())) throw new Error("a manilha inicial devia receber a chapa");
    // 38 mm: só fica justa numa manilha de boca entre 38 e 49,75 mm — não a de partida (boca 27)
    if (!opcoes.includes(38)) throw new Error("lista de chapas sem 38 mm");
    await trocar(38);
    await esperar(400);
    const depois = await codigo();
    if (depois === antes) throw new Error(`a manilha não mudou com a chapa mais grossa (${antes})`);
    if (!(await bocaOk())) throw new Error("a nova manilha devia receber a chapa mais grossa");
    const aviso = await rodar(`return document.getElementById("resultado-olhal").innerText`);
    if (!/boca da manilha/.test(aviso)) throw new Error("faltou a verificação da chapa na tela do olhal");
    await trocar(25);
    await esperar(400);
    return true;
  });

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

  await passo("o olhal é um só, dimensionado pela perna mais solicitada", async () => {
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
    if (vazio) throw new Error("campo em branco: " + vazio + " (campo vazio)");
    const antes = await rodar(`return document.querySelector("#fig-olhal svg").getAttribute("viewBox")`);
    await rodar(`const e = document.querySelector('[data-olhal-campo="base"]');
      e.value = String(Number(e.value.replace(",", ".")) * 2).replace(".", ","); e.dispatchEvent(new Event("change",{bubbles:true}));`);
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
    const r = JSON.parse(await rodar(`const enc = document.querySelector("#fig-encaixe svg");
      const txt = enc ? enc.textContent : "";
      return JSON.stringify({

        manilha: !!document.querySelector("#resultado-sapatilho-manilha svg"),
        encaixe: !!enc,
        vistas: ["1 —", "2 —", "3 —"].filter(t => txt.includes(t)).length,
        casos: document.querySelectorAll("#tab-encaixe tbody tr:not(.linha-formula)").length,
        temCabo: /cabo/i.test(txt)});`));
    if (!r.manilha) throw new Error("faltou a figura da manilha");
    if (!r.encaixe) throw new Error("faltou a figura do encaixe");
    if (r.vistas !== 3) throw new Error("a figura do encaixe não tem as três vistas: " + r.vistas);
    if (r.casos !== 4) throw new Error("casos na tabela: " + r.casos);
    if (!r.temCabo) throw new Error("a figura não menciona o cabo");
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

  await passo("peças do SolidWorks: eslinga e manilha com as propriedades da lista", async () => {
    const r = JSON.parse(await rodar(`return JSON.stringify(ICapp.pecasSolidworks());`));
    if (r.length !== 2) throw new Error("esperava 2 peças, veio " + r.length);
    const chaves = ["titlePT", "specPT", "material", "mass", "length", "area"];
    for (const p of r) {
      const falta = chaves.filter(k => !(k in p.props));
      if (falta.length) throw new Error(p.arquivo + ": faltam " + falta.join(", "));
      if (p.props.length !== "-" || p.props.area !== "-") throw new Error("length/area devem ser '-'");
      if (p.props.mass !== "-" && !/^\d+(\.\d+)?$/.test(p.props.mass)) throw new Error("massa fora do formato: " + p.props.mass);
    }
    const [esl, man] = r;
    if (!/^Eslinga \d pernas? \(CMT [\d,]+ ton\) com .*sapatilho.*Cabo de aço \((AACI|AF)\) Ø/.test(esl.props.specPT))
      throw new Error("especificação da eslinga: " + esl.props.specPT);
    if (esl.props.material !== "Aço liga") throw new Error("material da eslinga: " + esl.props.material);
    if (man.props.material !== "-") throw new Error("material da manilha: " + man.props.material);
    if (!/Green Pin .* ou similar \(CMT/.test(man.props.specPT)) throw new Error("especificação da manilha: " + man.props.specPT);
    console.log("      " + esl.props.titlePT + " | " + esl.props.specPT + " | " + esl.props.mass);
    console.log("      " + man.props.titlePT + " | " + man.props.specPT + " | " + man.props.mass);
    return true;
  });

  await passo("peças SolidWorks saem em .SLDPRT com as propriedades gravadas", async () => {
    const r = JSON.parse(await rodar(`return (async () => {
      const M = IC.sldprtModelo, out = [];
      for (const p of ICapp.pecasSolidworks()) {
        const arq = await IC.sldprt.gerar(p.props);
        const dv = new DataView(arq.buffer);
        const s = M.secoes.find(x => x.nome === "docProps/custom.xml");
        const comp = dv.getUint32(s.secao + 14, true), crc = dv.getUint32(s.secao + 10, true);
        const z = arq.slice(s.inicioDados, s.inicioDados + comp);
        const xml = await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
        const esc = v => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        out.push({ tam: arq.length, tamModelo: atob(M.arquivo).length,
          crcOk: IC.xlsx.crc32(new TextEncoder().encode(xml)) === crc && dv.getUint32(s.toc + 10, true) === crc,
          todas: Object.values(p.props).every(v => xml.includes(">" + esc(v) + "<")),
          semMarcador: !xml.includes("ZZtitlePTZZ") });
      }
      return JSON.stringify(out);
    })()`));
    if (r.length !== 2) throw new Error("esperava 2 peças");
    for (const x of r) {
      if (x.tam !== x.tamModelo) throw new Error("o arquivo mudou de tamanho — os blocos têm de ficar no lugar");
      if (!x.crcOk) throw new Error("crc do custom.xml não confere");
      if (!x.todas) throw new Error("alguma propriedade não foi gravada no custom.xml");
      if (!x.semMarcador) throw new Error("sobrou marcador do modelo");
    }
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

  await passo("usar a maior carga do estudo leva a mesma linga, manilha e olhal do de maior carga", async () => {
    const mudar = (sel, v) => rodar(`const e=document.querySelector('${sel}'); e.value="${v}"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    // o segundo (aberto) fica mais leve e passa a usar a carga do estudo
    await mudar("#ic-massa", "1000"); await esperar(300);
    await mudar("#ic-linga", "padrao"); await esperar(400);
    if (!(await rodar(`return !!document.getElementById("dica-linga")`))) throw new Error("faltou o aviso de que o conjunto vem do outro içamento");
    // no de maior carga: troca o tipo de manilha e a espessura do olhal
    await rodar(`document.querySelector('[data-aba="0"]').click();`); await esperar(400);
    const outroTipo = await rodar(`const ic = ICapp.estudo.icamentos[0];
      return Object.keys(IC.manilhas.tipos).find(k => k !== ic.manilhaTipo)`);
    await mudar("#ic-manilha-tipo", outroTipo); await esperar(400);
    await rodar(`ICapp.estudo.icamentos[0].olhal.modo = "fabricado"; ICapp.pintar();`); await esperar(300);
    await mudar('[data-olhal-campo="t"]', "38"); await esperar(400);
    const igual = () => rodar(`const [a, b] = ICapp.estudo.icamentos, ra = ICapp.riggingDe(a), rb = ICapp.riggingDe(b);
      return JSON.stringify({ tipo: [a.manilhaTipo, b.manilhaTipo], t: [a.olhal.geom.t, b.olhal.geom.t],
        modo: [a.olhal.modo, b.olhal.modo], linga: [ra.linga.diametro, rb.linga.diametro],
        manilha: [ra.manilha.manilha && ra.manilha.manilha.codigo, rb.manilha.manilha && rb.manilha.manilha.codigo] })`);
    let r = JSON.parse(await igual());
    Object.entries(r).forEach(([k, [a, b]]) => { if (a !== b) throw new Error(`${k} diferente: ${a} ≠ ${b}`); });
    if (r.tipo[0] !== outroTipo) throw new Error("o tipo de manilha não mudou no de maior carga");
    // mudar no que usa a carga do estudo muda lá também
    await rodar(`document.querySelector('[data-aba="1"]').click();`); await esperar(400);
    await mudar('[data-olhal-campo="t"]', "25"); await esperar(400);
    r = JSON.parse(await igual());
    if (r.t[0] !== 25 || r.t[1] !== 25) throw new Error("a espessura mudada no segundo devia ir para o de maior carga: " + r.t);
    // olhal fabricado: todas as medidas iguais, como a tela mostra
    const geoms = JSON.parse(await rodar(`const [a, b] = ICapp.estudo.icamentos;
      return JSON.stringify([a, b].map(x => ICapp.olhalDe(x, ICapp.riggingDe(x)).geom))`));
    Object.keys(geoms[0]).forEach(k => {
      if (geoms[0][k] !== geoms[1][k]) throw new Error(`olhal: ${k} diferente: ${geoms[0][k]} ≠ ${geoms[1][k]}`);
    });
    // olhal comprado: o mesmo modelo, escolhido pela maior carga do estudo
    await mudar("#ic-olhal-modo", "comprado"); await esperar(400);
    const comprados = JSON.parse(await rodar(`const [a, b] = ICapp.estudo.icamentos;
      return JSON.stringify([a, b].map(x => { const o = ICapp.olhalDe(x, ICapp.riggingDe(x)).resultado; return o.olhal && o.olhal.codigo; }))`));
    if (!comprados[0] || comprados[0] !== comprados[1]) throw new Error("olhal comprado diferente: " + comprados);
    await mudar("#ic-olhal-modo", "fabricado"); await esperar(400);
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
    // sem arredondar: 49,03 kN = 4999,67 kg, e é isso que o campo mostra
    if (Math.abs(Number(String(naTela).replace(",", ".")) - kn) > 0.01)
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

  await passo("os campos fazem conta: 20 + 30 vira 50", async () => {
    const medida = async texto => {
      await rodar(`const e = document.querySelector('[data-medida]'); e.value = ${JSON.stringify(texto)};
        e.dispatchEvent(new Event("change",{bubbles:true}));`);
      await esperar(350);
      return Number(await rodar(`const k = document.querySelector('[data-medida]').dataset.medida; return ICapp.atual().medidas[k]`));
    };
    const casos = [["20 + 30", 50], ["(1500 - 200) / 2", 650], ["2 x 350", 700], ["2 * 1,5 m", 3000],
      ["2 m + 300 mm", 2300], ["-100 + 40", -60], ["1000", 1000]];
    for (const [texto, esperado] of casos) {
      const v = await medida(texto);
      if (Math.abs(v - esperado) > 1e-6) throw new Error(`"${texto}" virou ${v}, esperado ${esperado}`);
    }
    // massa e ângulo também
    await rodar(`const e = document.getElementById("ic-massa"); e.value = "2 t + 500";
      e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(350);
    const m = Number(await rodar(`return ICapp.atual().massa`));
    if (Math.abs(m - 2500) > 1e-6) throw new Error(`"2 t + 500" virou ${m} kg`);
    await rodar(`const e = document.getElementById("ic-angulo"); e.value = "90 - 30";
      e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(350);
    const a = Number(await rodar(`return ICapp.atual().angulo`));
    if (Math.abs(a - 60) > 1e-6) throw new Error(`"90 - 30" virou ${a}°`);
    // o campo volta com o resultado
    const naTela = await rodar(`return document.getElementById("ic-angulo").value`);
    if (naTela !== "60") throw new Error("o campo do ângulo devia mostrar 60, mostra " + naTela);
    await rodar(`const e = document.getElementById("ic-massa"); e.value = "5000"; e.dispatchEvent(new Event("change",{bubbles:true}));`);
    await esperar(300);
    return true;
  });

  await passo("vírgula decimal em todos os campos, sem arredondar", async () => {
    const mudar = async (sel, v) => {
      await rodar(`const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)};
        e.dispatchEvent(new Event("change",{bubbles:true}));`);
      await esperar(350);
    };
    const r = async () => JSON.parse(await rodar(`const ic = ICapp.atual();
      const k = document.querySelector('[data-medida]').dataset.medida;
      return JSON.stringify({massa: ic.massa, ang: ic.angulo, med: ic.medidas[k],
        campoMassa: document.getElementById("ic-massa").value,
        campoAng: document.getElementById("ic-angulo").value,
        campoMed: document.querySelector('[data-medida]').value,
        fator: ic.fatores && ic.fatores.peso});`));
    await mudar("#ic-massa", "5432,75");
    await mudar("#ic-angulo", "57,5");
    await mudar("[data-medida]", "1234,56");
    await mudar('[data-fator="peso"]', "1,075");
    const v = await r();
    if (Math.abs(v.massa - 5432.75) > 1e-9) throw new Error("massa arredondada: " + v.massa);
    if (Math.abs(v.ang - 57.5) > 1e-9) throw new Error("ângulo arredondado: " + v.ang);
    if (Math.abs(v.med - 1234.56) > 1e-9) throw new Error("medida arredondada: " + v.med);
    if (Math.abs(v.fator - 1.075) > 1e-9) throw new Error("fator: " + v.fator);
    if (v.campoMassa !== "5432,75" || v.campoAng !== "57,5" || v.campoMed !== "1234,56")
      throw new Error("campo não voltou com vírgula: " + JSON.stringify(v));
    // ponto também vale como decimal, e "1.250,5" é milhar com vírgula
    await mudar("#ic-massa", "1.250,5");
    if (Math.abs((await r()).massa - 1250.5) > 1e-9) throw new Error("1.250,5 não virou 1250,5");
    await mudar("#ic-angulo", "45.25");
    if (Math.abs((await r()).ang - 45.25) > 1e-9) throw new Error("45.25 não virou 45,25");
    await mudar("#ic-massa", "5000"); await mudar("#ic-angulo", "60");
    await mudar("[data-medida]", "2500"); await mudar('[data-fator="peso"]', "1,03");
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

  await passo("relatório leva estudo, documento e responsável do cabeçalho", async () => {
    // digitando: a capa acompanha na hora
    await rodar(`[["est-nome","Estudo X"],["est-doc","DOC-001"],["est-resp","Eng. Fulano"]].forEach(([id,v]) => {
      const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); });`);
    let capa = await rodar(`return document.getElementById("capa").innerText`);
    for (const v of ["Estudo X", "DOC-001", "Eng. Fulano"])
      if (!capa.includes(v)) throw new Error(`a capa não trouxe "${v}" depois de digitar`);
    // valor preenchido sem evento (autopreenchimento do navegador): a impressão relê o cabeçalho
    await rodar(`document.getElementById("est-resp").value = "Eng. Beltrano"; window.dispatchEvent(new Event("beforeprint"));`);
    capa = await rodar(`return document.getElementById("capa").innerText`);
    if (!capa.includes("Eng. Beltrano")) throw new Error("a impressão não releu o responsável");
    return true;
  });

  await passo("quatro pernas mostram as duas hipóteses e a elástica × SKL é o padrão", async () => {
    const r = JSON.parse(await rodar(`return JSON.stringify({
      hip: document.getElementById("ic-hipotese").value,
      tab: document.getElementById("comparacao-hipoteses").innerText })`));
    if (r.hip !== "elastica") throw new Error("padrão devia ser elastica, veio " + r.hip);
    if (!/Elástica × SKL/.test(r.tab) || !/Pares diagonais/.test(r.tab)) throw new Error("faltou a comparação");
    return true;
  });

  if (SHOTS) {
    const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(SHOTS, "relatorio.pdf"), Buffer.from(pdf.result.data, "base64"));
  }

  ws.close(); chrome.kill();
  console.log("ok:", ok.length);
  ok.forEach(x => console.log("  ✓", x));
  if (falhas.length) { console.log("FALHAS:"); falhas.forEach(x => console.log("  ✗", x)); }
  const erros = logs.filter(l => !/favicon|DevTools/i.test(l));
  if (erros.length) { console.log("ERROS DE CONSOLE:"); erros.slice(0, 8).forEach(l => console.log("  !", l)); }
  process.exit(falhas.length || erros.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
