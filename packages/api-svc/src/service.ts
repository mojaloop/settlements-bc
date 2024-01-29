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


import { IAuditClient } from "@mojaloop/auditing-bc-public-types-lib";
import { KafkaLogger } from "@mojaloop/logging-bc-client-lib";
import { ILogger, LogLevel } from "@mojaloop/logging-bc-public-types-lib";
import {
	MLKafkaJsonConsumer,
	MLKafkaJsonProducer,
	MLKafkaJsonProducerOptions
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
	AuthenticatedHttpRequester,
	AuthorizationClient,
	TokenHelper
} from "@mojaloop/security-bc-client-lib";
import {
	IParticipantAccountNotifier,
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo,
	ISettlementConfigRepo,
	ISettlementMatrixRequestRepo,
} from "@mojaloop/settlements-bc-domain-lib";
import process from "process";
import { existsSync } from "fs";
import {
	AuditClient,
	KafkaAuditClientDispatcher,
	LocalAuditClientCryptoProvider
} from "@mojaloop/auditing-bc-client-lib";
import {
	MongoSettlementBatchRepo,
	MongoSettlementConfigRepo,
	MongoSettlementMatrixRepo,
	MongoSettlementTransferRepo
} from "@mojaloop/settlements-bc-infrastructure-lib";
import { IAuthorizationClient } from "@mojaloop/security-bc-public-types-lib";
import { Server } from "net";
import express, { Express } from "express";
import { ExpressRoutes } from "./routes";
import { ITokenHelper } from "@mojaloop/security-bc-public-types-lib/";

import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { IMetrics } from "@mojaloop/platform-shared-lib-observability-types-lib";
import { PrometheusMetrics } from "@mojaloop/platform-shared-lib-observability-client-lib";
import crypto from "crypto";
import { Privileges } from "@mojaloop/settlements-bc-domain-lib"


import { IConfigurationClient } from "@mojaloop/platform-configuration-bc-public-types-lib";
import { DefaultConfigProvider, ConfigurationClient, IConfigProvider } from "@mojaloop/platform-configuration-bc-client-lib";


// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require("../package.json");
const BC_NAME = "settlements-bc";
const APP_NAME = "settlements-api-svc";
const APP_VERSION = packageJSON.version;
const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOG_LEVEL: LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;
//const ENV_NAME = process.env["ENV_NAME"] || "dev";

const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix
const AUTH_N_TOKEN_ISSUER_NAME = process.env["AUTH_N_TOKEN_ISSUER_NAME"] || "mojaloop.vnext.dev.default_issuer";
const AUTH_N_TOKEN_AUDIENCE = process.env["AUTH_N_TOKEN_AUDIENCE"] || "mojaloop.vnext.dev.default_audience";

const AUTH_N_SVC_JWKS_URL = process.env["AUTH_N_SVC_JWKS_URL"] || `${AUTH_N_SVC_BASEURL}/.well-known/jwks.json`;

const AUTH_Z_SVC_BASEURL = process.env["AUTH_Z_SVC_BASEURL"] || "http://localhost:3202";


const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";
const MONGO_URL = process.env["MONGO_URL"] || "mongodb://root:example@localhost:27017/";

const KAFKA_AUDITS_TOPIC = process.env["KAFKA_AUDITS_TOPIC"] || "audits";
const KAFKA_LOGS_TOPIC = process.env["KAFKA_LOGS_TOPIC"] || "logs";
const AUDIT_KEY_FILE_PATH = process.env["AUDIT_KEY_FILE_PATH"] || "/app/data/audit_private_key.pem";

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "settlements-bc-api-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_SECRET"] || "superServiceSecret";

const SVC_DEFAULT_HTTP_PORT = process.env["SVC_DEFAULT_HTTP_PORT"] || 3600;

const DB_NAME: string = "settlements";
const SETTLEMENT_CONFIGS_COLLECTION_NAME: string = "configs";
const SETTLEMENT_BATCHES_COLLECTION_NAME: string = "batches";
const SETTLEMENT_MATRICES_COLLECTION_NAME: string = "matrices";
const SETTLEMENT_TRANSFERS_COLLECTION_NAME: string = "transfers";

const SERVICE_START_TIMEOUT_MS = (process.env["SERVICE_START_TIMEOUT_MS"] && parseInt(process.env["SERVICE_START_TIMEOUT_MS"])) || 60_000;

const INSTANCE_NAME = `${BC_NAME}_${APP_NAME}`;
const INSTANCE_ID = `${INSTANCE_NAME}__${crypto.randomUUID()}`;

const CONFIG_BASE_URL = "http://localhost:3100";
const CONFIGSET_VERSION = "0.0.1";

const kafkaProducerOptions: MLKafkaJsonProducerOptions = {
	kafkaBrokerList: KAFKA_URL
};

let globalLogger: ILogger;

export class Service {
	static logger: ILogger;
	static app: Express;
	static expressServer: Server;
	static tokenHelper: ITokenHelper;
	static authorizationClient: IAuthorizationClient;
	static auditClient: IAuditClient;
	static configRepo: ISettlementConfigRepo;
	static batchRepo: ISettlementBatchRepo;
	static participantAccountNotifier: IParticipantAccountNotifier;
	static batchTransferRepo: ISettlementBatchTransferRepo;
	static matrixRepo: ISettlementMatrixRequestRepo;
	static metrics: IMetrics;
	static messageProducer: IMessageProducer;
	static startupTimer: NodeJS.Timeout;
	static configClient: IConfigurationClient;

	static async start(
		logger?: ILogger,
		tokenHelper?: ITokenHelper,
		authorizationClient?: IAuthorizationClient,
		auditClient?: IAuditClient,
		configRepo?: ISettlementConfigRepo,
		batchRepo?: ISettlementBatchRepo,
		batchTransferRepo?: ISettlementBatchTransferRepo,
		matrixRepo?: ISettlementMatrixRequestRepo,
		participantAccountNotifier?: IParticipantAccountNotifier,
		messageProducer?: IMessageProducer,
		metrics?: IMetrics,
		configProvider?: IConfigProvider
	): Promise<void> {
		console.log(`Service starting with PID: ${process.pid}`);

		this.startupTimer = setTimeout(() => {
			throw new Error("Service start timed-out");
		}, SERVICE_START_TIMEOUT_MS);



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
				new MLKafkaJsonConsumer({ kafkaBrokerList: KAFKA_URL, autoOffsetReset: "earliest", kafkaGroupId: INSTANCE_ID }, logger) // for jwt list - no groupId
			);
			await tokenHelper.init();
		}
		this.tokenHelper = tokenHelper;

		// start config client - this is not mockable (can use STANDALONE MODE if desired)
		if (!configProvider) {
			// use default url from PLATFORM_CONFIG_CENTRAL_URL env var
			const authRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
			authRequester.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);

			const messageConsumer = new MLKafkaJsonConsumer({
				kafkaBrokerList: KAFKA_URL,
				kafkaGroupId: `${APP_NAME}_${Date.now()}` // unique consumer group - use instance id when possible
			}, logger.createChild("configClient.consumer"));
			const defaultConfigProvider: DefaultConfigProvider = new DefaultConfigProvider(logger, authRequester, messageConsumer, CONFIG_BASE_URL);

			const configClient = new ConfigurationClient(BC_NAME, APP_NAME, APP_VERSION, CONFIGSET_VERSION, defaultConfigProvider);
			await configClient.init();
			await configClient.bootstrap(true);
			await configClient.fetch();



		}

		// authorization client
		if (!authorizationClient) {
			// create the instance of IAuthenticatedHttpRequester
			const authRequester = new AuthenticatedHttpRequester(logger, AUTH_N_SVC_TOKEN_URL);
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
			// MUST only add privileges once, the cmd handler is already doing it
			addPrivileges(authorizationClient as AuthorizationClient);
			await (authorizationClient as AuthorizationClient).bootstrap(true);
			await (authorizationClient as AuthorizationClient).fetch();
			// init message consumer to automatically update on role changed events
			await (authorizationClient as AuthorizationClient).init();
		}
		this.authorizationClient = authorizationClient;

		if (!auditClient) {
			if (!existsSync(AUDIT_KEY_FILE_PATH)) {
				if (PRODUCTION_MODE) process.exit(9);
				// create e tmp file
				LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_KEY_FILE_PATH, 2048);
			}
			const auditLogger = logger.createChild("auditDispatcher");
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

		// if (!accountsAndBalancesAdapter) {
		// 	const loginHelper = new LoginHelper(AUTH_N_SVC_TOKEN_URL, logger);
		// 	loginHelper.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
		// 	accountsAndBalancesAdapter = new GrpcAccountsAndBalancesAdapter(ACCOUNTS_BALANCES_COA_SVC_URL, loginHelper, this.logger);
		// 	await accountsAndBalancesAdapter.init();
		// }
		// this.accountsAndBalancesAdapter = accountsAndBalancesAdapter;

		// repositories
		if (!configRepo) {
			configRepo = new MongoSettlementConfigRepo(
				logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_CONFIGS_COLLECTION_NAME
			);
			await configRepo.init();
		}
		this.configRepo = configRepo;

		if (!batchRepo) {
			batchRepo = new MongoSettlementBatchRepo(
				logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_BATCHES_COLLECTION_NAME
			);
			await batchRepo.init();
		}
		this.batchRepo = batchRepo;

		if (!batchTransferRepo) {
			batchTransferRepo = new MongoSettlementTransferRepo(
				logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_TRANSFERS_COLLECTION_NAME
			);
			await batchTransferRepo.init();
		}
		this.batchTransferRepo = batchTransferRepo;

		if (!matrixRepo) {
			matrixRepo = new MongoSettlementMatrixRepo(
				logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_MATRICES_COLLECTION_NAME
			);
			await matrixRepo.init();
		}
		this.matrixRepo = matrixRepo;

		// if (!participantAccountNotifier) {
		// 	// we cannot use mocks in production code, they need to be injected in the Service.Start() for tests
		// 	//participantAccountNotifier = new ParticipantAccountNotifierMock();
		// 	throw new Error("Invalid participantAccountNotifier provided on Service.Start()");
		// }
		// this.participantAccountNotifier = participantAccountNotifier;

		if (!messageProducer) {
			const producerLogger = this.logger.createChild("messageProducer");
			producerLogger.setLogLevel(LogLevel.INFO);
			messageProducer = new MLKafkaJsonProducer(kafkaProducerOptions, producerLogger);
			await messageProducer.connect();
		}
		this.messageProducer = messageProducer;

		// metrics client
		if (!metrics) {
			const labels: Map<string, string> = new Map<string, string>();
			labels.set("bc", BC_NAME);
			labels.set("app", APP_NAME);
			labels.set("version", APP_VERSION);
			PrometheusMetrics.Setup({ prefix: "", defaultLabels: labels }, this.logger);
			metrics = PrometheusMetrics.getInstance();
		}
		this.metrics = metrics;

		/* Aggregate cannot be used outside the command-handler
		// Aggregate:
		this.aggregate = new SettlementsAggregate(
			this.logger,
			this.authorizationClient,
			this.auditClient,
			this.batchRepo,
			this.batchTransferRepo,
			this.configRepo,
			this.matrixRepo,
			this.participantAccountNotifier,
			this.accountsAndBalancesAdapter,
			this.messageProducer,
			this.metrics
		);*/

		await this.setupExpress();

		// remove startup timeout
		clearTimeout(this.startupTimer);
	}


	static setupExpress(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.app = express();
			this.app.use(express.json()); // for parsing application/json
			this.app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

			const routes = new ExpressRoutes(
				this.logger,
				this.tokenHelper,
				this.configRepo,
				this.batchRepo,
				this.batchTransferRepo,
				this.matrixRepo,
				this.messageProducer,
				this.authorizationClient

			);

			this.app.use("/", routes.MainRouter);

			this.app.use((req, res) => {
				// catch all
				res.send(404);
			});

			let portNum = SVC_DEFAULT_HTTP_PORT;
			if (process.env["SVC_HTTP_PORT"] && !isNaN(parseInt(process.env["SVC_HTTP_PORT"]))) {
				portNum = parseInt(process.env["SVC_HTTP_PORT"]);
			}

			this.expressServer = this.app.listen(portNum, () => {
				this.logger.info(`🚀 Server ready at port: ${portNum}`);
				this.logger.info(`${APP_NAME} service v: ${APP_VERSION} started`);
				resolve();
			});
		});

	}

	static async stop(): Promise<void> {
		if (this.expressServer) await this.expressServer.close();
		if (this.configRepo) await this.configRepo.destroy();
		if (this.batchRepo) await this.batchRepo.destroy();
		if (this.batchTransferRepo) await this.batchTransferRepo.destroy();
		if (this.matrixRepo) await this.matrixRepo.destroy();
		if (this.participantAccountNotifier) await this.participantAccountNotifier.destroy();
		if (this.logger instanceof KafkaLogger) await this.logger.destroy();
	}
}

// TODO : To confrim adding priv
function addPrivileges(authorizationClient: AuthorizationClient): void {
	// processing of transfers must always happen, this priv is not required
	// authorizationClient.addPrivilege(
	// 	Privileges.CREATE_SETTLEMENT_TRANSFER,
	// 	Privileges.CREATE_SETTLEMENT_TRANSFER,
	// 	"Allows the creation of a settlement transfer."
	// );

	authorizationClient.addPrivilege(
		Privileges.CREATE_SETTLEMENT_CONFIG,
		Privileges.CREATE_SETTLEMENT_CONFIG,
		"Allows the creation of settlement model."
	);

	authorizationClient.addPrivilege(
		Privileges.CREATE_DYNAMIC_SETTLEMENT_MATRIX,
		Privileges.CREATE_DYNAMIC_SETTLEMENT_MATRIX,
		"Allows the creation of a dynamic settlement matrix."
	);
	authorizationClient.addPrivilege(
		Privileges.CREATE_STATIC_SETTLEMENT_MATRIX,
		Privileges.CREATE_STATIC_SETTLEMENT_MATRIX,
		"Allows the creation of a static settlement matrix."
	);

	authorizationClient.addPrivilege(
		Privileges.GET_SETTLEMENT_MATRIX,
		Privileges.GET_SETTLEMENT_MATRIX,
		"Allows the retrieval of a settlement matrix."
	);
	authorizationClient.addPrivilege(
		Privileges.SETTLEMENTS_CLOSE_MATRIX,
		Privileges.SETTLEMENTS_CLOSE_MATRIX,
		"Allows the settling of a settlement matrix."
	);
	authorizationClient.addPrivilege(
		Privileges.SETTLEMENTS_SETTLE_MATRIX,
		Privileges.SETTLEMENTS_SETTLE_MATRIX,
		"Allows the dispute of a settlement matrix."
	);
	authorizationClient.addPrivilege(
		Privileges.SETTLEMENTS_DISPUTE_MATRIX,
		Privileges.SETTLEMENTS_DISPUTE_MATRIX,
		"Allows the dispute of a settlement matrix."
	);
	authorizationClient.addPrivilege(
		Privileges.SETTLEMENTS_LOCK_MATRIX,
		Privileges.SETTLEMENTS_LOCK_MATRIX,
		"Allows the locking of a settlement matrix."
	);
	authorizationClient.addPrivilege(
		Privileges.SETTLEMENTS_UNLOCK_MATRIX,
		Privileges.SETTLEMENTS_UNLOCK_MATRIX,
		"Allows the unlocking of a settlement matrix."
	);
	authorizationClient.addPrivilege(
		Privileges.GET_SETTLEMENT_MATRIX,
		Privileges.GET_SETTLEMENT_MATRIX,
		"Allows the retrieval of a settlement matrix request."
	);
	authorizationClient.addPrivilege(
		Privileges.RETRIEVE_SETTLEMENT_BATCH,
		Privileges.RETRIEVE_SETTLEMENT_BATCH,
		"Allows the retrieval of a settlement batch."
	);
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
