import antfu from '@antfu/eslint-config'

export default antfu({
  pnpm: true,
  vue: true,
  ignores: [
    '.agents/**/*.md',
    '.claude/**/*.md',
    '.codex/**/*.md',
    '.cursor/**/*.md',
    '.opencode/**/*.md',
  ],
})
