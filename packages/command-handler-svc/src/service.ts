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

import process from "process";
import {SettlementsCommandHandler} from "./handler";
import {
	AuthenticatedHttpRequester,
	LoginHelper
} from "@mojaloop/security-bc-client-lib";

import {
	IAccountsBalancesAdapter, 
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo,
	ISettlementConfigRepo,
	ISettlementMatrixRequestRepo,
	SettlementPrivilegesDefinition,
	SettlementsAggregate
} from "@mojaloop/settlements-bc-domain-lib";
import {Express} from "express";
import {
	IAuthorizationClient,
	ITokenHelper,
	ILoginHelper,
	IAuthenticatedHttpRequester
} from "@mojaloop/security-bc-public-types-lib";

import {AuthorizationClient, TokenHelper} from "@mojaloop/security-bc-client-lib";
import {IMessageConsumer, IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
	GrpcAccountsAndBalancesAdapter,
	TigerBeetleAccountsAndBalancesAdapter,
	MongoSettlementBatchRepo,
	MongoSettlementConfigRepo
} from "@mojaloop/settlements-bc-infrastructure-lib";
import {
	MongoSettlementTransferRepo
} from "@mojaloop/settlements-bc-infrastructure-lib";
import {MongoSettlementMatrixRepo} from "@mojaloop/settlements-bc-infrastructure-lib";
import {IMetrics} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {PrometheusMetrics} from "@mojaloop/platform-shared-lib-observability-client-lib";

import configClient from "./config";
import {DEFAULT_SETTLEMENT_MODEL_ID, DEFAULT_SETTLEMENT_MODEL_NAME} from "@mojaloop/settlements-bc-public-types-lib";
import {IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";

import crypto from "crypto";

const BC_NAME = configClient.boundedContextName;
const APP_NAME = configClient.applicationName;
const APP_VERSION = configClient.applicationVersion;
const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOG_LEVEL: LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.INFO;

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const MONGO_URL = process.env["MONGO_URL"] || "mongodb://root:example@localhost:27017/";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_KEY_FILE_PATH = process.env["AUDIT_KEY_FILE_PATH"] || "/app/data/audit_private_key.pem";

const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix

const AUTH_N_TOKEN_ISSUER_NAME = process.env["AUTH_N_TOKEN_ISSUER_NAME"] || "http://localhost:3201/";
const AUTH_N_TOKEN_AUDIENCE = process.env["AUTH_N_TOKEN_AUDIENCE"] || "mojaloop.vnext.default_audience";
const AUTH_N_SVC_JWKS_URL = process.env["AUTH_N_SVC_JWKS_URL"] || `${AUTH_N_SVC_BASEURL}/.well-known/jwks.json`;

const AUTH_Z_SVC_BASEURL = process.env["AUTH_Z_SVC_BASEURL"] || "http://localhost:3202";

const ACCOUNTS_BALANCES_COA_SVC_URL = process.env["ACCOUNTS_BALANCES_COA_SVC_URL"] || "localhost:3300";

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "settlements-bc-command-handler-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";

const DB_NAME: string = "settlements";
const SETTLEMENT_CONFIGS_COLLECTION_NAME: string = "configs";
const SETTLEMENT_BATCHES_COLLECTION_NAME: string = "batches";
const SETTLEMENT_MATRICES_COLLECTION_NAME: string = "matrices";
const SETTLEMENT_TRANSFERS_COLLECTION_NAME: string = "transfers";

const SERVICE_START_TIMEOUT_MS= (process.env["SERVICE_START_TIMEOUT_MS"] && parseInt(process.env["SERVICE_START_TIMEOUT_MS"])) || 60_000;

const INSTANCE_NAME = `${BC_NAME}_${APP_NAME}`;
const INSTANCE_ID = `${INSTANCE_NAME}__${crypto.randomUUID()}`;

const kafkaConsumerOptions: MLKafkaJsonConsumerOptions = {
	kafkaBrokerList: KAFKA_URL,
	kafkaGroupId: `${BC_NAME}_${APP_NAME}`
};

const kafkaProducerOptions: MLKafkaJsonProducerOptions = {
	kafkaBrokerList: KAFKA_URL
};

// TigerBeetle:
const USE_TIGERBEETLE= process.env["USE_TIGERBEETLE"] && process.env["USE_TIGERBEETLE"].toUpperCase()==="TRUE" || false;
const TIGERBEETLE_CLUSTER_ID = process.env["TIGERBEETLE_CLUSTER_ID"] || 0;
const TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES = process.env["TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES"] || "localhost:9001";

// Redis:
const REDIS_HOST = process.env["REDIS_HOST"] || "localhost";
const REDIS_PORT = (process.env["REDIS_PORT"] && parseInt(process.env["REDIS_PORT"])) || 6379;

let globalLogger: ILogger;

export class Service {
	static logger: ILogger;
	static app: Express;
	static tokenHelper: ITokenHelper;
	static loginHelper: ILoginHelper;
	static authorizationClient: IAuthorizationClient;
	static auditClient: IAuditClient;
	static accountsAndBalancesAdapter: IAccountsBalancesAdapter;
	static configRepo: ISettlementConfigRepo;
	static batchRepo: ISettlementBatchRepo;
	static batchTransferRepo: ISettlementBatchTransferRepo;
	static matrixRepo: ISettlementMatrixRequestRepo;
	static messageConsumer: IMessageConsumer;
	static messageProducer: IMessageProducer;
	static aggregate: SettlementsAggregate;
	static handler: SettlementsCommandHandler;
	static metrics: IMetrics;
	static configurationClient: IConfigurationClient;
	static startupTimer: NodeJS.Timeout;

	static async start(
		logger?: ILogger,
		tokenHelper?: ITokenHelper,
		loginHelper?: ILoginHelper,
		authorizationClient?: IAuthorizationClient,
		auditClient?: IAuditClient,
		accountsAndBalancesAdapter?: IAccountsBalancesAdapter,
		configRepo?: ISettlementConfigRepo,
		batchRepo?: ISettlementBatchRepo,
		batchTransferRepo?: ISettlementBatchTransferRepo,
		matrixRepo?: ISettlementMatrixRequestRepo,
		messageConsumer?: IMessageConsumer,
		messageProducer?: IMessageProducer,
		metrics?: IMetrics,
		confClient?: IConfigurationClient
	): Promise<void> {
		console.log(`Service starting with PID: ${process.pid}`);

		this.startupTimer = setTimeout(()=>{
			throw new Error("Service start timed-out");
		}, SERVICE_START_TIMEOUT_MS);

		console.log(`Service starting with PID: ${process.pid}`);

		if (!logger) {
			logger = new KafkaLogger(
				BC_NAME,
				APP_NAME,
				APP_VERSION,
				kafkaProducerOptions,
				KAFKA_LOGS_TOPIC,
				LOG_LEVEL
			);
			await (logger as KafkaLogger).init();
		}
		globalLogger = this.logger = logger;

		if (!tokenHelper) {
			tokenHelper = new TokenHelper(
				AUTH_N_SVC_JWKS_URL, logger, AUTH_N_TOKEN_ISSUER_NAME, AUTH_N_TOKEN_AUDIENCE,
				new MLKafkaJsonConsumer({kafkaBrokerList: KAFKA_URL, autoOffsetReset: "earliest", kafkaGroupId: INSTANCE_ID}, logger) // for jwt list - no groupId
			);
			await tokenHelper.init();
		}
		this.tokenHelper = tokenHelper;

		if (!loginHelper){
			loginHelper = new LoginHelper(AUTH_N_SVC_TOKEN_URL, this.logger);
			(loginHelper as LoginHelper).setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
		}
		this.loginHelper = loginHelper;

		// config client:
		if (!confClient) confClient = configClient;
		this.configurationClient = confClient;

		// authorization client
		let authRequester: IAuthenticatedHttpRequester|null = null;
		if (!authorizationClient) {
			// create the instance of IAuthenticatedHttpRequester
			authRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
			authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);

			const consumerHandlerLogger = logger.createChild("authorizationClientConsumer");
			const messageConsumer = new MLKafkaJsonConsumer({
				kafkaBrokerList: KAFKA_URL,
				kafkaGroupId: `${BC_NAME}_${APP_NAME}_authz_client`
			}, consumerHandlerLogger);

			// setup privileges - bootstrap app privs and get priv/role associations
			authorizationClient = new AuthorizationClient(
				BC_NAME, APP_NAME, APP_VERSION,
				AUTH_Z_SVC_BASEURL, logger.createChild("AuthorizationClient"),
				authRequester,
				messageConsumer
			);
			authorizationClient.addPrivilegesArray(SettlementPrivilegesDefinition);
			await (authorizationClient as AuthorizationClient).bootstrap(true);
			await (authorizationClient as AuthorizationClient).fetch();
			// init message consumer to automatically update on role changed events
			await (authorizationClient as AuthorizationClient).init();
		}
		this.authorizationClient = authorizationClient;

		await this.configurationClient.init();
		await this.configurationClient.bootstrap(true);
		await this.configurationClient.fetch();

		if (!auditClient) {
			if (!existsSync(AUDIT_KEY_FILE_PATH)) {
				if (PRODUCTION_MODE) process.exit(9);
				// create e tmp file
				LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_KEY_FILE_PATH, 2048);
			}
			const auditLogger = this.logger.createChild("auditDispatcher");
			auditLogger.setLogLevel(LogLevel.INFO);

			const cryptoProvider = new LocalAuditClientCryptoProvider(
				AUDIT_KEY_FILE_PATH
			);
			const auditDispatcher = new KafkaAuditClientDispatcher(
				kafkaProducerOptions,
				KAFKA_AUDITS_TOPIC,
				auditLogger
			);
			// NOTE: to pass the same kafka logger to the audit client, make sure the logger is started/initialised already
			auditClient = new AuditClient(
				BC_NAME,
				APP_NAME,
				APP_VERSION,
				cryptoProvider,
				auditDispatcher
			);
			await auditClient.init();
		}
		this.auditClient = auditClient;

		if (!accountsAndBalancesAdapter) {
			if (USE_TIGERBEETLE) {
				accountsAndBalancesAdapter = new TigerBeetleAccountsAndBalancesAdapter(
					Number(TIGERBEETLE_CLUSTER_ID),
					[TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES],
					this.logger,
					this.configurationClient
				);
			} else {
				accountsAndBalancesAdapter = new GrpcAccountsAndBalancesAdapter(ACCOUNTS_BALANCES_COA_SVC_URL, this.loginHelper as LoginHelper, this.logger);
			}
		}
		await accountsAndBalancesAdapter.init();
		this.accountsAndBalancesAdapter = accountsAndBalancesAdapter;

		// repositories
		if (!configRepo) {
			configRepo = new MongoSettlementConfigRepo(
				this.logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_CONFIGS_COLLECTION_NAME,
				REDIS_HOST, 
				REDIS_PORT
			);
			await configRepo.init();

			if (!PRODUCTION_MODE){
				const defaultModel = await configRepo.getSettlementConfigByModelName(DEFAULT_SETTLEMENT_MODEL_NAME);
				if(!defaultModel){
					// create default model with 5 mins
					await configRepo.storeConfig({
						id: DEFAULT_SETTLEMENT_MODEL_ID,
						settlementModel: DEFAULT_SETTLEMENT_MODEL_NAME,
						batchCreateInterval: 300,
						isActive: true,
						createdBy: "(system)",
						createdDate: Date.now(),
						changeLog: []
					});
				}
			}
		}
		this.configRepo = configRepo;

		if (!batchRepo) {
			batchRepo = new MongoSettlementBatchRepo(
				this.logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_BATCHES_COLLECTION_NAME,
				REDIS_HOST, 
				REDIS_PORT
			);
			await batchRepo.init();
		}
		this.batchRepo = batchRepo;

		if (!matrixRepo) {
			matrixRepo = new MongoSettlementMatrixRepo(
				this.logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_MATRICES_COLLECTION_NAME
			);
			await matrixRepo.init();
		}
		this.matrixRepo = matrixRepo;

		if (!batchTransferRepo) {
			// if (USE_TIGERBEETLE) {
			// 	batchTransferRepo = new SettlementBatchTransferRepoVoid();
			// } else {
				batchTransferRepo = new MongoSettlementTransferRepo(
					this.logger,
					MONGO_URL,
					DB_NAME,
					SETTLEMENT_TRANSFERS_COLLECTION_NAME
				);
			// }
			await batchTransferRepo.init();
		}
		this.batchTransferRepo = batchTransferRepo;

		if (!messageConsumer) {
			messageConsumer = new MLKafkaJsonConsumer(kafkaConsumerOptions, this.logger);
		}
		this.messageConsumer = messageConsumer;

		if (!messageProducer) {
			messageProducer = new MLKafkaJsonProducer(kafkaProducerOptions, this.logger);
			await messageProducer.connect();
		}
		this.messageProducer = messageProducer;

		// metrics client:
		if (!metrics) {
			const labels: Map<string, string> = new Map<string, string>();
			labels.set("bc", BC_NAME);
			labels.set("app", APP_NAME);
			labels.set("version", APP_VERSION);
			PrometheusMetrics.Setup({prefix:"", defaultLabels: labels}, this.logger);
			metrics = PrometheusMetrics.getInstance();
		}
		this.metrics = metrics;

		// Aggregate:
		this.aggregate = new SettlementsAggregate(
			this.logger,
			this.auditClient,
			this.configurationClient,
			this.batchRepo,
			this.batchTransferRepo,
			this.configRepo,
			this.matrixRepo,
			this.accountsAndBalancesAdapter,
			this.messageProducer,
			this.metrics
		);

		// Create handler and start it:
		this.handler = new SettlementsCommandHandler(
			this.logger,
			this.messageConsumer,
			this.aggregate
		);
		await this.handler.start();

		this.logger.info(`Settlements Command Handler Service started, version: ${configClient.applicationVersion}`);

		// Remove startup timeout
		clearTimeout(this.startupTimer);
	}

	static async stop() {
		if (this.handler) await this.handler.stop();
		if (this.messageConsumer) await this.messageConsumer.destroy(true);

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
	console.info("Microservice - exiting...");
});
process.on("uncaughtException", (err: Error) => {
	console.error(err);
	console.log("UncaughtException - EXITING...");
	process.exit(999);
});
