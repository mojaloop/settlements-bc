# Settlements Bounded Context

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/settlements-bc.svg?style=flat)](https://github.com/mojaloop/settlements-bc/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/settlements-bc.svg?style=flat)](https://github.com/mojaloop/settlements-bc/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/settlements-bc.svg?style=flat)](https://hub.docker.com/r/mojaloop/settlements-bc)
[![CircleCI](https://circleci.com/gh/mojaloop/settlements-bc.svg?style=svg)](https://circleci.com/gh/mojaloop/settlements-bc)

## Packages
The Settlements BC consists of the following packages;

### `public-types-lib`
Public shared types.
[README](./packages/public-types-lib/README.md)

### `domain-lib`
Domain library types.
[README](./packages/domain-lib/README.md)

### `infrastructure-lib`
Infrastructure library.
[README](./packages/infrastructure-lib/README.md)

### `settlements-bc-http-svc`
HTTP service for Settlements BC.
[README](packages/api-svc/README.md)

### `settlement-model-lib`
Settlement library used to determine the settlement model for a settlement transfer.
[README](./packages/settlement-model-lib/README.md)

### `shared-mocks-lib`
Mock implementation used for testing.
[README](./packages/shared-mocks-lib/README.md)

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


# Run Integration Tests

```shell
npm run test:integration
```

## After running the docker-compose-infra we can start settlements-bc-http-svc:
```shell
npm run start:http-svc
```

Make sure you have the following services up and running (available in platform-shared-tools docker-compose files):

- infra
	- mongo
	- kafka
	- zoo

- cross-cutting
	- authentication-svc
	- authorization-svc
	- identity-svc
	- platform-configuration-svc
- apps
	- account-and-balances (both services)
    - participants-svc
    - 


# Collect coverage (from both unit and integration test types)

After running the unit and/or integration tests:

```shell
npm run posttest
```

You can then consult the html report in:

```shell
coverage/lcov-report/index.html
```

# Run all tests at once
Requires integration tests pre-requisites
```shell
npm run test
```

## Troubleshoot

### Unable to load `dlfcn_load`
```bash
error:25066067:DSO support routines:dlfcn_load:could not load the shared library
```
Fix: https://github.com/mojaloop/security-bc.git  `export OPENSSL_CONF=/dev/null`

## Documentation
The following documentation provides insight into the Settlements Bounded Context.

- **Technical Flows** - `../docs/flows`
- **Settlement Version 2** - `../docs/Settlement Version 2.pptx`
- **Settlement Operational Implementation** - https://docs.mojaloop.io/business-operations-framework-docs/guide/SettlementBC.html#core-settlement-operations
- **Reference Architecture** - https://mojaloop.github.io/reference-architecture-doc/boundedContexts/settlements/
- **MIRO Board** - https://miro.com/app/board/o9J_lJyA1TA=/
- **Settlement Functionality in MJL** - https://docs.google.com/presentation/d/19uy6pO_igmQ9uZRnKyZkXD8a8uyMKQcn/edit#slide=id.p1
- **Work Sessions** - https://docs.google.com/document/d/1Nm6B_tSR1mOM0LEzxZ9uQnGwXkruBeYB2slgYK1Kflo/edit#heading=h.6w64vxvw6er4
- **Admin API - Settlement Models** - https://github.com/mojaloop/mojaloop-specification/blob/master/admin-api/admin-api-specification-v1.0.md#api-resource-settlementmodels
