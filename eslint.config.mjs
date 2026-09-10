import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next — "**/" префікс (не лише
    // кореневий ".next/**") навмисно додано: без нього згенеровані типи
    // Next.js у .next вкладених worktree (.claude/worktrees/*/.next/types)
    // не виключались і засмічували lint тисячами нерелевантних помилок.
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
