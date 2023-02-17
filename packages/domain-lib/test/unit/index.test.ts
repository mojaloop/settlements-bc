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
	Aggregate
} from "../../src/index";
import {ConsoleLogger, ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {randomUUID} from "crypto";
import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {
	AuditClientMock,
	AuthorizationClientMock,
	SettlementConfigRepoMock,
	SettlementBatchRepoMock,
	SettlementBatchAccountRepoMock,
	ParticipantAccountNotifierMock,
	SettlementTransferRepoMock,
	SettlementMatrixRequestRepoMock
} from "@mojaloop/settlements-bc-shared-mocks-lib";
import {
	ISettlementTransferDto, SettlementMatrixRequestStatus
} from "@mojaloop/settlements-bc-public-types-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-client-lib";

let authorizationClient: IAuthorizationClient;
let configRepo: ISettlementConfigRepo;
let settleBatchRepo: ISettlementBatchRepo;
let settleBatchAccRepo: ISettlementBatchAccountRepo;
let settleTransferRepo: ISettlementTransferRepo;
let settleMatrixReqRepo: ISettlementMatrixRequestRepo;
let partNotifier: IParticipantAccountNotifier;

describe("Settlements BC [Domain] - Unit Tests", () => {
	let aggregate : Aggregate;
	let securityContext : CallSecurityContext;

	beforeAll(async () => {
		// Cross Cutting:
		const logger: ILogger = new ConsoleLogger();
		authorizationClient = new AuthorizationClientMock(logger);
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
			settleMatrixReqRepo
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

		// Batch:
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

	// :
	test("ensure batch seq increments for batches within the same period", async () => {
		// TODO
	});

	// :
	test("batch accounts unique per batch and participant-id", async () => {
		// TODO
	});

	// :
	test("ensure executed matrix cannot be executed again", async () => {
		// TODO
	});

	// :
	test("test exceptions/errors responses for create transfer (validations)", async () => {
		// TODO
	});
});
