/**
 * Co? Klíč, pod kterým `BandSetupData.musicianDefaults` drží defaultní
 * preset jednoho muzikanta pro jednu roli.
 *
 * Proč samostatná funkce? Sdílí ji čtení (`resolveMusicianDefaultPreset`) i
 * zápis po `Save as musician default` (R5, Task 12b) — obě strany musí sáhnout
 * pod stejný klíč, jinak by panel po uložení ukazoval starou odchylku, dokud
 * by se stránka znovu nenačetla.
 */
export function musicianDefaultsKey(musicianId: string, role: string): string {
  return `${musicianId}:${role}`;
}
