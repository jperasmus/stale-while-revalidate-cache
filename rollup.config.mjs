import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const pkg = require('./package.json')

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [nodeResolve(), commonjs(), typescript()],
  external: Object.keys(pkg.peerDependencies || {}),
}

export default config
