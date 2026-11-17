# Примусове оновлення Telegram command menu

- Дата: 2026-11-18
- Тип: Fix
- Модуль: telegram/profile

Піднято profile version до `v17`. Під час першого вхідного webhook після деплою бот перевіряє profile version, очищає старий command menu через `deleteMyCommands` і повторно встановлює лише актуальні команди. Це прибирає старі `/card`, `/p0`, `/audit`, `/stats`, `/refresh` та Shopify-центричні описи.
