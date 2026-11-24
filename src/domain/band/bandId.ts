import { toIdSlug } from "../ids/slug.js";

/**
 * R4: id kapely je slug jejího názvu. Vzniká jednou při založení a dál se
 * nemění ani při přejmenování, protože projekty na kapelu odkazují přes
 * `bandRef`.
 */
export function deriveBandId(name: string): string {
  return toIdSlug(name);
}
