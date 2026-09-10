export type Direction = 'up' | 'down' | 'left' | 'right';

/** Which movement control the player has chosen. Persisted between sessions. */
export type ControlScheme = 'dpad' | 'stick';

export const CONTROL_SCHEME_STORAGE_KEY = 'apparitions.genderwars.controlScheme';
