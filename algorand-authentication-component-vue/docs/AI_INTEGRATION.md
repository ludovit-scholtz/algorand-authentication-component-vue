# Integrating with an AI coding agent

`algorand-authentication-component-vue` ships a playbook written for AI agents:
[`skill/algorand-authentication-integration/SKILL.md`](../skill/algorand-authentication-integration/SKILL.md).
It is self-contained — context gathering, install, wallet registration for use-wallet 5, wrapping the UI,
signing, backend verification of the ARC-14 header, a verification checklist and a troubleshooting table.
It is part of the published npm package, so after installing the component it is available offline.

The human-readable companion is [INTEGRATION.md](INTEGRATION.md) (modes, code for protected and public pages, API calls,
backend verification, tests). The playbook below links to it.

## Give it to your agent

**Any agent** (Cursor, Windsurf, Copilot Chat, Aider, Codex, …) — one prompt:

```text
Read node_modules/algorand-authentication-component-vue/skill/algorand-authentication-integration/SKILL.md
and follow it to add Algorand wallet / ARC-76 sign-in to this app. Ask me for anything it says only I can provide
(WalletConnect project id, realm name, backend language). Run the verification section before you finish.
```

If the package is not installed yet, point the agent at the raw file instead:
`https://raw.githubusercontent.com/ludovit-scholtz/algorand-authentication-component-vue/main/algorand-authentication-component-vue/skill/algorand-authentication-integration/SKILL.md`

**Claude Code** — install it as a project skill so it is picked up automatically:

```bash
mkdir -p .claude/skills/algorand-authentication-integration
cp node_modules/algorand-authentication-component-vue/skill/algorand-authentication-integration/SKILL.md \
   .claude/skills/algorand-authentication-integration/SKILL.md
```

then ask: *“Add Algorand login to this app.”*

**Cursor / Windsurf rules, Copilot instructions** — copy the file into `.cursor/rules/`,
`.windsurf/rules/` or `.github/copilot-instructions.md` (the YAML front matter is harmless).

## What the agent will need from you

| Input                          | Why                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| WalletConnect project id       | Biatec and other WalletConnect wallets; free at <https://cloud.reown.com>. Never hardcoded. |
| Realm (e.g. `MyApp`)           | Signed into the ARC-14 note; the backend must check the same string.                        |
| Wallets to offer               | Each wallet is its own `@txnlab/use-wallet-<name>` package.                                 |
| Backend language / framework   | To generate the header verification (Node/TypeScript is documented; the checks are language-neutral). |

## Quick facts for agents (the short version)

- Vue 3 only. Peer deps: `vue ^3.5`, `@txnlab/use-wallet-vue ^5`, `algosdk ^3.5`. **No PrimeVue, no Tailwind.**
- `import 'algorand-authentication-component-vue/style.css'` once.
- Register wallets with factory functions: `app.use(WalletManagerPlugin, { wallets: [biatec({ projectId }), pera()], defaultNetwork: 'mainnet' })`.
- Wrap protected UI: `<AlgorandAuthentication arc14Realm="MyApp" authorizedOnlyAccess>…</AlgorandAuthentication>`.
- Read the session with `useAVMAuthentication()` → `authStore.{isAuthenticated, account, wallet, arc14Header}`;
  `await logout()`; sign with `await sign([txn], [0])` (works for wallets and ARC-76 accounts).
- Send `authStore.arc14Header` (`SigTx …`) as `Authorization`; the backend must verify signature, realm, validity window.
- ARC-76 needs HTTPS (`crypto.subtle`) and 16+ character passwords.
- Removed since 1.x: `onStateChange`, `useDemoMnemonics`, v4 `WalletId` enums, PrimeVue plugin. See [MIGRATION.md](MIGRATION.md).

## Testing the integration

The repository's demo contains a working reference with Playwright tests you can copy from:
`algorand-authentication-demo/e2e` — offline tests (ARC-76, mocked algod, testnet mnemonic wallet) and a live
test that pairs the demo with <https://wallet.biatec.io> through WalletConnect.
