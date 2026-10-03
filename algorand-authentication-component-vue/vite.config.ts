import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  build: {
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/index.ts'),
      name: 'AlgorandAuthenticationComponentVue',
      formats: ['es', 'umd'],
      fileName: 'algorand-authentication-component-vue',
      cssFileName: 'algorand-authentication-component-vue'
    },
    rollupOptions: {
      external: ['vue', '@txnlab/use-wallet-vue', '@txnlab/use-wallet', 'algosdk', 'buffer'],
      output: {
        globals: {
          vue: 'Vue',
          algosdk: 'algosdk',
          buffer: 'buffer',
          '@txnlab/use-wallet-vue': 'UseWalletVue',
          '@txnlab/use-wallet': 'UseWallet'
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
})
