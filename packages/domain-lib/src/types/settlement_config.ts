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

import {SettlementModel, ISettlementConfigDto} from "@mojaloop/settlements-bc-public-types-lib";
import {bigintToString} from "../converters";
import {SettlementBatch} from "./batch";

export class SettlementConfig {
	id: string;
	model: SettlementModel;
	batchCreateInterval: number;// [seconds]

	constructor(
		id: string,
		model: SettlementModel,
		batchCreateInterval: number
	) {
		this.id = id;
		this.model = model;
		this.batchCreateInterval = batchCreateInterval;
	}

	calculateBatchFromDate(timestamp : number) : number {
		return 1;//TODO calculate the fram
	}

	calculateBatchToDate(timestamp : number) : number {
		return 2;//TODO calculate the to
	}

	toDto(): ISettlementConfigDto {
		const configDto: ISettlementConfigDto = {
			id: this.id,
			settlementModel: this.model,
			batchCreateInterval: this.batchCreateInterval,
		};
		return configDto;
	}
}
