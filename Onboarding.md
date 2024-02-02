# Onboarding

>*Note:* Before completing this guide, make sure you have completed the _general_ onboarding guide in the [base mojaloop repository](https://github.com/mojaloop/mojaloop/blob/main/onboarding.md#mojaloop-onboarding).

## Contents

<!-- vscode-markdown-toc -->
1. [Prerequisites](#1-prerequisites)
2. [Service Overview](#2-service-overview)
3. [Installing and Building](#3-installing-and-building)
4. [Running Locally](#4-running-locally-dependencies-inside-of-docker)
5. [Running Inside Docker](#5-running-inside-docker)
6. [Testing](#6-testing)
7. [Common Errors/FAQs](#7-common-errorsfaqs)

<!-- vscode-markdown-toc-config
	numbering=true
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->
##  1. Prerequisites

If you have followed the [general onboarding guide](https://github.com/mojaloop/mojaloop/blob/main/onboarding.md#mojaloop-onboarding), you should already have the following cli tools installed:

* `brew` (macOS), [todo: windows package manager]
* `curl`, `wget`
* `docker` + `docker-compose`
* `node`, `npm` and (optionally) `nvm`

## 2. Service Overview 
The Settlements BC consists of the following packages;

`public-types-lib`
- Public shared types.
[README](./packages/public-types-lib/README.md)

`domain-lib`
- Domain library types.
[README](./packages/domain-lib/README.md)

`infrastructure-lib`
- Infrastructure library.
[README](./packages/infrastructure-lib/README.md)

`settlements-bc-api-svc`
- HTTP service for Settlements BC.
[README](packages/api-svc/README.md)

`event-handler-svc`
- Event handler service for Settlements BC.
[README](packages/event-handler-svc/README.md)

`command-handler-svc`
- Command handler service for Settlements BC.
[README](packages/command-handler-svc/README.md)

`settlement-model-lib`
- Settlement library used to determine the settlement model for a settlement transfer.
[README](./packages/settlement-model-lib/README.md)

`shared-mocks-lib`
- Mock implementation used for testing.
[README](./packages/shared-mocks-lib/README.md)


## 3. <a name='InstallingandBuilding'></a>Installing and Building

Firstly, clone your fork of the `settlement-bc` onto your local machine:
```bash
git clone https://github.com/<your_username>/settlement-bc.git
```

Then `cd` into the directory and install the node modules:
```bash
cd settlement-bc
```

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

#### Build

```bash
npm run build
``` 

## 4. Running Locally (dependencies inside of docker)

In this method, we will run all of the core dependencies inside of docker containers, while running the `settlement-bc` server on your local machine.

> Alternatively, you can run the `settlement-bc` inside of `docker-compose` with the rest of the dependencies to make the setup a little easier: [Running Inside Docker](#5-running-inside-docker).

### 4.1 Run all back-end dependencies as part of the Docker Compose

Use [platform-shared-tools docker-compose files](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/): 
Follow instructions in the `README.md` files to run the supporting services. Make sure you have the following services up and running:

- infra services : [docker-compose-infra](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-infra)
	- mongo
	- kafka
	- zoo
- cross-cutting services : [docker-compose-cross-cutting](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-cross-cutting)
	- authentication-svc
	- authorization-svc
	- identity-svc
	- platform-configuration-svc
- apps services : [docker-compose-apps](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/deployment/docker-compose-apps)
	- account-and-balances (both services)
    - participants-svc

This will do the following:
* `docker pull` down any dependencies defined in each `docker-compose.yml` file, and the services.
* run all of the containers together
* ensure that all dependencies have started for each services.


### 4.2 Set Up Environment Variables

```bash
# set the MONGO_URL* environment variable (required):
export MONGO_URL=mongodb://root:mongoDbPas42@localhost:27017/";
```

```bash
# set the AUDIT_KEY_FILE_PATH 
export AUDIT_KEY_FILE_PATH=./dist/auditing_cert
```
See the README.md file on each services for more Environment Variable Configuration options.

### 4.3 Run the server

```bash
npm run start:api-svc
```

## 5. Running Inside Docker


## 6. Testing
We use `npm` scripts as a common entrypoint for running the tests. Tests include unit, functional, and integration.

```bash
# unit tests:
npm run test:unit

# check test coverage
npm run test:coverage

# integration tests
npm run test:integration
```

### 6.1 Testing the `settlement-bc` API with Postman

[Here](https://github.com/mojaloop/platform-shared-tools/tree/main/packages/postman) you can find a complete Postman collection, in a json file, ready to be imported to Postman.


## 7. Common Errors/FAQs
### 7.1 Unable to load `dlfcn_load`
```bash
error:25066067:DSO support routines:dlfcn_load:could not load the shared library
```
Fix: https://github.com/mojaloop/security-bc.git  `export OPENSSL_CONF=/dev/null`