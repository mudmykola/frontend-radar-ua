# Додано AI та developer ecosystem джерела

- Дата: 2026-11-17
- Тип: Feature
- Модуль: ingest/config/sources
- Issue: source expansion follow-up

Додано OpenAI News, OpenAI Codex Changelog, Claude Code releases, GitHub Blog і Changelog, GitLab Blog та TLDR Dev. Anthropic News не має стабільного офіційного RSS, тому для Claude використано офіційний changelog репозиторію Claude Code без неофіційних проксі.

daily.dev не додано до RSS-конфігурації: його основні стрічки персоналізовані, а API потребує Bearer token. Для нього потрібен окремий API adapter, щоб не ламати поточний RSS/Atom pipeline.
