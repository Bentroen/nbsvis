const allowedScopes = [
  'player', // playback orchestration/public player API
  'audio', // engine, messaging, buffers, transport, scheduling, resampling, workers/worklets, balancing
  'viewer', // renderer/view abstraction
  'view', // specific view implementations
  'widgets', // viewer widgets/UI helpers
  'assets', // bundled sounds/images
  'demo', // apps/nbsvis-demo only
  'release', // semantic-release/npm workflow
  'deps', // dependency updates
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'style', 'test'],
    ],
    'scope-enum': [2, 'always', allowedScopes],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
  },
};
