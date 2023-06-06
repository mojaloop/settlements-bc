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

import {randomUUID} from "crypto";
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
	IAuthenticatedHttpRequester,
    LoginHelper
} from "@mojaloop/security-bc-client-lib";

import {
	IAccountsBalancesAdapter, IParticipantAccountNotifier,
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo,
	ISettlementConfigRepo,
	ISettlementMatrixRequestRepo,
	Privileges,
	SettlementsAggregate
} from "@mojaloop/settlements-bc-domain-lib";
import {Express} from "express";
import {Server} from "net";
import {IAuthorizationClient, ITokenHelper, ILoginHelper} from "@mojaloop/security-bc-public-types-lib";

/* import configs - other imports stay above */
import {AuthorizationClient, TokenHelper} from "@mojaloop/security-bc-client-lib";
import {IMessageConsumer, IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {ParticipantAccountNotifierMock} from "@mojaloop/settlements-bc-shared-mocks-lib";
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

import configClient from "./config";
const BC_NAME = configClient.boundedContextName;
const APP_NAME = configClient.applicationName;
const APP_VERSION = configClient.applicationVersion;
const PRODUCTION_MODE = process.env["PRODUCTION_MODE"] || false;
const LOG_LEVEL: LogLevel = process.env["LOG_LEVEL"] as LogLevel || LogLevel.DEBUG;

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
const PARTICIPANTS_SVC_URL = process.env["PARTICIPANTS_SVC_URL"] || "http://localhost:3010";

const SVC_CLIENT_ID = process.env["SVC_CLIENT_ID"] || "settlements-bc-command-handler-svc";
const SVC_CLIENT_SECRET = process.env["SVC_CLIENT_ID"] || "superServiceSecret";

const USE_TIGERBEETLE = process.env["USE_TIGERBEETLE"] || false;
const TIGERBEETLE_CLUSTER_ID = process.env["TIGERBEETLE_CLUSTER_ID"] || 0;
const TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES = process.env["TIGERBEETLE_CLUSTER_REPLICA_ADDRESSES"] || "default_CHANGEME";


const DB_NAME: string = "settlements";
const SETTLEMENT_CONFIGS_COLLECTION_NAME: string = "configs";
const SETTLEMENT_BATCHES_COLLECTION_NAME: string = "batches";
const SETTLEMENT_MATRICES_COLLECTION_NAME: string = "matrices";
const BATCH_SPECIFIC_SETTLEMENT_MATRICES_COLLECTION_NAME: string = "batch_specific_matrices";
const SETTLEMENT_TRANSFERS_COLLECTION_NAME: string = "transfers";

const kafkaConsumerOptions: MLKafkaJsonConsumerOptions = {
	kafkaBrokerList: KAFKA_URL,
	kafkaGroupId: `${BC_NAME}_${APP_NAME}`
};

const kafkaProducerOptions: MLKafkaJsonProducerOptions = {
	kafkaBrokerList: KAFKA_URL
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let globalLogger: ILogger;

export class Service {
	static logger: ILogger;
	static app: Express;
	static expressServer: Server;
	static tokenHelper: ITokenHelper;
	static loginHelper: ILoginHelper;
	static authorizationClient: IAuthorizationClient;
	static auditClient: IAuditClient;
	static accountsAndBalancesAdapter: IAccountsBalancesAdapter;
	static configRepo: ISettlementConfigRepo;
	static batchRepo: ISettlementBatchRepo;
	static participantAccountNotifier: IParticipantAccountNotifier;
	static batchTransferRepo: ISettlementBatchTransferRepo;
	static matrixRepo: ISettlementMatrixRequestRepo;
	static messageConsumer: IMessageConsumer;
	static messageProducer: IMessageProducer;
	static aggregate: SettlementsAggregate;
	static handler: SettlementsCommandHandler;

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
		participantAccountNotifier?: IParticipantAccountNotifier,
		matrixRepo?: ISettlementMatrixRequestRepo,
		messageConsumer?: IMessageConsumer,
		messageProducer?: IMessageProducer,
	): Promise<void> {
		console.log(`Service starting with PID: ${process.pid}`);

		/// start config client - this is not mockable (can use STANDALONE MODE if desired)
		await configClient.init();
		await configClient.bootstrap(true);

		//TODO: re-enable configClient.fetch();
		//await configClient.fetch();

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
			tokenHelper = new TokenHelper(AUTH_N_SVC_JWKS_URL, logger, AUTH_N_TOKEN_ISSUER_NAME, AUTH_N_TOKEN_AUDIENCE);
			await tokenHelper.init();
		}
		this.tokenHelper = tokenHelper;

		if(!loginHelper){
			loginHelper = new LoginHelper(AUTH_N_SVC_TOKEN_URL, this.logger);
			(loginHelper as LoginHelper).setAppCredentials(SVC_CLIENT_ID, SVC_CLIENT_SECRET);
		}
		this.loginHelper = loginHelper;

		// authorization client
		if (!authorizationClient) {
			// setup privileges - bootstrap app privs and get priv/role associations
			authorizationClient = new AuthorizationClient(
				BC_NAME, APP_NAME, APP_VERSION, AUTH_Z_SVC_BASEURL, this.logger.createChild("AuthorizationClient")
			);
			addPrivileges(authorizationClient as AuthorizationClient);
			await (authorizationClient as AuthorizationClient).bootstrap(true);
			await (authorizationClient as AuthorizationClient).fetch();

		}
		this.authorizationClient = authorizationClient;

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
					this.logger
				);
				await accountsAndBalancesAdapter.init();
			} else {
				accountsAndBalancesAdapter = new GrpcAccountsAndBalancesAdapter(ACCOUNTS_BALANCES_COA_SVC_URL, this.loginHelper as LoginHelper, this.logger);
				await accountsAndBalancesAdapter.init();
			}
		}
		this.accountsAndBalancesAdapter = accountsAndBalancesAdapter;

		// repositories
		if (!configRepo) {
			configRepo = new MongoSettlementConfigRepo(
				this.logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_CONFIGS_COLLECTION_NAME
			);
			await configRepo.init();

			if (!PRODUCTION_MODE){
				const defaultModel = await configRepo.getSettlementConfigByModel("DEFAULT");
				if(!defaultModel){
					// create default model with 5 mins
					await configRepo.storeConfig({
						id: randomUUID(),
						settlementModel: "DEFAULT",
						batchCreateInterval: 300
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
				SETTLEMENT_BATCHES_COLLECTION_NAME
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
			batchTransferRepo = new MongoSettlementTransferRepo(
				this.logger,
				MONGO_URL,
				DB_NAME,
				SETTLEMENT_TRANSFERS_COLLECTION_NAME
			);
			await batchTransferRepo.init();
		}
		this.batchTransferRepo = batchTransferRepo;

		// TODO implement remaining repositories and adapters


		if (!participantAccountNotifier) {
			participantAccountNotifier = new ParticipantAccountNotifierMock();
		}
		this.participantAccountNotifier = participantAccountNotifier;


		if (!messageConsumer) {
			messageConsumer = new MLKafkaJsonConsumer(kafkaConsumerOptions, this.logger);
		}
		this.messageConsumer = messageConsumer;

		if (!messageProducer) {
			messageProducer = new MLKafkaJsonProducer(kafkaProducerOptions, this.logger);
			await messageProducer.connect();
		}
		this.messageProducer = messageProducer;

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
			this.messageProducer
		);

		// create handler and start it
		this.handler = new SettlementsCommandHandler(this.logger, this.auditClient, this.messageConsumer, this.aggregate, this.loginHelper);
		await this.handler.start();

		this.logger.info(`Settlements Command Handler Service started, version: ${configClient.applicationVersion}`);
	}

	static async stop() {
		if (this.handler) await this.handler.stop();
		if (this.messageConsumer) await this.messageConsumer.destroy(true);

		if (this.auditClient) await this.auditClient.destroy();
		if (this.logger && this.logger instanceof KafkaLogger) await this.logger.destroy();
	}
}


function addPrivileges(authorizationClient: AuthorizationClient): void {
	authorizationClient.addPrivilege(
		Privileges.CREATE_SETTLEMENT_TRANSFER,
		Privileges.CREATE_SETTLEMENT_TRANSFER,
		"Allows the creation of a settlement transfer."
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
		Privileges.CREATE_SETTLEMENT_BATCH,
		Privileges.CREATE_SETTLEMENT_BATCH,
		"Allows the creation of a settlement batch."
	);
	authorizationClient.addPrivilege(
		Privileges.CREATE_SETTLEMENT_BATCH_ACCOUNT,
		Privileges.CREATE_SETTLEMENT_BATCH_ACCOUNT,
		"Allows the creation of a settlement batch account."
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
		Privileges.GET_SETTLEMENT_MATRIX,
		Privileges.GET_SETTLEMENT_MATRIX,
		"Allows the retrieval of a settlement matrix request."
	);
	authorizationClient.addPrivilege(
		Privileges.RETRIEVE_SETTLEMENT_BATCH,
		Privileges.RETRIEVE_SETTLEMENT_BATCH,
		"Allows the retrieval of a settlement batch."
	);
	authorizationClient.addPrivilege(
		Privileges.RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS,
		Privileges.RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS,
		"Allows the retrieval of a settlement batch account."
	);
	authorizationClient.addPrivilege(
		Privileges.RETRIEVE_SETTLEMENT_TRANSFERS,
		Privileges.RETRIEVE_SETTLEMENT_TRANSFERS,
		"Allows the retrieval of a settlement transfer."
	);
}

/**
 * process termination and cleanup
 */

async function _handle_int_and_term_signals(signal: NodeJS.Signals): Promise<void> {
	console.info(`Service - ${signal} received - cleaning up...`);
	let clean_exit = false;
	setTimeout(() => {
		clean_exit || process.abort();
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
	console.error(err, "UncaughtException - EXITING...");
	process.exit(999);
});
