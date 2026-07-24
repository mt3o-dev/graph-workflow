/**
 * Shared design-system prop types. String-free by construction: every
 * user-facing string is passed in by the caller (P2 i18n catalog), never
 * hardcoded here ([node:4a03791d], [node:aeb2d1f6]).
 */

export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type Size = 'sm' | 'md' | 'lg';

/** [node:167451f0]/dec:8 — every group-aggregated chart declares its mode. */
export type AttributionMode = 'overlap' | 'partition';

/** Sign of a formatted amount, for AmountText styling only (no math here). */
export type AmountSign = 'positive' | 'negative' | 'neutral';
