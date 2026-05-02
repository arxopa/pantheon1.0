const protectedTargets = new Set(['control-core', 'trace-priority-bus']);
const mutableCodeTargets = new Set([
  'agent-runtime',
  'atman-dialog',
  'child-interests',
  'shakti-bridge',
  'pantheon-web-scout',
  'pantheon-navigation-core',
  'pantheon-net-surfer',
  'pantheon-validator',
  'inspector',
  'resonance-monitor',
  'learning-ledger',
  'rishi',
  'test-suite',
  'preflight',
  'smoke-test',
  'mutation-sandbox',
  'compute-core',
  'memory-ganga',
]);

export class ControlCorePolicyGate {
  evaluate({ taskId, candidatePatch, errorJournal }) {
    const touchesProtectedSurface = protectedTargets.has(candidatePatch.target);
    const unknownCodeTarget = candidatePatch.domain === 'code-module' && !mutableCodeTargets.has(candidatePatch.target);
    const hasCriticalFinding = errorJournal.some((entry) => entry.severity === 'critical');
    const approved = !touchesProtectedSurface && !unknownCodeTarget && !hasCriticalFinding;

    return {
      approved,
      authority: approved ? 'Control Core / Shiva' : 'Control Core / Shiva manual channel',
      reason: approved
        ? `Patch for ${candidatePatch.target} stays within protected invariants.`
        : touchesProtectedSurface
          ? 'Patch touches the protected Control Core surface and requires manual review.'
          : unknownCodeTarget
            ? `Patch target ${candidatePatch.target} is outside the Control Core mutation allowlist.`
          : 'Reflective critic found a blocking signal; automatic update was denied.',
      rollbackCheckpoint: `cp-${taskId}-${candidatePatch.target}`,
      manualReviewRequired: !approved || candidatePatch.requiresManualReview,
    };
  }
}