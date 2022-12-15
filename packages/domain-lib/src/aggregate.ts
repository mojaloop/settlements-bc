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
	InvalidAmountError
} from "./types/errors";
import {
	ISettlementBatchRepo,
	ISettlementBatchAccountRepo,
	ISettlementTransferRepo
} from "./types/infrastructure";
import {SettlementBatch} from "./types/batch";
import {SettlementBatchAccount} from "./types/account";
import {SettlementTransfer} from "./types/transfer";
import {
	ISettlementBatchDto,
	ISettlementBatchAccountDto,
	ISettlementTransferDto,
	SettlementBatchStatus,
	SettlementModel
} from "@mojaloop/settlements-bc-public-types-lib";
import {IAuditClient, AuditSecurityContext} from "@mojaloop/auditing-bc-public-types-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-client-lib";
import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";
import {Privileges} from "./types/privileges";
import {join} from "path";
import {readFileSync} from "fs";
import {ICurrency} from "./types/currency";
import {bigintToString, stringToBigint} from "./converters";

enum AuditingActions {
	SETTLEMENT_BATCH_CREATED = "SETTLEMENT_BATCH_CREATED",
	SETTLEMENT_BATCH_ACCOUNT_CREATED = "SETTLEMENT_BATCH_ACCOUNT_CREATED",
	SETTLEMENT_TRANSFER_CREATED = "SETTLEMENT_TRANSFER_CREATED"
}

export class Aggregate {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	private readonly authorizationClient: IAuthorizationClient;
	private readonly auditingClient: IAuditClient;
	private readonly batchRepo: ISettlementBatchRepo;
	private readonly batchAccountRepo: ISettlementBatchAccountRepo;
	private readonly transfersRepo: ISettlementTransferRepo;
	private readonly currencies: ICurrency[];
	// Other properties.
	private static readonly CURRENCIES_FILE_NAME: string = "currencies.json";

	constructor(
		logger: ILogger,
		authorizationClient: IAuthorizationClient,
		auditingClient: IAuditClient,
		batchRepo: ISettlementBatchRepo,
		batchAccountRepo: ISettlementBatchAccountRepo,
		transfersRepo: ISettlementTransferRepo
	) {
		this.logger = logger;
		this.authorizationClient = authorizationClient;
		this.auditingClient = auditingClient;
		this.batchRepo = batchRepo;
		this.batchAccountRepo = batchAccountRepo;
		this.transfersRepo = transfersRepo;

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
		if (batchDto.externalId === "") throw new InvalidExternalIdError();

		// Generate a random UUId, if needed:
		if (await this.batchRepo.batchExistsByBatchIdentifier(batchDto.batchIdentifier)) {
			throw new InvalidBatchIdentifierError(`Batch with identifier '${batchDto.batchIdentifier}' already created.`);
		}

		// The Domain Batch:
		const batch: SettlementBatch = new SettlementBatch(
			randomUUID(),
			timestamp,
			batchDto.settlementModel,
			batchDto.batchStatus,
			batchDto.batchIdentifier
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
		if (accountDto.externalId === "") throw new InvalidExternalIdError();

		const currency: ICurrency | undefined = this.currencies.find(currency => {
			return currency.code === accountDto.currencyCode;
		});
		if (currency === undefined) throw new InvalidCurrencyCodeError();

		const account: SettlementBatchAccount = new SettlementBatchAccount(
			randomUUID(),
			accountDto.externalId,
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
				{key: "accountExternalId", value: account.externalId}
			]
		);

		return account.id;
	}

	async createSettlementTransfer(transferDto: ISettlementTransferDto, securityContext: CallSecurityContext): Promise<string> {
		const timestamp: number = Date.now();

		this.enforcePrivilege(securityContext, Privileges.CREATE_SETTLEMENT_TRANSFER);

		if (transferDto.currencyDecimals !== null) throw new InvalidCurrencyDecimalsError();
		if (transferDto.timestamp !== null) throw new InvalidTimestampError();
		if (transferDto.externalId === "") throw new InvalidExternalIdError();
		if (transferDto.externalCategory === "") throw new InvalidExternalCategoryError();

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
			transferDto.externalId,
			transferDto.externalCategory,
			transferDto.currencyCode,
			currency.decimals,
			amount,
			transferDto.creditedAccountId,
			transferDto.debitedAccountId,
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
			batchDto.batchStatus,
			batchDto.batchIdentifier
		)

		let creditedAccountDto: ISettlementBatchAccountDto | null;
		let debitedAccountDto: ISettlementBatchAccountDto | null;
		try {
			creditedAccountDto = await this.batchAccountRepo.getAccountById(
				this.deriveSettlementAccountId(transferDto.creditedAccountId, transfer.batch.id));
			debitedAccountDto = await this.batchAccountRepo.getAccountById(
				this.deriveSettlementAccountId(transferDto.debitedAccountId, transfer.batch.id)
			);
		} catch (error: unknown) {
			this.logger.error(error);
			throw error;
		}
		if (creditedAccountDto === null) {
			//TODO Create new settlement account using batch-id + accountId / participantId
		}
		if (debitedAccountDto === null) {
			//TODO Create new settlement account using batch-id + accountId / participantId
		}

		const creditedAccount = new SettlementBatchAccount(
			creditedAccountDto.id!,
			creditedAccountDto.externalId,
			creditedAccountDto.currencyCode,
			creditedAccountDto.currencyDecimals!,
			stringToBigint(creditedAccountDto.creditBalance, creditedAccountDto.currencyDecimals!),
			stringToBigint(creditedAccountDto.debitBalance, creditedAccountDto.currencyDecimals!),
			timestamp
		);
		const debitedAccount = new SettlementBatchAccount(
			debitedAccountDto.id!,
			debitedAccountDto.externalId,
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

	private deriveSettlementAccountId(accId: string, batchId: string): string {
		// TODO need to perform op:
    return accId;
	}

	async obtainSettlementBatch(
		transfer: SettlementTransfer,
		model: SettlementModel,
		securityContext: CallSecurityContext
	) : Promise<ISettlementBatchDto> {
		const timestamp = transfer.timestamp;

		//TODO 0. Lookup Settlement Batch config for Model:
		const fromDate: number = 1, toDate: number = 2;

		// TODO 1. need to get the settlement batch.
		// TODO 2. need to create new batch if batch is closed.
		// TODO 3. Need to create a batch if there isn't any
		let settlementBatchDto = this.batchRepo.getOpenSettlementBatch(fromDate, toDate, model)
		if (settlementBatchDto === null) {
			// Create a new Batch to store the transfer against:
			settlementBatchDto = new SettlementBatch(
				randomUUID(),
				timestamp,
				model,
				SettlementBatchStatus.OPEN,
				await this.generateBatchIdentifier()
			).toDto()
			await this.createSettlementBatch(settlementBatchDto, securityContext);
		}
		return settlementBatchDto;
	}

	async generateBatchIdentifier() : Promise<string> {
		return "";
	}

	async obtainSettlementModel(
		transfer: SettlementTransfer
	) : Promise<SettlementModel> {
		if (transfer == null) return SettlementModel.UNKNOWN;

		return await this.obtainSettlementModelFromRaw(
			transfer.amount,
			transfer.currencyCode,//TODO This will always result in default...
			transfer.currencyCode
		);
	}

	async obtainSettlementModelFromRaw(
		transferAmount: bigint,
		debitAccountCurrency: string,
		creditAccountCurrency: string
	) : Promise<SettlementModel> {
		if (debitAccountCurrency === null) return SettlementModel.UNKNOWN;
		if (creditAccountCurrency === null) return SettlementModel.UNKNOWN;
		if (debitAccountCurrency !== creditAccountCurrency) {
			return SettlementModel.FX;
		} else return SettlementModel.DEFAULT;
	}

	async getSettlementAccountsBy(
		fromDate: number,
		toDate: number,
		securityContext: CallSecurityContext,
		model?: SettlementModel
	): Promise<ISettlementBatchAccountDto | null> {
		this.enforcePrivilege(securityContext, Privileges.RETRIEVE_SETTLEMENT_BATCH);
		try {
			const accountDto: ISettlementBatchAccountDto | null = await this.batchRepo.getSettlementBatchesBy(fromDate, toDate, model);
			return accountDto;
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
