/*
 * Aços estruturais usuais para a chapa do olhal, com a tensão de escoamento (Fy) de cada um.
 *
 * `fy` em MPa é o valor mínimo especificado para a faixa de espessura comum em olhal (até
 * ~40 mm). Chapa grossa costuma ter Fy menor nas faixas mais espessas — conferir o certificado
 * do material quando a chapa passar disso.
 *
 * `fu` (ruptura) fica registrado por ser o que as verificações de solda pedem, embora a
 * verificação de solda não seja feita automaticamente aqui.
 */
window.IC = window.IC || {};

IC.acos = {
  fonte: "valores mínimos especificados nas normas de cada aço",
  lista: [
    { id: "A36",      nome: "ASTM A36",                 fy: 250, fu: 400 },
    { id: "A131AB",   nome: "ASTM A131 Gr. A/B/D/E",    fy: 235, fu: 400 },
    { id: "A131AH36", nome: "ASTM A131 Gr. AH36/DH36/EH36", fy: 355, fu: 490 },
    { id: "A572G50",  nome: "ASTM A572 Gr. 50",         fy: 345, fu: 450 },
    { id: "A588",     nome: "ASTM A588 (aclimável)",    fy: 345, fu: 485 },
    { id: "A516G70",  nome: "ASTM A516 Gr. 70",         fy: 260, fu: 485 },
    { id: "S235",     nome: "EN S235",                  fy: 235, fu: 360 },
    { id: "S275",     nome: "EN S275",                  fy: 275, fu: 430 },
    { id: "S355",     nome: "EN S355",                  fy: 355, fu: 490 },
    { id: "outro",    nome: "outro — informar o Fy",    fy: null, fu: null }
  ],

  /** o aço pelo identificador; devolve o primeiro da lista se não achar */
  de(id) {
    return this.lista.find(a => a.id === id) || this.lista[0];
  }
};
