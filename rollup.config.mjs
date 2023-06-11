import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import babel from '@rollup/plugin-babel'
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
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript(),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts'],
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              node: '14',
            },
          },
        ],
      ],
      plugins: ['@babel/plugin-transform-nullish-coalescing-operator'],
    }),
  ],
  external: Object.keys(pkg.peerDependencies || {}),
}

export default config
