/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Contributors
--------------
This is the official list of the Mojaloop project contributors for this file.
Names of the original copyright holders (individuals or organizations)
should be listed with a '*' in the first column. People who have
contributed from an organization can be listed under the organization
that actually holds the copyright for their contributions (see the
Mojaloop Foundation for an example). Those individuals should have
their names indented and be marked with a '-'. Email address can be added
optionally within square brackets <email>.

* Mojaloop Foundation
- Name Surname <name.surname@mojaloop.io>

* Coil
- Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

export const DEFAULT_SETTLEMENT_MODEL_ID = "DEFAULT";
export const DEFAULT_SETTLEMENT_MODEL_NAME = DEFAULT_SETTLEMENT_MODEL_ID;

// to be replaced by the TransferCommitFulfiledEvt, sent by transfers
export interface ITransferDto {
	id: string | null;
	transferId: string | null;
	payerFspId: string;
	payeeFspId: string;
	currencyCode: string;
	amount: string;
	timestamp: number;
	settlementModel: string;
}

/**
 * @todo Rename to ISettlementModel
 */
export interface ISettlementConfig {
	id: string;
    /**
     * Settlement model name, should be unique.
     * @todo rename to modelName
     */
    settlementModel: string;
    /**
     * Batch duration interval in seconds
     * @todo rename to batchCreateIntervalSecs
     */
    batchCreateInterval: number;
    // isAutoClose: boolean;
    // settlementTime: string | null;
    isActive: boolean;
    // remove custom customSettlementField
    //customSettlementField: ICustomSettlementField[] | null;

    // // will put fixed matching field temporary and will replace with flexibility later
    // matchingPayeeFspId: string | null;
    // matchingPayerFspId: string | null;
    // matchingCurrency: string | null;
    // matchingAmount: number | null;
    // // matchingTransactionType: string | null;
    // // matchingExtensionList: [];

    createdBy: string;
    createdDate: number;
    changeLog: ISettlementModelActivityLogEntry[];
}

export declare interface ISettlementModelActivityLogEntry {
    changeType: "CREATE" | "APPROVE" | "ACTIVATE" | "DEACTIVATE" | "UPDATE";
    user: string;
    timestamp: number;
    notes: string | null;
}

export interface ISettlementBatch {
	batchUUID: string;// 123e4567-e89b-12d3-a456-426614174000
	id: string; // FX.XOF:RWF.2021.08.23.00.00.001
	timestamp: number;
	settlementModel: string;
	currencyCode: string;
	batchName: string; // FX.XOF:RWF.2021.08.23.00.00 (minus seq)
	batchSequence: number; // 1 (seq only)
	state: SettlementMatrixBatchState;
	// this will only exist for batches that are in a state that mandates a
	// single matrix owning it, like "AWAITING_SETTLEMENT" or "SETTLED"
	// when locking or settling, put matrixId, when unlocking put it to null again
	ownerMatrixId: null | string;
	accounts: ISettlementBatchAccount[];
}

 // for use inside a ISettlementBatch
export interface ISettlementBatchAccount {
	accountExtId: string;
	participantId: string;
	currencyCode: string;
	creditBalance: string;
	debitBalance: string;
}

export interface ISettlementBatchTransfer {
	transferId: string;
	transferTimestamp: number;
	payerFspId: string;
	payeeFspId: string;
	currencyCode: string;
	amount: string;
	batchId: string;
	batchName: string;
	// NOTE: since the handleTransfer no longer populates the account info and therefore does not have its journalEntryId, it can be null so we need to check at a later stage
	journalEntryId: string | null;
	matrixId: string | null;
}


/*******************
* Settlement Matrix
********************/
export interface ISettlementMatrix {
	id: string;
	createdAt: number;
	updatedAt: number;

	// criteria
	dateFrom: number | null;
	dateTo: number | null;
	currencyCodes: string[];
	settlementModel: string | null;
	batchStatuses: string[];
	batches: ISettlementMatrixBatch[];
	state: "IDLE" | "BUSY" | "FINALIZED" | "OUT_OF_SYNC" | "LOCKED";
	type: "STATIC" | "DYNAMIC";
	generationDurationSecs: number | null;

	balancesByCurrency: ISettlementMatrixBalanceByCurrency[];
	balancesByStateAndCurrency: ISettlementMatrixBalanceByStateAndCurrency[];
	balancesByParticipant: ISettlementMatrixBalanceByParticipant[];
}

export interface ISettlementMatrixBalanceByCurrency {
	currencyCode: string;
	debitBalance: string;
	creditBalance: string;
}

export interface ISettlementMatrixBalanceByStateAndCurrency {
	currencyCode: string;
	state: string;
	debitBalance: string;
	creditBalance: string;
}

export type SettlementMatrixBatchState = "OPEN" | "DISPUTED" | "SETTLED" | "CLOSED" | "AWAITING_SETTLEMENT";

export interface ISettlementMatrixBalanceByParticipant {
	participantId: string;
	currencyCode: string;
	state: SettlementMatrixBatchState;
	debitBalance: string;
	creditBalance: string;
}

export interface ISettlementMatrixBatch {
	id: string;
	name: string;
	currencyCode: string;
	batchDebitBalance: string;
	batchCreditBalance: string;
	state: SettlementMatrixBatchState;
	batchAccounts?: ISettlementMatrixBatchAccount[];
}

export interface ISettlementMatrixBatchAccount {
	id: string;
	participantId: string;
	accountExtId: string;
	debitBalance: string;
	creditBalance: string;
}

/* ISettlementModelClient for settlement-model-lib */
export interface ISettlementModelClient {
	init(): Promise<void>;

	destroy(): Promise<void>;

	getSettlementModelId(
		transferAmount: string,
		payerCurrency: string | null,
		payeeCurrency: string | null,
		extensionList: { key: string; value: string; }[]
	): Promise<string>;
}


// Search result types with pagination
export type SearchResults = {
	pageIndex: number;
	pageSize: number;
    totalPages: number;
}

export type BatchSearchResults = SearchResults & {
    items: ISettlementBatch[];
}

export type MatrixSearchResults = SearchResults & {
    items: ISettlementMatrix[];
}

export type BatchTransferSearchResults = SearchResults & {
	items: ISettlementBatchTransfer[];
}
