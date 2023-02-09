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
	AccountAlreadyExistsError,
	InvalidExternalCategoryError,
	InvalidExternalIdError,
	InvalidTimestampError,
	UnauthorizedError,
	InvalidCurrencyCodeError,
	InvalidCreditBalanceError,
	InvalidDebitBalanceError,
	InvalidCurrencyDecimalsError,
	InvalidBatchIdentifierError,
	InvalidBatchSettlementModelError,
	SettlementBatchAlreadyExistsError,
	InvalidAmountError,
	NoSettlementConfig,
	PositionAccountNotFoundError,
	InvalidCreditAccountError,
	InvalidDebitAccountError,
	InvalidIdError,
	SettlementBatchNotFoundError,
	InvalidBatchDefinitionError,
	InvalidBatchSettlementAllocationError
} from "./types/errors";
import {
	ISettlementBatchRepo,
	ISettlementBatchAccountRepo,
	IParticipantAccountBatchMappingRepo,
	ISettlementTransferRepo,
	ISettlementConfigRepo
} from "./types/infrastructure";
import {SettlementBatch} from "./types/batch";
import {SettlementBatchAccount} from "./types/account";
import {SettlementTransfer} from "./types/transfer";
import {
	ISettlementBatchDto,
	ISettlementBatchAccountDto,
	ISettlementTransferDto,
	IParticipantAccountBatchMappingDto,
	ISettlementMatrixDto,
	SettlementBatchStatus,
	ISettlementMatrixBatchDto
} from "@mojaloop/settlements-bc-public-types-lib";
import {obtainSettlementModelFrom} from "@mojaloop/settlements-bc-model-lib";
import {IAuditClient, AuditSecurityContext} from "@mojaloop/auditing-bc-public-types-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-client-lib";
import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {Privileges} from "./types/privileges";
import {join} from "path";
import {readFileSync} from "fs";
import {ICurrency} from "./types/currency";
import {bigintToString, stringToBigint} from "./converters";
import {SettlementConfig} from "./types/settlement_config";

enum AuditingActions {
	SETTLEMENT_BATCH_CREATED = "SETTLEMENT_BATCH_CREATED",
	SETTLEMENT_BATCH_ACCOUNT_CREATED = "SETTLEMENT_BATCH_ACCOUNT_CREATED",
	SETTLEMENT_TRANSFER_CREATED = "SETTLEMENT_TRANSFER_CREATED",
	SETTLEMENT_MATRIX_CREATED = "SETTLEMENT_MATRIX_CREATED"
}

export class Aggregate {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	private readonly authorizationClient: IAuthorizationClient;
	private readonly auditingClient: IAuditClient;
	private readonly batchRepo: ISettlementBatchRepo;
	private readonly batchAccountRepo: ISettlementBatchAccountRepo;
	private readonly participantAccRepo: IParticipantAccountBatchMappingRepo;
	private readonly transfersRepo: ISettlementTransferRepo;
	private readonly configRepo: ISettlementConfigRepo;
	private readonly currencies: ICurrency[];
	// Other properties.
	private static readonly CURRENCIES_FILE_NAME: string = "currencies.json";

	constructor(
		logger: ILogger,
		authorizationClient: IAuthorizationClient,
		auditingClient: IAuditClient,
		batchRepo: ISettlementBatchRepo,
		batchAccountRepo: ISettlementBatchAccountRepo,
		participantAccRepo: IParticipantAccountBatchMappingRepo,
		transfersRepo: ISettlementTransferRepo,
		configRepo: ISettlementConfigRepo
	) {
		this.logger = logger;
		this.authorizationClient = authorizationClient;
		this.auditingClient = auditingClient;
		this.batchRepo = batchRepo;
		this.batchAccountRepo = batchAccountRepo;
		this.participantAccRepo = participantAccRepo;
		this.transfersRepo = transfersRepo;
		this.configRepo = configRepo;

		// TODO: @jason Need to obtain currencies from PlatForm config perhaps:
		const currenciesFilePath: string = join(__dirname, Aggregate.CURRENCIES_FILE_NAME);
		try {
			this.currencies = JSON.parse(readFileSync(currenciesFilePath, "utf-8"));
		} catch (error: unknown) {
			this.logger.error(error);
			throw error;
		}
	}

	private enforcePrivilege(securityContext: CallSecurityContext, privilegeId: string): void {
		if (securityContext === undefined) {
			this.logger.warn(`No [CallSecurityContext]. Not enforcing privilege: ${privilegeId}`);
			return;
		}
		for (const roleId of securityContext.rolesIds) {
			if (this.authorizationClient.roleHasPrivilege(roleId, privilegeId)) return;
		}
		throw new UnauthorizedError();
	}

	private getAuditSecurityContext(securityContext: CallSecurityContext): AuditSecurityContext {
		if (securityContext === undefined) return {userId: 'unknown', appId: 'settlement-bc', role: ''};

		return {
			userId: securityContext.username,
			appId: securityContext.clientId,
			role: "" // TODO: get role.
		};
	}

	async createSettlementBatch(batchDto: ISettlementBatchDto, securityContext: CallSecurityContext): Promise<string> {
		const timestamp: number = Date.now();

		this.enforcePrivilege(securityContext, Privileges.CREATE_SETTLEMENT_BATCH);

		if (batchDto.settlementModel === null) throw new InvalidBatchSettlementModelError();
		if (batchDto.timestamp === undefined) batchDto.timestamp = timestamp;
		if (batchDto.batchIdentifier === null || batchDto.batchIdentifier === "") throw new InvalidBatchIdentifierError();

		// IDs:
		if (batchDto.id === null || batchDto.id === "") throw new InvalidIdError();
		if (batchDto.currency === null || batchDto.currency === "") throw new InvalidCurrencyCodeError();

		// Generate a random UUID, if needed:
		if (await this.batchRepo.batchExistsByBatchIdentifier(batchDto.batchIdentifier)) {
			throw new InvalidBatchIdentifierError(`Batch with identifier '${batchDto.batchIdentifier}' already created.`);
		}

		// The Domain Batch:
		const batch: SettlementBatch = new SettlementBatch(
			batchDto.id,
			timestamp,
			batchDto.settlementModel,
			batchDto.currency,
			batchDto.batchSequence,
			batchDto.batchIdentifier,
			batchDto.batchStatus === undefined ? SettlementBatchStatus.OPEN : batchDto.batchStatus!
		);

		// Store the account (accountDto can't be stored).
		const formattedBatchDto: ISettlementBatchDto = batch.toDto();
		try {
			await this.batchRepo.storeNewBatch(formattedBatchDto);
		} catch (error: unknown) {
			if (!(error instanceof SettlementBatchAlreadyExistsError)) {
				this.logger.error(error);
			}
			throw error;
		}

		// We perform an async audit:
		this.auditingClient.audit(
			AuditingActions.SETTLEMENT_BATCH_CREATED,
			true,
			this.getAuditSecurityContext(securityContext),
			[
				{key: "settlementBatchId", value: batch.id},
				{key: "settlementBatchIdIdentifier", value: batch.batchIdentifier}
			]
		);
		return batch.id;
	}

	async createSettlementBatchAccount(accountDto: ISettlementBatchAccountDto, securityContext: CallSecurityContext): Promise<string> {
		const timestamp: number = Date.now();
		this.logger.debug(`Creating Batch Account: ${JSON.stringify(accountDto)}`);

		this.enforcePrivilege(securityContext, Privileges.CREATE_SETTLEMENT_BATCH_ACCOUNT);

		if (accountDto.timestamp === null) accountDto.timestamp = timestamp;
		if (parseInt(accountDto.creditBalance) !== 0) throw new InvalidCreditBalanceError();
		if (parseInt(accountDto.debitBalance) !== 0) throw new InvalidDebitBalanceError();
		if (accountDto.externalId === undefined || accountDto.externalId === "") throw new InvalidExternalIdError();

		const currency: ICurrency | undefined = this.currencies.find(currency => {
			return currency.code === accountDto.currencyCode;
		});
		if (currency === undefined) throw new InvalidCurrencyCodeError();

		const account: SettlementBatchAccount = new SettlementBatchAccount(
			accountDto.id === null ? randomUUID() : accountDto.id,
			accountDto.externalId!,
			accountDto.currencyCode,
			currency.decimals,
			0n,
			0n,
			timestamp
		);

		// Store the account (accountDto can't be stored).
		const formattedBatchAccountDto: ISettlementBatchAccountDto = account.toDto();
		formattedBatchAccountDto.settlementBatch = accountDto.settlementBatch;
		try {
			await this.batchAccountRepo.storeNewSettlementBatchAccount(formattedBatchAccountDto);
		} catch (error: unknown) {
			if (!(error instanceof AccountAlreadyExistsError)) {
				this.logger.error(error);
			}
			throw error;
		}

		// We perform an async audit:
		this.auditingClient.audit(
			AuditingActions.SETTLEMENT_BATCH_ACCOUNT_CREATED,
			true,
			this.getAuditSecurityContext(securityContext),
			[
				{key: "accountId", value: account.id},
				{key: "accountExternalId", value: account.externalId!}
			]
		);

		return account.id;
	}

	async createSettlementTransfer(transferDto: ISettlementTransferDto, securityContext: CallSecurityContext): Promise<ISettlementTransferDto> {
		this.enforcePrivilege(securityContext, Privileges.CREATE_SETTLEMENT_TRANSFER);

		if (transferDto.timestamp === undefined || transferDto.timestamp === null || transferDto.timestamp < 1) throw new InvalidTimestampError();
		if (transferDto.settlementModel === undefined ||
			(transferDto.settlementModel === null || transferDto.settlementModel === "")) throw new InvalidBatchSettlementModelError();
		if (transferDto.currencyCode === undefined || transferDto.currencyCode === "") throw new InvalidCurrencyCodeError();
		if (transferDto.amount === undefined || transferDto.amount === "") throw new InvalidAmountError();
		if (transferDto.externalId === undefined || transferDto.externalId === "") throw new InvalidExternalIdError();
		if (transferDto.creditParticipantAccountId === undefined || transferDto.creditParticipantAccountId === "") throw new InvalidCreditAccountError();
		if (transferDto.debitParticipantAccountId === undefined || transferDto.debitParticipantAccountId === undefined) throw new InvalidDebitAccountError();

		const timestamp: number = transferDto.timestamp;

		// Verify the currency code (and get the corresponding currency decimals).
		const currency: ICurrency | undefined = this.currencies.find(currency => {
			return currency.code === transferDto.currencyCode;
		});
		if (currency === undefined) throw new InvalidCurrencyCodeError();

		// Convert the amount and check if it's valid.
		let amount: bigint;
		try {
			amount = stringToBigint(transferDto.amount, currency.decimals);
		} catch (error: any) {
			throw new InvalidAmountError();
		}
		if (amount <= 0n) throw new InvalidAmountError();

		const transfer: SettlementTransfer = new SettlementTransfer(
			randomUUID(),
			transferDto.externalId!,
			transferDto.currencyCode,
			currency.decimals,
			amount,
			transferDto.creditParticipantAccountId,
			transferDto.debitParticipantAccountId,
			null,
			timestamp
		);

		// Fetch or Create a Settlement Batch:
		const batchDto = await this.obtainSettlementBatch(transfer, transferDto.settlementModel, securityContext);
		transfer.batch = new SettlementBatch(
			batchDto.id,
			batchDto.timestamp,
			batchDto.settlementModel!,
			batchDto.currency!,
			batchDto.batchSequence,
			batchDto.batchIdentifier!,
			batchDto.batchStatus!
		)

		let creditedAccountDto: ISettlementBatchAccountDto | null;
		let debitedAccountDto: ISettlementBatchAccountDto | null;
		try {
			debitedAccountDto = await this.batchAccountRepo.getAccountById(
				await this.obtainSettlementAccountId(transferDto.debitParticipantAccountId, transfer.batch.id)
			);
			creditedAccountDto = await this.batchAccountRepo.getAccountById(
				await this.obtainSettlementAccountId(transferDto.creditParticipantAccountId, transfer.batch.id));
		} catch (error: any) {
			this.logger.error(error);
			throw error;
		}

		// Create the Debit/Credit accounts as required:
		if (debitedAccountDto === null) {
			debitedAccountDto = await this.createSettlementBatchAccountFromAccId(
				transferDto.debitParticipantAccountId,
				transfer.id,
				transferDto.settlementModel,
				currency,
				securityContext
			);
		}
		if (creditedAccountDto === null) {
			creditedAccountDto = await this.createSettlementBatchAccountFromAccId(
				transferDto.creditParticipantAccountId,
				transfer.id,
				transferDto.settlementModel,
				currency,
				securityContext
			);
		}

		const creditedAccount = new SettlementBatchAccount(
			creditedAccountDto.id!,
			creditedAccountDto.externalId!,
			creditedAccountDto.currencyCode,
			creditedAccountDto.currencyDecimals!,
			stringToBigint(creditedAccountDto.creditBalance, creditedAccountDto.currencyDecimals!),
			stringToBigint(creditedAccountDto.debitBalance, creditedAccountDto.currencyDecimals!),
			timestamp
		);
		const debitedAccount = new SettlementBatchAccount(
			debitedAccountDto.id!,
			debitedAccountDto.externalId!,
			debitedAccountDto.currencyCode,
			debitedAccountDto.currencyDecimals!,
			stringToBigint(debitedAccountDto.creditBalance, debitedAccountDto.currencyDecimals!),
			stringToBigint(debitedAccountDto.debitBalance, debitedAccountDto.currencyDecimals!),
			timestamp
		);

		// Store the Transfer:
		const formattedTransferDto: ISettlementTransferDto = transfer.toDto();
		formattedTransferDto.debitParticipantAccountId = debitedAccountDto.id!;
		formattedTransferDto.creditParticipantAccountId = creditedAccountDto.id!;

		try {
			await this.transfersRepo.storeNewSettlementTransfer(formattedTransferDto);
		} catch (error: any) {
			this.logger.error(error);
			throw error;
		}

		// Update the debited account's debit balance and timestamp:
		const updatedDebitBalance: string = bigintToString(
			debitedAccount.debitBalance + transfer.amount,
			debitedAccount.currencyDecimals
		);
		try {
			await this.batchAccountRepo.updateAccountDebitBalanceAndTimestampById(
				debitedAccount.id,
				updatedDebitBalance,
				transfer.timestamp!
			);
		} catch (error: any) {
			this.logger.error(error);
			throw error;
		}

		// Update the credited account's credit balance and timestamp.
		const updatedCreditBalance: string = bigintToString(
			creditedAccount.creditBalance + transfer.amount,
			creditedAccount.currencyDecimals
		);
		try {
			await this.batchAccountRepo.updateAccountCreditBalanceAndTimestampById(
				creditedAccount.id,
				updatedCreditBalance,
				transfer.timestamp!
			);
		} catch (error: any) {
			this.logger.error(error);
			throw error;
		}

		// We perform an async audit:
		this.auditingClient.audit(
			AuditingActions.SETTLEMENT_TRANSFER_CREATED,
			true,
			this.getAuditSecurityContext(securityContext), [{key: "settlementTransferId", value: transfer.id}]
		);
		const returnVal : ISettlementTransferDto = {
			id: transfer.id,
			externalId: transfer.externalId,
			currencyCode: transfer.currencyCode,
			currencyDecimals: transfer.currencyDecimals,
			amount: `${transfer.amount}`,
			debitParticipantAccountId: debitedAccountDto.id!,
			creditParticipantAccountId: creditedAccountDto.id!,
			timestamp: timestamp,
			settlementModel: transfer.batch.settlementModel,
			batch: batchDto
		}
		return returnVal;
	}

	async createSettlementMatrix(
		settlementModel: string,
		fromDate: number,
		toDate: number,
		securityContext: CallSecurityContext
	): Promise<ISettlementMatrixDto> {
		const timestamp: number = Date.now();

		this.enforcePrivilege(securityContext, Privileges.REQUEST_SETTLEMENT_MATRIX);

		const settBefore = await this.batchRepo.getSettlementBatchesBy(fromDate, toDate, settlementModel);
		// CLOSE THE OPEN BATCH:
		const closedBatches : ISettlementBatchDto[] = [];
		for (const batch of settBefore) {
			if (SettlementBatchStatus.OPEN !== batch.batchStatus) continue;

			await this.batchRepo.closeBatch(batch);
			closedBatches.push(batch);
		}

		//TODO 1. Fetch all the batches, as long as the last batch is outside the [toDate]
		//TODO 2. Close the batches not already closed (no new txn's will be allowed on those closed batches)
		//TODO -----------
		//TODO 3. Fetch all of the settlement accounts
		//TODO 4. Calculate the settlement balance required for each of the accounts

		//TODO 5. Send an event in order to update the external system position account for the batches where the account was not closed.

		// Generate the Matrix!:
		try {
			//TODO await this.transfersRepo.storeNewSettlementTransfer(formattedTransferDto);
		} catch (error: any) {
			this.logger.error(error);
			throw error;
		}

		// We perform an async audit:
		this.auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_CREATED,
			true,
			this.getAuditSecurityContext(securityContext), [{key: "settlementModel", value: settlementModel}]
		);
		const matrixBatches : ISettlementMatrixBatchDto[] = [];
		// TODO rather fetch the batches using the ids from the TOP, otherwise we may land up returning a WIP batch.
		const settBatches = await this.batchRepo.getSettlementBatchesBy(fromDate, toDate, settlementModel);

		// TODO set and exec : IParticipantSettlementNotificationDto
		//TODO Complete:
		await this.participantAccRepo.publishSettlementNotification([]);


		const returnVal : ISettlementMatrixDto = {
			fromDate: fromDate,
			toDate: toDate,
			settlementModel: settlementModel,
			generationDuration: (Date.now() - timestamp) * 1000,
			batches: matrixBatches
		};
		return returnVal;
	}

	public async getSettlementBatches(
		settlementModel: string,
		fromDate: number,
		toDate: number,
		securityContext: CallSecurityContext
	): Promise<ISettlementBatchDto[]> {
		this.enforcePrivilege(securityContext, Privileges.RETRIEVE_SETTLEMENT_BATCH);

		return await this.batchRepo.getSettlementBatchesBy(fromDate, toDate, settlementModel)
	}

	public async getSettlementBatchAccounts(
		batchIdentifier : string,
		securityContext: CallSecurityContext
	): Promise<ISettlementBatchAccountDto[]> {
		this.enforcePrivilege(securityContext, Privileges.RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS);

		const batch = await this.batchRepo.getSettlementBatchById(batchIdentifier);
		if (batch === null) {
			throw new SettlementBatchNotFoundError(`Unable to locate Settlement Batch with identifier '${batchIdentifier}'.`);
		}

		const returnVal = await this.batchAccountRepo.getAccountsByBatch(batch)
		// Cleanup the JSON:
		returnVal.forEach(itm => {
			//TODO delete itm.settlementBatch;
		});
		return returnVal;
	}

	public async getSettlementBatchTransfers(
		batchIdentifier : string,
		securityContext: CallSecurityContext
	): Promise<ISettlementTransferDto[]> {
		this.enforcePrivilege(securityContext, Privileges.RETRIEVE_SETTLEMENT_TRANSFERS);

		const batch = await this.batchRepo.getSettlementBatchById(batchIdentifier);
		if (batch === null) {
			throw new SettlementBatchNotFoundError(`Unable to locate Settlement Batch with identifier '${batchIdentifier}'.`);
		}

		const settlementAccounts = await this.batchAccountRepo.getAccountsByBatch(batch);
		const accIds : string[] = [];
		settlementAccounts.forEach(itm => accIds.push(itm.id!));

		const returnVal = await this.transfersRepo.getSettlementTransfersByAccountIds(accIds/*settlementAccounts.map(acc => acc.id)*/);

		// Cleanup the JSON:
		returnVal.forEach(itm => {
			//TODO delete itm.batch
		})

		return returnVal;
	}

	private async createSettlementBatchAccountFromAccId(
		accId: string,
		batchId: string,
		settlementModel: string,
		currency: ICurrency,
		securityContext: CallSecurityContext
	): Promise<ISettlementBatchAccountDto> {
		const timestamp: number = Date.now();
		let partAcc : null | IParticipantAccountBatchMappingDto = await this.participantAccRepo.getAccountBy(accId, batchId);
		if (partAcc === null) {
			partAcc = {
				participantId: accId,
				settlementBatchId: batchId,
				settlementBatchAccountId: randomUUID()
			};
			await this.participantAccRepo.storeBatchParticipant(partAcc);
		}

		const settlementBatch : ISettlementBatchDto = {
			id: batchId,
			timestamp: 0,
			settlementModel: settlementModel,
			currency: null,
			batchSequence: 0,
			batchIdentifier: null,
			batchStatus: null
		}

		const accountDto : ISettlementBatchAccountDto = {
			id: await this.obtainSettlementAccountId(partAcc.participantId!, batchId),
			externalId: partAcc.participantId!,
			settlementBatch: settlementBatch,
			currencyCode: currency.code,
			currencyDecimals: currency.decimals,
			creditBalance: "0",
			debitBalance: "0",
			timestamp: timestamp
		};
		const accIdNew = await this.createSettlementBatchAccount(accountDto, securityContext);
		accountDto.id = accIdNew;
		return accountDto;
	}

	async obtainSettlementAccountId(accId: string, batchId: string): Promise<string> {
		const partAcc = await this.participantAccRepo.getAccountBy(accId, batchId);
		if (partAcc == null) return ""

		return partAcc.settlementBatchAccountId;
	}

	async obtainSettlementBatch(
		transfer: SettlementTransfer,
		model: string,
		securityContext: CallSecurityContext
	) : Promise<ISettlementBatchDto> {
		const timestamp = transfer.timestamp;

		const configDto = await this.configRepo.getSettlementConfigByModel(model);
		if (configDto == null) throw new NoSettlementConfig(`No settlement config for model '${model}'.`);
		const config = new SettlementConfig(
			configDto.id,
			configDto.settlementModel,
			configDto.batchCreateInterval
		)
		const fromDate: number = config.calculateBatchFromDate(timestamp),
			toDate: number = config.calculateBatchToDate(timestamp);

		let settlementBatchDto : null | ISettlementBatchDto = await this.batchRepo.getOpenSettlementBatch(fromDate, toDate, model)
		if (settlementBatchDto === null) {
			const nextBatchSeq = this.nextBatchSequence(model, transfer.currencyCode, transfer.currencyCode, toDate)
			// Create a new Batch to store the transfer against:
			settlementBatchDto = new SettlementBatch(
				randomUUID(),
				timestamp,
				model,
				transfer.currencyCode,
				nextBatchSeq,
				this.generateBatchIdentifier(model, transfer, nextBatchSeq),
				SettlementBatchStatus.OPEN
			).toDto()
			await this.createSettlementBatch(settlementBatchDto, securityContext);
		}
		return settlementBatchDto;
	}

	private generateBatchIdentifier(
		model: string,
		transfer: SettlementTransfer,
		batchSeq: number
	) : string {
		//TODO add assertion here:
		//FX.XOF:RWF.2021.08.23.00.00
		//const toDateDate = new Date(toDate);
		//const formatTimestamp = `${toDateDate.getUTCFullYear()}.${toDateDate.getUTCMonth()+1}.${toDateDate.getUTCDate()}.${toDateDate.getUTCHours()}.${toDateDate.getUTCMinutes()}`;

		let batchSeqTxt = `00${batchSeq}`;
		batchSeqTxt = batchSeqTxt.substr(batchSeqTxt.length - 3);

		return `${model}.${transfer.currencyCode}.${batchSeqTxt}`;
	}

	private nextBatchSequence(
		model: string,
		debitCurrency: string,
		creditCurrency: string,
		toDate: number
	) : number {
		//TODO add assertion here:

		//TODO need to get max batch seq using criteria

		return 1;
	}

	async getSettlementAccountsBy(
		fromDate: number,
		toDate: number,
		securityContext: CallSecurityContext,
		model?: string
	): Promise<ISettlementBatchAccountDto | null> {
		this.enforcePrivilege(securityContext, Privileges.RETRIEVE_SETTLEMENT_BATCH);
		try {
			// TODO first fetch all the batches....
			// TODO fetch all the accounts for the batches...

			// const accountDto: ISettlementBatchAccountDto[] | null = await this.batchAccountRepo.getAccountsByBatch();
			//return accountDto;
			return null;
		} catch (error: unknown) {
			this.logger.error(error);
			throw error;
		}
	}

	async getSettlementTransfersByAccountId(
		accountId: string,
		securityContext: CallSecurityContext
	): Promise<ISettlementTransferDto[]> {
		this.enforcePrivilege(securityContext, Privileges.RETRIEVE_SETTLEMENT_TRANSFERS);
		try {
			const transferDTOs: ISettlementTransferDto[] =
				await this.transfersRepo.getSettlementTransfersByAccountId(accountId);
			return transferDTOs;
		} catch (error: unknown) {
			this.logger.error(error);
			throw error;
		}
	}
}
