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

import {ISettlementTransferDto, ISettlementBatchDto, ISettlementBatchAccountDto} from "@mojaloop/settlements-bc-public-types-lib";
import {bigintToString} from "../converters";
import {SettlementBatch} from "./batch";

export class SettlementTransfer {
	id: string;
	externalId: string | null;
	currencyCode: string;
	currencyDecimals: number;
	amount: bigint;
	debitAccountId: string;
	creditAccountId: string;
	batch: SettlementBatch;
	timestamp: number;

	constructor(
		id: string,
		externalId: string,
		currencyCode: string,
		currencyDecimals: number,
		amount: bigint,
		creditAccountId: string,
		debitAccountId: string,
		batch: SettlementBatch,
		timestamp: number
	) {
		this.id = id;
		this.externalId = externalId;
		this.currencyCode = currencyCode;
		this.currencyDecimals = currencyDecimals;
		this.amount = amount;
		this.debitAccountId = debitAccountId;
		this.creditAccountId = creditAccountId;
		this.batch = batch;
		this.timestamp = timestamp;
	}

	toDto(): ISettlementTransferDto {
		const amount: string = bigintToString(this.amount, this.currencyDecimals);
		const batch: ISettlementBatchDto = this.batch.toDto();
		const debitAcc: ISettlementBatchAccountDto = {
			id: this.debitAccountId,
			externalId: null,
			settlementBatch: null,
			currencyCode: "",
			currencyDecimals: null,
			creditBalance: "",
			debitBalance: "",
			timestamp: null
		};
		const creditAcc: ISettlementBatchAccountDto = {
			id: this.creditAccountId,
			externalId: null,
			settlementBatch: null,
			currencyCode: "",
			currencyDecimals: null,
			creditBalance: "",
			debitBalance: "",
			timestamp: null
		};

		const transferDto: ISettlementTransferDto = {
			id: this.id,
			externalId: this.externalId,
			currencyCode: this.currencyCode,
			currencyDecimals: this.currencyDecimals,
			amount: amount,
			debitAccount: debitAcc,
			creditAccount: creditAcc,
			batch,
			timestamp: this.timestamp
		};
		return transferDto;
	}
}
