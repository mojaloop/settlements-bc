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

import {ISettlementBatchAccountDto} from "@mojaloop/settlements-bc-public-types-lib";
import {bigintToString} from "../converters";

export class SettlementBatchAccount {
	id: string;
	participantAccountId: string | null;
	currencyCode: string;
	currencyDecimals: number;
	creditBalance: bigint;
	debitBalance: bigint;
	timestamp: number;

	constructor(
		id: string,
		participantAccountId: string,
		currencyCode: string,
		currencyDecimals: number,
		creditBalance: bigint,
		debitBalance: bigint,
		timestamp: number
	) {
		this.id = id;
		this.participantAccountId = participantAccountId;
		this.currencyCode = currencyCode;
		this.currencyDecimals = currencyDecimals;
		this.creditBalance = creditBalance;
		this.debitBalance = debitBalance;
		this.timestamp = timestamp;
	}

	toDto(): ISettlementBatchAccountDto {
		const creditBalance: string = bigintToString(this.creditBalance, this.currencyDecimals);
		const debitBalance: string = bigintToString(this.debitBalance, this.currencyDecimals);

		const accountDto: ISettlementBatchAccountDto = {
			id: this.id,
			participantAccountId: this.participantAccountId,
			settlementBatch: null,
			currencyCode: this.currencyCode,
			currencyDecimals: this.currencyDecimals,
			creditBalance: creditBalance,
			debitBalance: debitBalance,
			timestamp: this.timestamp
		};
		return accountDto;
	}

	calculateAvailableBalance(): bigint {
		const balance: bigint = (this.creditBalance - this.debitBalance);
		return balance;
	}
}
