import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.js'],
    root: path.resolve(__dirname),
  },
})
