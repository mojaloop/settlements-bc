/*****
 License
 --------------
 Copyright © 2023 Bill & Melinda Gates Foundation
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

 * Coil
 * - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {
	ISettlementConfigRepo,
	ISettlementBatchRepo,
	IParticipantAccountNotifier,
	ISettlementMatrixRequestRepo,
	SettlementsAggregate,
	InvalidTimestampError,
	InvalidBatchSettlementModelError,
	InvalidCurrencyCodeError,
	InvalidAmountError,
	InvalidTransferIdError,
	InvalidDebitAccountError,
	InvalidCreditAccountError,
	SettlementBatchNotFoundError,
	UnauthorizedError,
	InvalidBatchIdentifierError,
	InvalidIdError,
	InvalidCreditBalanceError,
	InvalidDebitBalanceError,
	InvalidParticipantAccountIdError,
	IAccountsBalancesAdapter,
	ISettlementBatchTransferRepo
} from "../../src/index";
import {ConsoleLogger, ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {randomUUID} from "crypto";
import {stringToBigint, bigintToString} from "../../src/converters";
import {IAuthorizationClient, CallSecurityContext} from "@mojaloop/security-bc-public-types-lib";
import {
	AuditClientMock,
	AuthorizationClientMock,
	SettlementConfigRepoMock,
	SettlementBatchRepoMock,
	ParticipantAccountNotifierMock,
	SettlementMatrixRequestRepoMock,
	AccountsBalancesAdapterMock,
	SettlementBatchTransferRepoMock,
	MessageProducerMock,
	MessageCache
} from "@mojaloop/settlements-bc-shared-mocks-lib";
import {
	ITransferDto

} from "@mojaloop/settlements-bc-public-types-lib";
import {SettlementConfig} from "../../src/types/settlement_config";
import {SettlementBatchTransfer} from "../../src/types/transfer";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib/dist/index";

let authorizationClient: IAuthorizationClient;
let authorizationClientNoAuth: IAuthorizationClient;
let configRepo: ISettlementConfigRepo;
let settleBatchRepo: ISettlementBatchRepo;
let settleTransferRepo: ISettlementBatchTransferRepo;
let settleMatrixReqRepo: ISettlementMatrixRequestRepo;
let partNotifier: IParticipantAccountNotifier;
let abAdapter: IAccountsBalancesAdapter;
let msgCache: MessageCache;
let msgProducer: IMessageProducer;

describe("Settlements BC [Domain] - Unit Tests", () => {
	let aggregate : SettlementsAggregate;
	let aggregateNoAuth : SettlementsAggregate;
	let securityContext : CallSecurityContext;

	beforeAll(async () => {
		// Cross Cutting:
		const logger: ILogger = new ConsoleLogger();
		authorizationClient = new AuthorizationClientMock(logger, true);
		authorizationClientNoAuth = new AuthorizationClientMock(logger, false);
		const auditingClient: IAuditClient = new AuditClientMock(logger);

		securityContext = {
			username: 'unit-test',
			clientId: 'client-id',
			rolesIds: ['settlement-role'],
			accessToken: 'bear-token'
		};

		// Mock Repos:
		configRepo = new SettlementConfigRepoMock();
		settleBatchRepo = new SettlementBatchRepoMock();
		settleTransferRepo = new SettlementBatchTransferRepoMock();
		settleMatrixReqRepo = new SettlementMatrixRequestRepoMock();

		// Adapters:
		partNotifier = new ParticipantAccountNotifierMock();
		abAdapter = new AccountsBalancesAdapterMock();

		// Other:
		msgCache = new MessageCache();
		msgProducer = new MessageProducerMock(logger, msgCache);

		// Aggregate:
		aggregate = new SettlementsAggregate(
			logger,
			authorizationClient,
			auditingClient,
			settleBatchRepo,
			settleTransferRepo,
			configRepo,
			settleMatrixReqRepo,
			partNotifier,
			abAdapter,
			msgProducer
		);
		/*aggregateNoAuth = new SettlementsAggregate(
			logger,
			authorizationClientNoAuth,
			auditingClient,
			settleBatchRepo,
			settleBatchAccRepo,
			partNotifier,
			settleTransferRepo,
			configRepo,
			settleMatrixReqRepo,
			abAdapter
		);*/
	});

	afterAll(async () => {
		// Nothing for now.
	});

	// Create Settlement Transfer:
	test("create settlement transfer and ensure meta-data is present", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: "10000", //100 EURO
			timestamp: Date.now(),
			settlementModel: "DEFAULT"
		};
		const batchId: string = await aggregate.handleTransfer(securityContext, reqTransferDto);
		expect(batchId).toBeDefined();
		/*expect(rspTransferDto.id).toBeDefined();
		expect(rspTransferDto.transferId).toEqual(reqTransferDto.transferId);
		expect(rspTransferDto.currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(rspTransferDto.amount).toEqual(reqTransferDto.amount);*/

		// Batches:
		/*expect(rspTransferDto.batch).toBeDefined();
		expect(rspTransferDto.batch!.id).toBeDefined();
		expect(rspTransferDto.batch!.batchIdentifier).toBeDefined();*/

		const batches = await aggregate.getSettlementBatchesByCriteria(
			securityContext,
			reqTransferDto.settlementModel,
			reqTransferDto.currencyCode,
			Date.now() - 30000,
			Date.now() + 30000);
		expect(batches).toBeDefined();
		expect(batches.length).toBeGreaterThan(0);
		expect(batches[0].id).toEqual(batchId);

		const batchById = await aggregate.getSettlementBatch(securityContext, batchId);
		expect(batchById).toBeDefined();

		// Accounts:
		//TODO Complete accounts.

		// Transfers:
		//TODO Complete transfers.
	});
});
