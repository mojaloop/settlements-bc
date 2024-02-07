# Settlements Bounded Context - Event Handler Service

### Install

See notes in root dir of this repository
More information on how to install NVM: https://github.com/nvm-sh/nvm

## Build

```bash
npm run build
```

## Run this service

Anywhere in the repo structure:

```bash
npm run packages/event-handler-svc start
```

## Auto build (watch)

```bash
npm run watch
```

## Unit Tests

```bash
npm run test:unit
```

## Integration Tests

```bash
npm run test:integration
```

## Configuration 
### Environment variables

| Environment Variable | Description    | Example Values         |
|---------------------|-----------------|-----------------------------------------|
| PRODUCTION_MODE      | Flag indicating production mode   | FALSE                  |
| LOG_LEVEL            | Logging level for the application                  | LogLevel.DEBUG        |
| KAFKA_URL       | Kafka broker URL     | localhost:9092          |
| KAFKA_LOGS_TOPIC      | Kafka topic for logs          | logs    |
| KAFKA_AUDITS_TOPIC        | Kafka topic for audits              | audits                 |
| AUDIT_KEY_FILE_PATH  | File path for audit key           | /app/data/audit_private_key.pem         |
| SVC_CLIENT_ID        | Service client ID                 | settlements-bc-api-svc                 |
| SVC_CLIENT_SECRET    | Service client secret             | superServiceSecret     |
| SERVICE_START_TIMEOUT_MS               | Timeout for service startup in milliseconds        | 60_000                 |
