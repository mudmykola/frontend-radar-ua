# Виправлено Telegram command scopes

- Дата: 2026-11-18
- Тип: Fix
- Модуль: telegram/profile

Старі команди могли залишатися в Telegram через окремий scope `all_private_chats`. Profile sync тепер очищає default, private, group і administrator scopes та встановлює один актуальний список для default і приватних чатів. Profile version піднято до `v19`.
