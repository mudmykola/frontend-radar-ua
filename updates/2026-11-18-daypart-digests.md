# Daypart-aware Telegram digests

- Дата: 2026-11-18
- Тип: Feature
- Модуль: runtime/scheduled + telegram/digest

Дайджести тепер формуються за часовим поясом `Europe/Kyiv`: о 07:00 — `Ранковий Frontend Radar`, о 13:00 — `Денний пульс Radar`, о 19:00 — `Вечірній підсумок Radar`. Кожен період має окремий KV deduplication key, тому cron кожні 15 хвилин не створює повторів.

Поодинокі критичні alerts не отримують штучну назву періоду й надходять незалежно від daypart.
