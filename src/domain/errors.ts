export type DomainErrorCode =
  | 'invalid_points'
  | 'empty_hand'
  | 'unknown_side'
  | 'side_required'
  | 'unknown_bonus'
  | 'duplicate_bonus'
  | 'bonus_required'
  | 'game_finished'
  | 'game_abandoned'
  | 'unknown_entry'
  | 'entry_voided'
  | 'not_editable'
  | 'no_change'
  | 'nothing_to_undo'
  | 'invalid_target'
  | 'invalid_setup'
  | 'duplicate_player';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
