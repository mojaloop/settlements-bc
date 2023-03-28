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

 Coil
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {randomUUID} from "crypto";
import {
	InvalidAmountError,
	InvalidBatchSettlementModelError,
	InvalidCreditAccountError,
	InvalidCurrencyCodeError,
	InvalidDebitAccountError,
	InvalidIdError,
	InvalidTimestampError,
	InvalidTransferIdError,
	NoSettlementConfig,
	SettlementBatchNotFoundError, SettlementMatrixAlreadyExistsError,
	SettlementMatrixIsBusyError,
	SettlementMatrixIsClosedError,
	SettlementMatrixNotFoundError,

} from "./types/errors";
import {
	IAccountsBalancesAdapter,
	IParticipantAccountNotifier,
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo,
	ISettlementConfigRepo,
	ISettlementMatrixRequestRepo,
} from "./types/infrastructure";
import {SettlementBatch} from "./types/batch";

import {
	ISettlementBatch,
	ISettlementBatchTransfer,
	ISettlementMatrix, ISettlementMatrixBatch,
	ITransferDto,
} from "@mojaloop/settlements-bc-public-types-lib";
import {AuditSecurityContext, IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";

import {CallSecurityContext, ForbiddenError, IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {Privileges} from "./privileges";
import {join} from "path";
import {readFileSync} from "fs";
import {ICurrency} from "./types/currency";
import {bigintToString, stringToBigint} from "./converters";
import {SettlementConfig} from "./types/settlement_config";
import {AccountsAndBalancesAccountType} from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import {SettlementBatchTransfer} from "./types/transfer";
import {SettlementMatrix} from "./types/matrix";
import {ProcessTransferCmd} from "./commands";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib/dist/index";


const CURRENCIES_FILE_NAME: string = "currencies.json";
const SEQUENCE_STR_LENGTH = 3;
const BATCH_ACCOUNT_TYPE_IN_ACCOUNTS_AND_BALANCES: AccountsAndBalancesAccountType = "SETTLEMENT";

enum AuditingActions {
	SETTLEMENT_BATCH_CREATED = "SETTLEMENT_BATCH_CREATED",
	SETTLEMENT_BATCH_ACCOUNT_CREATED = "SETTLEMENT_BATCH_ACCOUNT_CREATED",
	SETTLEMENT_TRANSFER_CREATED = "SETTLEMENT_TRANSFER_CREATED",
	SETTLEMENT_MATRIX_EXECUTED = "SETTLEMENT_MATRIX_EXECUTED",
	SETTLEMENT_MATRIX_REQUEST_FETCH = "SETTLEMENT_MATRIX_REQUEST_FETCH",
	SETTLEMENT_MATRIX_REQUEST_CREATED = "SETTLEMENT_MATRIX_REQUEST_CREATED"
}

export class SettlementsAggregate {
	// Properties received through the constructor.
	private readonly _logger: ILogger;
	private readonly _authorizationClient: IAuthorizationClient;
	private readonly _auditingClient: IAuditClient;
	private readonly _batchRepo: ISettlementBatchRepo;
	private readonly _participantAccNotifier: IParticipantAccountNotifier;
	private readonly _batchTransferRepo: ISettlementBatchTransferRepo;
	private readonly _configRepo: ISettlementConfigRepo;
	private readonly _settlementMatrixReqRepo: ISettlementMatrixRequestRepo;
	private readonly _abAdapter: IAccountsBalancesAdapter;
	private readonly _msgProducer: IMessageProducer;
	private readonly _currencies: ICurrency[];

	constructor(
		logger: ILogger,
		authorizationClient: IAuthorizationClient,
		auditingClient: IAuditClient,
		batchRepo: ISettlementBatchRepo,
		batchTransferRepo: ISettlementBatchTransferRepo,
		configRepo: ISettlementConfigRepo,
		settlementMatrixReqRepo: ISettlementMatrixRequestRepo,
		participantAccNotifier: IParticipantAccountNotifier,
		abAdapter: IAccountsBalancesAdapter,
		msgProducer: IMessageProducer
	) {
		this._logger = logger;
		this._authorizationClient = authorizationClient;
		this._auditingClient = auditingClient;
		this._batchRepo = batchRepo;
		this._participantAccNotifier = participantAccNotifier;
		this._batchTransferRepo = batchTransferRepo;
		this._configRepo = configRepo;
		this._settlementMatrixReqRepo = settlementMatrixReqRepo;
		this._abAdapter = abAdapter;
		this._msgProducer = msgProducer;

		// TODO: @jason Need to obtain currencies from PlatForm config perhaps:
		const currenciesFilePath: string = join(__dirname, CURRENCIES_FILE_NAME);
		this._currencies = JSON.parse(readFileSync(currenciesFilePath, "utf-8"));
	}

	private _enforcePrivilege(secCtx: CallSecurityContext, privName: string): void {
		for (const roleId of secCtx.rolesIds) {
			if (this._authorizationClient.roleHasPrivilege(roleId, privName)) return;
		}
		throw new ForbiddenError(`Required privilege "${privName}" not held by caller`);
	}

	private _getAuditSecurityContext(secCtx: CallSecurityContext): AuditSecurityContext {
		if (secCtx === undefined) return {userId: 'unknown', appId: 'settlement-bc', role: ""};
		return {
			userId: secCtx.username,
			appId: secCtx.clientId,
			role: secCtx.rolesIds[0] // TODO: get role.
		};
	}

	private _getCurrencyOrThrow(currencyCode: string): { code: string, decimals: number } {
		// Validate the currency code and get the currency.
		const currency: { code: string, decimals: number } | undefined
			= this._currencies.find((value) => value.code===currencyCode);
		if (!currency) {
			throw new InvalidCurrencyCodeError(`Currency code: ${currencyCode} not found`);
		}
		return currency;
	}

	async processTransferCmd(secCtx: CallSecurityContext, processTransferCmd: ProcessTransferCmd): Promise<string> {
		// TODO this should the other way around, the rest API should send a command
		const transferDto: ITransferDto = {
			id: null,
			transferId: processTransferCmd.payload.transferId,
			currencyCode: processTransferCmd.payload.currencyCode,
			amount: processTransferCmd.payload.amount,
			timestamp: new Date(processTransferCmd.payload.completedTimestamp).valueOf(),
			payeeFspId: processTransferCmd.payload.payeeFspId,
			payerFspId: processTransferCmd.payload.payerFspId,
			settlementModel: processTransferCmd.payload.settlementModel
		};

		return this.handleTransfer(secCtx, transferDto);
	}


	async handleTransfer(secCtx: CallSecurityContext, transferDto: ITransferDto): Promise<string> {
		this._enforcePrivilege(secCtx, Privileges.CREATE_SETTLEMENT_TRANSFER);

		if (!transferDto.timestamp || !(typeof(transferDto.timestamp) === "number" ) || transferDto.timestamp < 1 ) throw new InvalidTimestampError();
		if (!transferDto.settlementModel) throw new InvalidBatchSettlementModelError();
		if (!transferDto.currencyCode) throw new InvalidCurrencyCodeError();
		if (!transferDto.amount) throw new InvalidAmountError();
		if (!transferDto.transferId) throw new InvalidTransferIdError();
		if (!transferDto.payerFspId) throw new InvalidIdError("Invalid payerFspId in transfer");
		if (!transferDto.payeeFspId) throw new InvalidIdError("Invalid payeeFspId in transfer");

		// Verify the currency code (and get the corresponding currency decimals).
		const currency = this._getCurrencyOrThrow(transferDto.currencyCode);

		const configDto = await this._configRepo.getSettlementConfigByModel(transferDto.settlementModel);
		if (!configDto) {
			throw new NoSettlementConfig(`No settlement config for model '${transferDto.settlementModel}'.`);
		}
		const config = SettlementConfig.fromDto(configDto);

		//const fromDate: number = config.calculateBatchFromDate(timestamp);
		// const toDate: number = config.calculateBatchToDate(transferDto.timestamp);
		const batchStartDate: number = config.calculateBatchStartTimestamp(transferDto.timestamp);

		// get or create a batch
		const resp = await this._getOrCreateBatch(transferDto.settlementModel, currency.code, new Date(batchStartDate));
		const batch = resp.batch;

		// Find payee batch account
		let creditedAccountExtId;
		const creditedAccount = batch.getAccount(transferDto.payeeFspId, currency.code);
		if (creditedAccount) {
			creditedAccountExtId = creditedAccount.accountExtId;
		} else {
			creditedAccountExtId = randomUUID(); // this might not be respected
			creditedAccountExtId = await this._abAdapter.createAccount(
				creditedAccountExtId,
				batch.id, // account owner is the batch
				BATCH_ACCOUNT_TYPE_IN_ACCOUNTS_AND_BALANCES,
				currency.code
			);
			batch.addAccount(creditedAccountExtId, transferDto.payeeFspId, currency.code);
		}

		// find payer batch account
		let debitedAccountExtId;
		const debitedAccount = batch.getAccount(transferDto.payerFspId, currency.code);
		if (debitedAccount) {
			debitedAccountExtId = debitedAccount.accountExtId;
		} else {
			debitedAccountExtId = randomUUID(); // this might not be respected
			debitedAccountExtId = await this._abAdapter.createAccount(
				debitedAccountExtId,
				batch.id, // account owner is the batch
				BATCH_ACCOUNT_TYPE_IN_ACCOUNTS_AND_BALANCES,
				currency.code
			);
			batch.addAccount(debitedAccountExtId, transferDto.payerFspId, currency.code);
		}

		// create the journal entry
		const journalEntryId = await this._abAdapter.createJournalEntry(
			randomUUID(),
			batch.id,
			currency.code,
			transferDto.amount,
			false,
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
		if(resp.created){
			await this._batchRepo.storeNewBatch(batch);
		}else{
			await this._batchRepo.updateBatch(batch);
		}

		if (resp.created) {
			// We perform an async audit:
			await this._auditingClient.audit(
				AuditingActions.SETTLEMENT_BATCH_CREATED,
				true,
				this._getAuditSecurityContext(secCtx),
				[
					{key: "settlementBatchIdIdentifier", value: batch.id}
				]
			);
		}

		// We perform an async audit:
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_TRANSFER_CREATED,
			true,
			this._getAuditSecurityContext(secCtx), [{key: "settlementTransferId", value: transferDto.transferId}]
		);

		return batch.id;
	}

	async createSettlementMatrix(
		secCtx: CallSecurityContext,
		matrixId: string,
		settlementModel: string,
		currencyCode: string,
		fromDate: number,
		toDate: number
	): Promise<string> {
		this._enforcePrivilege(secCtx, Privileges.REQUEST_SETTLEMENT_MATRIX);

		const newMatrix = new SettlementMatrix(
			fromDate,
			toDate,
			currencyCode,
			settlementModel
		);

		if(matrixId){
			const existing = await this._settlementMatrixReqRepo.getMatrixById(matrixId);
			if(existing){
				const err = new SettlementMatrixAlreadyExistsError("Matrix with the same id already exists");
				this._logger.warn(err.message);
				throw err;
			}
			newMatrix.id = matrixId;
		}

		const startTimestamp = Date.now();

		newMatrix.state = "CALCULATING";
		await this._settlementMatrixReqRepo.storeMatrix(newMatrix);

		await this._recalculateMatrix(newMatrix);

		newMatrix.state = "IDLE";
		newMatrix.updatedAt = Date.now();
		newMatrix.generationDurationSecs = Math.floor((newMatrix.updatedAt - startTimestamp) / 1000);
		await this._settlementMatrixReqRepo.storeMatrix(newMatrix);


		// We perform an async audit:
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_REQUEST_CREATED,
			true,
			this._getAuditSecurityContext(secCtx), [{key: "settlementMatrixRequestId", value: newMatrix.id}]
		);

		return newMatrix.id;
	}


	async getSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<ISettlementMatrix | null> {
		this._enforcePrivilege(secCtx, Privileges.GET_SETTLEMENT_MATRIX_REQUEST);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		// TODO attach accounts to batches before returning

		// We perform an async audit:
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_REQUEST_FETCH,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModel", value: matrixDto.settlementModel},
				{key: "settlementMatrixReqId", value: id}
			]
		);

		return matrixDto;
	}

	async recalculateSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<void> {
		this._enforcePrivilege(secCtx, Privileges.GET_SETTLEMENT_MATRIX_REQUEST);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state==="CLOSED") {
			const err = new SettlementMatrixIsClosedError("Cannot recalculate a closed matrix");
			this._logger.warn(err.message);
			throw err;
		}
		if (matrixDto.state==="CALCULATING" || matrixDto.state==="CLOSING") {
			const err = new SettlementMatrixIsBusyError("Matrix already being calculated or closed");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.FromDto(matrixDto);

		const startTimestamp = Date.now();

		matrix.state = "CALCULATING";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		await this._recalculateMatrix(matrix);

		matrix.state = "IDLE";
		matrix.updatedAt = Date.now();
		matrix.generationDurationSecs = Math.floor((matrix.updatedAt - startTimestamp) / 1000);
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// We perform an async audit:
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_REQUEST_FETCH,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModel", value: matrix.settlementModel},
				{key: "settlementMatrixReqId", value: id}
			]
		);

		return;
	}

	async closeSettlementMatrix(secCtx: CallSecurityContext, id: string): Promise<void> {
		this._enforcePrivilege(secCtx, Privileges.EXECUTE_SETTLEMENT_MATRIX);

		const matrixDto = await this._settlementMatrixReqRepo.getMatrixById(id);
		if (!matrixDto) {
			const err = new SettlementMatrixNotFoundError(`Matrix with id: ${id} not found`);
			this._logger.warn(err.message);
			throw err; // not found
		}

		if (matrixDto.state === "CLOSED") {
			const err = new SettlementMatrixIsClosedError("Cannot execute a closed matrix");
			this._logger.warn(err.message);
			throw err;
		}
		if (matrixDto.state === "CALCULATING" || matrixDto.state === "CLOSING") {
			const err = new SettlementMatrixIsBusyError("Matrix already being calculated or closed");
			this._logger.warn(err.message);
			throw err;
		}

		const matrix = SettlementMatrix.FromDto(matrixDto);

		const startTimestamp = Date.now();

		matrix.state = "CLOSING";
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// recalculate the matrix, without getting new batches in
		await this._recalculateMatrix(matrix, true);

		// first pass - close the open batches:
		const previouslySettledBatches : ISettlementBatch[] = [];
		const batchesClosedNow: ISettlementBatch[] = [];

		for (const matrixBatch of matrix.batches) {
			const batch = await this._batchRepo.getBatch(matrixBatch.id);
			if (!batch)
				throw new SettlementBatchNotFoundError(`Unable to locate batch for id '${matrixBatch.id}'.`);

			if (batch.state === 'SETTLED') {
				previouslySettledBatches.push(batch);
				continue;
			}

			batch.state = matrixBatch.state = 'SETTLED';
			await this._batchRepo.updateBatch(batch);
			batchesClosedNow.push(batch);
		}

		// TODO: close batch accounts in Accounts&Balances
		// TODO send matrix executed event:
		//await this._participantAccNotifier.publishSettlementMatrixExecuteEvent(returnVal);

		// Close the Matrix Request to prevent further execution:
		matrix.state = "CLOSED";
		matrix.updatedAt = Date.now();
		matrix.generationDurationSecs = Math.floor((matrix.updatedAt - startTimestamp) / 1000);
		await this._settlementMatrixReqRepo.storeMatrix(matrix);

		// We perform an async audit:
		this._auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_EXECUTED,
			true,
			this._getAuditSecurityContext(secCtx), [
				{key: "settlementModel", value: matrix.settlementModel},
				{key: "settlementMatrixReqId", value: id}
			]
		);

		return;
	}

	private async _recalculateMatrix(matrix: SettlementMatrix, close:boolean=false): Promise<void> {
		const currency = this._getCurrencyOrThrow(matrix.currencyCode);

		// start by cleaning the batches
		let batches:ISettlementBatch[];
		if (close) {
			// this should never change the already included batches
			// get by batchIds
			const batchIds = matrix.batches.map(value => value.id);
			batches = await this._batchRepo.getBatchesByIds(batchIds);
		} else {
			// this will pickup any new batches
			batches = await this._batchRepo.getBatchesByCriteria(matrix.dateFrom, matrix.dateTo, matrix.currencyCode, matrix.settlementModel);
		}

		// remove batches and zero totals
		matrix.clear();

		// summaries
		let totalDebit = 0n, totalCredit = 0n;
		const participantBalances:Map<string, {cr: bigint, dr:bigint}> = new Map<string, {cr: bigint; dr: bigint}>();

		//const settledTransfers: ISettlementBatchTransfer[] = [];

		if (batches && batches.length > 0) {
			await this._updateBatchAccountBalances(batches);

			for (const batch of batches) {
				// skip closed batches
				if (batch.state !== 'OPEN') continue;

				let batchDebitBalance = 0n;
				let batchCreditBalance = 0n;

				// TODO make sure the currencies all match - accounts->batches->matrix

				batch.accounts.forEach(acc => {
					const debit = stringToBigint(acc.debitBalance, currency.decimals);
					const credit = stringToBigint(acc.creditBalance, currency.decimals);
					batchDebitBalance += debit;
					batchCreditBalance += credit;

					// update per participant balances
					const partBal = participantBalances.get(acc.participantId);
					if(!partBal){
						participantBalances.set(acc.participantId, {dr:debit, cr: credit});
					}else{
						participantBalances.set(acc.participantId, {dr: partBal.dr + debit, cr: partBal.cr + credit});
					}
				});

				//const batchTransfers = await this._batchTransferRepo.getBatchTransfersByBatchIds([batch.id]);
				//settledTransfers.push(...batchTransfers);

				matrix.addBatch(
					batch,
					bigintToString(batchDebitBalance, currency.decimals),
					bigintToString(batchCreditBalance, currency.decimals)
				);

				totalDebit = totalDebit + batchDebitBalance;
				totalCredit = totalCredit + batchCreditBalance;
			}
		}
		// update main balances
		matrix.totalDebitBalance = bigintToString(totalDebit, currency.decimals);
		matrix.totalCreditBalance = bigintToString(totalCredit, currency.decimals);

		// if closing, mark transfers as settled by this matrix
		/*if(close) {
			for (const transfer of settledTransfers) {
				transfer.matrixId = matrix.id;
				await this._batchTransferRepo.storeBatchTransfer(transfer);
			}
		}*/

		// put per participant balances in the matrix
		participantBalances.forEach((value, key) => {
			matrix.participantBalances.push({
				participantId: key,
				debitBalance: bigintToString(value.dr, currency.decimals),
				creditBalance: bigintToString(value.cr, currency.decimals)
			});
		});
	}

	private async _updateBatchAccountBalances(batches: ISettlementBatch[]): Promise<void>{
		const extAccountIds: string[] = batches.flatMap(value => value.accounts).map(value => value.accountExtId);

		const abAccounts = await this._abAdapter.getAccounts(extAccountIds);
		if (!abAccounts || abAccounts.length !== extAccountIds.length) {
			const err = new Error("Could not get all accounts from accounts and balances on getSettlementBatches");
			this._logger.error(err);
			throw err;
		}

		for (const batch of batches) {
			for (const batchAccount of batch.accounts) {
				const abAccount = abAccounts.find(value => value.id===batchAccount.accountExtId);
				if (!abAccount) {
					const err = new Error("Could not get all accounts from accounts and balances on getSettlementBatches");
					this._logger.error(err);
					throw err;
				}
				batchAccount.creditBalance = abAccount.postedCreditBalance || "0"; // should always come valid
				batchAccount.debitBalance = abAccount.postedDebitBalance || "0"; // should always come valid
			}
		}
	}


	async getSettlementBatchesByCriteria(
		secCtx: CallSecurityContext,
		settlementModel: string,
		currencyCode: string,
		fromDate: number,
		toDate: number
	): Promise<ISettlementBatch[]> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_BATCH);

		const batches = await this._batchRepo.getBatchesByCriteria(fromDate, toDate, currencyCode, settlementModel);
		if(!batches || batches.length <=0 ) return [];

		await this._updateBatchAccountBalances(batches);
		return batches;
	}

	async getSettlementBatch(
		secCtx: CallSecurityContext,
		batchIdentifier : string,
	): Promise<ISettlementBatch | null> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS);

		const batch = await this._batchRepo.getBatch(batchIdentifier);
		if (!batch) return null;

		await this._updateBatchAccountBalances([batch]);
		return batch;
	}

	async getSettlementBatchesByName(secCtx: CallSecurityContext,batchName: string): Promise<ISettlementBatch[]> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS);

		const batches = await this._batchRepo.getBatchesByName(batchName);
		if (!batches || batches.length <= 0) {
			return [];
		}

		await this._updateBatchAccountBalances(batches);
		return batches;
	}

	async getSettlementBatchTransfersByBatchId(secCtx: CallSecurityContext, batchId : string): Promise<ISettlementBatchTransfer[]> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_TRANSFERS);

		const batch = await this._batchRepo.getBatch(batchId);
		if (batch === null) {
			throw new SettlementBatchNotFoundError(`Unable to locate Settlement Batch with 'Batch Id"" '${batchId}'.`);
		}

		const ISettlementBatchTransfer = await this._batchTransferRepo.getBatchTransfersByBatchIds([batchId]);

		return ISettlementBatchTransfer;
	}

	async getSettlementBatchTransfersByBatchName(secCtx: CallSecurityContext, batchName: string): Promise<ISettlementBatchTransfer[]> {
		this._enforcePrivilege(secCtx, Privileges.RETRIEVE_SETTLEMENT_TRANSFERS);

		const batches = await this._batchRepo.getBatchesByName(batchName);
		if (!batches || batches.length<=0) {
			return [];
		}

		const batchIds = batches.map(value => value.id);
		const transfers = await this._batchTransferRepo.getBatchTransfersByBatchIds(batchIds);

		return transfers;
	}

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

		// if (batchAllocation) {
		// 	return `${model}.${currencyCode}.${batchAllocation}.${formatTimestamp}`;
		// }

		return `${model}.${currencyCode}.${formatTimestamp}`;
	}

	private _generateBatchIdentifier(
		batchName:string,
		batchSeq: number,
	): string {
		const batchSeqTxt = batchSeq.toString().padStart(SEQUENCE_STR_LENGTH, "0");
		const batchId = `${batchName}.${batchSeqTxt}`;

		return batchId;
	}

	/*private _generateBatchIdentifierFromParams(
		model: string,
		currencyCode: string,
		toDate: Date,
		batchSeq: number,
		batchAllocation?: string | null
	) : string {
		//TODO add assertion here:
		//FX.XOF:RWF.2021.08.23.00.00

		const batchName = this._generateBatchName(model, currencyCode, toDate, batchAllocation);
		const batchId = this._generateBatchIdentifier(batchName, batchSeq);

		return batchId;
	}*/

	private async _getOrCreateBatch(
		model: string,
		currencyCode: string,
		toDate: Date
	):Promise<{batch: SettlementBatch, created:boolean}>{
		const batchName = this._generateBatchName(model, currencyCode, toDate);
		const existingBatches = await this._batchRepo.getBatchesByName(batchName);

		if (!existingBatches || existingBatches.length<=0) {
			// no batch exists with that name, let's create a new with seq number 1
			const newBatchId = this._generateBatchIdentifier(batchName, 1);
			const newBatch  = new SettlementBatch(
				newBatchId,
				Date.now(),
				model,
				currencyCode,
				1,
				batchName,
				'OPEN'
			);
			return Promise.resolve({batch:newBatch, created: true});
		}

		// let's find the highest seq open batch
		// sort in decreasing order
		const sortedBatches = existingBatches.sort((a, b) => b.batchSequence - a.batchSequence);
		if(sortedBatches[0].state === 'OPEN'){
			// highest seq is open, return it
			const batchDto = sortedBatches[0];
			const batch = new SettlementBatch(
				batchDto.id,
				batchDto.timestamp,
				batchDto.settlementModel,
				batchDto.currencyCode,
				batchDto.batchSequence,
				batchDto.batchName,
				'OPEN',
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
			'OPEN'
		);
		return Promise.resolve({batch: newBatch, created: true});
	}


}
