/**
 * Metry se drží na milimetru a stupně na celém čísle. Bez toho by tažení myší
 * plnilo JSON hodnotami typu 4.300000000000001 a každý diff projektu by
 * vypadal jako změna obsahu.
 */
export function roundM(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function roundDeg(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}
