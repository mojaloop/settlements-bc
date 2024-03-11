/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

"use strict";


import {ConsoleLogger, ILogger} from "@mojaloop/logging-bc-public-types-lib";


import {
    ConfigurationClient,
    DefaultConfigProvider
} from "@mojaloop/platform-configuration-bc-client-lib";
import {AuthenticatedHttpRequester} from "@mojaloop/security-bc-client-lib";
import {MLKafkaJsonConsumer} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
// import { ConfigParameterTypes } from "@mojaloop/platform-configuration-bc-public-types-lib";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require("../../package.json");

// configs - constants / code dependent
const BC_NAME = "settlements-bc";
const APP_NAME = "command-handler-svc";
const APP_VERSION = packageJSON.version;
const CONFIGSET_VERSION = "0.0.1";

// configs - non-constants
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";

// security
const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "interop-api-bc-fspiop-api-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";
const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix
const CONFIG_BASE_URL = process.env["CONFIG_BASE_URL"] || "http://localhost:3100";
const logger: ILogger = new ConsoleLogger();

// use default url from PLATFORM_CONFIG_CENTRAL_URL env var
const authRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);

const messageConsumer = new MLKafkaJsonConsumer({
 kafkaBrokerList: KAFKA_URL,
 kafkaGroupId: `${APP_NAME}_${Date.now()}` // unique consumer group - use instance id when possible
}, logger.createChild("configClient.consumer"));
const defaultConfigProvider: DefaultConfigProvider = new DefaultConfigProvider(logger, authRequester, messageConsumer,CONFIG_BASE_URL);

const configClient = new ConfigurationClient(BC_NAME, APP_NAME, APP_VERSION, CONFIGSET_VERSION, defaultConfigProvider);
export = configClient;

