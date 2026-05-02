# Pantheon / Child of Gods

Архитектурная модель Пантеона, или "Ребенка богов": универсального ИИ-агента с кластерной нейросетью, защищенным управляющим контуром, самостоятельным нет-серфингом, truth-check валидацией и интерактивной симуляцией жизненного цикла кластера.

## Блоки системы

- Control Core: максимально защищенный контрольный блок управления. Решает, какие блоки добавлять и удалять, какие архитектуры разрешать и какие инварианты обязаны сохраняться.
- Compute Core: расчетное ядро нейросети. Управляет всеми блоками, кроме Control Core, перестраивает кластеры под тип задачи и может только предлагать ручную реструктуризацию контрольного блока.
- Trace Sentinel: блок трассировки и логов. Имеет приоритет по триггерам, нужен для раннего обнаружения багов, деградации и конфликтов архитектуры.
- Linguistic Mesh: языковой слой нейросети. Разбирает пользовательскую речь, строит intent graph, удерживает диалоговую память и решает, какой агентный runtime и какой кластер нужен для задачи.

## Ключевые правила

- Control Core не изменяется автоматически.
- Любая реструктуризация Compute Core требует разрешения Control Core.
- На время тестирования новой архитектуры Compute Core временно передает свои функции Control Core.
- Любое изменение архитектуры должно проходить через sandbox, журналирование и rollback checkpoint.
- Реструктуризация Control Core допускается только вручную, редко и с возможностью отката.

## Назначение интерфейса

Интерфейс показывает:

- трехблочную архитектуру системы;
- протокол контролируемой реструктуризации;
- примеры адаптации кластерной топологии под разные типы задач;
- поток трассировки и набор неизменяемых системных инвариантов;
- live-симуляцию запроса, заморозки, теста, коммита, rollback и ручного review Control Core.
- лингвистический блок с узлами Intent Parser, Semantic Router, Dialogue Memory и Response Synthesizer;
- реестр GitHub-интеграций под внешние агентные рантаймы.

## Что уже реализовано в коде

- доменная модель вынесена в отдельные типы и данные;
- runtime-состояние собрано через reducer как state-машина;
- UI разбит на независимые React-компоненты;
- добавлены интерактивные сценарии: пошаговый цикл, полный прогон, аварийный rollback, ручной review и переключение профиля задачи;
- добавлен лингвистический блок нейросети;
- добавлена модель глубинного самообучения `Deep Self-Learning Mandala`;
- добавлен реестр интеграций для `openai/openai-agents-js` и `langchain-ai/langchainjs`.

## Модель глубинного самообучения

В проект заложен отдельный контур `Deep Self-Learning Mandala` с пятью слоями:

- `Perception Layer`: сбор опыта из запросов, действий, ошибок и runtime-сигналов;
- `Semantic Encoding Layer`: кодирование опыта в латентные признаки и гипотезы;
- `Reflective Critic Layer`: критика и поиск деградации по логам и trace-данным;
- `Controlled Update Layer`: закрепление изменений только после одобрения `Control Core`;
- `Memory Distillation Layer`: перенос полезного знания в долговременную память и удаление шума.

Дополнительно описаны три цикла:

- `Micro Backprop Loop` на каждый диалоговый проход;
- `Night Distillation Loop` для пакетного пересчета памяти;
- `Architectural Mutation Loop` для редкой контролируемой перестройки архитектуры.

## Подключенные GitHub-ориентированные рантаймы

- `openai/openai-agents-js`: выбран как основной runtime для handoff-логики, lifecycle hooks, session orchestration и specialist-agent схем.
- `langchain-ai/langchainjs`: добавлен как альтернативный runtime для tool-first маршрутизации, dynamic tool selection и structured output.

## Что теперь реализовано дополнительно

- серверный рантайм в `server/agent-runtime.mjs` для реального HTTP-вызова агента после появления Node.js;
- серверный модуль `server/self_learning/deep-self-learning.mjs` для контура глубинного самообучения;
- персистентный ledger `server/self_learning/learning-ledger.mjs`, который сохраняет cycles, memory shards, error journal и nightly runs в JSON-файл;
- путь к ledger можно переопределить через `LEARNING_LEDGER_PATH`, чтобы поднимать изолированные runtime-инстансы для smoke/preflight и не смешивать их с основной памятью;
- аналитический блок `server/self_learning/rishi.mjs`, который читает ledger, вычисляет gradients, выделяет degradation/opportunity signals и формирует rollback-aware рекомендации;
- чат-консоль в интерфейсе, которая умеет работать в трех режимах: `auto`, `server`, `local`;
- клиентский контракт вызова рантайма с безопасным fallback на локальную симуляцию;
- маршрутизация ответа и trace между выбранным профилем задачи и выбранным провайдером runtime.
- исполняемый `learning report` для micro backprop, night distillation и architectural mutation;
- журнал ошибок и memory shards для слоя `Memory Distillation Layer`;
- policy gate `Control Core / Shiva`, который блокирует автоматическое закрепление патчей в защищенные поверхности.

## Серверное накопление learning state

Теперь сервер не только возвращает `learningReport` в ответе, но и сохраняет его в `server/self_learning/data/learning-ledger.json`.

- `POST /api/agent/run` записывает очередной цикл в ledger;
- `GET /api/learning/state` возвращает накопленный snapshot и счетчики;
- `GET /api/rishi/state` возвращает inspectable state аналитика Rishi: gradients, insights и recommended action;
- фоновый `Night Distillation` запускается по таймеру `NIGHT_DISTILLATION_INTERVAL_MS` и сжимает последние циклы в долговременные memory shards.
- `Rishi checkpoint` запускается по таймеру `RISHI_CHECKPOINT_INTERVAL_MS` и записывает gradients/insights как first-class rollback-aware события в ledger.

Во фронтенде появилась отдельная inspectable-панель `Ledger и Rishi`, которая запрашивает оба endpoint и показывает накопленные циклы, состояние night distillation и рекомендации аналитического блока.

## Telegram Bot

Теперь Пантеон можно связать с Telegram через встроенный polling-бот без дополнительных npm-зависимостей.

Что нужно сделать:

- создать бота через `@BotFather` и получить token;
- узнать свой `chat_id` и при желании ограничить доступ только им;
- запустить runtime с переменными окружения:

```bash
export PATH="$HOME/.local/bin:$HOME/.local/node-current/bin:$PATH"
export TELEGRAM_BOT_TOKEN="<bot-token>"
export TELEGRAM_ALLOWED_CHAT_IDS="<your-chat-id>"
export TELEGRAM_DEFAULT_PERSONALITY_ID="default"
export TELEGRAM_BOT_AUTOSTART=true
npm run dev:agent-server
```

Доступные HTTP endpoints:

- `GET /api/telegram/status`
- `GET /api/telegram/logs`
- `POST /api/telegram/config`
- `POST /api/telegram/start`
- `POST /api/telegram/stop`
- `POST /api/telegram/send`

Команды внутри Telegram:

- `/start` — открыть bridge-сессию с Пантеоном;
- `/stop` — остановить текущую сессию;
- `/status` — показать состояние Telegram bot и bridge;
- `/personality <id>` — выбрать personality Atman;
- `/help` — показать список команд.

Обычные текстовые сообщения после `/start` маршрутизируются в Пантеон через существующий bridge: простой диалог идет в Atman, а запросы про интернет, браузер, нет-серфинг и tool-use делегируются в Pantheon runtime.

## Atman Social + Multimodal Layer

Для personalities Atman добавлен отдельный социальный и мультимодальный слой, привязанный к уже существующим trait/state-профилям.

Новые social endpoints:

- `GET /api/atman/social-map`
- `POST /api/atman/social-simulate`

Новые multimodal endpoints:

- `GET /api/atman/media/status`
- `GET /api/atman/media/logs`
- `POST /api/atman/media/profile`
- `POST /api/atman/media/tts`
- `POST /api/atman/media/stt`
- `POST /api/atman/media/image/generate`
- `POST /api/atman/media/image/describe`
- `POST /api/atman/media/video/generate`
- `POST /api/atman/media/video/describe`

Переменные окружения для внешних провайдеров необязательны. Если они не заданы, runtime использует локальные stub/fallback-режимы, чтобы endpoints оставались исполняемыми:

- `PANTHEON_TTS_API_URL`
- `PANTHEON_STT_API_URL`
- `PANTHEON_IMAGE_API_URL`
- `PANTHEON_VIDEO_API_URL`

Stub-режимы сейчас делают следующее:

- TTS генерирует WAV-артефакт с synthetic voice tone;
- STT принимает mock transcript и возвращает personality-aware transcription result;
- image generation создает SVG-card с характером личности и prompt;
- video generation создает JSON storyboard-артефакт;
- image/video recognition возвращают краткое personality-aware описание.

Операторские controls для этих endpoint'ов добавлены в `static/admin.html`, а детальное техническое задание на дальнейшее развитие зафиксировано в `docs/copilot-multimodal-personality-task.md`.

## Точный План Интеграции

Ниже зафиксирован практический порядок интеграции каналов познания, верификации обучения и контроля резонанса, уже привязанный к текущему коду проекта.

### Фаза 1. Явная обратная связь и reinforcement loop

- `POST /api/feedback`: сервер принимает оценку ответа и причину.
- При `POST /api/feedback` feedback event сразу превращается в pending reinforcement gradient и пишется в ledger как first-class сущность.
- Если количество pending gradients достигает `FEEDBACK_AUTO_APPLY_BATCH_SIZE`, сервер сразу запускает Shiva-gated auto-apply без ожидания таймера.
- `POST /api/feedback/process`: служит для догонки legacy/unprocessed feedback events без ожидания таймера.
- `POST /api/feedback/apply`: запускает Shiva-gated apply loop и переводит pending gradients в `applied` или `rejected`.
- `server/agent-runtime.mjs`: держит автоматический `feedback processing loop`, автоматический `feedback apply loop` и ручные триггеры для проверки без ожидания таймера.
- `server/self_learning/learning-ledger.mjs`: хранит и сами feedback events, и feedback-derived gradients, и статус последней обработки и применения.
- `src/components/AgentConsole.tsx`: кнопки `+ Верно` и `- Неверно` плюс текстовое поле причины.
- `src/components/LearningStatePanel.tsx`: показывает последние feedback events, feedback gradients, pending/applied counts и моменты последней обработки и применения.

Статус: реализовано.

### Фаза 2A. Truth Core

- `server/validation/pantheon-validator.mjs`: уже дает рабочий baseline по трем осям: internal consistency, factual grounding и utility posture.
- `server/self_learning/learning-ledger.mjs`: уже хранит `facts` с `score` и `expiresAt`, умеет recall по ключевым словам и сохраняет `validationIncidents`.
- `POST /api/facts/store` и `POST /api/facts/recall`: уже образуют базовый слой fact-memory с TTL и confidence.
- `POST /api/agent/run`: уже прогоняет ответ через validator до выдачи пользователю и удерживает unsafe reply через validation gate.

Доработка этой фазы нужна не в направлении нового отдельного Python-модуля, а в усилении существующего JS/ledger-слоя:

- разделить типы утверждений: `fact`, `inference`, `instruction`, `preference`, `hypothesis`;
- добавить provenance-модель для фактов: `manual`, `research`, `runtime-observed`, `validation-confirmed`, `user-provided`, `inferred`;
- ввести confidence lifecycle: decay, revalidation, promotion/demotion после повторных подтверждений или конфликтов;
- усилить contradiction model: entity-aware conflicts, relation-aware conflicts, numeric conflicts, negation conflicts;
- отделить truth verdict от uncertainty posture: `confident`, `cautious`, `insufficient-evidence`;
- отделить фактическую корректность от полезности ответа, чтобы система различала «истинно, но слабо полезно» и «полезно, но не доказано».

Статус: базовый слой реализован, требуется hardening до полноценного truth-core.

### Фаза 2B. Validation Pressure

- `server/self_learning/rishi.mjs`: уже использует validation failures как сильные деградационные сигналы и усиливает memory / trace pressure.
- `server/self_learning/resonance-monitor.mjs`: уже читает `validationIncidents` как часть resonance score.
- `src/components/AgentConsole.tsx` и `src/components/LearningStatePanel.tsx`: уже показывают fact matches, failure reasons, факт-память и validation failure counters.

Следующий уровень этой фазы:

- нормализовать validation-сигналы в отдельные pressure-каналы: `contradictionPressure`, `factualPressure`, `uncertaintyPressure`, `utilityPressure`;
- сделать checkpoint quality зависимым не только от общего resonance, но и от pressure profile;
- передавать в Rishi не только инцидент, но и machine-readable breakdown причины отказа;
- использовать validation pressure при ранжировании rollback-ready checkpoint'ов и при рекомендациях inspector-уровня;
- начать автоматическую генерацию regression cases из validation incidents и contradiction clusters как подготовку к следующей фазе.

Статус: частично реализовано через `validationIncidents` и validation-derived gradients, требуется формализация pressure-модели.

### Фаза 2.5. Лингвистический агент

- `server/linguistic/linguistic-agent.mjs`: выделяет intent, tone, response mode и hint для резонанса.
- `server/agent-runtime.mjs`: прогоняет каждое пользовательское сообщение через linguistic agent до вызова runtime.
- `src/components/AgentConsole.tsx`: показывает linguistic profile рядом с learning report.

Статус: реализовано.

### Фаза 3. Резонансный монитор и автоматический откат

- `server/self_learning/resonance-monitor.mjs`: считает resonance score по feedback, validation incidents и dialog engagement.
- `server/agent-runtime.mjs`: держит фоновую задачу resonance monitor, команду `!resonance`, endpoint'ы `/api/resonance/state` и `/api/resonance/check`, а также pause-aware auto-learning loops.
- `server/self_learning/learning-ledger.mjs`: хранит `dialogRuns`, `resonanceEvents`, `learningControl` и `checkpointSnapshots` для rollback.
- `server/self_learning/rishi.mjs`: создает rollback-capable checkpoints и умеет откатывать learning state к последнему good checkpoint.
- При падении resonance ниже `RESONANCE_LOW_THRESHOLD` автообучение ставится на паузу, а learning state откатывается к последнему checkpoint с resonance не ниже `RESONANCE_RECOVERY_THRESHOLD`.
- `src/components/LearningStatePanel.tsx`: показывает текущий resonance state, pause reason, resonance events и позволяет вручную запускать resonance check.

Следующая доработка этой фазы: перевести resonance с грубого счета инцидентов на нормализованные pressure-сигналы из Фазы 2B.

Статус: operational baseline реализован и live-validated, pressure-aware resonance еще предстоит усилить.

### Фаза 4. Eval Harness и regression discipline

- `server/testing/test-suite.mjs`: реализует persistent JSON-backed suite с ручным add/remove/list, scheduled checks и manual run/unblock;
- `server/agent-runtime.mjs`: добавляет `!test_list`, `!test_run`, `!test_unblock` и endpoint'ы `/api/tests/state`, `/api/tests/add`, `/api/tests/remove`, `/api/tests/unblock`, `/api/tests/run`;
- `server/self_learning/learning-ledger.mjs`: держит `testSuiteBlocked`, `testSuiteBlockReason`, `lastTestSuiteRunAt`, `lastTestSuiteAccuracy` как first-class learning control state;
- при падении accuracy ниже `PANTHEON_TEST_SUITE_ACCURACY_THRESHOLD` автообучение блокируется через тот же control plane, что и resonance pause, но с отдельным judge-флагом;
- `src/components/LearningStatePanel.tsx`: показывает состояние judge layer, позволяет вручную пополнять suite, удалять кейсы, запускать suite и снимать test-only блок;
- `server/self_learning/smoke-test.mjs`: проверяет полный block/recovery цикл, включая восстановление после удаления плохого кейса.

Что именно проверяет эта фаза:

- golden tasks для стабильных intent/repair ответов;
- contradiction suites против fact-memory и truth-core;
- recovery/rollback cases после validation pressure spikes;
- prompt-drift и noisy-input checks как подготовку к operator-facing inspector;
- ручную операционную дисциплину: test suite не только оценивает систему, но и останавливает auto-learning, если judge layer считает деградацию неприемлемой.

Статус: operational baseline реализован и live-validated.

### Фаза 5. Inspector и control plane

Фаза 5 стала операторским слоем над уже готовыми truth-core, resonance и test-suite механизмами. Ее цель не в новом judge, а в explainable control plane:

- `server/self_learning/inspector.mjs`: собирает aggregated status, metrics, checkpoint inventory и audit log для ручных действий оператора;
- `server/agent-runtime.mjs`: добавляет inspector-команды `!status`, `!checkpoints`, `!checkpoint`, `!rollback <checkpoint-id>`, `!clear_gradients`, `!set_resonance <low> <high>`, `!set_test_threshold <value>`, `!learning on|off`, `!metrics` и HTTP endpoints `/api/inspector/*`;
- `server/self_learning/learning-ledger.mjs`: теперь хранит `manualLearningPaused`, `manualPauseReason` и `inspectorActions`, так что manual override стал first-class guard с audit trail;
- `src/components/LearningStatePanel.tsx`: стал фактическим inspector surface с control-plane кнопками, threshold editing, rollback actions, incident drilldown и recent control log;
- `server/self_learning/preflight.mjs` и `server/self_learning/smoke-test.mjs`: валидируют inspector endpoints, manual pause, threshold updates, gradient cleanup и rollback API.

Минимальный deliverable для Фазы 5:

- отдельный inspector surface в UI поверх текущего Learning State;
- explainable rollback trail с причиной и affected artifacts;
- editable thresholds и явный status по каждому guard;
- manual learning override и cleanup операций с audit trail;
- подготовка к внешнему operator loop без расширения автономии.

Статус: operational baseline реализован и включен в live validation.

### Фаза 6. Pantheon Web Scout и policy-constrained external action layer

- `server/research/pantheon-web-scout.mjs`: самостоятельный нет-серфинг Пантеона, который умеет собирать источники по query или по прямым URL.
- `server/validation/pantheon-validator.mjs`: уже использует внешние evidence-сигналы как часть truth-check.
- `POST /api/research/run`: ручной запуск web scout как отдельного инструмента обучения.
- `POST /api/validation/run`: ручной запуск validator для произвольного ответа.
- `POST /api/agent/run`: теперь может автоматически запускать scout для аналитических и verification-oriented запросов, а затем валидировать ответ и сохранять оба результата в ledger.

Эту фазу не стоит расширять до агрессивной автономии, пока не усилен truth-core. Правильное продолжение здесь:

- multi-source verification adapters для проверяемых фактов;
- stricter policy gate для внешних действий;
- replayable audit trail для каждого внешнего шага;
- explainable routing между research, validation и navigation.

Статус: базовый research/evidence слой реализован, расширение внешних действий должно идти только после Фазы 4 и 5.

### Фаза 6.1. Pantheon NetSurfer и веб-входы

- `server/navigation/pantheon-net-surfer.mjs`: отдельный browser-automation блок для реального web surfing и имитации действий пользователя через `navigate`, `click`, `type`, `scroll` и `search`;
- NetSurfer изолирован от общего navigation fetch-layer и использует отдельный policy gate, allowlist и graceful fallback, если `playwright` или Chromium еще не установлены;
- `server/agent-runtime.mjs`: раздает `/chat.html` и `/admin.html` как отдельные HTML-входы, добавляет `/api/netsurfer/status`, `/api/netsurfer/navigate`, `/api/netsurfer/search`, `/api/netsurfer/click`, `/api/netsurfer/type`, `/api/netsurfer/scroll` и записывает `netsurferRuns` в основной ledger как normal execution artifact;
- `static/chat_index.html`: пользовательский вход для общения с Atman напрямую через `/api/atman/chat` с возможностью переключиться обратно на полный `/api/agent/run` runtime;
- `static/admin.html`: отдельная lightweight admin-панель для inspector controls, NetSurfer actions и управления весами/памятью Atman поверх `/api/inspector/*`, `/api/netsurfer/*` и `/api/atman/*` endpoints.

Практические ограничения этой фазы:

- `playwright` добавлен в `package.json`, но для реального browser automation нужно выполнить `npm install` и затем `npx playwright install chromium`;
- до установки Playwright сервер не падает: `/api/netsurfer/status` показывает, что модуль недоступен, а action endpoints возвращают понятную ошибку;
- реальный нетсерфинг все еще ограничен host allowlist'ом и policy gate, поэтому автономное поведение не выходит за управляемый operator-safe контур.

Статус: baseline реализован; реальный браузерный execution требует доустановки Playwright runtime.

### Фаза 6.2. Atman dialogue core

- `server/dialog/atman.mjs`: выделенное диалоговое ядро, которое хранит file-backed веса, response patterns и локальную историю разговоров;
- `server/agent-runtime.mjs`: больше не строит текстовый ответ напрямую, а использует Atman как основной dialogue layer внутри полного хода Pantheon;
- `POST /api/atman/chat`, `POST /api/atman/chat/stream`, `GET /api/atman/status`, `GET/POST /api/atman/weights`, `GET /api/atman/history`, `GET/POST /api/atman/examples`, `GET /api/atman/logs`, `POST /api/atman/train`, `POST /api/atman/seed`: отдельный surface для роста Атмана в самостоятельного чат-агента;
- Atman уже получает context от linguistic agent, Web Scout, Navigation Core и NetSurfer, а также меняет собственный стиль через applied feedback gradients;
- `npm run train:atman`: локальный seed/training script, который закладывает минимальную базу знаний ребёнка примерно трёх лет и усиливает стиль ответа без внешней LLM;
- `server/self_learning/rishi.mjs`, `server/self_learning/preflight.mjs` и `server/self_learning/smoke-test.mjs`: теперь учитывают Atman/NetSurfer flow как часть общей runtime-проверки.

Практический смысл этой фазы:

- отделить развитие диалога от внешних действий и control-plane логики;
- удержать совместимость с truth-core, resonance, test-suite и rollback discipline;
- позволить говорить с Атманом потоком, вручную учить его примерами и сразу превращать удачные ответы в regression cases через feedback loop;
- подготовить Atman к будущему переходу на локальную LLM через Ollama без замены общей архитектуры Pantheon.

Статус: operational baseline реализован; по умолчанию Atman работает в обучаемом stub-режиме, а при настройке `ATMAN_OLLAMA_MODEL` может перейти на локальный Ollama runtime.

### Фаза 6.5. Pantheon Navigation Core

- `server/navigation/pantheon-navigation-core.mjs`: безопасный навигационный движок с `robots.txt`, allowlist-хостами, inspectable route trace и human-paced delays.
- `POST /api/navigation/run`: ручной запуск навигации по безопасному маршруту.
- `POST /api/agent/run`: может автоматически запускать Pantheon Navigation Core по явным URL или navigation-oriented запросам.
- `server/self_learning/learning-ledger.mjs`: сохраняет `navigationRuns` как first-class learning artifact.
- `server/self_learning/rishi.mjs`: использует навигационные сессии как аналитический источник и verification signal.
- `src/components/AgentConsole.tsx` и `src/components/LearningStatePanel.tsx`: показывают summary, status, visited/block counters и inspectable traces navigation core.

Статус: безопасный baseline реализован.

### Фаза 7. Long-running runtime и operator loop

- после стабилизации truth-core, eval harness и inspector-слоя систему можно готовить к непрерывной работе;
- сюда входят 24/7 deployment, backup/restore, scheduled eval runs, operator notifications, safe resume after rollback и внешний канал управления;
- `server/agent-runtime.mjs`, ledger checkpoints и resonance pause/resume уже дают техническую основу, но production-операционный контур еще не собран.

Статус: инфраструктурная база частично готова, полноценный runtime-operations слой еще впереди.

### Уже реализованные baseline-проверки

- `server/linguistic/benchmark-suite.mjs`: набор контрольных кейсов для лингвистического агента.
- `POST /api/tests/run`: запускает suite и пишет результат в ledger.
- `src/components/LearningStatePanel.tsx`: показывает score, список кейсов и историю benchmark run.

Статус: реализовано как baseline, но это еще не полноценный eval harness из новой Фазы 4.

### Текущие каналы верификации обучения

Проверка строится по четырем каналам:

- `Shiva policy approval`: проходит ли candidate patch через инварианты.
- `critic journal`: фиксирует деградацию, ошибки и rollback signals.
- `explicit user feedback`: учитывает прямую оценку пользователя.
- `feedback-derived gradients`: подтверждает, что оценка не только записана, но и превращена в обучающий сигнал.
- `Pantheon Web Scout`: добавляет внешний источник сведений как отдельный обучающий канал.
- `Pantheon Validator`: добавляет машинную truth-check проверку по структурированным критериям.
- `fact memory`: добавляет проверку на согласованность с ранее сохраненными фактами с TTL и confidence.
- `Pantheon Navigation Core`: подтверждает, что внешний выход идет по inspectable и policy-constrained маршруту.
- `benchmark suite score`: отдельно контролирует, не дрейфует ли linguistic agent.

Эти каналы уже входят в `verificationSignals` внутри `Rishi state` и образуют основу для будущего Eval Harness.

Статус: реализовано.

### Живая внешняя модель

- `server/agent-runtime.mjs`: уже умеет идти в OpenAI Responses API.
- Для реального перехода с fallback на живую модель нужен `OPENAI_API_KEY`.
- После подключения ключа живой LLM должен включаться не как отдельная фаза развития, а как runtime-layer поверх уже усиленного truth-core, eval harness и inspector.

Статус: инфраструктура готова, но живой LLM вызов заблокирован отсутствием `OPENAI_API_KEY`.

## npm-зависимости

В `package.json` сейчас используются пакеты:

- `@openai/agents`
- `playwright`
- `react`
- `react-dom`
- `zod`

Для локальной установки зависимостей используется одна команда:

```bash
npm install
```

Основные команды запуска:

```bash
npm run dev:agent-server
npm run dev
```

Основная валидация репозитория:

```bash
npm run check
```

В VS Code для этого же сценария добавлен task `check`.

Для server smoke-test:

```bash
npm run preflight:agent-server
npm run smoke:agent-server
```

`preflight:agent-server` проверяет диагностические endpoint и печатает активные интервалы Night Distillation, Rishi checkpoint, feedback processing, feedback apply, batch-threshold auto-apply, resonance monitor и параметры Pantheon Web Scout / Pantheon Navigation Core / fact memory.

Клиент будет отправлять запросы в `VITE_AGENT_API_URL`. Если сервер недоступен, режим `auto` автоматически переключится на локальный fallback-рантайм.

Для ключа модели добавлен шаблон `.env.example`:

```bash
VITE_OPENAI_API_KEY=
VITE_AGENT_API_URL=http://localhost:8787/api/agent/run
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
AGENT_SERVER_PORT=8787
LEARNING_LEDGER_PATH=
FEEDBACK_PROCESSING_INTERVAL_MS=180000
FEEDBACK_APPLICATION_INTERVAL_MS=240000
FEEDBACK_AUTO_APPLY_BATCH_SIZE=5
PANTHEON_WEB_SCOUT_ENABLED=true
PANTHEON_WEB_SCOUT_MAX_FINDINGS=3
PANTHEON_WEB_SCOUT_TIMEOUT_MS=7000
PANTHEON_NAVIGATION_ALLOWLIST=localhost,127.0.0.1,duckduckgo.com,html.duckduckgo.com
PANTHEON_NAVIGATION_MAX_STEPS=3
PANTHEON_NAVIGATION_MIN_DELAY_MS=350
PANTHEON_NAVIGATION_MAX_DELAY_MS=1200
PANTHEON_NAVIGATION_TIMEOUT_MS=7000
PANTHEON_FACT_TTL_MS=86400000
PANTHEON_FACT_MIN_SCORE=0.65
RESONANCE_CHECK_INTERVAL_MS=600000
RESONANCE_LOW_THRESHOLD=0.3
RESONANCE_RECOVERY_THRESHOLD=0.7
RESONANCE_LOOKBACK_MINUTES=60
RESONANCE_MIN_FEEDBACK_SAMPLES=5
RESONANCE_PAUSE_DURATION_MS=1800000
```

`LEARNING_LEDGER_PATH` можно оставить пустым для стандартного `server/self_learning/data/learning-ledger.json` или указать отдельный JSON-файл для изолированных тестовых прогонов.

## Технологии

- React
- TypeScript
- Vite

## Текущее ограничение среды

Node.js и npm уже установлены локально, поэтому серверный рантайм, inspectable UI, benchmark suite и feedback loop можно реально запускать через `npm run dev:agent-server`, `npm run preflight:agent-server`, `npm run smoke:agent-server` и `npm run build`. Единственный остающийся внешний блокер для живой LLM-ветки — отсутствие `OPENAI_API_KEY`.