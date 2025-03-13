/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Contributors
--------------
This is the official list of the Mojaloop project contributors for this file.
Names of the original copyright holders (individuals or organizations)
should be listed with a '*' in the first column. People who have
contributed from an organization can be listed under the organization
that actually holds the copyright for their contributions (see the
Mojaloop Foundation for an example). Those individuals should have
their names indented and be marked with a '-'. Email address can be added
optionally within square brackets <email>.

* Mojaloop Foundation
- Name Surname <name.surname@mojaloop.io>

* Crosslake
- Pedro Sousa Barreto <pedrob@crosslaketech.com>
*****/

"use strict";

import {existsSync} from "fs";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import {
	AuditClient,
	KafkaAuditClientDispatcher,
	LocalAuditClientCryptoProvider
} from "@mojaloop/auditing-bc-client-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {
	MLKafkaJsonConsumer,
	MLKafkaJsonProducer,
	MLKafkaJsonConsumerOptions,
	MLKafkaJsonProducerOptions
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {IMessageConsumer, IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import process from "process";
import {SettlementsEventHandler} from "./handler";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require("../package.json");

import {IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import crypto from "crypto";

import {GetSettlementsConfigSet} from "@mojaloop/settlements-bc-config-lib";

const BC_NAME = "quoting-bc";
const APP_NAME = "event-handler-svc";
const APP_VERSION = packageJSON.version;
const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOG_LEVEL: LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;
const INSTANCE_NAME = `${BC_NAME}_${APP_NAME}`;
const INSTANCE_ID = `${INSTANCE_NAME}__${crypto.randomUUID()}`;

// Message Consumer/Publisher
const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const KAFKA_AUTH_ENABLED = process.env["KAFKA_AUTH_ENABLED"] && process.env["KAFKA_AUTH_ENABLED"].toUpperCase()==="TRUE" || false;
const KAFKA_AUTH_PROTOCOL = process.env["KAFKA_AUTH_PROTOCOL"] || "sasl_plaintext";
const KAFKA_AUTH_MECHANISM = process.env["KAFKA_AUTH_MECHANISM"] || "plain";
const KAFKA_AUTH_USERNAME = process.env["KAFKA_AUTH_USERNAME"] || "user";
const KAFKA_AUTH_PASSWORD = process.env["KAFKA_AUTH_PASSWORD"] || "password";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_KEY_FILE_PATH = process.env["AUDIT_KEY_FILE_PATH"] || "/app/data/audit_private_key.pem";

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "settlements-event-handler-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";

const SERVICE_START_TIMEOUT_MS= (process.env["SERVICE_START_TIMEOUT_MS"] && parseInt(process.env["SERVICE_START_TIMEOUT_MS"])) || 60_000;

// kafka common options
const kafkaProducerCommonOptions:MLKafkaJsonProducerOptions = {
	kafkaBrokerList: KAFKA_URL,
	producerClientId: `${INSTANCE_ID}`,
};
const kafkaConsumerCommonOptions:MLKafkaJsonConsumerOptions ={
	kafkaBrokerList: KAFKA_URL
};
if(KAFKA_AUTH_ENABLED){
	kafkaProducerCommonOptions.authentication = kafkaConsumerCommonOptions.authentication = {
		protocol: KAFKA_AUTH_PROTOCOL as "plaintext" | "ssl" | "sasl_plaintext" | "sasl_ssl",
		mechanism: KAFKA_AUTH_MECHANISM as "PLAIN" | "GSSAPI" | "SCRAM-SHA-256" | "SCRAM-SHA-512",
		username: KAFKA_AUTH_USERNAME,
		password: KAFKA_AUTH_PASSWORD
	};
}

const kafkaConsumerOptions: MLKafkaJsonConsumerOptions = {
	...kafkaConsumerCommonOptions,
	kafkaGroupId: `${BC_NAME}_${APP_NAME}`
};

let globalLogger: ILogger;

export class Service {
	static logger: ILogger;
	static auditClient: IAuditClient;
	static messageConsumer: IMessageConsumer;
	static messageProducer: IMessageProducer;
	static handler: SettlementsEventHandler;
	static startupTimer: NodeJS.Timeout;
	static configClient: IConfigurationClient;

	static async start(
		logger?: ILogger,
		auditClient?: IAuditClient,
		messageConsumer?: IMessageConsumer,
		messageProducer?: IMessageProducer
	): Promise<void> {
		console.log(`Service starting with PID: ${process.pid}`);

		this.startupTimer = setTimeout(()=>{
			throw new Error("Service start timed-out");
		}, SERVICE_START_TIMEOUT_MS);

        // We only need the minimum, no configProvider required
        this.configClient = GetSettlementsConfigSet(BC_NAME);
        await this.configClient.init();

		if (!logger) {
			logger = new KafkaLogger(
				BC_NAME,
				APP_NAME,
				APP_VERSION,
				kafkaProducerCommonOptions,
				KAFKA_LOGS_TOPIC,
				LOG_LEVEL
			);
			await (logger as KafkaLogger).init();
		}
		globalLogger = this.logger = logger;

		/// start auditClient
		if (!auditClient) {
			if (!existsSync(AUDIT_KEY_FILE_PATH)) {
				if (PRODUCTION_MODE) process.exit(9);
				// create e tmp file
				LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_KEY_FILE_PATH, 2048);
			}
			const auditLogger = logger.createChild("auditDispatcher");
			auditLogger.setLogLevel(LogLevel.INFO);

			const cryptoProvider = new LocalAuditClientCryptoProvider(AUDIT_KEY_FILE_PATH);
			const auditDispatcher = new KafkaAuditClientDispatcher(kafkaProducerCommonOptions, KAFKA_AUDITS_TOPIC, auditLogger);
			// NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
			auditClient = new AuditClient(BC_NAME, APP_NAME, APP_VERSION, cryptoProvider, auditDispatcher);
			await auditClient.init();
		}
		this.auditClient = auditClient;

		if(!messageConsumer){
			const consumerHandlerLogger = logger.createChild("handlerConsumer");
			consumerHandlerLogger.setLogLevel(LogLevel.INFO);
			messageConsumer = new MLKafkaJsonConsumer(kafkaConsumerOptions, consumerHandlerLogger);
		}
		this.messageConsumer = messageConsumer;

		if (!messageProducer) {
			const producerLogger = logger.createChild("producerLogger");
			producerLogger.setLogLevel(LogLevel.INFO);
			messageProducer = new MLKafkaJsonProducer(kafkaProducerCommonOptions, producerLogger);
		}
		this.messageProducer = messageProducer;

		// create handler and start it
		this.handler = new SettlementsEventHandler(this.logger, this.messageConsumer, this.messageProducer);
		await this.handler.start();

		this.logger.info(`Settlement Event Handler Service started, version: ${APP_VERSION}`);

		// remove startup timeout
		clearTimeout(this.startupTimer);
	}

	static async stop() {
		if (this.handler) await this.handler.stop();
		if (this.messageConsumer) await this.messageConsumer.destroy(true);
		if (this.messageProducer) await this.messageProducer.destroy();

		if (this.auditClient) await this.auditClient.destroy();
		if (this.logger && this.logger instanceof KafkaLogger) await this.logger.destroy();
	}
}



/**
 * process termination and cleanup
 */

async function _handle_int_and_term_signals(signal: NodeJS.Signals): Promise<void> {
	console.info(`Service - ${signal} received - cleaning up...`);
	let clean_exit = false;
	setTimeout(() => {
		clean_exit || process.exit(99);
	}, 5000);

	// call graceful stop routine
	await Service.stop();

	clean_exit = true;
	process.exit();
}

//catches ctrl+c event
process.on("SIGINT", _handle_int_and_term_signals);
//catches program termination event
process.on("SIGTERM", _handle_int_and_term_signals);

//do something when app is closing
process.on("exit", async () => {
	globalLogger.info("Microservice - exiting...");
});
process.on("uncaughtException", (err: Error) => {
	globalLogger.error(err);
	console.log("UncaughtException - EXITING...");
	process.exit(999);
});
