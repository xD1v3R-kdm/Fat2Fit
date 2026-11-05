# Fat2Fit 0.3.1 — развёртывание в Vercel + Supabase + Telegram

**Статус:** проект подготовлен к деплою, но пока НЕ опубликован. Не утверждайте, что он работает в Telegram, пока не завершён smoke-тест на двух настоящих аккаунтах.

## 0. Что потребуется

- Аккаунт Vercel с правом создавать проекты.
- Проект Supabase (PostgreSQL) и его пароль БД.
- Бот, созданный через `@BotFather` в Telegram.
- Telegram user ID первого тренера (числовой; не username).
- Репозиторий GitHub/GitLab/Bitbucket или Vercel CLI на Mac.

**Никаких токенов, URI базы данных или SESSION_SECRET не присылать в ChatGPT.** Вставляйте их только в панели настройки соответствующего сервиса.

## 1. Supabase — база данных

1. Используйте существующий проект Supabase (ref `hjckimoritnehwwazszf`), который ранее назывался GymTrack. Регион: `eu-west-1`.
2. Схема 10 таблиц уже применена; **не запускайте** повторно `001_initial.sql`.
3. Глобальный каталог из четырёх упражнений уже добавлен; **не запускайте** повторно `002_seed_catalog.sql`. Восемь индексов добавлены миграцией `20261029233935_gymtrack_foreign_key_indexes.sql`.
4. Проверьте наличие таблиц `users`, `workspaces`, `memberships`, `exercises`, `workout_templates`, `assignments`, `set_logs`.
5. Откройте **Connect → Transaction pooler**. Скопируйте полный Postgres URI, порт **6543**. Подставьте пароль вместо шаблона и при необходимости percent-encode специальные символы пароля. Используйте **именно выданный Supabase host и username**, не придумывайте их.

> Для будущего управляемого migration workflow используйте Supabase CLI; однократный SQL Editor подходит для первого пустого тестового проекта, но не синхронизирует историю миграций CLI автоматически.

## 2. Telegram — бот и Mini App

1. В `@BotFather` отправьте `/newbot` и создайте нового бота. Сохраните API Token в надёжном менеджере секретов.
2. Настройте для этого бота Mini App в BotFather (создайте отдельное приложение/short name, например `fat2fit`). Выберите публичный HTTPS-адрес проекта Vercel. Если URL ещё не известен, вернитесь к настройке Mini App после создания Vercel-проекта, перед тестированием.
3. Сохраните точные bot username (без `@`) и app short name.
4. Укажите в переменной `BOOTSTRAP_COACH_TELEGRAM_IDS` только ID первого тренера (числовой; несколько ID через запятую). При первом входе сервер создаст его Workspace.

Пример ссылки запуска: `https://t.me/YourBotName/fat2fit`. Приглашения создаются с одноразовым `startapp=invite_<token>`.

## 3. Vercel — проект

### Вариант A. Через Git (предпочтительный)

1. Распакуйте архив, загрузите содержимое папки `fat2fit-0.3.1` в **приватный** Git-репозиторий.
2. В Vercel создайте **New Project**, импортируйте этот репозиторий, выберите Next.js.
3. Убедитесь, что **Root Directory** указывает на папку с `package.json`.
4. В **Settings → Environment Variables** создайте значения из следующего списка, для Production и, когда будете тестировать ветки, Preview. Все значения кроме `NEXT_PUBLIC_*` — секретные/серверные:

| Имя | Пример/источник | Scope |
|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `false` | public build flag |
| `DATABASE_URL` | Transaction pooler URI из Supabase, порт 6543 | server secret |
| `TELEGRAM_BOT_TOKEN` | Токен от BotFather | server secret |
| `SESSION_SECRET` | 32+ случайных байта, например `openssl rand -hex 32` | server secret |
| `BOOTSTRAP_COACH_TELEGRAM_IDS` | Числовой Telegram ID тренера | server config |
| `TELEGRAM_BOT_USERNAME` | Имя бота без `@` | server config |
| `TELEGRAM_MINI_APP_SHORT_NAME` | Short name из BotFather | server config |
| `NEXT_PUBLIC_APP_URL` | Опционально: `https://<ваш-домен>` | public config |

5. Нажмите Deploy. Скрипт `prebuild` проверит обязательные настройки и **остановит** развёртывание при публичном деморежиме и отсутствии секретов.
6. После успешного деплоя проверьте HTTPS-адрес, затем при необходимости обновите URL Mini App в BotFather.

### Вариант B. С Mac через CLI

```bash
cd fat2fit-0.3.1
npm install
npm test
npm run build                  # local demo build (если VERCEL не установлен)
npm i -g vercel
vercel login
vercel link
# добавьте значения через Vercel Dashboard или vercel env add ...
vercel --prod
```

**Не переносите `.env.local` в Git или чат.** Не делайте `NEXT_PUBLIC_DATABASE_URL`/`NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`.

## 4. Проверка после публикации

1. Откройте direct Mini App link от **разрешённого тренерского Telegram аккаунта**. Убедитесь, что появился тренерский Workspace.
2. Создайте собственное упражнение и шаблон, получите приглашение для ученика.
3. Откройте приглашение **с другого Telegram аккаунта** и назначьте ему тренировку.
4. Заполните один подход, закройте Mini App, снова откройте — результат должен сохраниться.
5. Завершите тренировку и проверьте отчёт в интерфейсе тренера.
6. Проверьте, что внешнее открытие `https://<домен>/api/me` без Telegram сессии возвращает HTTP 401, а не данные ученика.
7. На отдельном тестовом аккаунте проверьте невозможность доступа к чужому Workspace/назначению.
8. Сохраните скриншоты ошибок и логов Vercel **без секретов**.

## 5. Что пока не реализовано

- Команды Telegram-бота (`/start`), push-уведомления и подтверждение подписки на сообщения.
- Загрузка фото с устройства в Supabase Storage (сейчас работают HTTPS-ссылки).
- Надёжная офлайн-очередь синхронизации подходов.
- E2E-проверки с реальными Telegram и Supabase аккаунтами.

Первый публичный деплой означает **тестовый стенд**, а не готовность к массовому запуску.

## 6. Автоматизированные проверки развёртывания

После выполнения миграций откройте `scripts/database-check.sql` в Supabase SQL Editor.
Ожидается 10 таблиц с `row_security = true`, минимум 4 глобальных упражнения,
а также `anon_can_select = false` и `authenticated_can_select = false` в каждой строке.

После первого деплоя выполните **без авторизации**:

```bash
node scripts/smoke-public.mjs https://your-fat2fit.vercel.app
```

Ожидается HTTP 200 для главной страницы и HTTP 401 для трёх защищённых API-запросов.
**Эта проверка не заменяет** вход реального тренера/ученика через Telegram и
интеграционное тестирование записи в Supabase.
