import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '**/dist',
    // Generated output — not ours to lint.
    'apps/api/src/generated',
  ]),

  // ---- Base, everywhere -------------------------------------------------
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },

  // ---- Web --------------------------------------------------------------
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    // app/ is composition wiring — the router table and provider tree. It
    // exports a router and a QueryClient, not components, so "this file should
    // only export components" is asking the wrong thing of it. Fast refresh of
    // the router itself is not a workflow anyone has.
    files: ['apps/web/src/app/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // ---- API --------------------------------------------------------------
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // ==================================================================
      // The guardrail behind the whole RBAC design.
      // ==================================================================
      // All database access goes through src/services/**, because that is
      // where scopeFor(actor, resource) is applied. A route that imports
      // prisma directly can query unscoped rows -- an agent reading another
      // agent's clients -- and nothing would catch it.
      //
      // A LINT RULE, not a runtime hack: it fails at author time, in the
      // editor, before the query is ever written. See docs/RBAC.md.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/prisma', '**/lib/prisma.js', '**/generated/prisma/**'],
              // Types cannot execute a query. scope.ts needs Prisma.WhereInput
              // to type its return; banning that would be cargo-culting the
              // rule rather than enforcing its intent.
              allowTypeImports: true,
              message:
                'Do not import the prisma client outside src/services/**. Data access belongs in a service so scopeFor() is always applied. Type-only imports are fine. See docs/RBAC.md.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        // Express identifies an error handler by its ARITY: (err, req, res, next).
        // The 4th param must exist even when unused, or the handler silently
        // stops catching errors.
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The sanctioned places for the prisma client: the service layer, the
    // client factory itself, the seed, the composition root (which owns
    // $disconnect on shutdown), and authenticate — which must read the session
    // row before an actor exists to scope by.
    files: [
      'apps/api/src/services/**/*.ts',
      'apps/api/src/lib/prisma.ts',
      'apps/api/src/middleware/authenticate.ts',
      'apps/api/src/index.ts',
      'apps/api/prisma/**/*.ts',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },

  // ---- Shared -----------------------------------------------------------
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      // This package ships in the browser bundle. Importing Prisma would drag
      // its runtime client-side. Enum parity is enforced by a test instead.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                '@app/shared is bundled for the browser and must never import Prisma. Mirror the enum in enums.ts; the parity test keeps it honest.',
            },
          ],
        },
      ],
    },
  },

  // ---- Tests ------------------------------------------------------------
  {
    files: ['**/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      // Tests legitimately reach for internals to assert on them.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
