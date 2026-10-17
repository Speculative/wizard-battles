import type { MovementState } from './contestants/movement';
import type { MovementStats } from './kinematics';

export const EXPERIMENT = {
  id: 'movement-pacing-v1',
  title: 'Pressure, commitment, escape',
  hypothesis: 'More deliberate movement may make pressure and commitment easier to anticipate while preserving satisfying bursts. None of these approaches working is a useful result.',
  maxSeconds: 120,
  seeds: [1, 7, 19, 42],
  scenarios: ['duel', 'four-wizards'],
  rotations: [0, Math.PI / 2],
  dt: 1 / 60,
} as const;

type MovementOverride = Partial<Record<MovementState, Partial<MovementStats>>>;
export const VARIANTS: { id: string; name: string; description: string; movement: MovementOverride }[] = [
  { id: 'baseline', name: 'Baseline', description: 'Current movement and casting mobility.', movement: {} },
  { id: 'measured', name: 'Measured commitments', description: 'Slower travel; stop to charge. Does a clearer commitment create anticipation or make the duel static?', movement: {
    walking: { maxSpeed: 45 }, running: { maxSpeed: 90 }, sprinting: { maxSpeed: 160 },
    charging: { maxSpeed: 0, acceleration: 0, friction: 1500 },
  } },
  { id: 'burst', name: 'Bursts and resets', description: 'Slower neutral travel, faster sprints and dashes, planted recovery. Does contrast create momentum or more circling?', movement: {
    running: { maxSpeed: 85 }, sprinting: { maxSpeed: 280, acceleration: 850 },
    dashing: { maxSpeed: 410, acceleration: 2600 },
    recovering: { maxSpeed: 0, acceleration: 0, friction: 1500 },
  } },
];

export function variantDefinition(id: string) {
  const variant = VARIANTS.find(v => v.id === id);
  if (!variant) throw new Error(`Unknown variant: ${id}`);
  return variant;
}
