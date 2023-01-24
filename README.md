# Settlements Bounded Context

## Packages

### settlements-bc-http-svc

[README](./modules/http-svc/README.md)

#### Run

```bash
npm run start:http-svc
```

## Usage

### Install Node version

More information on how to install NVM: https://github.com/nvm-sh/nvm

```bash
nvm install
nvm use
```

### Install Dependencies

```bash
npm install
```

## Build

```bash
npm run build
```

## Unit Tests

```bash
npm run test:unit
```

## Run the services

### Startup supporting services

Use https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-infra

Follow instructions in the docker-compose-infra `README.md` to run the supporting services.


## After running the docker-compose-infra we can start settlements-bc-http-svc:
```shell
npm run start:http-svc
```

## Integration Tests
```bash
npm run test:integration
```

## Troubleshoot

### Unable to load dlfcn_load
```bash
error:25066067:DSO support routines:dlfcn_load:could not load the shared library
```
Fix: https://github.com/mojaloop/security-bc.git  `export OPENSSL_CONF=/dev/null`

## Documentation
The following documentation provides insight into the Settlements Bounded Context.

- **Technical Flows** - `../docs/flows`
- **Settlement Operational Implementation** - https://docs.mojaloop.io/business-operations-framework-docs/guide/SettlementBC.html#core-settlement-operations
- **Reference Architecture** - https://mojaloop.github.io/reference-architecture-doc/boundedContexts/settlements/
