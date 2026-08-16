/**
 * Čtyři řezy, které tištěný box používá (R1). Rodina a váha jsou opsané z CSS
 * v `src/infra/pdf/styles.ts`: nadpis `.stageplanBoxHeader` je 700, řádek role
 * `.stageplanBoxRole` je mono 400, odrážka dědí 400 a napájení
 * `.stageplanPower` je 600.
 *
 * Skript, ne doména: doména drží naměřená čísla, tenhle soubor jen říká, co se
 * měřilo. Když se změní CSS, změní se nejdřív tady a pak se přegeneruje.
 */
export type PrintTextStyleSpec = {
  readonly name: "boxHeader" | "boxRole" | "boxBody" | "boxPower";
  readonly fontFamily: string;
  readonly fontWeight: number;
};

export const PRINT_TEXT_STYLE_SPECS: readonly PrintTextStyleSpec[] = [
  { name: "boxHeader", fontFamily: "Space Grotesk", fontWeight: 700 },
  { name: "boxRole", fontFamily: "IBM Plex Mono", fontWeight: 400 },
  { name: "boxBody", fontFamily: "Space Grotesk", fontWeight: 400 },
  { name: "boxPower", fontFamily: "Space Grotesk", fontWeight: 600 },
];
