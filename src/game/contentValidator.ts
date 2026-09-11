import { CASES, PROTOCOLS, RUN_LENGTH } from './data';

export function validateContent(): void {
  const protocolIds = new Set(Object.keys(PROTOCOLS));
  const ids = new Set<string>();
  const errors: string[] = [];

  if (CASES.length < RUN_LENGTH) {
    errors.push(`Need at least ${RUN_LENGTH} cases, got ${CASES.length}`);
  }

  for (const item of CASES) {
    if (ids.has(item.id)) errors.push(`Duplicate case id: ${item.id}`);
    ids.add(item.id);

    if (item.options.length !== 3) errors.push(`${item.id}: encounter must expose exactly 3 protocol options`);
    if (!item.options.includes(item.correct)) errors.push(`${item.id}: correct protocol is not present in options`);
    if (!protocolIds.has(item.correct)) errors.push(`${item.id}: unknown correct protocol ${item.correct}`);
    if (item.signal.length !== 4) errors.push(`${item.id}: signal dossier must contain exactly 4 fragments`);
    if (item.labOptions.length !== 3) errors.push(`${item.id}: lab must contain exactly 3 answers`);
    if (item.labAnswer < 0 || item.labAnswer > 2) errors.push(`${item.id}: labAnswer must be 0..2`);
    if (item.trace.length < 8) errors.push(`${item.id}: trace should have at least 8 points`);
    if (item.trace.some((value) => value < 0 || value > 1)) errors.push(`${item.id}: trace values must be normalized 0..1`);
  }

  if (errors.length > 0) {
    const message = `Signal Arena content validation failed:\n${errors.join('\n')}`;
    if (import.meta.env.DEV) {
      throw new Error(message);
    }
    console.warn(message);
  }
}
