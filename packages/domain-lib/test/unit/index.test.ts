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
	ISettlementBatchTransferRepo, SettlementMatrixAlreadyExistsError
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
	let aggregateNoAuth : SettlementsAggregate;//TODO Do one with no auth.
	let securityContext : CallSecurityContext;

	beforeAll(async () => {
		// cross Cutting:
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

		// mock Repos:
		configRepo = new SettlementConfigRepoMock();
		settleBatchRepo = new SettlementBatchRepoMock();
		settleTransferRepo = new SettlementBatchTransferRepoMock();
		settleMatrixReqRepo = new SettlementMatrixRequestRepoMock();

		// adapters:
		partNotifier = new ParticipantAccountNotifierMock();
		abAdapter = new AccountsBalancesAdapterMock();

		// other:
		msgCache = new MessageCache();
		msgProducer = new MessageProducerMock(logger, msgCache);

		// aggregate:
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
		// nothing for now.
	});

	test("create settlement transfer and ensure meta-data is present", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'DEFAULT'
		};
		const batchId: string = await aggregate.handleTransfer(securityContext, reqTransferDto);
		expect(batchId).toBeDefined();

		// transfer:
		const batches = await aggregate.getSettlementBatchesByCriteria(
			securityContext,
			reqTransferDto.settlementModel,
			reqTransferDto.currencyCode,
			Date.now() - 30000,
			Date.now() + 30000);
		expect(batches).toBeDefined();
		expect(batches.length).toBeGreaterThan(0);
		expect(batches[0].id).toEqual(batchId);
		expect(batches[0].state).toEqual('OPEN');
		expect(batches[0].accounts.length).toEqual(2);

		// batch:
		const batchById = await aggregate.getSettlementBatch(securityContext, batchId);
		expect(batchById).toBeDefined();
		expect(batchById!.id).toEqual(batchId);
		expect(batchById!.timestamp).toBeGreaterThan(0);
		expect(batchById!.settlementModel).toEqual(reqTransferDto.settlementModel);
		expect(batchById!.currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(batchById!.batchName).toEqual(batchId.substring(0, batchId.length - 4));
		expect(batchById!.batchSequence).toEqual(1);
		expect(batchById!.state).toEqual('OPEN');
		expect(batchById!.accounts).toBeDefined();
		expect(batchById!.accounts.length).toEqual(2);

		// accounts:
		const accDR = await abAdapter.getParticipantAccounts(reqTransferDto.payerFspId);
		expect(accDR).toBeDefined();
		expect(accDR.length).toEqual(1);
		expect(accDR[0]!.id).toBeDefined();
		expect(accDR[0]!.ownerId).toEqual(reqTransferDto.payerFspId);
		expect(accDR[0]!.state).toEqual('ACTIVE');
		expect(accDR[0]!.type).toEqual('SETTLEMENT');
		expect(accDR[0]!.currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(accDR[0]!.pendingDebitBalance).toEqual('0');
		expect(accDR[0]!.postedDebitBalance).toEqual(reqTransferDto.amount);
		expect(accDR[0]!.postedCreditBalance).toEqual('0');
		expect(accDR[0]!.pendingCreditBalance).toEqual('0');
		expect(accDR[0]!.timestampLastJournalEntry).toBeDefined();
		expect(accDR[0]!.timestampLastJournalEntry).toBeGreaterThan(0);

		const accCR = await abAdapter.getParticipantAccounts(reqTransferDto.payeeFspId);
		expect(accCR).toBeDefined();
		expect(accCR.length).toEqual(1);
		expect(accCR[0]!.id).toBeDefined();
		expect(accCR[0]!.ownerId).toEqual(reqTransferDto.payeeFspId);
		expect(accCR[0]!.state).toEqual('ACTIVE');
		expect(accCR[0]!.type).toEqual('SETTLEMENT');
		expect(accCR[0]!.currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(accCR[0]!.pendingDebitBalance).toEqual('0');
		expect(accCR[0]!.postedDebitBalance).toEqual('0');
		expect(accCR[0]!.postedCreditBalance).toEqual(reqTransferDto.amount);
		expect(accCR[0]!.pendingCreditBalance).toEqual('0');
		expect(accCR[0]!.timestampLastJournalEntry).toBeDefined();
		expect(accCR[0]!.timestampLastJournalEntry).toBeGreaterThan(0);

		// transfers (journal entries):
		const accDRTransfers = await abAdapter.getJournalEntriesByAccountId(accDR[0]!.id!);
		expect(accDRTransfers).toBeDefined();
		expect(accDRTransfers.length).toEqual(1);
		expect(accDRTransfers[0].id).toBeDefined();
		expect(accDRTransfers[0].ownerId).toBeDefined();
		expect(accDRTransfers[0].ownerId).toEqual(batchId);
		expect(accDRTransfers[0].currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(accDRTransfers[0].amount).toEqual(reqTransferDto.amount);
		expect(accDRTransfers[0].pending).toEqual(false);
		expect(accDRTransfers[0].debitedAccountId).toEqual(accDR[0]!.id);
		expect(accDRTransfers[0].creditedAccountId).toEqual(accCR[0]!.id);
		expect(accDRTransfers[0].timestamp).toBeGreaterThan(0);

		// transfers (settlement link):
		// locate the transfer link in settlement and ensure they match up:
		const accDRTransferSttl = await settleTransferRepo.getBatchTransfersByBatchIds([batchId]);
		expect(accDRTransferSttl).toBeDefined();
		expect(accDRTransferSttl.length).toEqual(1);
		expect(accDRTransferSttl[0].transferId).toBeDefined();
		expect(accDRTransferSttl[0].transferTimestamp).toBeGreaterThan(0);
		expect(accDRTransferSttl[0].payerFspId).toEqual(reqTransferDto.payerFspId);
		expect(accDRTransferSttl[0].payeeFspId).toEqual(reqTransferDto.payeeFspId);
		expect(accDRTransferSttl[0].currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(accDRTransferSttl[0].amount).toEqual(reqTransferDto.amount);
		expect(accDRTransferSttl[0].batchId).toEqual(batchId);
		expect(accDRTransferSttl[0].batchName).toEqual(batches[0].batchName);
		expect(accDRTransferSttl[0].journalEntryId).toEqual(accDRTransfers[0].id);
	});

	test("create settlement transfer and ensure batch allocation is correct based on settlement model", async () => {
		//TODO 
	});


	test("test exceptions/errors responses for create transfer (validations)", async () => {
		// TODO
	});

	test("request and execute a settlement matrix", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'FX'
		};
		const batchId: string = await aggregate.handleTransfer(securityContext, reqTransferDto);
		expect(batchId).toBeDefined();

		const dateTo = Date.now();
		const dateFrom = dateTo - 5000;
		const matrixId = await aggregate.createSettlementMatrix(
			securityContext,
			null, // matrix-id
			reqTransferDto.settlementModel,
			reqTransferDto.currencyCode,
			dateFrom,
			dateTo
		);
		expect(matrixId).toBeDefined();

		// Not allowed to create matrix using the same id.
		try {
			await aggregate.createSettlementMatrix(
				securityContext,
				matrixId,
				reqTransferDto.settlementModel,
				reqTransferDto.currencyCode,
				dateFrom,
				dateTo
			);
			fail('Expected to throw error!');
		} catch (err: any) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementMatrixAlreadyExistsError).toEqual(true);
			expect(err.message).toEqual('Matrix with the same id already exists');
		}

		// retrieve the matrix and ensure it is in idle:
		const matrix = await aggregate.getSettlementMatrix(securityContext, matrixId);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId);
		expect(matrix!.updatedAt).toBeGreaterThan(0);
		expect(matrix!.createdAt).toBeGreaterThan(0);
		expect(matrix!.createdAt).toBeGreaterThan(0);
		expect(matrix!.dateFrom).toEqual(dateFrom);
		expect(matrix!.dateTo).toEqual(dateTo);
		expect(matrix!.currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(matrix!.settlementModel).toEqual(reqTransferDto.settlementModel);
		expect(matrix!.state).toEqual('IDLE');
		expect(matrix!.batches.length).toEqual(1);
		expect(matrix!.participantBalances.length).toEqual(2);
		expect(matrix!.totalDebitBalance).toEqual(reqTransferDto.amount);
		expect(matrix!.totalCreditBalance).toEqual(reqTransferDto.amount);
		expect(matrix!.generationDurationSecs).toBeGreaterThan(-1);

		// close the matrix:
		await aggregate.closeSettlementMatrix(securityContext, matrixId);
		const matrixClosed = await aggregate.getSettlementMatrix(securityContext, matrixId);
		expect(matrixClosed).toBeDefined();
		expect(matrixClosed!.id).toEqual(matrixId);
		expect(matrixClosed!.state).toEqual('CLOSED');

		
		
		
		

	});

	
});
