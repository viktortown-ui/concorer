export type BranchStrength = 'weak' | 'normal' | 'strong'

export interface YggdrasilBranch {
  id: string
  title: string
  direction: 'up' | 'down'
  rune: 'I' | 'II' | 'III' | 'IV' | 'V'
  strength: BranchStrength
}

interface Props {
  objective: string
  branches: YggdrasilBranch[]
}

const strengthLabel: Record<BranchStrength, string> = {
  weak: 'слабая',
  normal: 'норм',
  strong: 'сильная',
}

const branchPath = [
  'M180 286 C140 252,120 210,90 168',
  'M180 286 C148 236,138 190,128 140',
  'M180 286 C182 236,178 188,180 140',
  'M180 286 C212 236,222 190,232 140',
  'M180 286 C222 252,250 210,272 168',
]

const branchNode = [
  { x: 90, y: 168 },
  { x: 128, y: 140 },
  { x: 180, y: 140 },
  { x: 232, y: 140 },
  { x: 272, y: 168 },
]

export function GoalYggdrasilTree({ objective, branches }: Props) {
  const sceneBranches = branches.slice(0, 5)

  return (
    <div className="goal-yggdrasil">
      <h2>Иггдрасиль</h2>
      <p className="goal-yggdrasil__objective"><strong>Objective:</strong> {objective || 'Уточните цель в Кузнице.'}</p>
      <div className="goal-yggdrasil__scene">
        <svg viewBox="0 0 360 320" role="img" aria-label="Сцена Иггдрасиля">
          <path d="M180 312 L180 250" className="goal-yggdrasil__trunk" />
          <path d="M180 312 C170 308,160 304,152 296" className="goal-yggdrasil__root" />
          <path d="M180 312 C190 308,200 304,208 296" className="goal-yggdrasil__root" />
          {sceneBranches.map((branch, index) => (
            <g key={branch.id}>
              <path d={branchPath[index]} className={`goal-yggdrasil__branch goal-yggdrasil__branch--${branch.strength}`} />
              <circle cx={branchNode[index].x} cy={branchNode[index].y} r="14" className={`goal-yggdrasil__leaf goal-yggdrasil__leaf--${branch.strength}`} />
            </g>
          ))}
        </svg>
      </div>
      <ul className="goal-yggdrasil__branches">
        {branches.map((branch, index) => (
          <li key={branch.id} className="panel">
            <strong>KR{index + 1}: {branch.title}</strong>
            <span>{branch.direction === 'up' ? '↑ Рост' : '↓ Снижение'} · Руна {branch.rune} · {strengthLabel[branch.strength]}</span>
          </li>
        ))}
      </ul>
      {branches.length === 0 ? <p>Ветви появятся после настройки KR в Кузнице.</p> : null}
      <p className="goal-yggdrasil__caption">Числовые параметры спрятаны в «Кузнице (для продвинутых)».</p>
    </div>
  )
}
