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

import {SettlementModel, SettlementBatchStatus, ISettlementBatchDto} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementBatch {
	id: string;
	timestamp: number;
	settlementModel: SettlementModel;
	debitCurrency: string;
	creditCurrency: string;
	batchSequence: number;
	batchIdentifier: string;// FX.XOF:RWF.2021.08.23.00.00.001
	batchStatus: SettlementBatchStatus;

	constructor(
		id: string,
		timestamp: number,
		settlementModel: SettlementModel,
		debitCurrency: string,
		creditCurrency: string,
		batchSequence: number,
		batchIdentifier: string,
		batchStatus: SettlementBatchStatus
	) {
		this.id = id;
		this.timestamp = timestamp;
		this.settlementModel = settlementModel;
		this.debitCurrency = debitCurrency;
		this.creditCurrency = creditCurrency;
		this.batchSequence = batchSequence;
		this.batchIdentifier = batchIdentifier;
		this.batchStatus = batchStatus;
	}

	toDto(): ISettlementBatchDto {
		const batchDto: ISettlementBatchDto = {
			id: this.id,
			timestamp: this.timestamp,
			settlementModel: this.settlementModel,
			debitCurrency: this.debitCurrency,
			creditCurrency: this.creditCurrency,
			batchSequence: this.batchSequence,
			batchIdentifier: this.batchIdentifier,
			batchStatus: this.batchStatus
		};
		return batchDto;
	}
}
