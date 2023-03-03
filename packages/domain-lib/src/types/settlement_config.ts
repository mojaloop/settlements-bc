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

import {ISettlementConfig} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementConfig implements ISettlementConfig{
	id: string;
	settlementModel: string;
	batchCreateInterval: number;// [seconds]

	constructor(
		id: string,
		model: string,
		batchCreateInterval: number
	) {
		this.id = id;
		this.settlementModel = model;
		this.batchCreateInterval = batchCreateInterval;
	}

	static fromDto(dto: ISettlementConfig): SettlementConfig{
		return new SettlementConfig(
			dto.id,
			dto.settlementModel,
			dto.batchCreateInterval
		);
	}

	calculateBatchStartTimestamp(timestamp:number):number{
		// this will round down to the batchCreateInterval in seconds (removing the remainder)
		// returns in milliseconds format
		// eg: if seconds are 18 and interval is 10 will be 10
		// eg: if seconds are 31 and interval is 30 will be 30
		// eg: if seconds are 31 and interval is 60 will be 00
		if(!(typeof (timestamp)==="number"))
			throw new Error("Invalid timestamp in calculateBatchStartTimestamp");
		return Math.floor(timestamp / 1000 / this.batchCreateInterval) * this.batchCreateInterval * 1000;
	}

	toDto(): ISettlementConfig {
		const configDto: ISettlementConfig = {
			id: this.id,
			settlementModel: this.settlementModel,
			batchCreateInterval: this.batchCreateInterval,
		};
		return configDto;
	}
}
