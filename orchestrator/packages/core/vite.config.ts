import pkg from './package.json'
// @ts-ignore
import tsconfig from './tsconfig.json'
import base from '../../vite.base'

export default base({
  name: 'core',
  pkg,
  tsconfig
})