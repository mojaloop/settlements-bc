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
 * - Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

import {ISettlementConfigRepo} from "@mojaloop/settlements-bc-domain-lib";
import {
	DEFAULT_SETTLEMENT_MODEL_ID,
	DEFAULT_SETTLEMENT_MODEL_NAME,
	ISettlementConfig
} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementConfigRepoMock implements ISettlementConfigRepo {

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	storeConfig(config: ISettlementConfig): Promise<void>{
		throw new Error("not implemented");
	}

	async getAllSettlementConfigs(): Promise<ISettlementConfig[]>{
		return Promise.resolve([{
			id: DEFAULT_SETTLEMENT_MODEL_ID,
			settlementModel: DEFAULT_SETTLEMENT_MODEL_NAME,
			batchCreateInterval: 5000,
			isActive: true,
			createdBy: "admin",
			createdDate: 1686654836126,
			changeLog: []
		}]);
	}

	async getSettlementConfig(id: string): Promise<ISettlementConfig | null> {
		const returnVal : ISettlementConfig = {
			id: id,
			settlementModel: DEFAULT_SETTLEMENT_MODEL_NAME,
			batchCreateInterval: 5000,
			isActive: true,
			createdBy: "admin",
			createdDate: 1686654836126,
			changeLog: []
		};
		return Promise.resolve(returnVal);
	}

	async getSettlementConfigByModelName(modelName: string): Promise<ISettlementConfig | null> {
		const returnVal : ISettlementConfig = {
			id: DEFAULT_SETTLEMENT_MODEL_ID,
			settlementModel: modelName,
			batchCreateInterval: 5000,
			isActive: true,
			createdBy: "admin",
			createdDate: 1686654836126,
			changeLog: []
		};
		return Promise.resolve(returnVal);
	}
}
