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

 Interledger
 - Jason Bruwer <jason@interledger.org>
 Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {randomUUID} from "crypto";
import {
	CannotAddBatchesToSettlementMatrixError,
	CannotCloseSettlementMatrixError, CannotLockSettlementMatrixError,
	CannotRecalculateSettlementMatrixError,
	CannotRemoveBatchesFromSettlementMatrixError,
	CannotSettleSettlementMatrixError, CannotUnlockSettlementMatrixError,
	InvalidAmountError,
	InvalidBatchSettlementModelError,
	InvalidCurrencyCodeError,
	InvalidIdError,
	InvalidSettlementModelError,
	InvalidTimestampError,
	InvalidTransferIdError,
	NoSettlementConfig,
	SettlementBatchNotFoundError,
	SettlementMatrixAlreadyExistsError,
	SettlementMatrixIsClosedError,
	SettlementMatrixNotFoundError,
	SettlementModelAlreadyExistError,

} from "./types/errors";
import {
	IAccountsBalancesAdapter,
	IParticipantAccountNotifier,
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo,
	ISettlementConfigRepo,
	ISettlementMatrixRequestRepo
} from "./types/infrastructure";
import {SettlementBatch} from "./types/batch";

import {
	ISettlementBatch,
	ISettlementMatrix,
	ITransferDto,
} from "@mojaloop/settlements-bc-public-types-lib";
import {AuditSecurityContext, IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";

import {CallSecurityContext, ForbiddenError, IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {Privileges} from "./privileges";
import {join} from "path";
import {readFileSync} from "fs";
import {bigintToString, stringToBigint} from "./converters";
import {SettlementConfig} from "./types/settlement_config";
import {AccountsAndBalancesAccountType} from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import {SettlementBatchTransfer} from "./types/transfer";
import {SettlementMatrix} from "./types/matrix";
import {MarkMatrixOutOfSyncCmd, CreateSettlementModelCmdPayload, ProcessTransferCmd} from "./commands";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
	SettlementMatrixSettledEvt,
	SettlementMatrixSettledEvtPayloadParticipantItem
} from "@mojaloop/platform-shared-lib-public-messages-lib";

import {ICounter, IHistogram, IMetrics} from "@mojaloop/platform-shared-lib-observability-types-lib";
import {Currency, IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";

const CURRENCIES_FILE_NAME: string = "currencies.json";
const SEQUENCE_STR_LENGTH = 3;
const BATCH_ACCOUNT_TYPE_IN_ACCOUNTS_AND_BALANCES: AccountsAndBalancesAccountType = "SETTLEMENT";

enum AuditingActions {
	SETTLEMENT_BATCH_CREATED = "SETTLEMENT_BATCH_CREATED",
	SETTLEMENT_BATCH_ACCOUNT_CREATED = "SETTLEMENT_BATCH_ACCOUNT_CREATED",
//	SETTLEMENT_TRANSFER_CREATED = "SETTLEMENT_TRANSFER_CREATED",
	SETTLEMENT_MATRIX_CLOSED = "SETTLEMENT_MATRIX_CLOSED",
	SETTLEMENT_MATRIX_SETTLED = "SETTLEMENT_MATRIX_SETTLED",
	SETTLEMENT_MATRIX_DISPUTED = "SETTLEMENT_MATRIX_DISPUTED",
	SETTLEMENT_MATRIX_REQUEST_FETCH = "SETTLEMENT_MATRIX_REQUEST_FETCH",
	SETTLEMENT_MATRIX_ADD_BATCHES = "SETTLEMENT_MATRIX_ADD_BATCHES",
	SETTLEMENT_MATRIX_REMOVE_BATCHES = "SETTLEMENT_MATRIX_REMOVE_BATCHES",
	BATCH_SPECIFIC_SETTLEMENT_MATRIX_REQUEST_FETCH = "BATCH_SPECIFIC_SETTLEMENT_MATRIX_REQUEST_FETCH",
	SETTLEMENT_MATRIX_REQUEST_CREATED = "SETTLEMENT_MATRIX_REQUEST_CREATED",
	STATIC_SETTLEMENT_MATRIX_REQUEST_CREATED = "STATIC_SETTLEMENT_MATRIX_REQUEST_CREATED",
	SETTLEMENT_MATRIX_LOCK = "SETTLEMENT_MATRIX_LOCK",
	SETTLEMENT_MATRIX_UNLOCK = "SETTLEMENT_MATRIX_UNLOCK",
	SETTLEMENT_MODEL_CREATED = "SETTLEMENT_MODEL_CREATED"
}

export class SettlementsAggregate {
	// Properties received through the constructor.
	private readonly _logger: ILogger;
	private readonly _authorizationClient: IAuthorizationClient;
	private readonly _auditingClient: IAuditClient;
	private readonly _configClient: IConfigurationClient;
	private readonly _batchRepo: ISettlementBatchRepo;
	private readonly _batchTransferRepo: ISettlementBatchTransferRepo;
	private readonly _configRepo: ISettlementConfigRepo;
	private readonly _settlementMatrixReqRepo: ISettlementMatrixRequestRepo;
	private readonly _abAdapter: IAccountsBalancesAdapter;
	private readonly _msgProducer: IMessageProducer;
	private readonly  _currencyList: Currency[];
	private _histo: IHistogram;
	private _commandsCounter:ICounter;

	constructor(
		logger: ILogger,
		//authorizationClient: IAuthorizationClient,
		auditingClient: IAuditClient,
		configClient: IConfigurationClient,
		batchRepo: ISettlementBatchRepo,
		batchTransferRepo: ISettlementBatchTransferRepo,
		configRepo: ISettlementConfigRepo,
		settlementMatrixReqRepo: ISettlementMatrixRequestRepo,
		abAdapter: IAccountsBalancesAdapter,
		msgProducer: IMessageProducer,
		metrics: IMetrics
	) {
		this._logger = logger;
		//this._authorizationClient = authorizationClient;
		this._auditingClient = auditingClient;
		this._configClient = configClient;
		this._batchRepo = batchRepo;
		this._batchTransferRepo = batchTransferRepo;
		this._configRepo = configRepo;
		this._settlementMatrixReqRepo = settlementMatrixReqRepo;
		this._abAdapter = abAdapter;
		this._msgProducer = msgProducer;

		// Metrics:
		this._histo = metrics.getHistogram("SettlementsAggregate", "SettlementsAggregate calls", ["callName", "success"]);
		this._commandsCounter = metrics.getCounter("SettlementsAggregate_CommandsProcessed", "Commands processed by the Settlements Aggregate", ["commandName"]);

		// Configs:
		this._currencyList = this._configClient.globalConfigs.getCurrencies();
	}

	// private _enforcePrivilege(secCtx: CallSecurityContext, privName: string): void {
	// 	for (const roleId of secCtx.platformRoleIds) {
	// 		if (this._authorizationClient.roleHasPrivilege(roleId, privName)) return;
	// 	}
	// 	throw new ForbiddenError(`Required privilege "${privName}" not held by caller`);
	// }

	private _getAuditSecurityContext(secCtx: CallSecurityContext): AuditSecurityContext {
		if (secCtx === undefined) return {userId: 'unknown', appId: 'settlement-bc', role: ""};
		return {
			userId: secCtx.username,
			appId: secCtx.clientId,
			role: secCtx.platformRoleIds[0] // TODO: get role.
		};
	}

	private _getCurrencyOrThrow(currencyCode: string): Currency {
		const currency: Currency | undefined
			= this._currencyList.find((value) => value.code === currencyCode);
		if (!currency) {
			throw new InvalidCurrencyCodeError(`Currency code: ${currencyCode} not found`);
		}
		return currency;
	}

	private _getAmountOrThrow(amountTxt :string, currency: Currency) {
		// convert the amount and confirm if it's valid:
		let amount: bigint;
		try {
			amount = stringToBigint(amountTxt, currency.decimals);
		} catch (error) {
			throw new InvalidAmountError();
		}
		if (amount <= 0n) throw new InvalidAmountError();
		return amount;
	}

	private async _updateMatrixStateAndSave(
		matrix: SettlementMatrix,
		state: "IDLE" | "BUSY" | "FINALIZED" | "OUT_OF_SYNC" | "LOCKED",
		startTimestamp: number
	): Promise<void> {
		matrix.state = state;
		matrix.updatedAt = Date.now();
		matrix.generationDurationSecs = Math.floor((matrix.updatedAt - startTimestamp) / 1000);
		await this._settlementMatrixReqRepo.storeMatrix(matrix);
	}

	private async _markMatrixBatchesOutOfSync(
		originMatrix: ISettlementMatrix,
		batchIds: string[]
	): Promise<void> {
		// send events to indicate the batch has been updated:
		const cmd = new MarkMatrixOutOfSyncCmd({
			originMatrixId: originMatrix.id,
			batchIds: batchIds
		});
		await this._msgProducer.send(cmd);
	}

	async processTransferCmd(secCtx: CallSecurityContext, cmd: ProcessTransferCmd): Promise<string> {
		const transferDto: ITransferDto = {
			id: null,
			transferId: cmd.payload.transferId,
			currencyCode: cmd.payload.currencyCode,
			amount: cmd.payload.amount,
			timestamp: new Date(cmd.payload.completedTimestamp).valueOf(),
			payeeFspId: cmd.payload.payeeFspId,
			payerFspId: cmd.payload.payerFspId,
			settlementModel: cmd.payload.settlementModel
		};

		// Metrics and process transfer:
		this._commandsCounter.inc({commandName: cmd.msgName}, 1);

		const execStarts_timerEndFn = this._histo.startTimer({ callName: "aggregate_handleTransfer"});
		const returnVal = this.handleTransfer(secCtx, transferDto);
		execStarts_timerEndFn({success:"true"});
		return returnVal;
	}

	async handleTransfer(secCtx: CallSecurityContext, transferDto: ITransferDto): Promise<string> {
		//this._enforcePrivilege(secCtx, Privileges.CREATE_SETTLEMENT_TRANSFER);

		if (!transferDto.timestamp || transferDto.timestamp < 1 ) throw new InvalidTimestampError();
		if (!transferDto.settlementModel) throw new InvalidBatchSettlementModelError();
		if (!transferDto.currencyCode) throw new InvalidCurrencyCodeError();
		if (!transferDto.amount) throw new InvalidAmountError();
		if (!transferDto.transferId) throw new InvalidTransferIdError();
		if (!transferDto.payerFspId) throw new InvalidIdError("Invalid payerFspId in transfer");
		if (!transferDto.payeeFspId) throw new InvalidIdError("Invalid payeeFspId in transfer");

		// verify the currency code (and get the corresponding currency decimals).
		const currency = this._getCurrencyOrThrow(transferDto.currencyCode);
		this._getAmountOrThrow(transferDto.amount, currency);

		// TODO implement cache and cache invalidation
		const configDto = await this._configRepo.getSettlementConfigByModelName(transferDto.settlementModel);
		if (!configDto) {
			throw new NoSettlementConfig(`No settlement config for model '${transferDto.settlementModel}'.`);
		}
		const config = SettlementConfig.fromDto(configDto);

		const batchStartDate: number = config.calculateBatchStartTimestamp(transferDto.timestamp);

		// get or create a batch
		const resp = await this._getOrCreateBatch(transferDto.settlementModel, currency.code, new Date(batchStartDate));
		const batch = resp.batch;

		// find payer batch account (debit):
		let debitedAccountExtId;
		const debitedAccount = batch.getAccount(transferDto.payerFspId, currency.code);
		if (debitedAccount) {
			debitedAccountExtId = debitedAccount.accountExtId;
		} else {
			debitedAccountExtId = randomUUID();
			debitedAccountExtId = await this._abAdapter.createAccount(
				debitedAccountExtId,
				transferDto.payerFspId, // account owner is the participantId
				BATCH_ACCOUNT_TYPE_IN_ACCOUNTS_AND_BALANCES,
				currency.code
			);
			batch.addAccount(debitedAccountExtId, transferDto.payerFspId, currency.code);
		}

		// find payee batch account (credit):
		let creditedAccountExtId;
		const creditedAccount = batch.getAccount(transferDto.payeeFspId, currency.code);
		if (creditedAccount) {
			creditedAccountExtId = creditedAccount.accountExtId;
		} else {
			creditedAccountExtId = randomUUID();
			creditedAccountExtId = await this._abAdapter.createAccount(
				creditedAccountExtId,
				transferDto.payeeFspId, // account owner is the participantId
				BATCH_ACCOUNT_TYPE_IN_ACCOUNTS_AND_BALANCES,
				currency.code
			);
			batch.addAccount(creditedAccountExtId, transferDto.payeeFspId, currency.code);
		}

		// create the journal entry
		const journalEntryId = await this._abAdapter.createJournalEntry(
			randomUUID(),
			batch.id, // allows us to segment transfers for batches easily.
			currency.code,
			transferDto.amount,
			false, // not a 2-phase transfer.
			debitedAccountExtId,
			creditedAccountExtId
		);

		// add the transfer record to the batch and persist the batch changes
		const batchTransfer = new SettlementBatchTransfer(
			transferDto.transferId,
			transferDto.timestamp,
			transferDto.payerFspId,
			transferDto.payeeFspId,
			transferDto.currencyCode,
			transferDto.amount,
			batch.id,
			batch.batchName,
			journalEntryId
		);
		await this._batchTransferRepo.storeBatchTransfer(batchTransfer);

		// persist the batch changes
		if (resp.created) {
			await this._batchRepo.storeNewBatch(batch);
		} else {
			await this._batchRepo.updateBatch(batch);
		}

		if (resp.created) {
			// We perform an async audit:
			// @esli
			await this._auditingClient.audit(
				AuditingActions.SETTLEMENT_BATCH_CREATED,
				true,
				this._getAuditSecurityContext(secCtx),
				[
					{key: "settlementBatchIdIdentifier", value: batch.id}
				]
			);
		}

		// this should not be audited - we only audit operator actions or odd things
		/*this._auditingClient.audit(
			AuditingActions.SETTLEMENT_TRANSFER_CREATED,
			true,
			this._getAuditSecurityContext(secCtx), [{key: "settlementTransferId", value: transferDto.transferId}]
		);*/

		return batch.id;
	}

	async createSettlementConfig(
		secCtx: CallSecurityContext,
		cmdPayload: CreateSettlementModelCmdPayload,
	): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.CREATE_SETTLEMENT_CONFIG);

		if (!cmdPayload) {
			const err = new InvalidSettlementModelError("Invalid settlement model");
			this._logger.warn(err.message);
			throw err;
		}

		if (!cmdPayload.settlementModel) {
			const err = new InvalidSettlementModelError("Invalid settlement model name");
			this._logger.warn(err.message);
			throw err;
		}

		if (!cmdPayload.batchCreateInterval){
			const err = new InvalidTimestampError("Invalid settlement batch timestamp");
			this._logger.warn(err.message);
			throw err;
		}

		const existingModel = await this._configRepo.getSettlementConfigByModelName(cmdPayload.settlementModel);
		if (existingModel) {
			const err = new SettlementModelAlreadyExistError("Settlement model with the same name already exists");
			this._logger.warn(err.message);
			throw err;
		}

		const now = Date.now();

		const config = new SettlementConfig(
			cmdPayload.id,
			cmdPayload.settlementModel,
			cmdPayload.batchCreateInterval,
			true,
			cmdPayload.createdBy,
			now,
			[{
				changeType: "CREATE",
				user: cmdPayload.createdBy,
				timestamp: now,
				notes: null
			}]
		);

		await this._configRepo.storeConfig(config);

		// We perform an async audit:
		// @esli
		await this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MODEL_CREATED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModelName", value: cmdPayload.settlementModel}
			]
		);
	}

	async createStaticSettlementMatrix(
		secCtx: CallSecurityContext,
		matrixId: string | null,
		batchIds: string[]
	): Promise<string> {
		//this._enforcePrivilege(secCtx, Privileges.CREATE_STATIC_SETTLEMENT_MATRIX);

		const startTimestamp = Date.now();

		// Need the batches first to get the currency
		const batches = await this._batchRepo.getBatchesByIds(batchIds);
		const newMatrix = SettlementMatrix.CreateStatic();
		if (matrixId) {
			const existing = await this._settlementMatrixReqRepo.getMatrixById(matrixId);
			if (existing) {
				const err = new SettlementMatrixAlreadyExistsError("Matrix with the same id already exists");
				this._logger.warn(err.message);
				throw err;
			}
			newMatrix.id = matrixId;
		}

		batches.forEach(batch => newMatrix.addBatch(batch, "0", "0"));

		newMatrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(newMatrix);
		await this._recalculateMatrix(newMatrix);

		await this._updateMatrixStateAndSave(newMatrix, "IDLE", startTimestamp);

		// We perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.STATIC_SETTLEMENT_MATRIX_REQUEST_CREATED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementMatrixRequestId", value: newMatrix.id},
				{key: "matrixType", value: newMatrix.type}
			]
		);
		return newMatrix.id;
	}

	async createDynamicSettlementMatrix(
		secCtx: CallSecurityContext,
		matrixId: string | null,
		settlementModel: string,
		currencyCodes: string[],
		batchStatuses: string[],
		fromDate: number,
		toDate: number
	): Promise<string> {
		//this._enforcePrivilege(secCtx, Privileges.CREATE_DYNAMIC_SETTLEMENT_MATRIX);
		const startTimestamp = Date.now();

		const newMatrix = SettlementMatrix.CreateDynamic(
			fromDate,
			toDate,
			currencyCodes,
			settlementModel,
			batchStatuses
		);
		if (matrixId) {
			const existing = await this._settlementMatrixReqRepo.getMatrixById(matrixId);
			if (existing) {
				const err = new SettlementMatrixAlreadyExistsError("Matrix with the same id already exists");
				this._logger.warn(err.message);
				throw err;
			}
			newMatrix.id = matrixId;
		}

		newMatrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(newMatrix);
		await this._recalculateMatrix(newMatrix);

		await this._updateMatrixStateAndSave(newMatrix, "IDLE", startTimestamp);

		// We perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_REQUEST_CREATED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementMatrixRequestId", value: newMatrix.id},
				{key: "matrixType", value: newMatrix.type}
			]
		);

		return newMatrix.id;
	}

	async addBatchesToStaticSettlementMatrix(
		secCtx: CallSecurityContext,
		matrixId: string,
		newBatchIds: string[]
	): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.CREATE_STATIC_SETTLEMENT_MATRIX);
		const startTimestamp = Date.now();

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(matrixId);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${matrixId} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.type !== "STATIC") {
			const err = new SettlementMatrixIsClosedError("Cannot add batches to a non-STATIC settlement matrix");
			this._logger.warn(err.message);
			throw err;
		}

		if (matrixDto.state !== "IDLE") {
			const err = new CannotAddBatchesToSettlementMatrixError("Can only add batches to matrices in idle state");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);

		matrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		const newBatches = await this._batchRepo.getBatchesByIds(newBatchIds);
		for (const newBatch of newBatches) {
			const existing = matrix.batches.find(value => value.id === newBatch.id);

			// TODO control that we cannot ever add a settled batch to a matrix, if it is should throw

			if(!existing){
				matrix.addBatch(newBatch, "0", "0");
			}
		}
		await this._recalculateMatrix(matrix);

		await this._updateMatrixStateAndSave(matrix, "IDLE", startTimestamp);

		// We perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_ADD_BATCHES,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: matrix.id}
			]
		);
		return;
	}

	async removeBatchesFromStaticSettlementMatrix(
		secCtx: CallSecurityContext,
		matrixId: string,
		batchIdsToRemove: string[]
	): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.CREATE_STATIC_SETTLEMENT_MATRIX);
		const startTimestamp = Date.now();

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(matrixId);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${matrixId} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.type !== "STATIC") {
			const err = new SettlementMatrixIsClosedError("Cannot remove batches from a non-STATIC settlement matrix");
			this._logger.warn(err.message);
			throw err;
		}

		if (matrixDto.state !== "IDLE") {
			const err = new CannotRemoveBatchesFromSettlementMatrixError("Can only remove batches from matrices in idle state");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);

		matrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		const toRemove = await this._batchRepo.getBatchesByIds(batchIdsToRemove);
		for (const toRem of toRemove) {
			const existing = matrix.batches.find(value => value.id===toRem.id);

			// TODO control that we cannot ever remove a settled batch from a matrix, if it is should throw

			if (existing) {
				matrix.removeBatch(toRem);
			}
		}
		await this._recalculateMatrix(matrix);

		await this._updateMatrixStateAndSave(matrix, "IDLE", startTimestamp);

		// We perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_REMOVE_BATCHES,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: matrix.id}
			]
		);
	}

	async getSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<ISettlementMatrix | null> {
		//this._enforcePrivilege(secCtx, Privileges.GET_SETTLEMENT_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		// We perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_REQUEST_FETCH,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrixDto.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: id}
			]
		);

		return matrixDto;
	}

	async recalculateSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.GET_SETTLEMENT_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state !== "IDLE" && matrixDto.state !== "OUT_OF_SYNC") {
			const err = new CannotRecalculateSettlementMatrixError("Can only recalculate matrices in idle or out-of-sync statuses");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);
		const startTimestamp = Date.now();

		const previousState = matrix.state;
		matrix.state = "BUSY";

		await this._settlementMatrixReqRepo.storeMatrix(matrix);
		await this._recalculateMatrix(matrix);

		await this._updateMatrixStateAndSave(matrix, (previousState === "OUT_OF_SYNC" ? "IDLE" : previousState), startTimestamp);

		// We perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_REQUEST_FETCH,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: id}
			]
		);
		return;
	}

	async disputeSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.SETTLEMENTS_DISPUTE_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state !== "IDLE") {
			const err = new CannotCloseSettlementMatrixError("Can only dispute an idle matrix");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);
		const startTimestamp = Date.now();

		matrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// recalculate the matrix, without getting new batches in
		await this._recalculateMatrix(matrix);

		// first pass - close the open batches:
		const batchesUpdated: string[] = [];
		for (const matrixBatch of matrix.batches) {
			const batch = await this._batchRepo.getBatch(matrixBatch.id);
			if (!batch) throw new SettlementBatchNotFoundError(`Unable to locate batch for id '${matrixBatch.id}'.`);

			if (batch.state==="SETTLED" || batch.state==="AWAITING_SETTLEMENT" || batch.state==="DISPUTED") {
				continue;
			}

			batch.state = matrixBatch.state = "DISPUTED";
			await this._batchRepo.updateBatch(batch);
			batchesUpdated.push(batch.id);
		}

		// Dispute the Matrix Request to prevent further execution:
		await this._updateMatrixStateAndSave(matrix, "IDLE", startTimestamp);

		// Let the other matrices know the batch has been updated:
		await this._markMatrixBatchesOutOfSync(matrix, batchesUpdated);

		// We perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_DISPUTED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: id}
			]
		);
		return;
	}

	async lockSettlementMatrixForAwaitingSettlement(secCtx: CallSecurityContext, id: string): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.SETTLEMENTS_LOCK_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state !== "IDLE") {
			const err = new CannotLockSettlementMatrixError("Can only lock an idle matrix");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);
		const startTimestamp = Date.now();

		matrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// recalculate the matrix, without getting new batches in
		await this._recalculateMatrix(matrix);

		// first pass - close the open batches:
		const batchesUpdated: string[] = [];
		for (const matrixBatch of matrix.batches) {
			const batch = await this._batchRepo.getBatch(matrixBatch.id);
			if (!batch) throw new SettlementBatchNotFoundError(`Unable to locate batch for id '${matrixBatch.id}'.`);

			if (batch.state==="SETTLED" || batch.state==="AWAITING_SETTLEMENT" || batch.state==="DISPUTED") {
				continue;
			}

			batch.state = matrixBatch.state = "AWAITING_SETTLEMENT";
			batch.ownerMatrixId = matrix.id; // lock it in the batch
			await this._batchRepo.updateBatch(batch);
			batchesUpdated.push(batch.id);
		}

		// dispute the Matrix Request to prevent further execution:
		await this._updateMatrixStateAndSave(matrix, "LOCKED", startTimestamp);

		// let the other matrices know the batch has been updated:
		await this._markMatrixBatchesOutOfSync(matrix, batchesUpdated);

		// we perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_LOCK,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: id}
			]
		);
		return;
	}

	async unLockSettlementMatrixFromAwaitingSettlement(secCtx: CallSecurityContext, id: string): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.SETTLEMENTS_UNLOCK_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state !== "LOCKED") {
			const err = new CannotUnlockSettlementMatrixError("Can only unlock an locked matrix");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);
		const startTimestamp = Date.now();

		matrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// recalculate the matrix, without getting new batches in
		await this._recalculateMatrix(matrix);

		// first pass - close the open batches:
		const batchesUpdated: string[] = [];
		for (const matrixBatch of matrix.batches) {
			const batch = await this._batchRepo.getBatch(matrixBatch.id);
			if (!batch) throw new SettlementBatchNotFoundError(`Unable to locate batch for id '${matrixBatch.id}'.`);

			if (batch.state ===  "AWAITING_SETTLEMENT" && batch.ownerMatrixId === matrix.id) {
				batch.ownerMatrixId = null; // remove the lock
				batch.state = matrixBatch.state = "CLOSED";
				await this._batchRepo.updateBatch(batch);
				batchesUpdated.push(batch.id);
			}
		}

		// dispute the Matrix Request to prevent further execution:
		await this._updateMatrixStateAndSave(matrix, "IDLE", startTimestamp);

		// let the other matrices know the batch has been updated:
		await this._markMatrixBatchesOutOfSync(matrix, batchesUpdated);

		// we perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_DISPUTED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: id}
			]
		);
		return;
	}

	async closeSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.SETTLEMENTS_CLOSE_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state !== "IDLE") {
			const err = new CannotCloseSettlementMatrixError("Can only close an idle matrix");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);
		const startTimestamp = Date.now();

		matrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// recalculate the matrix, without getting new batches in
		await this._recalculateMatrix(matrix);

		// first pass - close the open batches:
		const batchesUpdated: string[] = [];
		for (const matrixBatch of matrix.batches) {
			const batch = await this._batchRepo.getBatch(matrixBatch.id);
			if (!batch) throw new SettlementBatchNotFoundError(`Unable to locate batch for id '${matrixBatch.id}'.`);

			if (batch.state==="SETTLED" || batch.state==="CLOSED" || batch.state==="AWAITING_SETTLEMENT") {
				continue;
			}

			batch.state = matrixBatch.state = "CLOSED";
			await this._batchRepo.updateBatch(batch);
			batchesUpdated.push(batch.id);
		}

		// close the Matrix Request to prevent further execution:
		await this._updateMatrixStateAndSave(matrix, "IDLE", startTimestamp);

		// let the other matrices know the batch has been updated:
		await this._markMatrixBatchesOutOfSync(matrix, batchesUpdated);

		// we perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_CLOSED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: id}
			]
		);
		return;
	}

	async settleSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<void> {
		//this._enforcePrivilege(secCtx, Privileges.SETTLEMENTS_SETTLE_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state !== "LOCKED") {
			const err = new CannotSettleSettlementMatrixError("Cannot settle a matrix that is not Locked");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.CreateFromDto(matrixDto);
		const startTimestamp = Date.now();

		matrix.state = "BUSY";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// recalculate the matrix, making sure disputed batches are not included in the calculations
		await this._recalculateMatrix(matrix, true);

		// remove disputed batches before saving
		matrix.batches.forEach(item => {
			if (item.state !== "AWAITING_SETTLEMENT") matrix.removeBatchById(item.id);
		});

		// first pass - close the open batches:
		const batchesUpdated: string[] = [];
		for (const matrixBatch of matrix.batches) {
			const batch = await this._batchRepo.getBatch(matrixBatch.id);
			if (!batch) throw new SettlementBatchNotFoundError(`Unable to locate batch for id '${matrixBatch.id}'.`);

			if (batch.state === "SETTLED") continue;

			batch.state = matrixBatch.state = "SETTLED";
			await this._batchRepo.updateBatch(batch);
			batchesUpdated.push(batch.id);
		}

		// close the Matrix Request to prevent further execution:
		await this._updateMatrixStateAndSave(matrix, "FINALIZED", startTimestamp);

		// let the other matrices know the batch has been updated:
		await this._markMatrixBatchesOutOfSync(matrix, batchesUpdated);

		const participants: SettlementMatrixSettledEvtPayloadParticipantItem[] = [];
		// put per participant balances in the matrix:
		// participantBalances.forEach((value, key) => {
		matrix.balancesByParticipant.forEach((item) => {
			const currency = this._getCurrencyOrThrow(item.currencyCode);
			participants.push({
				participantId: item.participantId,
				currencyCode: currency.code,
				settledDebitBalance: item.debitBalance,
				settledCreditBalance: item.creditBalance
			});
		});

		// send matrix event for settlement:
		const event = new SettlementMatrixSettledEvt({
			settlementMatrixId: matrix.id,
			settledTimestamp: Date.now(),
			participantList: participants
		});
		await this._msgProducer.send(event);

		// we perform an async audit:
		// @esli
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_SETTLED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModels", value: matrix.settlementModel ?? ""},
				{key: "settlementMatrixReqId", value: id}
			]
		);
		return;
	}

	async markMatrixOutOfSyncWhereBatch(
		secCtx: CallSecurityContext,
		originMatrixId: string,
		batchIds: string[]
	): Promise<void> {
		// This privilege doesn't make sense, it is an internal process
		//this._enforcePrivilege(secCtx, Privileges.MARK_SETTLEMENT_MATRIX_OUT_OF_SYNC);

		if (!batchIds || batchIds.length < 1) return Promise.resolve();

		//TODO (optimisation opportunity) getMatricesInSyncWhereBatch should take an array of batchIds

		for (const batchId of batchIds) {
			const idleInSyncMatrices =
				await this._settlementMatrixReqRepo.getIdleMatricesWithBatchId(batchId);
			for (const matrixDto of idleInSyncMatrices){
				if (originMatrixId === matrixDto.id) continue;

				const startTimestamp = Date.now();
				const matrix = SettlementMatrix.CreateFromDto(matrixDto);

				// Close the Matrix Request to prevent further execution:
				await this._updateMatrixStateAndSave(matrix, "OUT_OF_SYNC", startTimestamp);
			}
		}
	}

	private async _recalculateMatrix(
		matrix : SettlementMatrix,
		settlingMatrix: boolean = false
	): Promise<void> {
		// start by cleaning the batches
		let batches :ISettlementBatch[];
		if (matrix.type === "STATIC") {
			// this should never change the already included batches
			const batchIds = matrix.batches.map(value => value.id);
			batches = await this._batchRepo.getBatchesByIds(batchIds);
		} else {
			// this will pick up any new batches:
			const result = await this._batchRepo.getBatchesByCriteria(
				matrix.dateFrom!,
				matrix.dateTo!,
				matrix.settlementModel!,
				matrix.currencyCodes!,
				matrix.batchStatuses!
			);

			batches = result.items;
		}

		// remove batches and zero totals
		matrix.clear();

		if (batches && batches.length > 0) {
			// invoke the A&B adapter in order to fetch up-to-date balances:
			await this._updateBatchAccountBalances(batches);

			for (const batch of batches) {
				if (settlingMatrix) {
					// when settling, we can only settle batches that are AWAITING_SETTLEMENT and are already owned by this matrix
					if (!batch.ownerMatrixId || batch.ownerMatrixId !== matrix.id) continue;
					else if (batch.state !== "AWAITING_SETTLEMENT") continue;
				}

				const currency = this._getCurrencyOrThrow(batch.currencyCode);

				let batchDebitBalance = 0n, batchCreditBalance = 0n;
				batch.accounts.forEach(acc => {
					const accDebit = stringToBigint(acc.debitBalance, currency.decimals);
					const accCredit = stringToBigint(acc.creditBalance, currency.decimals);

					batchDebitBalance += accDebit;
					batchCreditBalance += accCredit;
					matrix.addBalance(
						acc.participantId,
						batch.currencyCode,
						settlingMatrix ? "SETTLED" : batch.state,
						accDebit,
						accCredit,
						currency.decimals
					);
				});

				matrix.addBatch(
					batch,
					bigintToString(batchDebitBalance, currency.decimals),
					bigintToString(batchCreditBalance, currency.decimals)
				);
			}
		}
	}

	private async _updateBatchAccountBalances(batches: ISettlementBatch[]): Promise<void>{
		const extAccountIds: string[] = batches.flatMap(value => value.accounts).map(value => value.accountExtId);

		const abAccounts = await this._abAdapter.getAccounts(extAccountIds);
		if (!abAccounts || abAccounts.length !== extAccountIds.length) {
			const err = new Error("Could not get all accounts from accounts and balances on [getSettlementBatches]");
			this._logger.error(err);
			throw err;
		}

		for (const batch of batches) {
			for (const batchAccount of batch.accounts) {
				const abAccount = abAccounts.find(value => value.id===batchAccount.accountExtId);
				if (!abAccount) {
					const err = new Error("Could not get all accounts from accounts and balances on [getSettlementBatches]");
					this._logger.error(err);
					throw err;
				}
				batchAccount.creditBalance = abAccount.postedCreditBalance || "0"; // should always come valid
				batchAccount.debitBalance = abAccount.postedDebitBalance || "0"; // should always come valid
			}
		}
	}

	// TODO: if this method is only for tests, remove it
	async getSettlementBatchesByCriteria(
		secCtx: CallSecurityContext,
		currencyCodes: string[],
		settlementModel: string,
		batchStatuses: string[],
		fromDate: number,
		toDate: number
	): Promise<ISettlementBatch[]> {
		//this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_BATCH);

		const batches = await this._batchRepo.getBatchesByCriteria(
			fromDate,
			toDate,
			settlementModel,
			currencyCodes,
			batchStatuses
		);
		if(!batches || !batches.items || batches.items.length <=0 ) return [];

		await this._updateBatchAccountBalances(batches.items);
		return batches.items;
	}

	async getSettlementBatch(
		secCtx: CallSecurityContext,
		batchIdentifier : string,
	): Promise<ISettlementBatch | null> {
		//this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_BATCH);

		const batch = await this._batchRepo.getBatch(batchIdentifier);
		if (!batch) return null;

		await this._updateBatchAccountBalances([batch]);
		return batch;
	}

	// TODO: if this method is only for tests, remove it, also, why the RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS privilege?
	/*async getSettlementBatchesByName(secCtx: CallSecurityContext, batchName: string): Promise<ISettlementBatch[]> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS);

		const batches = await this._batchRepo.getBatchesByName(batchName);
		if(!batches || !batches.items || batches.items.length <=0 ) return [];

		await this._updateBatchAccountBalances(batches.items);
		return batches.items;
	}*/

	// TODO: if this method is only for tests, remove it, also, why the RETRIEVE_SETTLEMENT_TRANSFERS privilege?
	/*async getSettlementBatchTransfersByBatchId(secCtx: CallSecurityContext, batchId : string): Promise<ISettlementBatchTransfer[]> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_TRANSFERS);

		const batch = await this._batchRepo.getBatch(batchId);
		if (batch === null) {
			throw new SettlementBatchNotFoundError(`Unable to locate Settlement Batch with 'Batch Id"" '${batchId}'.`);
		}

		const result = await this._batchTransferRepo.getBatchTransfersByBatchIds([batchId]);
		return result.items;
	}*/

	/* Not used? Commenting it out.
	async getSettlementBatchTransfersByBatchName(secCtx: CallSecurityContext, batchName: string): Promise<ISettlementBatchTransfer[]> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_TRANSFERS);

		const batches = await this._batchRepo.getBatchesByName(batchName);
		if (!batches || !batches.items || batches.items.length <= 0) return [];

		const batchIds = batches.items.map(value => value.id);
		const result = await this._batchTransferRepo.getBatchTransfersByBatchIds(batchIds);
		return result.items;
	}*/

	private _generateBatchName(
		model: string,
		currencyCode: string,
		toDate: Date,
	): string {
		//TODO add assertion here:
		//FX.XOF:RWF.2021.08.23.00.00
		const month = (toDate.getUTCMonth() + 1).toString().padStart(2,"0");
		const day = (toDate.getUTCDate()).toString().padStart(2, "0");
		const hours = (toDate.getUTCHours()).toString().padStart(2, "0");
		const minutes = (toDate.getUTCMinutes()).toString().padStart(2, "0");
		const formatTimestamp = `${toDate.getUTCFullYear()}.${month}.${day}.${hours}.${minutes}`;

		return `${model}.${currencyCode}.${formatTimestamp}`;
	}

	private _generateBatchIdentifier(
		batchName:string,
		batchSeq: number,
	): string {
		return `${batchName}.${batchSeq.toString().padStart(SEQUENCE_STR_LENGTH, "0")}`;
	}

	private async _getOrCreateBatch(
		model: string,
		currencyCode: string,
		toDate: Date
	):Promise<{batch: SettlementBatch, created:boolean}>{
		const batchName = this._generateBatchName(model, currencyCode, toDate);
		const existingBatches = await this._batchRepo.getBatchesByName(batchName);

		if (!existingBatches || !existingBatches.items || existingBatches.items.length <= 0) {
			// no batch exists with that name, let's create a new with seq number 1
			const newBatchId = this._generateBatchIdentifier(batchName, 1);
			const newBatch  = new SettlementBatch(
				newBatchId,
				Date.now(),
				model,
				currencyCode,
				1,
				batchName,
				"OPEN"
			);
			return Promise.resolve({batch:newBatch, created: true});
		}

		// let's find the highest seq open batch
		// sort in decreasing order
		const sortedBatches = existingBatches.items.sort((a, b) => b.batchSequence - a.batchSequence);
		if (sortedBatches[0].state === "OPEN") {
			// highest seq is open, return it
			const batchDto = sortedBatches[0];
			const batch = new SettlementBatch(
				batchDto.id,
				batchDto.timestamp,
				batchDto.settlementModel,
				batchDto.currencyCode,
				batchDto.batchSequence,
				batchDto.batchName,
				"OPEN",
				batchDto.accounts
			);
			return Promise.resolve({batch: batch, created: false});
		}

		// if we got here, there is no open batch, let's open a new one
		const nextSeq = sortedBatches[0].batchSequence + 1;
		const newBatchId = this._generateBatchIdentifier(batchName, nextSeq);
		const newBatch = new SettlementBatch(
			newBatchId,
			Date.now(),
			model,
			currencyCode,
			nextSeq,
			batchName,
			"OPEN"
		);
		return Promise.resolve({batch: newBatch, created: true});
	}
}
