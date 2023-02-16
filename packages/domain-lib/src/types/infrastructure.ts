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
 *  - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {
	ISettlementConfigDto,
	ISettlementBatchDto,
	ISettlementBatchAccountDto,
	ISettlementTransferDto,
	ISettlementMatrixRequestDto,
	ISettlementMatrixDto
} from "@mojaloop/settlements-bc-public-types-lib";

export interface ISettlementConfigRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	getSettlementConfigByModel(model: string): Promise<ISettlementConfigDto | null>;
}

export interface ISettlementBatchRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewBatch(batch: ISettlementBatchDto): Promise<void>; // Throws if account.id is not unique.
	closeBatch(batch: ISettlementBatchDto): Promise<void>;

	batchExistsByBatchIdentifier(batchIdentifier: string): Promise<boolean>;
	getSettlementBatchById(id: string): Promise<ISettlementBatchDto | null>;
	getSettlementBatchByBatchIdentifier(batchIdentifier: string): Promise<ISettlementBatchDto | null>;
	getSettlementBatchesBy(fromDate: number, toDate: number, model?: string): Promise<ISettlementBatchDto[]>;
	getOpenSettlementBatch(fromDate: number, toDate: number, model: string, currency: string): Promise<ISettlementBatchDto | null>;
}

export interface ISettlementBatchAccountRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewSettlementBatchAccount(account: ISettlementBatchAccountDto): Promise<void>; // Throws if account.id is not unique.
	accountExistsById(accountId: string): Promise<boolean>;
	getAccountById(accountId: string): Promise<ISettlementBatchAccountDto | null>;
	getAccountsByParticipantAccountId(partAccId: string): Promise<ISettlementBatchAccountDto[]>;
	getAccountByParticipantAccountAndBatchId(partAccId: string, batchId: string): Promise<ISettlementBatchAccountDto | null>;
	getAccountsByBatch(batch: ISettlementBatchDto): Promise<ISettlementBatchAccountDto[]>;
	updateAccountCreditBalanceAndTimestampById(
		accountId: string,
		creditBalance: string,
		timeStampLastJournalEntry: number
	): Promise<void>;
	updateAccountDebitBalanceAndTimestampById(
		accountId: string,
		debitBalance: string,
		timeStampLastJournalEntry: number
	): Promise<void>;
}

export interface IParticipantAccountNotifier {
	init(): Promise<void>;
	destroy(): Promise<void>;
	publishSettlementMatrixExecuteEvent(matrix: ISettlementMatrixDto): Promise<void>;
}

export interface ISettlementTransferRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewSettlementTransfer(transfer: ISettlementTransferDto): Promise<void>; // Throws if account.id is not unique.
	transferExistsById(id: string): Promise<boolean>;
	getSettlementTransfersByAccountId(accountId: string): Promise<ISettlementTransferDto[]>;
	getSettlementTransfersByAccountIds(accountId: string[]): Promise<ISettlementTransferDto[]>;
}

export interface ISettlementMatrixRequestRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewSettlementMatrixRequest(req: ISettlementMatrixRequestDto): Promise<void>; // Throws if account.id is not unique.
	getSettlementMatrixById(settlementMatrixReqId: string): Promise<ISettlementMatrixRequestDto | null>;

	closeSettlementMatrixRequest(matrixReq: ISettlementMatrixRequestDto): Promise<void>;
}

