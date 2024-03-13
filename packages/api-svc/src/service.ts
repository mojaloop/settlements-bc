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


import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {KafkaLogger} from "@mojaloop/logging-bc-client-lib";
import {ILogger, LogLevel} from "@mojaloop/logging-bc-public-types-lib";
import {
	MLKafkaJsonConsumer,
	MLKafkaJsonProducer,
	MLKafkaJsonProducerOptions
} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {
	AuthenticatedHttpRequester,
	AuthorizationClient, LoginHelper,
	TokenHelper
} from "@mojaloop/security-bc-client-lib";
import {
	IAccountsBalancesAdapter,
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo,
	ISettlementConfigRepo,
	ISettlementMatrixRequestRepo
} from "@mojaloop/settlements-bc-domain-lib";
import process from "process";
import {existsSync} from "fs";
import {
	AuditClient,
	KafkaAuditClientDispatcher,
	LocalAuditClientCryptoProvider
} from "@mojaloop/auditing-bc-client-lib";
import {
	GrpcAccountsAndBalancesAdapter,
	MongoSettlementBatchRepo,
	MongoSettlementConfigRepo,
	MongoSettlementMatrixRepo,
	MongoSettlementTransferRepo,
	TigerBeetleAccountsAndBalancesAdapter,
	SettlementBatchTransferRepoTigerBeetle
} from "@mojaloop/settlements-bc-infrastructure-lib";
import {IAuthenticatedHttpRequester, IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {Server} from "net";
import express, {Express} from "express";
import {ExpressRoutes} from "./routes";
import {ITokenHelper} from "@mojaloop/security-bc-public-types-lib/";

import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import crypto from "crypto";
import {IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import {ConfigurationClient, DefaultConfigProvider} from "@mojaloop/platform-configuration-bc-client-lib";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require("../package.json");
const BC_NAME = "settlements-bc";
const APP_NAME = "settlements-api-svc";
const APP_VERSION = packageJSON.version;
const CONFIGSET_VERSION = "0.0.1";
const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOG_LEVEL: LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.INFO;

const AUTH_N_SVC_BASEURL = process.env["AUTH_N_SVC_BASEURL"] || "http://localhost:3201";
const AUTH_N_SVC_TOKEN_URL = AUTH_N_SVC_BASEURL + "/token"; // TODO this should not be known here, libs that use the base should add the suffix
const AUTH_N_TOKEN_ISSUER_NAME = process.env["AUTH_N_TOKEN_ISSUER_NAME"] || "mojaloop.vnext.dev.default_issuer";
const AUTH_N_TOKEN_AUDIENCE = process.env["AUTH_N_TOKEN_AUDIENCE"] || "mojaloop.vnext.dev.default_audience";

const CONFIG_SVC_BASEURL = process.env["CONFIG_SVC_BASEURL"] || "http://localhost:3203";

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
const ACCOUNTS_BALANCES_COA_SVC_URL = process.env["ACCOUNTS_BALANCES_COA_SVC_URL"] || "localhost:3300";

// persistence related:
const DB_NAME: string = "settlements";
const SETTLEMENT_CONFIGS_COLLECTION_NAME: string = "configs";
const SETTLEMENT_BATCHES_COLLECTION_NAME: string = "batches";
const SETTLEMENT_MATRICES_COLLECTION_NAME: string = "matrices";
const SETTLEMENT_TRANSFERS_COLLECTION_NAME: string = "transfers";

const SERVICE_START_TIMEOUT_MS= (process.env["SERVICE_START_TIMEOUT_MS"] && parseInt(process.env["SERVICE_START_TIMEOUT_MS"])) || 60_000;

const INSTANCE_NAME = `${BC_NAME}_${APP_NAME}`;
const INSTANCE_ID = `${INSTANCE_NAME}__${crypto.randomUUID()}`;

const kafkaProducerOptions: MLKafkaJsonProducerOptions = {
	kafkaBrokerList: KAFKA_URL
};

let globalLogger: ILogger;

// TigerBeetle:
const USE_TIGERBEETLE= process.env["USE_TIGERBEETLE"] && process.env["USE_TIGERBEETLE"].toUpperCase()==="TRUE" || false;
const TIGERBEETLE_CLUSTER_ID = process.env["TIGERBEETLE_CLUSTER_ID"] || 0;
const TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES = process.env["TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES"] || "localhost:9001";

// Redis:
const REDIS_HOST = process.env["REDIS_HOST"] || "localhost";
const REDIS_PORT = (process.env["REDIS_PORT"] && parseInt(process.env["REDIS_PORT"])) || 6379;

export class Service {
	static logger: ILogger;
	static app: Express;
	static expressServer: Server;
	static tokenHelper: ITokenHelper;
	static authorizationClient: IAuthorizationClient;
	static auditClient: IAuditClient;
	static configClient: IConfigurationClient;
	static configRepo: ISettlementConfigRepo;
	static batchRepo: ISettlementBatchRepo;
	static batchTransferRepo: ISettlementBatchTransferRepo;
	static matrixRepo: ISettlementMatrixRequestRepo;
	static messageProducer: IMessageProducer;
	static startupTimer: NodeJS.Timeout;
	// static abAdapter: IAccountsBalancesAdapter;

	static async start(
		logger?:ILogger,
		tokenHelper?: ITokenHelper,
		authorizationClient?: IAuthorizationClient,
		auditClient?: IAuditClient,
		configClient?: IConfigurationClient,
		configRepo?: ISettlementConfigRepo,
		batchRepo?: ISettlementBatchRepo,
		batchTransferRepo?: ISettlementBatchTransferRepo,
		matrixRepo?: ISettlementMatrixRequestRepo,
		messageProducer?: IMessageProducer,
		// accountsAndBalancesAdapter?: IAccountsBalancesAdapter
	) : Promise<void> {
		console.log(`Service starting with PID: ${process.pid}`);

		this.startupTimer = setTimeout(()=>{
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
				AUTH_N_SVC_JWKS_URL, logger, AUTH_N_TOKEN_ISSUER_NAME,AUTH_N_TOKEN_AUDIENCE,
				new MLKafkaJsonConsumer({kafkaBrokerList: KAFKA_URL, autoOffsetReset: "earliest", kafkaGroupId: INSTANCE_ID}, logger) // for jwt list - no groupId
			);
			await tokenHelper.init();
		}
		this.tokenHelper = tokenHelper;

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
			// MUST only add privileges once, the cmd handler is already doing it
			// addPrivileges(authorizationClient as AuthorizationClient);
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
				LocalAuditClientCryptoProvider.createRsaPrivateKeyFileSync(AUDIT_KEY_FILE_PATH,2048);
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

		if (!configClient) {
			const defaultConfigProvider: DefaultConfigProvider = new DefaultConfigProvider(
				logger,
				authRequester!,
				null,
				CONFIG_SVC_BASEURL
			);
			configClient = new ConfigurationClient(BC_NAME, APP_NAME, APP_VERSION, CONFIGSET_VERSION, defaultConfigProvider);
		}
		this.configClient = configClient;

		// if (!accountsAndBalancesAdapter) {
		// 	if (USE_TIGERBEETLE) {
		// 		accountsAndBalancesAdapter = new TigerBeetleAccountsAndBalancesAdapter(
		// 			Number(TIGERBEETLE_CLUSTER_ID),
		// 			[TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES],
		// 			this.logger,
		// 			this.configClient
		// 		);
		// 	} else {
		// 		const loginHelper = new LoginHelper(AUTH_N_SVC_TOKEN_URL, logger);
		// 		loginHelper.setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
		// 		accountsAndBalancesAdapter = new GrpcAccountsAndBalancesAdapter(ACCOUNTS_BALANCES_COA_SVC_URL, loginHelper, this.logger);
		// 	}
		// 	await accountsAndBalancesAdapter.init();
		// }
		// this.abAdapter = accountsAndBalancesAdapter;

		// repositories:
		if (!configRepo) {
			configRepo = new MongoSettlementConfigRepo(
				logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_CONFIGS_COLLECTION_NAME,
				REDIS_HOST,
				REDIS_PORT
			);
			await configRepo.init();
		}
		this.configRepo = configRepo;

		if (!batchRepo) {
			batchRepo = new MongoSettlementBatchRepo(
				logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_BATCHES_COLLECTION_NAME,
				REDIS_HOST,
				REDIS_PORT
			);
			await batchRepo.init();
		}
		this.batchRepo = batchRepo;

		if (!batchTransferRepo) {
			// if (USE_TIGERBEETLE) {
				batchTransferRepo = new MongoSettlementTransferRepo(
					logger,
					MONGO_URL,
					DB_NAME,
					SETTLEMENT_TRANSFERS_COLLECTION_NAME
				);
			// } else {
			// 	batchTransferRepo = new SettlementBatchTransferRepoTigerBeetle(this.batchRepo, this.abAdapter);
			// }
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

		if (!messageProducer) {
			const producerLogger = this.logger.createChild("messageProducer");
			producerLogger.setLogLevel(LogLevel.INFO);
			messageProducer = new MLKafkaJsonProducer(kafkaProducerOptions, producerLogger);
			await messageProducer.connect();
		}
		this.messageProducer = messageProducer;

		await this.setupExpress();

		// remove startup timeout
		clearTimeout(this.startupTimer);
	}

	static setupExpress(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.app = express();
			this.app.use(express.json()); // for parsing application/json
			this.app.use(express.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

			const routes = new ExpressRoutes(
				this.logger,
				this.tokenHelper,
				this.configRepo,
				this.batchRepo,
				this.batchTransferRepo,
				this.matrixRepo,
				this.messageProducer
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
		if (this.logger instanceof KafkaLogger) await this.logger.destroy();
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
