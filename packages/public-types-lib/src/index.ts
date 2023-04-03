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
 - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

// to be replaced by the TransferCommitFulfiledEvt, sent by transfers
export interface ITransferDto {
	id: string | null;
	transferId: string | null;
	payerFspId: string;
	payeeFspId: string;
	currencyCode: string;
	//currencyDecimals: number | null;
	amount: string;
	//debitParticipantAccountId: string;
	//creditParticipantAccountId: string;
	timestamp: number;
	settlementModel: string;
}

export interface ISettlementConfig {
	id: string;
	settlementModel: string;
	batchCreateInterval: number;
}

export interface ISettlementBatch {
	id: string; // FX.XOF:RWF.2021.08.23.00.00.001
	timestamp: number;
	settlementModel: string;
	currencyCode: string;
	batchName: string; // FX.XOF:RWF.2021.08.23.00.00 (minus seq)
	batchSequence: number; // 1 (seq only)
	state: "OPEN" | "DISPUTED" | "SETTLED";
	accounts: ISettlementBatchAccount[];
}

 // for use inside a ISettlementBatch
export interface ISettlementBatchAccount {
	accountExtId: string;
	participantId:string;
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
	journalEntryId: string;
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
	dateFrom: number;
	dateTo: number;
	currencyCode: string;
	settlementModel: string;
	batches: ISettlementMatrixBatch[];
	participantBalances: ISettlementMatrixParticipantBalance[];
	state: "IDLE" | "CALCULATING" | "CLOSING" | "DISPUTED" | "CLOSED";
	generationDurationSecs: number | null;
	totalDebitBalance: string;
	totalCreditBalance: string;
}

export interface ISettlementMatrixParticipantBalance{
	participantId: string;
	debitBalance: string;
	creditBalance: string;
}

export interface ISettlementMatrixBatch {
	id: string;
	name: string;
	batchDebitBalance: string;
	batchCreditBalance: string;
	state: "OPEN" | "DISPUTED" | "SETTLED";
	batchAccounts?: ISettlementMatrixBatchAccount[];
}

export interface ISettlementMatrixBatchAccount {
	id: string;
	participantId: string;
	accountExtId: string;
	debitBalance: string;
	creditBalance: string;
}



