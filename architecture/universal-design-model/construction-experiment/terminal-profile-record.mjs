const supportedProfiles = new Set(['flat', 'chamfered']);
const chamferOrientations = new Set(['outer-right']);

/** Validate only fields shared by the supported terminal-profile records. */
export function validateTerminalProfileRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['Terminal profile record must be an object.'];
  }

  if (!Object.hasOwn(record, 'profile')) return ['Terminal profile is required.'];
  if (!supportedProfiles.has(record.profile)) {
    return [`Unsupported terminal profile ${String(record.profile)}.`];
  }

  if (record.profile === 'flat') {
    const errors = [];
    if (Object.hasOwn(record, 'orientation')) errors.push('Flat terminal profile does not accept orientation.');
    if (Object.hasOwn(record, 'cutRatio')) errors.push('Flat terminal profile does not accept cutRatio.');
    return errors;
  }

  const errors = [];
  if (!Object.hasOwn(record, 'orientation')) {
    errors.push('Chamfered terminal profile requires an orientation.');
  } else if (!chamferOrientations.has(record.orientation)) {
    errors.push(`Unsupported terminal orientation ${String(record.orientation)}.`);
  }

  if (!Object.hasOwn(record, 'cutRatio')) {
    errors.push('Chamfered terminal profile requires cutRatio.');
  } else if (typeof record.cutRatio !== 'number' || !Number.isFinite(record.cutRatio)) {
    errors.push('Terminal cutRatio must be a finite number.');
  } else if (record.cutRatio <= 0 || record.cutRatio > 0.25) {
    errors.push('Terminal cutRatio must be greater than zero and at most 0.25 stem widths.');
  }

  return errors;
}
