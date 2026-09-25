import { useEffect } from 'react'
import styles from './ServerRoom.css?raw'
import { Scene } from './scene/Scene'
import { TopBar } from './ui/TopBar'
import { HealthPanel } from './ui/HealthPanel'
import { Inspector } from './ui/Inspector'
import { ConfirmBar, HelpHint, PendingBanner, Toast, Tooltip } from './ui/Overlay'
import { useDerived, useSim, useUI } from './store'

// Dev-only handle for poking at state from the console. Never shipped.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__serverRoom = { useSim, useUI, useDerived }
}

export function ServerRoom() {
  // Simulation clock: UPS battery drain / recharge. Only runs while the page is open.
  useEffect(() => {
    const id = setInterval(() => {
      const mode = useDerived.getState().d.ups.mode
      useSim.getState().tick(1, mode)
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="srv">
      <style>{styles}</style>
      <div className="srv-stage">
        <Scene />
      </div>
      <TopBar />
      <HealthPanel />
      <Inspector />
      <PendingBanner />
      <ConfirmBar />
      <Toast />
      <HelpHint />
      <Tooltip />
    </div>
  )
}
