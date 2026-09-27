/*
 * Espessuras comerciais de chapa grossa, para a chapa do olhal.
 *
 * Duas famílias convivem no mercado brasileiro e nas listas de material de obra:
 *   · em polegada, por fração (3/16", 1/4", 3/8"…) — o valor em mm é a fração × 25,4
 *   · em milímetro, da série métrica (8, 12,5, 16, 19, 25…)
 *
 * A lista é ordenada pela espessura em mm. `mm` é o valor exato usado no cálculo (a fração
 * em polegada não arredonda: 1/4" é 6,35 mm, não 6 mm) e `rotulo` é como a chapa é pedida.
 *
 * Conferir a disponibilidade com o fornecedor: nem toda espessura desta lista é de pronta
 * entrega, e material de obra costuma seguir o que já existe no estoque.
 */
window.IC = window.IC || {};

IC.chapas = (function () {
  const pol = (num, den) => ({ mm: Math.round((num / den) * 25.4 * 100) / 100, rotulo: `${num}/${den}"` });
  const mm = v => ({ mm: v, rotulo: `${String(v).replace(".", ",")} mm` });

  const lista = [
    pol(3, 16), mm(6.3), pol(1, 4), mm(8), pol(5, 16), mm(9.5), pol(3, 8), mm(12.5),
    pol(1, 2), mm(16), pol(5, 8), mm(19), pol(3, 4), mm(22.4), pol(7, 8), mm(25),
    pol(1, 1), mm(31.5), pol(5, 4), mm(38), pol(3, 2), mm(44.5), pol(7, 4), mm(50),
    pol(2, 1), mm(63), pol(5, 2), mm(75), pol(3, 1), mm(100)
  ].sort((a, b) => a.mm - b.mm);

  // rótulo completo: a polegada leva o mm junto, como nas listas de material
  lista.forEach(c => {
    c.texto = c.rotulo.endsWith('"') ? `${c.rotulo} (${String(c.mm).replace(".", ",")} mm)` : c.rotulo;
  });

  /** a espessura comercial mais próxima de um valor em mm, nunca menor que ele */
  function acima(valorMm) {
    const v = Number(valorMm) || 0;
    return lista.find(c => c.mm >= v - 0.01) || lista[lista.length - 1];
  }

  /** a entrada da lista que corresponde a esta espessura, se houver */
  function daEspessura(valorMm) {
    const v = Number(valorMm) || 0;
    return lista.find(c => Math.abs(c.mm - v) < 0.01) || null;
  }

  return { lista, acima, daEspessura };
})();
