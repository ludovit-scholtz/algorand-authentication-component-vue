# algorand-authentication-component-vue (monorepo)

| Package                                                                    | What it is                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`algorand-authentication-component-vue`](algorand-authentication-component-vue) | v2 — Vue 3 ARC-14 / ARC-76 sign-in component for use-wallet 5 ([README](algorand-authentication-component-vue/README.md), [migration](algorand-authentication-component-vue/docs/MIGRATION.md), [AI integration guide](algorand-authentication-component-vue/docs/AI_INTEGRATION.md)) |
| [`algorand-authentication-demo`](algorand-authentication-demo)             | Demo app and Playwright end-to-end tests, including the live Biatec Wallet integration  |

```bash
pnpm install
pnpm build        # component: type-check + library + declarations
pnpm test         # component unit tests
pnpm demo         # demo dev server (needs a built component)
pnpm test:e2e     # Playwright (installs: pnpm --filter algorand-authentication-demo exec playwright install chromium)
```

Requires Node ≥ 20.19 and pnpm.
