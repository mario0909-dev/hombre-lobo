import { useState } from 'react'
import type { RoleId } from '../game'
import { CardModal } from './components'

/** Abre una carta en grande desde cualquier lista. Hay que pintar `modal` en la pantalla. */
export function useCardModal() {
  const [open, setOpen] = useState<{ id: RoleId; playerName?: string } | null>(null)
  const modal = open ? <CardModal id={open.id} playerName={open.playerName} onClose={() => setOpen(null)} /> : null
  return { show: (id: RoleId, playerName?: string) => setOpen({ id, playerName }), modal }
}
