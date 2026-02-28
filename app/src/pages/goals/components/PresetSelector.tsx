import type { GoalModePresetId } from '../../../core/models/goal'

interface PresetCard {
  id: GoalModePresetId
  title: string
}

interface PresetSelectorProps {
  presets: PresetCard[]
  activePresetId: GoalModePresetId
  onSelect: (presetId: GoalModePresetId) => void
}

export function PresetSelector({ presets, activePresetId, onSelect }: PresetSelectorProps) {
  return (
    <div className="forge-presets" role="tablist" aria-label="Режимы кузницы">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          role="tab"
          aria-selected={activePresetId === preset.id}
          aria-label={`Режим ${preset.title}`}
          className={activePresetId === preset.id ? 'forge-preset forge-preset--active' : 'forge-preset'}
          onClick={() => onSelect(preset.id)}
        >
          {preset.title}
        </button>
      ))}
    </div>
  )
}
