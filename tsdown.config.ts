import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from 'tsdown'

const isDev = process.env.NODE_ENV === 'development'
const buildConfig: ReturnType<typeof defineConfig> = defineConfig({
  workspace: {
    include: ['packages/*'],
    exclude: ['apps/*'],
  },
  dts: true,
  tsconfig: join(import.meta.dirname, 'tsconfig.json'),
  entry: ['src/index.ts'],
  sourcemap: isDev,
  inputOptions: {
    resolve: {
      conditionNames: ['dev'],
    },
  },
  outExtensions: (_ctx) => {
    return {
      js: '.js',
    }
  },
})
export default buildConfig
