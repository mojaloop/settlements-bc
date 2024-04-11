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
	CannotSettleSettlementMatrixError,
	IAccountsBalancesAdapter,
	InvalidAmountError,
	InvalidBatchSettlementModelError,
	InvalidCurrencyCodeError,
	InvalidIdError,
	InvalidTimestampError,
	InvalidTransferIdError, ISettlementBatchCacheRepo,
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo, ISettlementConfigCacheRepo,
	ISettlementConfigRepo,
	ISettlementMatrixRequestRepo,
	ProcessTransferCmd,
	ProcessTransferCmdPayload,
	SettlementMatrixAlreadyExistsError,
	SettlementMatrixNotFoundError,
	SettlementsAggregate
} from "../../src/index";
import {ConsoleLogger, ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {randomUUID} from "crypto";
import {
	AccountsBalancesAdapterMock,
	AuditClientMock,
	MessageCache,
	MessageProducerMock, SettlementBatchCacheRepoMock,
	SettlementBatchRepoMock,
	SettlementBatchTransferRepoMock, SettlementConfigCacheRepoMock,
	SettlementConfigRepoMock,
	SettlementMatrixRequestRepoMock
} from "@mojaloop/settlements-bc-shared-mocks-lib";
import {ITransferDto} from "@mojaloop/settlements-bc-public-types-lib";
import {IMessageProducer, MessageTypes} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {IMetrics, MetricsMock} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";
import {ConfigurationClientMock} from "@mojaloop/settlements-bc-shared-mocks-lib/dist/config_client_mock";

let configRepo: ISettlementConfigRepo;
let settleBatchRepo: ISettlementBatchRepo;
let settleTransferRepo: ISettlementBatchTransferRepo;
let settleMatrixReqRepo: ISettlementMatrixRequestRepo;
// let confCacheRepo: ISettlementConfigCacheRepo;
// let batchCacheRepo: ISettlementBatchCacheRepo;
let abAdapter: IAccountsBalancesAdapter;
let msgCache: MessageCache;
let msgProducer: IMessageProducer;

describe("Settlements BC [Domain] - Unit Tests", () => {
	let aggregate : SettlementsAggregate;

	beforeAll(async () => {
		// cross Cutting:
		const logger: ILogger = new ConsoleLogger();
		const auditingClient: IAuditClient = new AuditClientMock();
		const configClient: IConfigurationClient = new ConfigurationClientMock();

		// mock Repos:
		configRepo = new SettlementConfigRepoMock();
		settleBatchRepo = new SettlementBatchRepoMock();
		settleTransferRepo = new SettlementBatchTransferRepoMock();
		settleMatrixReqRepo = new SettlementMatrixRequestRepoMock();
		// confCacheRepo = new SettlementConfigCacheRepoMock();
		// batchCacheRepo = new SettlementBatchCacheRepoMock();

		// adapters:
		abAdapter = new AccountsBalancesAdapterMock();

		// other:
		msgCache = new MessageCache();
		msgProducer = new MessageProducerMock(logger, msgCache);

		// metrics:
		const metricsMock: IMetrics = new MetricsMock();

		// aggregate:
		aggregate = new SettlementsAggregate(
			logger,
			auditingClient,
			configClient,
			settleBatchRepo,
			settleTransferRepo,
			configRepo,
			settleMatrixReqRepo,
			abAdapter,
			msgProducer,
			metricsMock,
			//confCacheRepo,
			//batchCacheRepo
		);
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
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// transfer:
		const batches = await settleBatchRepo.getBatchesByCriteria(
			Date.now() - 30000,
			Date.now() + 30000,
			reqTransferDto.settlementModel,
			[reqTransferDto.currencyCode],
			['OPEN']
		);
		expect(batches.items).toBeDefined();
		expect(batches.items.length).toBeGreaterThan(0);
		expect(batches.items[0].id).toEqual(batchId);
		expect(batches.items[0].state).toEqual('OPEN');
		expect(batches.items[0].accounts.length).toEqual(2);

		// batch:
		const batchById = await settleBatchRepo.getBatch(batchId);
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
		expect(accDRTransferSttl.items).toBeDefined();
		expect(accDRTransferSttl.items.length).toEqual(1);
		expect(accDRTransferSttl.items[0].transferId).toBeDefined();
		expect(accDRTransferSttl.items[0].transferTimestamp).toBeGreaterThan(0);
		expect(accDRTransferSttl.items[0].payerFspId).toEqual(reqTransferDto.payerFspId);
		expect(accDRTransferSttl.items[0].payeeFspId).toEqual(reqTransferDto.payeeFspId);
		expect(accDRTransferSttl.items[0].currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(accDRTransferSttl.items[0].amount).toEqual(reqTransferDto.amount);
		expect(accDRTransferSttl.items[0].batchId).toEqual(batchId);
		expect(accDRTransferSttl.items[0].batchName).toEqual(batches.items[0].batchName);
		expect(accDRTransferSttl.items[0].journalEntryId).toEqual(accDRTransfers[0].id);
	});

	test("create settlement transfer and ensure batch allocation is correct based on settlement model", async () => {
		const debPartAccId = randomUUID();
		const credPartAccId = randomUUID();

		const txn1RspBatch1 = await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: debPartAccId,
			payeeFspId: credPartAccId,
			currencyCode: 'EUR',
			amount: '100', // 1 EURO
			timestamp: Date.now(),
			settlementModel: 'DEF'
		});
		const txn2RspBatch1 = await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: debPartAccId,
			payeeFspId: credPartAccId,
			currencyCode: 'EUR',
			amount: '500', // 5 EURO
			timestamp: Date.now(),
			settlementModel: 'DEF'
		});
		const txn3RspBatch1 = await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: debPartAccId,
			payeeFspId: credPartAccId,
			currencyCode: 'EUR',
			amount: '300', // 3 EURO
			timestamp: Date.now(),
			settlementModel: 'DEF'
		});

		// now we have a new settlement model:
		const txn4RspBatch2 = await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: debPartAccId,
			payeeFspId: credPartAccId,
			currencyCode: 'EUR',
			amount: '300', // 3 EURO
			timestamp: Date.now(),
			settlementModel: 'FRX'
		});

		// now we ensure that we have 1 batch for the first 3 transfers, and another batch for transfer nr 4:
		expect(txn1RspBatch1).toBeDefined();
		expect(txn2RspBatch1).toBeDefined();
		expect(txn3RspBatch1).toBeDefined();
		expect(txn4RspBatch2).toBeDefined();

		expect(txn1RspBatch1).toEqual(txn2RspBatch1);
		expect(txn1RspBatch1).toEqual(txn3RspBatch1);

		const batch1 = await settleBatchRepo.getBatch(txn1RspBatch1);
		expect(batch1).toBeDefined();
		expect(batch1!.settlementModel).toEqual('DEF');
		expect(batch1!.id).toEqual(txn1RspBatch1);
		expect(batch1!.id).toEqual(txn2RspBatch1);
		expect(batch1!.id).toEqual(txn3RspBatch1);

		const batch2 = await settleBatchRepo.getBatch(txn4RspBatch2);
		expect(batch2).toBeDefined();
		expect(batch2!.settlementModel).toEqual('FRX');
		expect(batch2!.id).toEqual(txn4RspBatch2);

		// Ensure we have one batch for model [DEFAULT]:
		const batchModelDef = await settleBatchRepo.getBatchesByCriteria(
			Date.now() - 15000,
			Date.now(),
			batch1!.settlementModel,
			[batch1!.currencyCode],
			['OPEN']
		);
		expect(batchModelDef.items).toBeDefined();
		expect(batchModelDef.items.length).toEqual(1);

		// Ensure we have one batch for model [FX]:
		const batchModelFx = await settleBatchRepo.getBatchesByCriteria(
			Date.now() - 15000,
			Date.now(),
			batch2!.settlementModel,
			[batch2!.currencyCode],
			['OPEN']
		);
		expect(batchModelFx.items).toBeDefined();
		expect(batchModelFx.items.length).toEqual(1);

		// There should be no batch in closed state:
		const batchModelNoClosed = await settleBatchRepo.getBatchesByCriteria(
			Date.now() - 15000,
			Date.now(),
			batch2!.settlementModel,
			[batch2!.currencyCode],
			['CLOSED']
		);
		expect(batchModelNoClosed.items).toBeDefined();
		expect(batchModelNoClosed.items.length).toEqual(0);
	});

	test("test exceptions/errors responses for create transfer (validations)", async () => {
		// Timestamp:
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: randomUUID(),
				payeeFspId: randomUUID(),
				currencyCode: 'ZAR',
				amount: '1600', //100 EURO
				timestamp: 0,
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidTimestampError).toEqual(true);
		}

		// Settlement Model:
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: randomUUID(),
				payeeFspId: randomUUID(),
				currencyCode: 'ZAR',
				amount: '1600', //100 EURO
				timestamp: Date.now(),
				settlementModel: ''
			});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidBatchSettlementModelError).toEqual(true);
		}

		// Currency Code:
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: randomUUID(),
				payeeFspId: randomUUID(),
				currencyCode: '',
				amount: '1600', //100 EURO
				timestamp: Date.now(),
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCurrencyCodeError).toEqual(true);
		}

		// Amount:
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: randomUUID(),
				payeeFspId: randomUUID(),
				currencyCode: 'ZAR',
				amount: '',
				timestamp: Date.now(),
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidAmountError).toEqual(true);
		}

		// Transfer ID:
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: '',
				payerFspId: randomUUID(),
				payeeFspId: randomUUID(),
				currencyCode: 'ZAR',
				amount: '15000', //150 ZAR
				timestamp: Date.now(),
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidTransferIdError).toEqual(true);
		}

		// Debit Account ID:
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: '',
				payeeFspId: randomUUID(),
				currencyCode: 'ZAR',
				amount: '15000', //150 ZAR
				timestamp: Date.now(),
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err :any) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidIdError).toEqual(true);
			expect(err.message).toEqual('Invalid payerFspId in transfer');
		}

		// Credit Account ID:
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: randomUUID(),
				payeeFspId: '',
				currencyCode: 'ZAR',
				amount: '15000', //150 ZAR
				timestamp: Date.now(),
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err :any) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidIdError).toEqual(true);
			expect(err.message).toEqual('Invalid payeeFspId in transfer');
		}

		// Invalid Currency ID (not mapped):
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: randomUUID(),
				payeeFspId: randomUUID(),
				currencyCode: 'ZZZ',
				amount: '15000', //150 ZZZ
				timestamp: Date.now(),
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCurrencyCodeError).toEqual(true);
		}

		// Invalid Amount (non decimal):
		try {
			await aggregate.handleTransfer({
				id: null,
				transferId: randomUUID(),
				payerFspId: randomUUID(),
				payeeFspId: randomUUID(),
				currencyCode: 'ZAR',
				amount: 'GSDSSD', // Invalid
				timestamp: Date.now(),
				settlementModel: 'ERR'
			});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidAmountError).toEqual(true);
		}

		// Invalid Amount (0):
		try {
			await aggregate.handleTransfer({
					id: null,
					transferId: randomUUID(),
					payerFspId: randomUUID(),
					payeeFspId: randomUUID(),
					currencyCode: 'ZAR',
					amount: '0', // Invalid
					timestamp: Date.now(),
					settlementModel: 'ERR'
				});
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidAmountError).toEqual(true);
		}
	});

	test("request, close and settle a settlement matrix", async () => {
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
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		const dateTo = Date.now();
		const dateFrom = dateTo - 5000;
		const matrixId = await aggregate.createDynamicSettlementMatrix(
			null, // matrix-id
			reqTransferDto.settlementModel,
			[reqTransferDto.currencyCode],
			[],
			dateFrom,
			dateTo
		);
		expect(matrixId).toBeDefined();

		// not allowed to create matrix using the same id.
		try {
			await aggregate.createDynamicSettlementMatrix(
				matrixId,
				reqTransferDto.settlementModel,
				[reqTransferDto.currencyCode],
				[],
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
		const matrix = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId);
		expect(matrix!.updatedAt).toBeGreaterThan(0);
		expect(matrix!.createdAt).toBeGreaterThan(0);
		expect(matrix!.createdAt).toBeGreaterThan(0);
		expect(matrix!.dateFrom).toEqual(dateFrom);
		expect(matrix!.dateTo).toEqual(dateTo);
		expect(matrix!.currencyCodes[0]).toEqual(reqTransferDto.currencyCode);
		expect(matrix!.settlementModel).toEqual(reqTransferDto.settlementModel);
		expect(matrix!.state).toEqual('IDLE');
		expect(matrix!.batches.length).toEqual(1);
		expect(matrix!.balancesByParticipant.length).toEqual(2);
		// State and Currency balances:
		expect(matrix!.balancesByStateAndCurrency[0].debitBalance).toEqual(reqTransferDto.amount);
		expect(matrix!.balancesByStateAndCurrency[0].creditBalance).toEqual(reqTransferDto.amount);
		expect(matrix!.balancesByStateAndCurrency[0].state).toEqual('OPEN');
		expect(matrix!.balancesByStateAndCurrency[0].currencyCode).toEqual(reqTransferDto.currencyCode);
		// Participants:
		expect(matrix!.generationDurationSecs).toBeGreaterThan(-1);

		// close the matrix:
		await aggregate.closeSettlementMatrix(matrixId);
		const matrixClosed = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixClosed).toBeDefined();
		expect(matrixClosed!.id).toEqual(matrixId);
		expect(matrixClosed!.state).toEqual('IDLE');

		// lock the matrix:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId);
		// settle the matrix:
		await aggregate.settleSettlementMatrix(matrixId);
		const matrixSettled = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixSettled).toBeDefined();
		expect(matrixSettled!.id).toEqual(matrixId);
		expect(matrixSettled!.state).toEqual('FINALIZED');
	});

	test("ensure executed matrix cannot be settled again", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'ZAR',
			amount: '1600', //16 ZAR
			timestamp: Date.now(),
			settlementModel: 'REMITTANCE'
		};
		await aggregate.handleTransfer(reqTransferDto);

		// request a Settlement Matrix, which will be used to execute the matrix on.
		const matrixId = await aggregate.createDynamicSettlementMatrix(
			null, // matrix-id
			reqTransferDto.settlementModel,
			[reqTransferDto.currencyCode],
			[],
			Date.now() - 5000,
			Date.now()
		);
		expect(matrixId).toBeDefined();

		const matrix = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId);
		expect(matrix!.state).toEqual('IDLE');

		// lock the matrix:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId);
		// execute the matrix:
		await aggregate.settleSettlementMatrix(matrixId);
		const matrixClosed = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixClosed).toBeDefined();
		expect(matrixClosed!.id).toEqual(matrixId);
		expect(matrixClosed!.state).toEqual('FINALIZED');

		// ensure the 2nd execute generates an error (SettlementMatrixRequestClosedError):
		try {
			await aggregate.settleSettlementMatrix(matrixId);
			fail('Expected to throw error!');
		} catch (err :any) {
			expect(err).toBeDefined();
			expect(err instanceof CannotSettleSettlementMatrixError).toEqual(true);
			expect(err.message).toEqual("Cannot settle a matrix that is not Locked");
		}

		// ensure an invalid id generates an error (SettlementMatrixRequestClosedError):
		const invalidMatrixId = randomUUID();
		try {
			await aggregate.settleSettlementMatrix(invalidMatrixId);
			fail('Expected to throw error!');
		} catch (err :any) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementMatrixNotFoundError).toEqual(true);
			expect(err.message).toEqual(`Matrix with id: ${invalidMatrixId} not found`);
		}
	});

	test("ensure batch seq increments for batches within the same period", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'ZAR',
			amount: '1200', //12 ZAR
			timestamp: Date.now(),
			settlementModel: 'SEQ_TEST'
		};
		const batchId = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// Request a Settlement Matrix, which will be used to execute the matrix on.
		const matrixId = await aggregate.createDynamicSettlementMatrix(
			null, //matrix-id
			reqTransferDto.settlementModel,
			[reqTransferDto.currencyCode],
			[],
			Date.now() - 5000,
			Date.now()
		);
		expect(matrixId).toBeDefined();

		const matrix = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId);
		expect(matrix!.state).toEqual('IDLE');

		// lock the matrix for settlement:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId);
		const matrixLocked = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixLocked).toBeDefined();
		expect(matrixLocked!.id).toEqual(matrixId);
		expect(matrixLocked!.state).toEqual('LOCKED');

		// execute the matrix:
		await aggregate.settleSettlementMatrix(matrixId);
		// ensure the batch has been closed:
		const matrixClosed = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixClosed).toBeDefined();
		expect(matrixClosed!.id).toEqual(matrixId);
		expect(matrixClosed!.state).toEqual('FINALIZED');

		// create another Transfer:
		const newBatchId = await aggregate.handleTransfer(reqTransferDto);
		expect(newBatchId).toBeDefined();
		expect(newBatchId === batchId).toEqual(false);

		// retrieve the Batch:
		const batches = await settleBatchRepo.getBatchesByCriteria(
			Date.now() - 15000,
			Date.now(),
			reqTransferDto.settlementModel,
			[reqTransferDto.currencyCode],
			[]
		);
		expect(batches.items).toBeDefined();
		// we expect at least 2 batches:
		expect(batches.items.length).toEqual(2);
		expect(batches.items[0].batchName).toEqual(batches.items[1].batchName);

		// ensure the Batch Sequence has a Seq of [2].
		for (const batch of batches.items) {
			if (batch.state === 'SETTLED') continue;
			// Ensure our seq was incremented:
			expect(batch.batchSequence).toEqual(2);
		}

		const batchesByName = await settleBatchRepo.getBatchesByName(batches.items[0].batchName)
		expect(batchesByName).toBeDefined();
		expect(batches.items.length).toEqual(2);
		expect(batches.items[0].id === batches.items[1].id).toEqual(false);
	});

	test("batch accounts unique per batch and participant-id", async () => {
		const settleModel = 'PAR_ACC';
		const currency = 'ZAR';
		const payer = 'deb-acc';
		const payee = 'cred-acc';
		const batchId = await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: payer,
			payeeFspId: payee,
			currencyCode: currency,
			amount: '123', //1.23 ZAR
			timestamp: Date.now(),
			settlementModel: settleModel
		});
		expect(batchId).toBeDefined();

		const matrixId = await aggregate.createDynamicSettlementMatrix(
			null, //matrix-id
			settleModel,
			[currency],
			[],
			Date.now() - 5000,
			Date.now(),
		);
		expect(matrixId).toBeDefined();

		// lock:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId);
		// settle:
		await aggregate.settleSettlementMatrix(matrixId);

		// New Transfer under a new batch but same participants:
		const batchId2 = await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: payer,
			payeeFspId: payee,
			currencyCode: currency,
			amount: '123', //1.23 ZAR
			timestamp: Date.now(),
			settlementModel: settleModel
			},
		);
		expect(batchId2).toBeDefined();

		const partAccPayer = await abAdapter.getParticipantAccounts(payer);
		const partAccPayee = await abAdapter.getParticipantAccounts(payee);

		expect(partAccPayer).toBeDefined();
		expect(partAccPayer.length).toEqual(2);
		expect(partAccPayee).toBeDefined();
		expect(partAccPayee.length).toEqual(2);

		for (const accBatch1 of partAccPayer) {
			for (const accBatch2 of partAccPayee) {
				expect(accBatch1).toBeDefined();
				expect(accBatch2).toBeDefined();
				// Batch Accounts are not allowed to match, even if [ParticipantAccountId's] match:
				expect(accBatch1.id === accBatch2.id).toEqual(false);
			}
		}
	});

	test("process handle transfer command", async () => {
		const payload: ProcessTransferCmdPayload = {
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'ZAR',
			amount: '1500', //15 ZAR
			completedTimestamp: Date.now(),
			settlementModel: 'SEQ_TEST_CMD'
		}

		const reqTransferCmd: ProcessTransferCmd = {
			boundedContextName: "",
			aggregateId: "",
			aggregateName: "",
			msgKey: "",
			msgTopic: "",
			payload: payload,
			validatePayload: function (): void {
				throw new Error("Function not implemented.");
			},
			msgType: MessageTypes.COMMAND,
			fspiopOpaqueState: undefined,
			msgId: "",
			msgTimestamp: Date.now(),
			msgPartition: null,
			msgOffset: null,
			msgName: ""
		};
		const batchId = await aggregate.processTransferCmd(reqTransferCmd);
		expect(batchId).toBeDefined();

		const results = await settleTransferRepo.getBatchTransfersByBatchIds([batchId]);
		const transfers = results.items;
		expect(transfers).toBeDefined();
		expect(transfers.length).toEqual(1);
		expect(transfers[0].transferId).toEqual(payload.transferId);

		// lookup with invalid batch-id
		// try {
			const results2 = await settleTransferRepo.getBatchTransfersByBatchIds([randomUUID()]);
			expect(results2.items.length).toEqual(0);
		// } catch (err: any) {
		// 	expect(err).toBeDefined();
		// 	expect(err instanceof SettlementBatchNotFoundError).toEqual(true);
		// }
	});

	test("matrix re-calculate logic", async () => {
		const settleModel = 'RE-CALC';
		const currency = 'ZAR';
		const batchId = await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: currency,
			amount: '1000', //10 EURO
			timestamp: Date.now(),
			settlementModel: settleModel
		});
		expect(batchId).toBeDefined();

		const matrixId = await aggregate.createDynamicSettlementMatrix(
			null, //matrix-id
			settleModel,
			[currency],
			[],
			Date.now() - 5000,
			Date.now(),
		);
		expect(matrixId).toBeDefined();

		await aggregate.recalculateSettlementMatrix(matrixId);
		const matrixIdle = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixIdle).toBeDefined();
		expect(matrixIdle!.id).toEqual(matrixId);
		expect(matrixIdle!.state).toEqual('IDLE');
		expect(matrixIdle!.balancesByParticipant.length).toEqual(2);

		// 2nd transfer with new participants:
		await aggregate.handleTransfer({
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: currency,
			amount: '1100', //11 EURO
			timestamp: Date.now(),
			settlementModel: settleModel
		});
		await aggregate.recalculateSettlementMatrix(matrixId);
		const matrixIdleUpdated = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixIdleUpdated).toBeDefined();
		expect(matrixIdleUpdated!.id).toEqual(matrixId);
		expect(matrixIdleUpdated!.state).toEqual('IDLE');
		expect(matrixIdleUpdated!.balancesByParticipant.length).toEqual(4);
	});

	test("test exceptions/errors responses for lookups", async () => {
		const batch = await settleBatchRepo.getBatch('12345');
		expect(batch).toBeNull();
	});

	test("dispute a batch", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'DISPUTE-ME'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// dispute the one and only batch:
		const matrixIdDisp = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixIdDisp).toBeDefined();

		// not allowed to create a duplicate static matrix:
		try {
			await aggregate.createStaticSettlementMatrix(matrixIdDisp, [batchId]);
			fail('Expected to throw error!');
		} catch (err: any) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementMatrixAlreadyExistsError).toEqual(true);
			expect(err.message).toEqual('Matrix with the same id already exists');
		}

		// dispute the static matrix:
		await aggregate.disputeSettlementMatrix(matrixIdDisp);

		let matrixDisp = await settleMatrixReqRepo.getMatrixById(matrixIdDisp);
		expect(matrixDisp).toBeDefined();
		expect(matrixDisp!.id).toEqual(matrixIdDisp);
		expect(matrixDisp!.state).toEqual("IDLE");
		expect(matrixDisp!.type).toEqual("STATIC");
		// Currency:
		expect(matrixDisp!.balancesByStateAndCurrency.length).toEqual(1);
		expect(matrixDisp!.balancesByStateAndCurrency[0].debitBalance).toEqual("10000");
		expect(matrixDisp!.balancesByStateAndCurrency[0].creditBalance).toEqual("10000");
		expect(matrixDisp!.balancesByStateAndCurrency[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByStateAndCurrency[0].state).toEqual("OPEN");
		// Participants:
		expect(matrixDisp!.balancesByParticipant.length).toEqual(2);
		// Payer:
		expect(matrixDisp!.balancesByParticipant[0].debitBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[0].creditBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[0].participantId).toEqual(reqTransferDto.payerFspId);
		expect(matrixDisp!.balancesByParticipant[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[0].state).toEqual("OPEN");
		// Payee:
		expect(matrixDisp!.balancesByParticipant[1].debitBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[1].creditBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[1].participantId).toEqual(reqTransferDto.payeeFspId);
		expect(matrixDisp!.balancesByParticipant[1].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[1].state).toEqual("OPEN");

		await aggregate.recalculateSettlementMatrix(matrixIdDisp);
		matrixDisp = await settleMatrixReqRepo.getMatrixById(matrixIdDisp);
		expect(matrixDisp).toBeDefined();
		expect(matrixDisp!.id).toEqual(matrixIdDisp);
		expect(matrixDisp!.state).toEqual("IDLE");
		expect(matrixDisp!.type).toEqual("STATIC");

		expect(matrixDisp!.balancesByParticipant.length).toEqual(2);
		// Payer:
		expect(matrixDisp!.balancesByParticipant[0].debitBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[0].creditBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[0].participantId).toEqual(reqTransferDto.payerFspId);
		expect(matrixDisp!.balancesByParticipant[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[0].state).toEqual("DISPUTED");
		// Payee:
		expect(matrixDisp!.balancesByParticipant[1].debitBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[1].creditBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[1].participantId).toEqual(reqTransferDto.payeeFspId);
		expect(matrixDisp!.balancesByParticipant[1].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[1].state).toEqual("DISPUTED");

		const batchDisp = await settleBatchRepo.getBatch(batchId);
		expect(batchDisp).toBeDefined();
		expect(batchDisp!.id).toEqual(batchId);
		expect(batchDisp!.state).toEqual("DISPUTED");

		// now let's create a matrix with the disputed batch:
		const matrixId = await aggregate.createDynamicSettlementMatrix(
			null, //matrix-id
			reqTransferDto.settlementModel,
			[reqTransferDto.currencyCode],
			[],
			Date.now() - 5000,
			Date.now(),
		);
		expect(matrixId).toBeDefined();
		const matrix = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId);
		expect(matrix!.state).toEqual('IDLE');
		expect(matrix!.batches.length).toEqual(1);

		// remove the batch from dispute and re-calculate the matrix:
		const matrixIdUnDispute = await aggregate.createStaticSettlementMatrix(
			null, //matrix-id
			[batchId]
		);
		await aggregate.closeSettlementMatrix(matrixIdUnDispute);

		expect(matrixIdUnDispute).toBeDefined();
		const matrixUnDispute = await settleMatrixReqRepo.getMatrixById(matrixIdUnDispute);
		expect(matrixUnDispute).toBeDefined();
		expect(matrixUnDispute!.state).toEqual('IDLE');
		expect(matrixUnDispute!.currencyCodes.length).toEqual(0);
		expect(matrixUnDispute!.settlementModel).toBeNull();
		expect(matrixUnDispute!.batches.length).toEqual(1);

		const batchUnDispute = await settleBatchRepo.getBatch(batchId);
		expect(batchUnDispute).toBeDefined();
		expect(batchUnDispute!.id).toEqual(batchId);
		expect(batchUnDispute!.state).toEqual('CLOSED');

		// not allowed to create a duplicate close specific matrix:
		try {
			await aggregate.createStaticSettlementMatrix(matrixIdUnDispute, [batchId]);
			fail('Expected to throw error!');
		} catch (err: any) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementMatrixAlreadyExistsError).toEqual(true);
			expect(err.message).toEqual('Matrix with the same id already exists');
		}
	});

	test("test static matrix batch add/remove", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'ADD-REMOVE-BATCHES-ME'
		};
		const batchId01: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId01).toBeDefined();
		reqTransferDto.transferId = randomUUID()
		reqTransferDto.timestamp += 1_000_000_0
		const batchId02: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId02).toBeDefined();
		expect(batchId01 === batchId02).toEqual(false);

		// Dispute the one and only batch:
		const matrixId = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId01]
		);
		expect(matrixId).toBeDefined();

		let matrix01 = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix01).toBeDefined();
		expect(matrix01!.id).toEqual(matrixId);
		expect(matrix01!.batches.length).toEqual(1);

		// Add the 2nd batch:
		await aggregate.addBatchesToStaticSettlementMatrix(matrixId, [batchId02]);

		matrix01 = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix01).toBeDefined();
		expect(matrix01!.id).toEqual(matrixId);
		expect(matrix01!.batches.length).toEqual(2);

		// Remove the 2nd batch:
		await aggregate.removeBatchesFromStaticSettlementMatrix(matrixId, [batchId02]);
		matrix01 = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix01).toBeDefined();
		expect(matrix01!.id).toEqual(matrixId);
		expect(matrix01!.batches.length).toEqual(1);
	});

	test("disputed batch not to settle", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'DISPUTE-ME'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		const reqTransferDto2: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'NO-DISPUTE'
		};
		const batchId2: string = await aggregate.handleTransfer(reqTransferDto2);
		expect(batchId2).toBeDefined();

		// Create a settlement matrix with batches:
		const matrixIdDisp = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId, batchId2]
		);
		expect(matrixIdDisp).toBeDefined();

		let matrixDisp = await settleMatrixReqRepo.getMatrixById(matrixIdDisp);
		expect(matrixDisp).toBeDefined();
		expect(matrixDisp!.id).toEqual(matrixIdDisp);
		expect(matrixDisp!.state).toEqual('IDLE');
		expect(matrixDisp!.type).toEqual('STATIC');

		// Totals:
		expect(matrixDisp!.balancesByStateAndCurrency.length).toEqual(1);
		expect(matrixDisp!.balancesByStateAndCurrency[0].debitBalance).toEqual("20000");
		expect(matrixDisp!.balancesByStateAndCurrency[0].creditBalance).toEqual("20000");
		expect(matrixDisp!.balancesByStateAndCurrency[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByStateAndCurrency[0].state).toEqual("OPEN");
		// Participants:
		expect(matrixDisp!.balancesByParticipant.length).toEqual(4);
		// Payer:
		expect(matrixDisp!.balancesByParticipant[0].debitBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[0].creditBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[0].participantId).toEqual(reqTransferDto.payerFspId);
		expect(matrixDisp!.balancesByParticipant[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[0].state).toEqual("OPEN");
		// Payee:
		expect(matrixDisp!.balancesByParticipant[1].debitBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[1].creditBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[1].participantId).toEqual(reqTransferDto.payeeFspId);
		expect(matrixDisp!.balancesByParticipant[1].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[1].state).toEqual("OPEN");

		// Create another settlement matrix with first batch:
		const matrixIdDisp2 = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixIdDisp2).toBeDefined();

		let matrixDisp2 = await settleMatrixReqRepo.getMatrixById(matrixIdDisp2);
		expect(matrixDisp2).toBeDefined();
		expect(matrixDisp2!.id).toEqual(matrixIdDisp2);
		expect(matrixDisp2!.state).toEqual('IDLE');
		expect(matrixDisp2!.type).toEqual('STATIC');
		expect(matrixDisp2!.balancesByParticipant.length).toEqual(2);

		// Totals:
		expect(matrixDisp2!.balancesByStateAndCurrency.length).toEqual(1);
		expect(matrixDisp2!.balancesByStateAndCurrency[0].debitBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByStateAndCurrency[0].creditBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByStateAndCurrency[0].currencyCode).toEqual("EUR");
		expect(matrixDisp2!.balancesByStateAndCurrency[0].state).toEqual("OPEN");
		// Participants:
		expect(matrixDisp2!.balancesByParticipant.length).toEqual(2);
		// Payer:
		expect(matrixDisp2!.balancesByParticipant[0].debitBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByParticipant[0].creditBalance).toEqual("0");
		expect(matrixDisp2!.balancesByParticipant[0].participantId).toEqual(reqTransferDto.payerFspId);
		expect(matrixDisp2!.balancesByParticipant[0].currencyCode).toEqual("EUR");
		expect(matrixDisp2!.balancesByParticipant[0].state).toEqual("OPEN");
		// Payee:
		expect(matrixDisp2!.balancesByParticipant[1].debitBalance).toEqual("0");
		expect(matrixDisp2!.balancesByParticipant[1].creditBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByParticipant[1].participantId).toEqual(reqTransferDto.payeeFspId);
		expect(matrixDisp2!.balancesByParticipant[1].currencyCode).toEqual("EUR");
		expect(matrixDisp2!.balancesByParticipant[1].state).toEqual("OPEN");

		// Dispute the matrix:
		await aggregate.disputeSettlementMatrix(matrixIdDisp2);

		// Verify disputed batch:
		const batchDisp = await settleBatchRepo.getBatch(batchId);
		expect(batchDisp).toBeDefined();
		expect(batchDisp!.id).toEqual(batchId);
		expect(batchDisp!.state).toEqual('DISPUTED');

		// Verify matrix2 before re-calculate:
		matrixDisp2 = await settleMatrixReqRepo.getMatrixById(matrixIdDisp2);
		expect(matrixDisp2).toBeDefined();
		expect(matrixDisp2!.id).toEqual(matrixIdDisp2);
		expect(matrixDisp2!.state).toEqual('IDLE');
		expect(matrixDisp2!.type).toEqual('STATIC');
		expect(matrixDisp2!.balancesByParticipant.length).toEqual(2);

		// Totals:
		expect(matrixDisp2!.balancesByStateAndCurrency.length).toEqual(1);
		expect(matrixDisp2!.balancesByStateAndCurrency[0].debitBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByStateAndCurrency[0].creditBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByStateAndCurrency[0].currencyCode).toEqual("EUR");
		expect(matrixDisp2!.balancesByStateAndCurrency[0].state).toEqual("OPEN");
		// Participants:
		expect(matrixDisp2!.balancesByParticipant.length).toEqual(2);
		// Payer:
		expect(matrixDisp2!.balancesByParticipant[0].debitBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByParticipant[0].creditBalance).toEqual("0");
		expect(matrixDisp2!.balancesByParticipant[0].participantId).toEqual(reqTransferDto.payerFspId);
		expect(matrixDisp2!.balancesByParticipant[0].currencyCode).toEqual("EUR");
		expect(matrixDisp2!.balancesByParticipant[0].state).toEqual("OPEN");
		// Payee:
		expect(matrixDisp2!.balancesByParticipant[1].debitBalance).toEqual("0");
		expect(matrixDisp2!.balancesByParticipant[1].creditBalance).toEqual("10000");
		expect(matrixDisp2!.balancesByParticipant[1].participantId).toEqual(reqTransferDto.payeeFspId);
		expect(matrixDisp2!.balancesByParticipant[1].currencyCode).toEqual("EUR");
		expect(matrixDisp2!.balancesByParticipant[1].state).toEqual("OPEN");
		
		await aggregate.recalculateSettlementMatrix(matrixIdDisp2);

		// Verify matrix2 after re-calculate:
		matrixDisp2 = await settleMatrixReqRepo.getMatrixById(matrixIdDisp2);
		expect(matrixDisp2).toBeDefined();
		expect(matrixDisp2!.id).toEqual(matrixIdDisp2);
		expect(matrixDisp2!.state).toEqual('IDLE');
		expect(matrixDisp2!.type).toEqual('STATIC');
		expect(matrixDisp2!.balancesByParticipant.length).toEqual(2);

		// Verify matrix1 again:
		await aggregate.recalculateSettlementMatrix(matrixIdDisp);

		matrixDisp = await settleMatrixReqRepo.getMatrixById(matrixIdDisp);
		// Verify before settlement:
		expect(matrixDisp).toBeDefined();
		expect(matrixDisp!.id).toEqual(matrixIdDisp);
		expect(matrixDisp!.state).toEqual('IDLE');
		expect(matrixDisp!.type).toEqual('STATIC');
		expect(matrixDisp!.balancesByParticipant.length).toEqual(4);
		
		// Settle matrix1:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixIdDisp);
		await aggregate.settleSettlementMatrix(matrixIdDisp);

		matrixDisp = await settleMatrixReqRepo.getMatrixById(matrixIdDisp);
		//check the settled matrix1 again
		expect(matrixDisp).toBeDefined();
		expect(matrixDisp!.id).toEqual(matrixIdDisp);
		expect(matrixDisp!.state).toEqual('FINALIZED');
		expect(matrixDisp!.type).toEqual('STATIC');
		// We only expect a single batch (the settled batch, since the disputed batch is excluded).
		expect(matrixDisp!.batches.length).toEqual(1);

		// Totals:
		expect(matrixDisp!.balancesByStateAndCurrency.length).toEqual(1);
		expect(matrixDisp!.balancesByStateAndCurrency[0].debitBalance).toEqual("10000");
		expect(matrixDisp!.balancesByStateAndCurrency[0].creditBalance).toEqual("10000");
		expect(matrixDisp!.balancesByStateAndCurrency[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByStateAndCurrency[0].state).toEqual("SETTLED");
		// Participants:
		expect(matrixDisp!.balancesByParticipant.length).toEqual(2);
		// Payer:
		expect(matrixDisp!.balancesByParticipant[0].debitBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[0].creditBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[0].state).toEqual("SETTLED");
		// Payee:
		expect(matrixDisp!.balancesByParticipant[1].debitBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[1].creditBalance).toEqual("10000");
		expect(matrixDisp!.balancesByParticipant[1].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[1].state).toEqual("SETTLED");

		// Ensure that the disputed batch was not settled, even though it was originally part of [matrixIdDisp]:
		const batchExpDisputed = await settleBatchRepo.getBatch(batchId);
		expect(batchExpDisputed).toBeDefined();
		expect(batchExpDisputed!.state).toEqual('DISPUTED');

		const batchExpSettled = await settleBatchRepo.getBatch(batchId2);
		expect(batchExpSettled).toBeDefined();
		expect(batchExpSettled!.state).toEqual('SETTLED');
	});

	test("settlement matrix balances", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '1300', //13 EURO
			timestamp: Date.now(),
			settlementModel: 'BAL-TEST'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		const payerTxn2and3 = randomUUID();
		const payeeTxn2and3 = randomUUID();
		const reqTransferDto2: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: payerTxn2and3,
			payeeFspId: payeeTxn2and3,
			currencyCode: 'EUR',
			amount: '1300', //13 EURO
			timestamp: Date.now(),
			settlementModel: 'BAL-TEST'
		};
		const batchId2: string = await aggregate.handleTransfer(reqTransferDto2);
		expect(batchId2).toBeDefined();
		expect(batchId).toEqual(batchId2);

		const reqTransferDto3: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: payerTxn2and3,
			payeeFspId: payeeTxn2and3,
			currencyCode: 'EUR',
			amount: '1300', //13 EURO
			timestamp: Date.now(),
			settlementModel: 'BAL-TEST'
		};
		const batchId3: string = await aggregate.handleTransfer(reqTransferDto3);
		expect(batchId3).toBeDefined();
		expect(batchId2).toEqual(batchId3);

		// Create a settlement matrix with batches:
		const matrixIdDisp = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixIdDisp).toBeDefined();

		let matrixDisp = await settleMatrixReqRepo.getMatrixById(matrixIdDisp);
		expect(matrixDisp).toBeDefined();
		expect(matrixDisp!.id).toEqual(matrixIdDisp);
		expect(matrixDisp!.state).toEqual('IDLE');
		expect(matrixDisp!.type).toEqual('STATIC');

		// Totals:
		expect(matrixDisp!.balancesByStateAndCurrency.length).toEqual(1);
		expect(matrixDisp!.balancesByStateAndCurrency[0].debitBalance).toEqual("3900");
		expect(matrixDisp!.balancesByStateAndCurrency[0].creditBalance).toEqual("3900");
		expect(matrixDisp!.balancesByStateAndCurrency[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByStateAndCurrency[0].state).toEqual("OPEN");
		// Participants:
		expect(matrixDisp!.balancesByParticipant.length).toEqual(4);
		// Payer from Transfers 1:
		expect(matrixDisp!.balancesByParticipant[0].debitBalance).toEqual("1300");
		expect(matrixDisp!.balancesByParticipant[0].creditBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[0].participantId).toEqual(reqTransferDto.payerFspId);
		expect(matrixDisp!.balancesByParticipant[0].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[0].state).toEqual("OPEN");
		// Payee from Transfer 1:
		expect(matrixDisp!.balancesByParticipant[1].debitBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[1].creditBalance).toEqual("1300");
		expect(matrixDisp!.balancesByParticipant[1].participantId).toEqual(reqTransferDto.payeeFspId);
		expect(matrixDisp!.balancesByParticipant[1].currencyCode).toEqual("EUR");
		expect(matrixDisp!.balancesByParticipant[1].state).toEqual("OPEN");
		// Payer from Transfers 2 & 3:
		expect(matrixDisp!.balancesByParticipant[2].debitBalance).toEqual("2600");
		expect(matrixDisp!.balancesByParticipant[2].creditBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[2].participantId).toEqual(payerTxn2and3);
		// Payee from Transfers 2 & 3:
		expect(matrixDisp!.balancesByParticipant[3].debitBalance).toEqual("0");
		expect(matrixDisp!.balancesByParticipant[3].creditBalance).toEqual("2600");
		expect(matrixDisp!.balancesByParticipant[3].participantId).toEqual(payeeTxn2and3);

		// Batch balances:
		const awaitSettleByBatch = await settleBatchRepo.getBatch(batchId);
		expect(awaitSettleByBatch).toBeDefined();
		expect(awaitSettleByBatch!.accounts).toBeDefined();
		expect(awaitSettleByBatch!.accounts.length).toEqual(4);
		expect(awaitSettleByBatch!.id).toEqual(batchId);
		expect(awaitSettleByBatch!.state).toEqual('OPEN');

		// Batch Total Balances:
		var totalDebit = 0, totalCredit = 0;
		awaitSettleByBatch!.accounts.forEach(accItm => {
			totalCredit += Number(accItm.creditBalance);
			totalDebit += Number(accItm.debitBalance);
		});
		expect(totalDebit).toEqual(3900);
		expect(totalCredit).toEqual(3900);
	});

	test("test awaiting settlement lock and unlock (awaiting settlement)", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'AWAIT-ME'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// create a settlement matrix with batches:
		const matrixIdLock = await aggregate.createStaticSettlementMatrix(

			null, // matrix-id
			[batchId]
		);
		expect(matrixIdLock).toBeDefined();
		// lock the matrix:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixIdLock);

		const matrixIdNoLock = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixIdNoLock).toBeDefined();

		// attempt to lock the batch for matrix [matrixIdNoLock, which is already locked by matrixIdLock]:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixIdNoLock);

		// ensure matrix [matrixIdLock] has the lock:
		let awaitSettleByBatch = await settleBatchRepo.getBatch(batchId);
		expect(awaitSettleByBatch).toBeDefined();
		expect(awaitSettleByBatch!.ownerMatrixId!).toEqual(matrixIdLock);
		expect(awaitSettleByBatch!.id).toEqual(batchId);
		expect(awaitSettleByBatch!.state).toEqual('AWAITING_SETTLEMENT');

		// release the lock from the wrong matrix id [matrixIdNoLock]:
		await aggregate.unLockSettlementMatrixFromAwaitingSettlement(matrixIdNoLock);
		// ensure the lock is still on the initial batch:
		awaitSettleByBatch = await settleBatchRepo.getBatch(batchId);
		expect(awaitSettleByBatch).toBeDefined();
		expect(awaitSettleByBatch!.ownerMatrixId).toEqual(matrixIdLock);
		expect(awaitSettleByBatch!.id).toEqual(batchId);
		expect(awaitSettleByBatch!.state).toEqual('AWAITING_SETTLEMENT');

		const matrixLocked = await settleMatrixReqRepo.getMatrixById(matrixIdLock);
		expect(matrixLocked).toBeDefined();
		expect(matrixLocked!.id).toEqual(matrixIdLock);
		expect(matrixLocked!.state).toEqual('LOCKED');
		expect(matrixLocked!.type).toEqual('STATIC');
		expect(matrixLocked!.balancesByParticipant.length).toEqual(2);
		expect(matrixLocked!.batches.length).toEqual(1);

		// release the lock from the correct matrix:
		await aggregate.unLockSettlementMatrixFromAwaitingSettlement(matrixIdLock);
		// lock should now be released:
		awaitSettleByBatch = await settleBatchRepo.getBatch(batchId);
		expect(awaitSettleByBatch!.ownerMatrixId).toBeNull();
		// lock by matrix [matrixIdNoLock]
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixIdNoLock);
		awaitSettleByBatch = await settleBatchRepo.getBatch(batchId);
		expect(awaitSettleByBatch).toBeDefined();
		expect(awaitSettleByBatch!.ownerMatrixId).toEqual(matrixIdNoLock);
		expect(awaitSettleByBatch!.id).toEqual(batchId);
		expect(awaitSettleByBatch!.state).toEqual('AWAITING_SETTLEMENT');

		// batch is allowed to be added to the matrix, but not allowed to lock:
		let matrixNoLock = await settleMatrixReqRepo.getMatrixById(matrixIdNoLock);
		expect(matrixNoLock).toBeDefined();
		expect(matrixNoLock!.id).toEqual(matrixIdNoLock);
		expect(matrixNoLock!.state).toEqual('LOCKED');
		expect(matrixNoLock!.type).toEqual('STATIC');
		expect(matrixNoLock!.balancesByParticipant.length).toEqual(2);
		expect(matrixNoLock!.batches.length).toEqual(1);

		await aggregate.settleSettlementMatrix(matrixIdNoLock);
		matrixNoLock = await settleMatrixReqRepo.getMatrixById(matrixIdNoLock);
		expect(matrixNoLock).toBeDefined();
		expect(matrixNoLock!.id).toEqual(matrixIdNoLock);
		expect(matrixNoLock!.state).toEqual('FINALIZED');
		expect(matrixNoLock!.type).toEqual('STATIC');
		expect(matrixNoLock!.balancesByParticipant.length).toEqual(2);
		expect(matrixNoLock!.batches.length).toEqual(1);
	});

	test("test matrix state machine - positive", async () => {
		// The `settlementModel` is used to categorize the settlements.
		// Settlement is not responsible for deciding what the settlement should be.
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'STATE_MACHINE'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// initial state for a batch is [OPEN]:
		let batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('OPEN');

		// create a settlement matrix with batches:
		let matrixId = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixId).toBeDefined();
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('OPEN');

		// At this point, more transactions may be added to the batch, because the batch status is OPEN.

		// close:
		await aggregate.closeSettlementMatrix(matrixId);
		// At this point, no more transactions will be allocated to the closed batch.
		// A new batch will be created to allocate "late" transfers to.
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('CLOSED');

		// dispute:
		await aggregate.disputeSettlementMatrix(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('DISPUTED');

		// close again:
		await aggregate.closeSettlementMatrix(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('CLOSED');

		// lock settlement:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('AWAITING_SETTLEMENT');

		// unlock settlement:
		await aggregate.unLockSettlementMatrixFromAwaitingSettlement(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('CLOSED');

		// settle settlement, but it won't be settled since it is not yet locked:
		try {
			await aggregate.settleSettlementMatrix(matrixId);
			fail('Expected to throw error!');
		} catch (err: any) {
			expect(err).toBeDefined();
			expect(err instanceof CannotSettleSettlementMatrixError).toEqual(true);
			expect(err.message).toEqual('Cannot settle a matrix that is not Locked');
		}

		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('CLOSED');
		// now we lock the batches via the matrix in order to settle the matrix, but we need a new matrix:
		matrixId = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixId).toBeDefined();
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId);
		await aggregate.settleSettlementMatrix(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('SETTLED');

		const matrixSettled = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrixSettled).toBeDefined();
		expect(matrixSettled!.id).toEqual(matrixId);
		expect(matrixSettled!.state).toEqual('FINALIZED');
	});

	test("test matrix state machine - cannot settle a non-locked matrix", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'STATE_MACHINE_SETTLE'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// initial state for a batch is [OPEN]:
		let batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('OPEN');

		// create a settlement matrix with batches:
		let matrixId = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixId).toBeDefined();

		// settle an open batch, which should fail:
		try {
			await aggregate.settleSettlementMatrix(matrixId);
			fail('Expected to throw error!');
		} catch (err: any) {
			expect(err).toBeDefined();
			expect(err instanceof CannotSettleSettlementMatrixError).toEqual(true);
			expect(err.message).toEqual('Cannot settle a matrix that is not Locked');
		}
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('OPEN');

		let matrix = await settleMatrixReqRepo.getMatrixById(matrixId);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId);
		expect(matrix!.state).toEqual('IDLE');

		// close and try to settle, the batch should be moved to closed:
		matrixId = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixId).toBeDefined();
		await aggregate.closeSettlementMatrix(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('CLOSED');

		// dispute the batch and try to settle:
		await aggregate.disputeSettlementMatrix(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('DISPUTED');
	});

	test("test matrix state machine - cannot lock a matrix already locked by another", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'STATE_MACHINE_LOCKED'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// Initial state for a batch is [OPEN]:
		let batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('OPEN');

		// Create a settlement matrix with batches:
		const matrixId = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixId).toBeDefined();

		// lock the batch for the matrix:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('AWAITING_SETTLEMENT');
		expect(batch!.ownerMatrixId).toEqual(matrixId);

		// create another matrix and try to lock the batch:
		const otherMatrixId = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(otherMatrixId).toBeDefined();

		// attempt to lock the matrix with the new matrix-id:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(otherMatrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('AWAITING_SETTLEMENT');
		expect(batch!.ownerMatrixId).toEqual(matrixId);// initial matrix is still the owner


		// settle using the original matrix-id:
		await aggregate.settleSettlementMatrix(matrixId);
		batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('SETTLED');
	});

	test("test matrix marked out-of-sync", async () => {
		const reqTransferDto: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'OUT_OF_SYNC_TEST'
		};
		const batchId: string = await aggregate.handleTransfer(reqTransferDto);
		expect(batchId).toBeDefined();

		// Initial state for a batch is [OPEN]:
		let batch = await settleBatchRepo.getBatch(batchId);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId);
		expect(batch!.state).toEqual('OPEN');

		// Create a settlement matrix with batch:
		const matrixId1 = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixId1).toBeDefined();

		// matrix is not out of sync:
		let matrix1 = await settleMatrixReqRepo.getMatrixById(matrixId1);
		expect(matrix1).toBeDefined();
		expect(matrix1!.state).toEqual('IDLE');// Only one batch, no problem with out-of-sync.

		let inSync = await settleMatrixReqRepo.getIdleMatricesWithBatchId(batchId);
		expect(inSync).toBeDefined();
		expect(inSync!.length).toEqual(1);
		expect(inSync![0].id).toEqual(matrix1!.id);

		// Create another settlement matrix with batch:
		const matrixId2 = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId]
		);
		expect(matrixId2).toBeDefined();

		// mark the batch out of sync:
		await aggregate.markMatrixOutOfSyncWhereBatch(matrixId2, [batchId]);
		await new Promise(f => setTimeout(f, 1000));// 1 second

		inSync = await settleMatrixReqRepo.getIdleMatricesWithBatchId(batchId);
		expect(inSync).toBeDefined();
		// the matrix that made the change will not be out of sync.
		expect(inSync!.length).toEqual(1);

		matrix1 = await settleMatrixReqRepo.getMatrixById(matrixId1);
		expect(matrix1).toBeDefined();
		expect(matrix1!.state).toEqual('OUT_OF_SYNC');
	});

	test("test matrix - settlement model and currency optional for dynamic matrix", async () => {
		const reqTransferDto_1: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'MULTI_CURRENCY'
		};
		const batchId_1: string = await aggregate.handleTransfer(reqTransferDto_1);
		expect(batchId_1).toBeDefined();

		// Initial state for a batch is [OPEN]:
		let batch = await settleBatchRepo.getBatch(batchId_1);
		expect(batch).toBeDefined();
		expect(batch!.id).toEqual(batchId_1);
		expect(batch!.state).toEqual('OPEN');

		const dateTo = (Date.now() + 5000);
		const dateFrom = (Date.now() - 5000);
		const matrixId_1 = await aggregate.createDynamicSettlementMatrix(
			null, // matrix-id
			reqTransferDto_1.settlementModel,
			['USD', 'EUR'],
			[],
			dateFrom,
			dateTo
		);
		expect(matrixId_1).toBeDefined();

		// Close the matrix:
		await aggregate.closeSettlementMatrix(matrixId_1);
		let matrix = await settleMatrixReqRepo.getMatrixById(matrixId_1);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId_1);
		expect(matrix!.state).toEqual('IDLE');

		// 2nd Transfer:
		const reqTransferDto_2: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: randomUUID(),
			payeeFspId: randomUUID(),
			currencyCode: 'USD',
			amount: '15000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'MULTI_CURRENCY'
		};
		const batchId_2: string = await aggregate.handleTransfer(reqTransferDto_2);
		expect(batchId_2).toBeDefined();
		// Ensure the batch is allocated to another batch.
		expect(batchId_2 !== batchId_1).toBe(true);

		// Recalculate the matrix to fetch the new batch:
		await aggregate.recalculateSettlementMatrix(matrixId_1);
		matrix = await settleMatrixReqRepo.getMatrixById(matrixId_1);
		expect(matrix).toBeDefined();
		expect(matrix!.id).toEqual(matrixId_1);
		expect(matrix!.state).toEqual('IDLE');
		expect(matrix!.batches.length).toEqual(2);

		// Create a dynamic matrix with no settlement model:
		const matrixId_2 = await aggregate.createDynamicSettlementMatrix(
			null, // matrix-id
			reqTransferDto_2.settlementModel,
			['USD', 'EUR'],
			[],
			dateFrom,
			dateTo
		);
		expect(matrixId_2).toBeDefined();
		matrix = await settleMatrixReqRepo.getMatrixById(matrixId_2);
		expect(matrix).toBeDefined();
		expect(matrixId_1 !== matrixId_2).toBe(true);
		expect(matrix!.id).toEqual(matrixId_2);
		expect(matrix!.state).toEqual('IDLE');
		expect(matrix!.batches.length).toBeGreaterThan(1);
	});

	test("test matrix - settled batch to be part of matrix even if settled with another matrix", async () => {
		const payer = randomUUID();
		const payee = randomUUID();
		const reqTransferDto_1: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: payer,
			payeeFspId: payee,
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'MULTI_MATRIX'
		};
		const reqTransferDto_2: ITransferDto = {
			id: null,
			transferId: randomUUID(),
			payerFspId: payer,
			payeeFspId: payee,
			currencyCode: 'EUR',
			amount: '10000', //100 EURO
			timestamp: Date.now(),
			settlementModel: 'MULTI_MATRIX'
		};
		const batchId_1: string = await aggregate.handleTransfer(reqTransferDto_1);
		expect(batchId_1).toBeDefined();

		// Initial state for a batch is [OPEN]:
		let batch_1 = await settleBatchRepo.getBatch(batchId_1);
		expect(batch_1).toBeDefined();
		expect(batch_1!.id).toEqual(batchId_1);
		expect(batch_1!.state).toEqual('OPEN');

		const matrixId_1 = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId_1]
		);
		expect(matrixId_1).toBeDefined();

		// close the matrix with batch [batchId_1]:
		await aggregate.closeSettlementMatrix(matrixId_1);
		let matrix1 = await settleMatrixReqRepo.getMatrixById(matrixId_1);
		expect(matrix1).toBeDefined();
		expect(matrix1!.id).toEqual(matrixId_1);
		expect(matrix1!.state).toEqual('IDLE');

		const batchId_2: string = await aggregate.handleTransfer(reqTransferDto_2);
		expect(batchId_2).toBeDefined();
		expect(batchId_1).toBeDefined();
		expect(batchId_2 === batchId_1).toEqual(false);

		const matrixId_2 = await aggregate.createStaticSettlementMatrix(
			null, // matrix-id
			[batchId_1, batchId_2]
		);
		expect(matrixId_1).toBeDefined();
		let matrix2 = await settleMatrixReqRepo.getMatrixById(matrixId_2);
		expect(matrix2).toBeDefined();
		expect(matrix2!.id).toEqual(matrixId_2);
		expect(matrix2!.state).toEqual('IDLE');
		expect(matrix2!.batches.length).toEqual(2);

		// Settle matrix1:
		await aggregate.lockSettlementMatrixForAwaitingSettlement(matrixId_1);
		await aggregate.settleSettlementMatrix(matrixId_1);

		// Ensure it has been settled:
		batch_1 = await settleBatchRepo.getBatch(batchId_1);
		expect(batch_1).toBeDefined();
		expect(batch_1!.ownerMatrixId).toBe(matrixId_1);
		expect(batch_1!.state).toBe('SETTLED');

		// Confirm status of Matrix 2:
		await aggregate.recalculateSettlementMatrix(matrixId_2);
		matrix2 = await settleMatrixReqRepo.getMatrixById(matrixId_2);
		expect(matrix2).toBeDefined();
		expect(matrix2!.id).toEqual(matrixId_2);
		expect(matrix2!.state).toEqual('IDLE');
		expect(matrix2!.batches.length).toEqual(2);
		expect(matrix2!.balancesByCurrency.length).toEqual(1);// EUR only.
		expect(matrix2!.balancesByStateAndCurrency.length).toEqual(2);// 1 OPEN and 1 SETTLED
		expect(matrix2!.balancesByParticipant.length).toEqual(4);// 2 OPEN and 2 SETTLED
	});
});
