/* Formatação numérica (pt-BR, vírgula decimal) e utilidades de texto. */
window.IC = window.IC || {};

IC.fmt = {
  /** número com até `dec` casas, sem zeros à direita */
  num(v, dec = 2) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
    const r = Math.round(Number(v) * 10 ** dec) / 10 ** dec;
    let s = r.toFixed(dec);
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s.replace(".", ",");
  },
  mm(v) { return `${this.num(v, 0)} mm`; },
  kn(v) { return `${this.num(v, 1)} kN`; },
  ton(v) { return `${this.num(v, 2)} t`; },
  grau(v) { return `${this.num(v, 1)}°`; },
  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  /**
   * Escapa e escreve `X_sub` como X com "sub" em subscrito (ex.: "F_pino" → F com pino
   * embaixo), do jeito que o memorial de referência mostra as variáveis — sem depender de
   * nenhuma biblioteca de matemática, só HTML.
   */
  mat(s) {
    return this.esc(s).replace(/([A-Za-zΔλχδπσβθγη])_([A-Za-z0-9,²³.]+)/g, "$1<sub>$2</sub>");
  },
  /** data de hoje, dd/mm/aaaa */
  hoje() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
};
