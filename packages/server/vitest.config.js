import { defineConfig } from 'vitest/config';

// Coverage strategy while the test suite is still growing:
//
//   Per-file thresholds on the modules that ARE tested today. This catches
//   regressions in coverage on security-sensitive code without making CI
//   red every time someone adds an untested file elsewhere (which would
//   happen under a global threshold given how sparse the suite is).
//
//   As tests spread, add more files to the thresholds map and eventually
//   flip on a global baseline. The `include` glob intentionally omits the
//   KMS stub and the mock provider so their 0% doesn't pollute the summary.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: [
        '**/*.test.js',
        'src/index.js', // bootstrap, covered by integration when we add one
        'src/services/kmsKeyManager.js', // stub — tracked separately
        'src/providers/mock/**', // demo code, not on the hot path
      ],
      thresholds: {
        'src/services/credentialService.js': {
          statements: 95,
          branches: 80,
          functions: 95,
          lines: 95,
        },
        'src/services/keyManager.js': {
          statements: 75,
          branches: 40,
          functions: 75,
          lines: 75,
        },
      },
    },
  },
});
