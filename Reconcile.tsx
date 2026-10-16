import { useState } from "react"
import { createPortal } from "react-dom"
import Reconciliation from "./uc03/Reconciliation"
import uc03Styles from "./uc03/uc03-isolated.css?inline"

/**
 * Replace only UC03: other four pages keep the original App, store and CSS.
 * Shadow DOM prevents Luân’s global .card/.sidebar/.button/.table rules
 * from changing the other UC interfaces. UC03 uses its own demo fixtures
 * under a namespaced localStorage key; production data bridging is not present.
 */
export default function Reconcile(_props: { s?: unknown; notify?: unknown }) {
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null)
  return (
    <div
      className="uc03-shadow-host"
      ref={(node) => {
        if (!node || shadowRoot) return
        setShadowRoot(node.shadowRoot || node.attachShadow({ mode: "open" }))
      }}
    >
      {shadowRoot && createPortal(
        <>
          <style>{uc03Styles}</style>
          <div className="uc03-island"><Reconciliation /></div>
        </>,
        shadowRoot,
      )}
    </div>
  )
}
