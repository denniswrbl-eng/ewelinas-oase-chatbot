/**
 * Client-Registry
 *
 * Aggregiert alle Client-Configs in ein zentrales Dict, das chat.js importiert.
 *
 * Neue Kunden hinzufuegen:
 *  1. Neue Datei `./mein-kunde.js` mit `export default { ... }` anlegen
 *  2. Hier unten importieren und im CLIENTS-Objekt eintragen
 *
 * Default-Client: wird zurueckgegeben wenn kein clientId im Request,
 * oder wenn der uebergebene clientId nicht existiert (backward-compatible).
 */

import ewelinasOase from "./ewelinas-oase.js";

export const CLIENTS = {
  "ewelinas-oase": ewelinasOase,
  // Weitere Kunden hier ergaenzen:
  // "creative-look-hamm": creativeLookHamm,
};

export const DEFAULT_CLIENT_ID = "ewelinas-oase";

/**
 * Loest clientId zu einer Config auf. Bei unbekannter/fehlender ID
 * wird auf den Default-Client zurueckgefallen.
 *
 * @param {string|undefined} clientId
 * @returns {{ id: string, config: object }}
 */
export function resolveClient(clientId) {
  const id = clientId && CLIENTS[clientId] ? clientId : DEFAULT_CLIENT_ID;
  return { id, config: CLIENTS[id] };
}
