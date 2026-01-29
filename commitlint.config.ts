export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Formatting
        'refactor', // Refactoring
        'perf', // Performance optimization
        'test', // Testing
        'chore', // Build tools or helper tools changes
        'ci', // CI configuration
        'build', // Build system
        'revert', // Revert
      ],
    ],
    'subject-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 72],
  },
}
