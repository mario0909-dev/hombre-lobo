import type { RoleId } from '../game'

/**
 * Imagen de la carta de cada personaje. Para usar fotos propias, basta con sustituir
 * los archivos de `public/cartas/` (o cambiar aquí la extensión si son .jpg/.png).
 */
export function cardSrc(id: RoleId): string {
  return `${import.meta.env.BASE_URL}cartas/${id}.svg`
}

/** "A", "A y B", "A, B y C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}
