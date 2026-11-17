# Додано toolchain і browser джерела

- Дата: 2026-11-17
- Тип: Feature
- Модуль: ingest/config/sources
- Issue: source expansion follow-up

Додано офіційні RSS/Atom джерела для pnpm, npm CLI, Bun, Homebrew, Storybook, Figma Release Notes, Chrome for Developers, Mozilla Hacks і Firefox Nightly. Node.js, Vite та TypeScript уже були в радарі й залишилися без дублювання.

Для нових хостів розширено allowlist статей. Тест перевіряє URL, формат, теги та approved hosts.
