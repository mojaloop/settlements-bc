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

export interface ISettlementConfigDto {
	id: string;
	settlementModel: string;
	batchCreateInterval: number;
}

export interface ISettlementBatchDto {
	id: string;
	timestamp: number;
	settlementModel: string;
	currency: string | null;
	batchSequence: number;
	batchIdentifier: string | null;// FX.XOF:RWF.2021.08.23.00.00.001
	batchStatus: SettlementBatchStatus | null;
}

export interface ISettlementBatchAccountDto {
	id: string | null;
	externalId: string | null;
	settlementBatch?: ISettlementBatchDto | null;
	currencyCode: string;
	currencyDecimals: number | null;
	creditBalance: string;
	debitBalance: string;
	timestamp: number | null;
}

export interface IParticipantAccountBatchMappingDto {
	participantId: string;
	settlementBatchId: string;
	settlementBatchAccountId: string;
}

export interface ISettlementTransferDto {
	id: string | null;
	externalId: string | null;
	currencyCode: string;
	currencyDecimals: number | null;
	amount: string;
	debitParticipantAccountId: string;
	creditParticipantAccountId: string;
	timestamp: number;
	settlementModel: string;
	batch?: ISettlementBatchDto | null;
}

/*******************
* Settlement Matrix
********************/
/**Matrix Request**/
export interface ISettlementMatrixRequestDto {
	id: string;
	timestamp: number;
	dateFrom: number;
	dateTo: number;
	settlementModel: string;
	batches: ISettlementBatchDto[];// Batches to include for the request.
}

/**Matrix**/
export interface ISettlementMatrixSettlementBatchAccountDto {
	id: string;
	externalId: string;
	currencyCode: string;
	creditBalance: string;
	debitBalance: string;
}

export interface ISettlementMatrixBatchDto {
	batchIdentifier: string;
	batchStatus: SettlementBatchStatus;
	batchStatusNew: SettlementBatchStatus;
	currencyCode: string;
	creditBalance: string;
	debitBalance: string;
	batchAccounts: ISettlementMatrixSettlementBatchAccountDto[];
}

export interface ISettlementMatrixDto {
	fromDate: number;
	toDate: number;
	settlementModel: string;
	generationDuration: number
	batches: ISettlementMatrixBatchDto[];
}

export enum SettlementBatchStatus {
	OPEN = "OPEN",
	CLOSED = "CLOSED"
}
