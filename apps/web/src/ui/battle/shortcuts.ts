// The battle keyboard map (UX 17.2), shown on the shortcut sheet (?) and in Options.

export const SHORTCUTS: readonly { readonly keys: readonly string[]; readonly action: string }[] = [
  { keys: ['Click'], action: 'Select a unit; then a square to move or an enemy to attack' },
  { keys: ['Right-click', 'Esc'], action: 'Go back one step, deselect, close' },
  { keys: ['Enter', 'Space'], action: 'Confirm the locked preview; skip an animation' },
  { keys: ['Tab', 'Shift+Tab'], action: 'Next / previous unit that can still act' },
  { keys: ['M', 'A', 'D', 'C', 'G'], action: 'Move, Attack, Defend, Charge, Group march' },
  { keys: ['1', '2', '3', '4'], action: 'Abilities of the selected unit' },
  { keys: ['[', ']'], action: 'Previous / next target' },
  { keys: ['←', '↑', '→', '↓'], action: 'Group march direction (as you see the board)' },
  { keys: ['Backspace'], action: 'Remove the last pick, painted square or path step' },
  { keys: ['Ctrl+Enter'], action: 'End turn (twice when units can still act)' },
  { keys: ['Ctrl+Z'], action: 'Ask your opponent for a take-back' },
  { keys: ['V'], action: 'Top or isometric view' },
  { keys: ['T'], action: 'Danger zone: where visible enemies can strike' },
  { keys: ['F'], action: 'Show the selected unit' },
  { keys: ['H'], action: 'Select your commander' },
  { keys: ['L'], action: 'Show or hide the side panel' },
  { keys: ['?'], action: 'This sheet' },
]
