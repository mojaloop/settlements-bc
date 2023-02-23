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
	ISettlementBatchAccountRepo,
	IParticipantAccountNotifier,
	ISettlementTransferRepo,
	ISettlementMatrixRequestRepo,
	Aggregate,
	SettlementMatrixRequestClosedError,
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
	SettlementMatrixRequestNotFoundError,
	InvalidIdError,
	InvalidCreditBalanceError,
	InvalidDebitBalanceError,
	InvalidParticipantAccountIdError, IAccountsBalancesAdapter
} from "../../src/index";
import {ConsoleLogger, ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {randomUUID} from "crypto";
import {stringToBigint, bigintToString} from "../../src/converters";
import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {
	AuditClientMock,
	AuthorizationClientMock,
	SettlementConfigRepoMock,
	SettlementBatchRepoMock,
	SettlementBatchAccountRepoMock,
	ParticipantAccountNotifierMock,
	SettlementTransferRepoMock,
	SettlementMatrixRequestRepoMock, AccountsBalancesAdapterMock
} from "@mojaloop/settlements-bc-shared-mocks-lib";
import {
	ISettlementTransferDto, SettlementBatchStatus, SettlementMatrixRequestStatus
} from "@mojaloop/settlements-bc-public-types-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-client-lib";
import {SettlementConfig} from "../../src/types/settlement_config";
import {SettlementTransfer} from "../../src/types/transfer";

let authorizationClient: IAuthorizationClient;
let authorizationClientNoAuth: IAuthorizationClient;
let configRepo: ISettlementConfigRepo;
let settleBatchRepo: ISettlementBatchRepo;
let settleBatchAccRepo: ISettlementBatchAccountRepo;
let settleTransferRepo: ISettlementTransferRepo;
let settleMatrixReqRepo: ISettlementMatrixRequestRepo;
let partNotifier: IParticipantAccountNotifier;
let abAdapter: IAccountsBalancesAdapter;

describe("Settlements BC [Domain] - Unit Tests", () => {
	let aggregate : Aggregate;
	let aggregateNoAuth : Aggregate;
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
		settleBatchAccRepo = new SettlementBatchAccountRepoMock();
		settleTransferRepo = new SettlementTransferRepoMock();
		settleMatrixReqRepo = new SettlementMatrixRequestRepoMock();

		partNotifier = new ParticipantAccountNotifierMock();

		abAdapter = new AccountsBalancesAdapterMock();

		// Aggregate:
		aggregate = new Aggregate(
			logger,
			authorizationClient,
			auditingClient,
			settleBatchRepo,
			settleBatchAccRepo,
			partNotifier,
			settleTransferRepo,
			configRepo,
			settleMatrixReqRepo,
			abAdapter
		);
		aggregateNoAuth = new Aggregate(
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
		);
	});

	afterAll(async () => {
		// Nothing for now.
	});

	// Create Settlement Transfer:
	test("create settlement transfer and ensure meta-data is present", async () => {
		const reqTransferDto: ISettlementTransferDto = {
			id: null,
			transferId: randomUUID(),
			currencyCode: 'EUR',
			currencyDecimals: 2,
			amount: "10000", //100 EURO
			debitParticipantAccountId: randomUUID(),
			creditParticipantAccountId: randomUUID(),
			timestamp: Date.now(),
			settlementModel: "DEFAULT",
			batch: null
		};
		const rspTransferDto: ISettlementTransferDto = await aggregate.createSettlementTransfer(reqTransferDto, securityContext);
		expect(rspTransferDto).toBeDefined();
		expect(rspTransferDto.id).toBeDefined();
		expect(rspTransferDto.transferId).toEqual(reqTransferDto.transferId);
		expect(rspTransferDto.currencyCode).toEqual(reqTransferDto.currencyCode);
		expect(rspTransferDto.amount).toEqual(reqTransferDto.amount);

		// Batches:
		expect(rspTransferDto.batch).toBeDefined();
		expect(rspTransferDto.batch!.id).toBeDefined();
		expect(rspTransferDto.batch!.batchIdentifier).toBeDefined();

		const batches = await aggregate.getSettlementBatches(reqTransferDto.settlementModel, Date.now() - 5000, Date.now(), securityContext);
		expect(batches).toBeDefined();
		expect(batches.length).toBeGreaterThan(0);
		expect(batches[0].id).toEqual(rspTransferDto.batch!.id);

		// Accounts:
		const batchAccountsByBatchId = await aggregate.getSettlementBatchAccountsByBatchId(rspTransferDto.batch!.id, securityContext);
		expect(batchAccountsByBatchId).toBeDefined();
		expect(batchAccountsByBatchId.length).toEqual(2);

		const batchAccountsByBatchIdentifier = await aggregate.getSettlementBatchAccountsByBatchIdentifier(
			rspTransferDto.batch!.batchIdentifier!, securityContext);
		expect(batchAccountsByBatchIdentifier).toBeDefined();
		expect(batchAccountsByBatchIdentifier.length).toEqual(2);

		// Transfers:
		const transfersByBatchIdentifier = await aggregate.getSettlementBatchTransfersByBatchIdentifier(
			rspTransferDto.batch!.batchIdentifier!, securityContext);
		expect(transfersByBatchIdentifier).toBeDefined();
		expect(transfersByBatchIdentifier.length).toEqual(2);

		const transfersByBatchId = await aggregate.getSettlementBatchTransfersByBatchId(
			rspTransferDto.batch!.id, securityContext);
		expect(transfersByBatchId).toBeDefined();
		expect(transfersByBatchId.length).toEqual(2);

		const transfersByAcc = await aggregate.getSettlementTransfersByAccountId(batchAccountsByBatchId[0].id!, securityContext);
		expect(transfersByAcc).toBeDefined();
	});

	// Create Settlement Transfer:
	test("create settlement transfer and ensure batch allocation is correct based on settlement model", async () => {
		const debPartAccId = randomUUID();
		const credPartAccId = randomUUID();

		const txn1RspBatch1 = await aggregate.createSettlementTransfer({
				id: null,
				transferId: randomUUID(),
				currencyCode: 'EUR',
				currencyDecimals: 2,
				amount: '100', //5 EURO
				debitParticipantAccountId: debPartAccId,
				creditParticipantAccountId: credPartAccId,
				timestamp: Date.now(),
				settlementModel: 'DEF',
				batch: null
			}, securityContext
		);
		const txn2RspBatch1 = await aggregate.createSettlementTransfer({
				id: null,
				transferId: randomUUID(),
				currencyCode: 'EUR',
				currencyDecimals: 2,
				amount: '500', //5 EURO
				debitParticipantAccountId: debPartAccId,
				creditParticipantAccountId: credPartAccId,
				timestamp: Date.now(),
				settlementModel: 'DEF',
				batch: null
			}, securityContext
		);
		const txn3RspBatch1 = await aggregate.createSettlementTransfer({
				id: null,
				transferId: randomUUID(),
				currencyCode: 'EUR',
				currencyDecimals: 2,
				amount: '300', //5 EURO
				debitParticipantAccountId: debPartAccId,
				creditParticipantAccountId: credPartAccId,
				timestamp: Date.now(),
				settlementModel: 'DEF',
				batch: null
			}, securityContext
		);

		// Now we have a new settlement model:
		const txn4RspBatch2 = await aggregate.createSettlementTransfer({
				id: null,
				transferId: randomUUID(),
				currencyCode: 'EUR',
				currencyDecimals: 2,
				amount: '300', //5 EURO
				debitParticipantAccountId: debPartAccId,
				creditParticipantAccountId: credPartAccId,
				timestamp: Date.now(),
				settlementModel: 'FRX',
				batch: null
			}, securityContext
		);

		// Now we ensure that we have 1 batch for the first 3 transfers, and another batch for transfer nr 4:
		expect(txn1RspBatch1).toBeDefined();
		expect(txn2RspBatch1).toBeDefined();
		expect(txn3RspBatch1).toBeDefined();
		expect(txn4RspBatch2).toBeDefined();

		expect(txn1RspBatch1.batch!.id).toEqual(txn2RspBatch1.batch!.id);
		expect(txn1RspBatch1.batch!.id).toEqual(txn3RspBatch1.batch!.id);

		expect(txn1RspBatch1.batch!.settlementModel).toEqual('DEF');
		expect(txn2RspBatch1.batch!.settlementModel).toEqual('DEF');
		expect(txn3RspBatch1.batch!.settlementModel).toEqual('DEF');
		expect(txn4RspBatch2.batch!.settlementModel).toEqual('FRX');

		// Ensure we have one batch for model [DEFAULT]:
		const batchModelDef = await aggregate.getSettlementBatches(
			txn1RspBatch1.batch!.settlementModel!, Date.now() - 15000, Date.now(), securityContext);
		expect(batchModelDef).toBeDefined();
		expect(batchModelDef.length).toEqual(1);

		// Ensure we have one batch for model [FX]:
		const batchModelFx = await aggregate.getSettlementBatches(
			txn1RspBatch1.batch!.settlementModel!, Date.now() - 15000, Date.now(), securityContext);
		expect(batchModelFx).toBeDefined();
		expect(batchModelFx.length).toEqual(1);
	});

	// Req and execute Matrix:
	test("request and execute a settlement matrix", async () => {
		const reqTransferDto: ISettlementTransferDto = {
			id: null,
			transferId: randomUUID(),
			currencyCode: 'ZAR',
			currencyDecimals: 2,
			amount: "1200", //12 ZAR
			debitParticipantAccountId: randomUUID(),
			creditParticipantAccountId: randomUUID(),
			timestamp: Date.now(),
			settlementModel: "FX",
			batch: null
		};
		await aggregate.createSettlementTransfer(reqTransferDto, securityContext);

		// Request a Settlement Matrix, which will be used to execute the matrix on.
		const rspReq = await aggregate.settlementMatrixRequest(reqTransferDto.settlementModel, Date.now() - 5000, Date.now(), securityContext);
		expect(rspReq).toBeDefined();
		expect(rspReq.id).toBeDefined();
		expect(rspReq.matrixStatus).toEqual(SettlementMatrixRequestStatus.OPEN);

		// Execute the matrix:
		const execResult = await aggregate.executeSettlementMatrix(rspReq.id, securityContext);
		expect(execResult).toBeDefined();
		expect(execResult.batches).toBeDefined();
		expect(execResult.batches.length).toEqual(1);

		// Ensure the batch has been closed:
		const matrixById = await aggregate.getSettlementMatrixRequestById(rspReq.id, securityContext);
		expect(matrixById).toBeDefined();
		expect(matrixById.timestamp).toBeDefined();
		expect(matrixById.dateFrom).toBeDefined();
		expect(matrixById.dateTo).toBeDefined();
		expect(matrixById.batches.length).toEqual(1);
		expect(matrixById.settlementModel).toEqual('FX');
		expect(rspReq.matrixStatus).toEqual(SettlementMatrixRequestStatus.CLOSED);
	});

	// Create Transfer Errors to ensure invalid request data is handled:
	test("test exceptions/errors responses for create transfer (validations)", async () => {
		// Timestamp:
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'ZAR',
					currencyDecimals: 2,
					amount: "1600", //16 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: 0,
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidTimestampError).toEqual(true);
		}

		// Settlement Model:
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'ZAR',
					currencyDecimals: 2,
					amount: "1600", //16 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidBatchSettlementModelError).toEqual(true);
		}

		// Currency Code:
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: '',
					currencyDecimals: 2,
					amount: '1600', //16 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCurrencyCodeError).toEqual(true);
		}

		// Amount:
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'ZAR',
					currencyDecimals: 2,
					amount: '', //16 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidAmountError).toEqual(true);
		}

		// Transfer ID:
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: '',
					currencyCode: 'ZAR',
					currencyDecimals: 2,
					amount: '15000', //150 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidTransferIdError).toEqual(true);
		}

		// Debit Account ID:
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'ZAR',
					currencyDecimals: 2,
					amount: '15000', //150 ZAR
					debitParticipantAccountId: '',
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidDebitAccountError).toEqual(true);
		}

		// Credit Account ID:
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'ZAR',
					currencyDecimals: 2,
					amount: '15000', //150 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: '',
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCreditAccountError).toEqual(true);
		}

		// Invalid Currency ID (not mapped):
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'ZZZ',
					currencyDecimals: 2,
					amount: '15000', //150 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCurrencyCodeError).toEqual(true);
		}

		// Invalid Amount (non decimal):
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'USD',
					currencyDecimals: 2,
					amount: 'GSDSSD', //150 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidAmountError).toEqual(true);
		}

		// Invalid Amount (0):
		try {
			await aggregate.createSettlementTransfer(
				{
					id: null,
					transferId: randomUUID(),
					currencyCode: 'USD',
					currencyDecimals: 2,
					amount: '0', //0 ZAR
					debitParticipantAccountId: randomUUID(),
					creditParticipantAccountId: randomUUID(),
					timestamp: Date.now(),
					settlementModel: "ERR",
					batch: null
				}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidAmountError).toEqual(true);
		}
	});

	// Not allowed to re-execute a Matrix Batch Request:
	test("ensure executed matrix cannot be executed again", async () => {
		const reqTransferDto: ISettlementTransferDto = {
			id: null,
			transferId: randomUUID(),
			currencyCode: 'ZAR',
			currencyDecimals: 2,
			amount: "1600", //16 ZAR
			debitParticipantAccountId: randomUUID(),
			creditParticipantAccountId: randomUUID(),
			timestamp: Date.now(),
			settlementModel: "REMITTANCE",
			batch: null
		};
		await aggregate.createSettlementTransfer(reqTransferDto, securityContext);

		// Request a Settlement Matrix, which will be used to execute the matrix on.
		const rspReq = await aggregate.settlementMatrixRequest(reqTransferDto.settlementModel, Date.now() - 5000, Date.now(), securityContext);
		expect(rspReq).toBeDefined();
		expect(rspReq.id).toBeDefined();
		expect(rspReq.matrixStatus).toEqual(SettlementMatrixRequestStatus.OPEN);

		// Execute the matrix:
		const execResult = await aggregate.executeSettlementMatrix(rspReq.id, securityContext);
		expect(execResult).toBeDefined();
		expect(execResult.batches).toBeDefined();
		expect(execResult.batches.length).toEqual(1);

		// Ensure the 2nd execute generates an error (SettlementMatrixRequestClosedError):
		try {
			await aggregate.executeSettlementMatrix(rspReq.id, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementMatrixRequestClosedError).toEqual(true);
		}
	});

	// Ensure Batch Seq is incremented:
	test("ensure batch seq increments for batches within the same period", async () => {
		const reqTransferDto: ISettlementTransferDto = {
			id: null,
			transferId: randomUUID(),
			currencyCode: 'ZAR',
			currencyDecimals: 2,
			amount: '1200', //12 ZAR
			debitParticipantAccountId: randomUUID(),
			creditParticipantAccountId: randomUUID(),
			timestamp: Date.now(),
			settlementModel: 'SEQ_TEST',
			batch: null
		};
		const ornTransfer = await aggregate.createSettlementTransfer(reqTransferDto, securityContext);

		// Request a Settlement Matrix, which will be used to execute the matrix on.
		const rspReq = await aggregate.settlementMatrixRequest(reqTransferDto.settlementModel, Date.now() - 5000, Date.now(), securityContext);
		expect(rspReq).toBeDefined();
		expect(rspReq.id).toBeDefined();
		expect(rspReq.matrixStatus).toEqual(SettlementMatrixRequestStatus.OPEN);

		// Execute the matrix:
		const execResult = await aggregate.executeSettlementMatrix(rspReq.id, securityContext);
		expect(execResult).toBeDefined();
		expect(execResult.batches).toBeDefined();
		expect(execResult.batches.length).toEqual(1);
		const batchExecutedIdentifier = execResult.batches[0].batchIdentifier

		// Ensure the batch has been closed:
		const matrixById = await aggregate.getSettlementMatrixRequestById(rspReq.id, securityContext);
		expect(matrixById).toBeDefined();
		expect(matrixById.timestamp).toBeDefined();
		expect(matrixById.dateFrom).toBeDefined();
		expect(matrixById.dateTo).toBeDefined();
		expect(matrixById.batches.length).toEqual(1);
		expect(matrixById.settlementModel).toEqual('SEQ_TEST');
		expect(rspReq.matrixStatus).toEqual(SettlementMatrixRequestStatus.CLOSED);

		// Create another Transfer:
		const newBatchTransfer = await aggregate.createSettlementTransfer(reqTransferDto, securityContext);
		expect(newBatchTransfer).toBeDefined();
		expect(newBatchTransfer.batch!.id === ornTransfer.batch!.id).toEqual(false);

		// Retrieve the Batch:
		const batches = await aggregate.getSettlementBatches(reqTransferDto.settlementModel, Date.now() - 15000, Date.now(), securityContext);
		expect(batches).toBeDefined();
		// We expect at least 2 batches:
		expect(batches.length).toEqual(2);

		// Ensure the Batch Sequence has a Seq of [2].
		for (const batch of batches) {
			if (batch.batchStatus === SettlementBatchStatus.CLOSED) continue;
			// Ensure our seq was incremented:
			expect(batch.batchSequence).toEqual(2);
			const batchIdForOpen = batch.batchIdentifier!.substring(0, batch.batchIdentifier!.length - 3);
			const toCompareTo = batchExecutedIdentifier.substring(0, batchExecutedIdentifier.length - 3);

			expect(batchIdForOpen).toEqual(toCompareTo);
		}
	});

	// Unique Accounts Per Batch:
	test("batch accounts unique per batch and participant-id", async () => {
		const settleModel = 'PAR_ACC';
		const txnBatch1 = await aggregate.createSettlementTransfer(
			{
				id: null,
				transferId: randomUUID(),
				currencyCode: 'ZAR',
				currencyDecimals: 2,
				amount: '123', //12.30 ZAR
				debitParticipantAccountId: 'deb-acc',
				creditParticipantAccountId: 'cred-acc',
				timestamp: Date.now(),
				settlementModel: settleModel,
				batch: null
			}, securityContext
		);
		const rspReq = await aggregate.settlementMatrixRequest(settleModel, Date.now() - 5000, Date.now(), securityContext);
		await aggregate.executeSettlementMatrix(rspReq.id, securityContext);

		// New Transfer under a new batch:
		const txnBatch2 = await aggregate.createSettlementTransfer(
			{
				id: null,
				transferId: randomUUID(),
				currencyCode: 'ZAR',
				currencyDecimals: 2,
				amount: '123', //12.30 ZAR
				debitParticipantAccountId: 'deb-acc',
				creditParticipantAccountId: 'cred-acc',
				timestamp: Date.now(),
				settlementModel: settleModel,
				batch: null
			}, securityContext
		);

		const accountsBatch1 = await aggregate.getSettlementBatchAccountsByBatchId(txnBatch1.batch!.id, securityContext);
		const accountsBatch2 = await aggregate.getSettlementBatchAccountsByBatchId(txnBatch2.batch!.id, securityContext);

		expect(accountsBatch1).toBeDefined();
		expect(accountsBatch1.length).toEqual(2);
		expect(accountsBatch2).toBeDefined();
		expect(accountsBatch2.length).toEqual(2);

		for (const accBatch1 of accountsBatch1) {
			for (const accBatch2 of accountsBatch2) {
				expect(accBatch1).toBeDefined();
				expect(accBatch2).toBeDefined();
				// Batch Accounts are not allowed to match, even if [ParticipantAccountId's] match:
				expect(accBatch1.id === accBatch2.id).toEqual(false);
			}
		}
	});

	// Lookup error responses:
	test("test exceptions/errors responses for lookups", async () => {
		// No Batch Found:
		try {
			await aggregate.getSettlementBatchTransfersByBatchIdentifier('121212', securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementBatchNotFoundError).toEqual(true);
		}

		try {
			await aggregate.getSettlementBatchTransfersByBatchId('121212', securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementBatchNotFoundError).toEqual(true);
		}

		try {
			await aggregateNoAuth.getSettlementBatchTransfersByBatchId('121212', securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof UnauthorizedError).toEqual(true);
		}
	});

	test("test exceptions/errors responses for creates", async () => {
		// No Batch Identifier when creating a batch:
		try {
			await aggregate.createSettlementBatch({
				id: '',
				settlementModel: 'MOD1',
				batchIdentifier: null
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidBatchIdentifierError).toEqual(true);
		}

		// No Model for batch:
		try {
			await aggregate.createSettlementBatch({
				id: ''
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidBatchSettlementModelError).toEqual(true);
		}

		// empty id for batch:
		try {
			await aggregate.createSettlementBatch({
				id: '',
				settlementModel: 'ERR-MOD',
				batchIdentifier: 'ERR-BATCH-ID'
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidIdError).toEqual(true);
		}

		// empty currency for batch:
		try {
			await aggregate.createSettlementBatch({
				id: randomUUID(),
				settlementModel: 'ERR-MOD',
				batchIdentifier: 'ERR-BATCH-ID'
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCurrencyCodeError).toEqual(true);
		}

		// Duplicate Batch Identifier:
		try {
			const batchIdentifier = 'Batch001'
			await aggregate.createSettlementBatch({
				id: randomUUID(),
				settlementModel: 'MOD1',
				currency: 'ZAR',
				batchIdentifier: batchIdentifier
			}, securityContext);

			await aggregate.createSettlementBatch({
				id: randomUUID(),
				settlementModel: 'MOD1',
				currency: 'ZAR',
				batchIdentifier: batchIdentifier
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidBatchIdentifierError).toEqual(true);
		}

		try {
			await aggregate.executeSettlementMatrix(randomUUID(), securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementMatrixRequestNotFoundError).toEqual(true);
		}

		try {
			await aggregate.getSettlementMatrixRequestById(randomUUID(), securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementMatrixRequestNotFoundError).toEqual(true);
		}

		try {
			await aggregate.getSettlementBatchAccountsByBatchIdentifier(randomUUID(), securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementBatchNotFoundError).toEqual(true);
		}

		try {
			await aggregate.getSettlementBatchAccountsByBatchId(randomUUID(), securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof SettlementBatchNotFoundError).toEqual(true);
		}

		// account invalid credit balance:
		try {
			await aggregate.createSettlementBatchAccount({
				id: null,
				participantAccountId: null,
				currencyCode: "",
				currencyDecimals: null,
				creditBalance: "0",
				debitBalance: "1",
				timestamp: null
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidDebitBalanceError).toEqual(true);
		}

		// account invalid credit balance:
		try {
			await aggregate.createSettlementBatchAccount({
				id: null,
				participantAccountId: null,
				currencyCode: "",
				currencyDecimals: null,
				creditBalance: "1",
				debitBalance: "0",
				timestamp: null
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCreditBalanceError).toEqual(true);
		}

		// account invalid participant account:
		try {
			await aggregate.createSettlementBatchAccount({
				id: null,
				participantAccountId: '',
				currencyCode: "",
				currencyDecimals: null,
				creditBalance: "0",
				debitBalance: "0",
				timestamp: null
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidParticipantAccountIdError).toEqual(true);
		}

		// account invalid currency account:
		try {
			await aggregate.createSettlementBatchAccount({
				id: null,
				participantAccountId: randomUUID(),
				currencyCode: 'UNK',
				currencyDecimals: null,
				creditBalance: "0",
				debitBalance: "0",
				timestamp: null
			}, securityContext);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof InvalidCurrencyCodeError).toEqual(true);
		}

		// account invalid currency account:
		await aggregate.createSettlementBatchAccount({
			id: null,
			participantAccountId: randomUUID(),
			currencyCode: 'USD',
			currencyDecimals: null,
			creditBalance: "0",
			debitBalance: "0",
			timestamp: null
		}, securityContext);
	});

	// Batch Allocation:
	test("create a settlement batch with batch allocation", async () => {
		const rspTransferDto: ISettlementTransferDto = await aggregate.createSettlementTransfer(
			{
				id: null,
				transferId: randomUUID(),
				currencyCode: 'EUR',
				currencyDecimals: 2,
				amount: "10000", //100 EURO
				debitParticipantAccountId: randomUUID(),
				creditParticipantAccountId: randomUUID(),
				timestamp: Date.now(),
				settlementModel: "MOD-ALLOC",
				batch: null,
				batchAllocation: 'jason-test'
			}, securityContext);
		expect(rspTransferDto).toBeDefined();
		expect(rspTransferDto.batch).toBeDefined();
		expect(rspTransferDto.batch!.batchIdentifier).toContain('MOD-ALLOC.EUR.jason-test.');
	});

	// :
	test("send a settlement matrix request again, to show that the results are different from a previous matrix", async () => {
		//TODO
	});

	// Complete Branch Coverage:
	test("code [branch] coverage", async () => {
		// Settlement Config:
		const settleConf = new SettlementConfig(randomUUID(), 'MDL', 20).toDto();
		expect(settleConf).toBeDefined();

		const transfer = new SettlementTransfer(
			randomUUID(), randomUUID(), 'USD', 2, 300n, randomUUID(), randomUUID(), null, Date.now()).toDto();
		expect(transfer).toBeDefined();

		// Wrong number of [.]:
		try {
			stringToBigint('123.45.67', 2);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof Error).toEqual(true);
		}

		// More fractions than allowed.
		try {
			stringToBigint('123.453', 2);
			fail('Expected to throw error!');
		} catch (err) {
			expect(err).toBeDefined();
			expect(err instanceof Error).toEqual(true);
		}

		// More fractions than allowed.
		const amnt = bigintToString(5n, 3);
		expect(amnt).toBeDefined();
		expect(amnt).toEqual('0.005');
	});
});
