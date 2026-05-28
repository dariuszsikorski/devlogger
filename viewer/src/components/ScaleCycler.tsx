// @purpose UI scale cycle button - identical rotator behaviour as
// phi/aria-kit/seller. Click cycles through 75%/100%/.../200% with a
// View Transitions API zoom animation. Replaces FontSizeSlider in the
// header for parity with the directiv panel.
import { Button } from 'react-aria-components'
import { Type } from 'lucide-react'
import { useScale } from '../hooks/useScale'
import './ScaleCycler.scss'

export function ScaleCycler() {
  const { scaleLabel, cycleScale } = useScale()
  return (
    <Button
      className="ScaleCycler"
      onPress={cycleScale}
      aria-label={`UI scale ${scaleLabel} - click to cycle`}
    >
      <Type size={12} className="ScaleCycler_icon" aria-hidden="true" />
      <span className="ScaleCycler_label">{scaleLabel}</span>
    </Button>
  )
}
