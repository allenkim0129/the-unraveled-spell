export type SpellId = 'force' | 'motion';
export type TargetId = 'anchor' | 'debris' | 'mechanism';
export type Phase = 'editing' | 'executing' | 'resolved';

export interface Spell {
  connected: boolean;
  target: TargetId;
}

export interface Outcome {
  anchorIntact: boolean;
  bridgeRaised: boolean;
  safe: boolean;
}

interface Snapshot {
  spells: Record<SpellId, Spell>;
  stitches: number;
}

export interface GameState extends Snapshot {
  phase: Phase;
  elapsed: number;
  history: Snapshot[];
  outcome: Outcome | null;
  won: boolean;
}

export type ActionResult = { ok: true } | { ok: false; message: MessageKey };

export const EXECUTION_SECONDS = 5;
export const STITCH_CAPACITY = 3;
export const SPELL_IDS: SpellId[] = ['force', 'motion'];
export const VALID_TARGETS: Record<SpellId, readonly TargetId[]> = {
  force: ['anchor', 'debris'],
  motion: ['debris', 'mechanism'],
};
export const TARGET_NAMES: Record<TargetId, MessageKey> = {
  anchor: 'anchorName',
  debris: 'debrisName',
  mechanism: 'mechanismName',
};
export const SPELL_NAMES: Record<SpellId, MessageKey> = {
  force: 'forceName',
  motion: 'motionName',
};

export function createState(): GameState {
  return {
    spells: {
      force: { connected: true, target: 'anchor' },
      motion: { connected: true, target: 'debris' },
    },
    stitches: STITCH_CAPACITY,
    history: [],
    phase: 'editing',
    elapsed: 0,
    outcome: null,
    won: false,
  };
}

function snapshot(state: GameState): Snapshot {
  return {
    spells: {
      force: { ...state.spells.force },
      motion: { ...state.spells.motion },
    },
    stitches: state.stitches,
  };
}

function editError(state: GameState): ActionResult | undefined {
  if (state.phase !== 'editing') {
    return { ok: false, message: 'errorPhase' };
  }
  if (state.stitches === 0) {
    return { ok: false, message: 'errorStitches' };
  }
}

export function cutThread(state: GameState, id: SpellId): ActionResult {
  if (!state.spells[id].connected) {
    return { ok: false, message: 'errorAlreadyCut' };
  }
  const error = editError(state);
  if (error) return error;
  state.history.push(snapshot(state));
  state.spells[id].connected = false;
  state.stitches--;
  return { ok: true };
}

export function redirectThread(state: GameState, id: SpellId, target: TargetId): ActionResult {
  if (!VALID_TARGETS[id].includes(target)) {
    return { ok: false, message: 'errorInvalidTarget' };
  }
  if (!state.spells[id].connected) {
    return { ok: false, message: 'errorCutRedirect' };
  }
  if (state.spells[id].target === target) {
    return { ok: false, message: 'errorSameTarget' };
  }
  const error = editError(state);
  if (error) return error;
  state.history.push(snapshot(state));
  state.spells[id].target = target;
  state.stitches--;
  return { ok: true };
}

export function undoEdit(state: GameState): ActionResult {
  if (state.phase !== 'editing') {
    return { ok: false, message: 'errorUndoPhase' };
  }
  const previous = state.history.pop();
  if (!previous) return { ok: false, message: 'errorNoUndo' };
  state.spells = previous.spells;
  state.stitches = previous.stitches;
  return { ok: true };
}

export function evaluateOutcome(state: GameState): Outcome {
  const anchorIntact = !state.spells.force.connected || state.spells.force.target !== 'anchor';
  const bridgeRaised = state.spells.motion.connected && state.spells.motion.target === 'mechanism';
  return { anchorIntact, bridgeRaised, safe: anchorIntact && bridgeRaised };
}

export function execute(state: GameState): ActionResult {
  if (state.phase !== 'editing') {
    return { ok: false, message: 'errorAlreadyExecuted' };
  }
  state.phase = 'executing';
  state.elapsed = 0;
  return { ok: true };
}

export function advance(state: GameState, seconds: number): void {
  if (state.phase !== 'executing' || !Number.isFinite(seconds) || seconds <= 0) return;
  state.elapsed = Math.min(EXECUTION_SECONDS, state.elapsed + seconds);
  if (state.elapsed === EXECUTION_SECONDS) {
    state.phase = 'resolved';
    state.outcome = evaluateOutcome(state);
  }
}

export function reachExit(state: GameState): boolean {
  if (state.phase !== 'resolved' || !state.outcome?.safe || state.won) return false;
  state.won = true;
  return true;
}

export function outcomeKey(state: GameState): MessageKey {
  if (state.won) return 'outcomeWon';
  if (!state.outcome) return 'outcomeDefault';
  if (state.outcome.safe) return 'outcomeSafe';
  if (!state.outcome.anchorIntact && !state.outcome.bridgeRaised) {
    return 'outcomeBothFailed';
  }
  if (!state.outcome.anchorIntact) return 'outcomeAnchorFailed';
  return 'outcomeBridgeFailed';
}

export function outcomeMessage(state: GameState): string {
  return t(outcomeKey(state));
}
import { t } from '../i18n';
import type { MessageKey } from '../i18n';
