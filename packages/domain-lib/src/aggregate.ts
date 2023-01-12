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
	InvalidDebitAccountError
} from "./types/errors";
import {
	ISettlementBatchRepo,
	ISettlementBatchAccountRepo,
	IParticipantAccountRepo,
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
	IParticipantAccountDto,
	ISettlementMatrixDto,
	SettlementBatchStatus,
	SettlementModel
} from "@mojaloop/settlements-bc-public-types-lib";
//TODO import {obtainSettlementModelFrom} from "@mojaloop/settlements-model-lib";
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
	private readonly participantAccRepo: IParticipantAccountRepo;
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
		participantAccRepo: IParticipantAccountRepo,
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
		for (const roleId of securityContext.rolesIds) {
			if (this.authorizationClient.roleHasPrivilege(roleId, privilegeId)) {
				return;
			}
		}
		throw new UnauthorizedError();
	}

	private getAuditSecurityContext(securityContext: CallSecurityContext): AuditSecurityContext {
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
		if (batchDto.timestamp !== null) throw new InvalidTimestampError();
		if (batchDto.batchIdentifier === null || batchDto.batchIdentifier === "") throw new InvalidBatchIdentifierError();

		// IDs:
		if (batchDto.id === "") throw new InvalidExternalIdError();

		// Generate a random UUId, if needed:
		if (await this.batchRepo.batchExistsByBatchIdentifier(batchDto.batchIdentifier)) {
			throw new InvalidBatchIdentifierError(`Batch with identifier '${batchDto.batchIdentifier}' already created.`);
		}

		// The Domain Batch:
		const batch: SettlementBatch = new SettlementBatch(
			randomUUID(),
			timestamp,
			batchDto.settlementModel,
			batchDto.debitCurrency,
			batchDto.creditCurrency,
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

		this.enforcePrivilege(securityContext, Privileges.CREATE_SETTLEMENT_BATCH_ACCOUNT);

		if (accountDto.currencyDecimals !== null) throw new InvalidCurrencyDecimalsError();
		if (accountDto.timestamp !== null) throw new InvalidTimestampError();
		if (parseInt(accountDto.creditBalance) !== 0) throw new InvalidCreditBalanceError();
		if (parseInt(accountDto.debitBalance) !== 0) throw new InvalidDebitBalanceError();
		if (accountDto.externalId === undefined || accountDto.externalId === "") throw new InvalidExternalIdError();

		const currency: ICurrency | undefined = this.currencies.find(currency => {
			return currency.code === accountDto.currencyCode;
		});
		if (currency === undefined) throw new InvalidCurrencyCodeError();

		const account: SettlementBatchAccount = new SettlementBatchAccount(
			randomUUID(),
			accountDto.externalId!,
			accountDto.currencyCode,
			currency.decimals,
			0n,
			0n,
			timestamp
		);

		// Store the account (accountDto can't be stored).
		const formattedBatchAccountDto: ISettlementBatchAccountDto = account.toDto();
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

	async createSettlementTransfer(transferDto: ISettlementTransferDto, securityContext: CallSecurityContext): Promise<string> {
		const timestamp: number = Date.now();

		this.enforcePrivilege(securityContext, Privileges.CREATE_SETTLEMENT_TRANSFER);

		if (transferDto.currencyDecimals !== null) throw new InvalidCurrencyDecimalsError();
		if (transferDto.timestamp !== null) throw new InvalidTimestampError();
		if (transferDto.externalId === undefined || transferDto.externalId === "") throw new InvalidExternalIdError();
		if (transferDto.externalCategory === undefined || transferDto.externalCategory === "") throw new InvalidExternalCategoryError();
		if (transferDto.creditAccountId === undefined || transferDto.creditAccountId === "") throw new InvalidCreditAccountError();
		if (transferDto.debitAccountId === undefined || transferDto.debitAccountId === "") throw new InvalidDebitAccountError();

		// Verify the currency code (and get the corresponding currency decimals).
		const currency: ICurrency | undefined = this.currencies.find(currency => {
			return currency.code === transferDto.currencyCode;
		});
		if (currency === undefined) throw new InvalidCurrencyCodeError();

		// Convert the amount and check if it's valid.
		let amount: bigint;
		try {
			amount = stringToBigint(transferDto.amount, currency.decimals);
		} catch (error: unknown) {
			throw new InvalidAmountError();
		}
		if (amount <= 0n) throw new InvalidAmountError();

		const transfer: SettlementTransfer = new SettlementTransfer(
			randomUUID(),
			transferDto.externalId!,
			transferDto.externalCategory!,
			transferDto.currencyCode,
			currency.decimals,
			amount,
			transferDto.creditAccountId!,
			transferDto.debitAccountId!,
			null,
			timestamp
		);

		// Assign the Batch:
		const settlementModel: SettlementModel = await this.obtainSettlementModel(transfer);

		// Fetch or Create a Settlement Batch:
		const batchDto = await this.obtainSettlementBatch(transfer, settlementModel, securityContext);
		transfer.batch = new SettlementBatch(
			batchDto.id,
			batchDto.timestamp,
			batchDto.settlementModel,
			batchDto.debitCurrency,
			batchDto.creditCurrency,
			batchDto.batchSequence,
			batchDto.batchIdentifier,
			batchDto.batchStatus!
		)

		let creditedAccountDto: ISettlementBatchAccountDto | null;
		let debitedAccountDto: ISettlementBatchAccountDto | null;
		try {
			creditedAccountDto = await this.batchAccountRepo.getAccountById(
				this.deriveSettlementAccountId(transferDto.creditAccountId, transfer.batch.id));
			debitedAccountDto = await this.batchAccountRepo.getAccountById(
				this.deriveSettlementAccountId(transferDto.debitAccountId, transfer.batch.id)
			);
		} catch (error: unknown) {
			this.logger.error(error);
			throw error;
		}

		// Create the Debit/Credit accounts as required:
		if (creditedAccountDto === null) {
			creditedAccountDto = await this.createSettlementBatchAccountFromAccId(
				transferDto.creditAccountId,
				transfer.batch.id,
				currency,
				securityContext
			);
		}
		if (debitedAccountDto === null) {
			debitedAccountDto = await this.createSettlementBatchAccountFromAccId(
				transferDto.debitAccountId,
				transfer.batch.id,
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
		try {
			await this.transfersRepo.storeNewSettlementTransfer(formattedTransferDto);
		} catch (error: unknown) {
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
		} catch (error: unknown) {
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
		} catch (error: unknown) {
			this.logger.error(error);
			throw error;
		}

		// We perform an async audit:
		this.auditingClient.audit(
			AuditingActions.SETTLEMENT_TRANSFER_CREATED,
			true,
			this.getAuditSecurityContext(securityContext), [{key: "settlementTransferId", value: transfer.id}]
		);
		return transfer.id;
	}

	async createSettlementMatrix(
		settlementModel: SettlementModel,
		fromDate: number,
		toDate: number,
		securityContext: CallSecurityContext
	): Promise<ISettlementMatrixDto> {
		const timestamp: number = Date.now();

		this.enforcePrivilege(securityContext, Privileges.REQUEST_SETTLEMENT_MATRIX);

		//TODO 1. Fetch all the batches, as long as the last batch is outside the [toDate]
		//TODO 2. Close the batches not already closed (no new txn's will be allowed on those closed batches)
		//TODO -----------
		//TODO 3. Fetch all of the settlement accounts
		//TODO 4. Calculate the settlement balance required for each of the accounts
		//TODO 5. Send an event in order to update the external system position account for the batches where the account was not closed.

		// Generate the Matrix!:
		try {
			//TODO await this.transfersRepo.storeNewSettlementTransfer(formattedTransferDto);
		} catch (error: unknown) {
			this.logger.error(error);
			throw error;
		}

		// We perform an async audit:
		this.auditingClient.audit(
			AuditingActions.SETTLEMENT_MATRIX_CREATED,
			true,
			this.getAuditSecurityContext(securityContext), [{key: "settlementModel", value: settlementModel}]
		);

		const returnVal : ISettlementMatrixDto = {
			fromDate: fromDate,
			toDateDate: toDate,
			settlementModel: settlementModel,
			batches: null//TODO @jason need to complete
		};
		return returnVal;
	}

	private async getSettlementBatches(
		settlementModel: SettlementModel,
		fromDate: number,
		toDate: number,
		securityContext: CallSecurityContext
	): Promise<ISettlementBatchDto[] | null> {
		const timestamp: number = Date.now();

		this.enforcePrivilege(securityContext, Privileges.RETRIEVE_SETTLEMENT_BATCH);

		//TODO need to complete this
		return null;
	}

	private async createSettlementBatchAccountFromAccId(
		accId: string,
		batchId: string,
		currency: ICurrency,
		securityContext: CallSecurityContext
	): Promise<ISettlementBatchAccountDto> {
		const timestamp: number = Date.now();
		const partAcc : null | IParticipantAccountDto = await this.participantAccRepo.getAccountById(accId);
		if (partAcc === null) {
			throw new PositionAccountNotFoundError(`Unable to locate Participant account with id '${accId}'.`);
		}

		const accountDto : ISettlementBatchAccountDto = {
			id: this.deriveSettlementAccountId(partAcc.id!, batchId),
			externalId: batchId,// Links the account to the batch
			currencyCode: currency.code,
			currencyDecimals: currency.decimals,
			creditBalance: "0",
			debitBalance: "0",
			timestamp: timestamp
		};
		await this.createSettlementBatchAccount(accountDto, securityContext);
		return accountDto;
	}

	private deriveSettlementAccountId(accId: string, batchId: string): string {
		const settlementAccId = randomUUID();

		// TODO need to create mapping table between batch account and participant account:

		return settlementAccId
	}

	async obtainSettlementBatch(
		transfer: SettlementTransfer,
		model: SettlementModel,
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
				transfer.currencyCode,
				nextBatchSeq,
				this.generateBatchIdentifier(model, transfer.currencyCode, transfer.currencyCode, toDate, nextBatchSeq),
				SettlementBatchStatus.OPEN
			).toDto()
			await this.createSettlementBatch(settlementBatchDto, securityContext);
		}
		return settlementBatchDto;
	}

	private generateBatchIdentifier(
		model: SettlementModel,
		debitCurrency: string,
		creditCurrency: string,
		toDate: number,
		batchSeq: number
	) : string {
		//TODO add assertion here:
		//FX.XOF:RWF.2021.08.23.00.00
		const formatTimestamp = "2021.08.23.00.00";
		//TODO 1. Need to fetch all the closed batches for the suffix

		return `${model}.${debitCurrency.toUpperCase()}:${creditCurrency.toUpperCase()}.${formatTimestamp}.${batchSeq}`;
	}

	private nextBatchSequence(
		model: SettlementModel,
		debitCurrency: string,
		creditCurrency: string,
		toDate: number
	) : number {
		//TODO add assertion here:

		//TODO need to get max batch seq using criteria

		return 1;
	}

	//TODO this will not be in settlements anymore:
	async obtainSettlementModel(
		transfer: SettlementTransfer
	) : Promise<SettlementModel> {
		if (transfer == null) return SettlementModel.UNKNOWN;
		return SettlementModel.DEFAULT;

		//TODO need to use the lib again:
		/*return await obtainSettlementModelFrom(
			transfer.amount,
			transfer.currencyCode,//TODO This will always result in default...
			transfer.currencyCode
		);*/
	}

	async getSettlementAccountsBy(
		fromDate: number,
		toDate: number,
		securityContext: CallSecurityContext,
		model?: SettlementModel
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
