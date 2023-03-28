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
	ISettlementBatch, ISettlementMatrix, ISettlementMatrixBatch, ISettlementMatrixParticipantBalance

} from "@mojaloop/settlements-bc-public-types-lib";
import {randomUUID} from "crypto";
import now = jest.now;

// internal to settlements BC, domain and infra, should not go to public clients

/*export interface ISettlementMatrixBatch {
	id: string;
	name: string;
	currencyCode: string;

	batchDebitBalance: string;
	batchCreditBalance: string;
	batchTransferCount: number;

	isClosed: boolean;
	batchWasClosedBeforeExec: boolean;

	// not persisted - only populated on output - for api responses
	batchAccounts?: ISettlementMatrixBatchAccountResponse[];
}

export interface ISettlementMatrix {
	id: string;
	createdAt: number;
	updatedAt: number;

	// criteria
	dateFrom: number;
	dateTo: number;
	settlementModel: string;

	batches: ISettlementMatrixBatch[];// Batches found everytime the matrix is recalculated
	// closedBatchesIds: string[]; // batches that were closed with the matrix execution

	isClosed: boolean;
	generationDuration: number;
	totalDebitBalance: string;
	totalCreditBalance: string;
	totalTransferCount: number;
}*/

export class SettlementMatrix implements ISettlementMatrix{
	id: string;
	createdAt: number;
	updatedAt: number;

	dateFrom: number;
	dateTo: number;
	currencyCode: string;
	settlementModel: string;

	batches: ISettlementMatrixBatch[];
	participantBalances: ISettlementMatrixParticipantBalance[];

	state: "IDLE" | "CALCULATING" | "CLOSING" | "CLOSED";

	generationDurationSecs: number | null;
	totalDebitBalance: string;
	totalCreditBalance: string;

	constructor(
		dateFrom: number,
		dateTo: number,
		currencyCode: string,
		settlementModel: string,
	) {
		this.id = randomUUID();
		this.createdAt = this.updatedAt = Date.now();
		this.dateFrom = dateFrom;
		this.dateTo = dateTo;
		this.currencyCode = currencyCode;
		this.settlementModel = settlementModel;

		this.state = "IDLE";

		this.batches  = [];
		this.participantBalances = [];
		this.totalDebitBalance = "0";
		this.totalCreditBalance = "0";
	}

	addBatch(batch: ISettlementBatch, debitBalance: string, creditBalance: string):void{
		this.batches.push({
			id: batch.id,
			name: batch.batchName,
			batchDebitBalance: debitBalance,
			batchCreditBalance: creditBalance,
			state: batch.state,
		});
	}

	clear(){
		this.batches = [];
		this.participantBalances = [];
		this.totalDebitBalance = "0";
		this.totalCreditBalance = "0";
	}

	static FromDto(dto: ISettlementMatrix):SettlementMatrix{
		const newInstance = new SettlementMatrix(dto.dateFrom, dto.dateTo, dto.currencyCode, dto.settlementModel);

		newInstance.id = dto.id;
		newInstance.createdAt = dto.createdAt;
		newInstance.updatedAt = dto.updatedAt;
		newInstance.state = dto.state;

		newInstance.batches = dto.batches;
		newInstance.participantBalances = dto.participantBalances;

		newInstance.generationDurationSecs = dto.generationDurationSecs;
		newInstance.totalDebitBalance = dto.totalDebitBalance;
		newInstance.totalCreditBalance = dto.totalCreditBalance;

		return newInstance;
	}
}
