# Settlements Bounded Context

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/settlements-bc.svg?style=flat)](https://github.com/mojaloop/settlements-bc/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/settlements-bc.svg?style=flat)](https://github.com/mojaloop/settlements-bc/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/settlements-bc.svg?style=flat)](https://hub.docker.com/r/mojaloop/settlements-bc)
[![CircleCI](https://circleci.com/gh/mojaloop/settlements-bc.svg?style=svg)](https://circleci.com/gh/mojaloop/settlements-bc)

The Settlements BC is integral to settling Participant transfers using either Deferred Net Settlement or Immediate Gross Settlement methods. It encompasses the following functions:

- Creating settlement windows,
- Identifying and deploying the required settlement method (DNS/IGS),
- Settling, closing, and updating batches,
- Recording all deposits and withdrawals to the appropriate ledger accounts in the Accounts and Balances BC.

## Contents
- [settlement-bc](#settlement-bc)
  - [Contents](#contents)
  - [Packages](#packages)
  - [Running Locally](#running-locally)
  - [Configuration](#configuration)
  - [API](#api)
  - [Logging](#logging)
  - [Tests](#tests)
  - [Auditing Dependencies](#auditing-dependencies)
  - [Container Scans](#container-scans)
  - [Automated Releases](#automated-releases)
    - [Potential problems](#potential-problems)
  - [Documentation](#documentation)

## Packages
The Settlements BC consists of the following packages;

`public-types-lib`
Public shared types.
[README](./packages/public-types-lib/README.md)

`domain-lib`
Domain library types.
[README](./packages/domain-lib/README.md)

`infrastructure-lib`
Infrastructure library.
[README](./packages/infrastructure-lib/README.md)

`settlements-bc-api-svc`
HTTP service for Settlements BC.
[README](packages/api-svc/README.md)

`event-handler-svc`
Event handler service for Settlements BC.
[README](packages/event-handler-svc/README.md)

`command-handler-svc`
Command handler service for Settlements BC.
[README](packages/command-handler-svc/README.md)

`settlement-model-lib`
Settlement library used to determine the settlement model for a settlement transfer.
[README](./packages/settlement-model-lib/README.md)

`shared-mocks-lib`
Mock implementation used for testing.
[README](./packages/shared-mocks-lib/README.md)

## Running Locally

Please follow the instruction in [Onboarding Document](Onboarding.md) to setup and run the service locally.

## Configuration

See the README.md file on each services for more Environment Variable Configuration options.

## API

For endpoint documentation, see the [API documentation](https://github.com/mojaloop/mojaloop-specification/blob/master/admin-api/admin-api-specification-v1.0.md#api-resource-settlementmodels).

For help preparing and executing transfers, see the [Transfer Guide](TransferGuide.md)

## Documentation
The following documentation provides insight into the Settlements Bounded Context.

- **Technical Flows** - [`../docs/flows`](docs/flows/)
- **Settlement Version 2** - [`../docs/Settlement Version 2.pptx`](docs/Settlement%20Version%202.pptx)
- **Functional Specification** - [`../docs/func_spec`](docs/func_spec/)
- **Settlement Operational Implementation** - https://docs.mojaloop.io/business-operations-framework-docs/guide/SettlementBC.html#core-settlement-operations
- **Reference Architecture** - https://mojaloop.github.io/reference-architecture-doc/boundedContexts/settlements/
- **MIRO Board** - https://miro.com/app/board/o9J_lJyA1TA=/
- **Settlement Functionality in MJL** - https://docs.google.com/presentation/d/19uy6pO_igmQ9uZRnKyZkXD8a8uyMKQcn/edit#slide=id.p1
- **Work Sessions** - https://docs.google.com/document/d/1Nm6B_tSR1mOM0LEzxZ9uQnGwXkruBeYB2slgYK1Kflo/edit#heading=h.6w64vxvw6er4
- **Admin API - Settlement Models** - https://github.com/mojaloop/mojaloop-specification/blob/master/admin-api/admin-api-specification-v1.0.md#api-resource-settlementmodels


## Logging

Logs are sent to standard output by default.

## Build
```bash
npm run build
```

## Tests

### Unit Tests

```bash
npm run test:unit
```

### Run Integration Tests

```shell
npm run test:integration
```

### Run all tests at once
Requires integration tests pre-requisites
```shell
npm run test
```

### Collect coverage (from both unit and integration test types)

After running the unit and/or integration tests:

```shell
npm run posttest
```

You can then consult the html report in:

```shell
coverage/lcov-report/index.html
```


