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
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAuthenticatedHttpRequester} from "@mojaloop/security-bc-public-types-lib";
import {
	DEFAULT_SETTLEMENT_MODEL_ID,
	ISettlementConfig,
	ISettlementModelClient
} from "@mojaloop/settlements-bc-public-types-lib";

// default 1 minute cache
const MAX_CACHE_AGE_MS = 1 * 60 * 1000;

export class SettlementModelClient implements ISettlementModelClient {
	private readonly _logger: ILogger;
	private readonly _baseUrlHttpService: string;
	private readonly _authRequester: IAuthenticatedHttpRequester;
	private readonly _cacheTimeoutMs: number;

	private _models:ISettlementConfig[] = [];
	private _lastFetchTimestamp: number = 0;

	constructor(
		logger: ILogger,
		baseUrlHttpService: string,
		authRequester: IAuthenticatedHttpRequester,
		cacheTimeoutMs: number = MAX_CACHE_AGE_MS
	) {
		this._logger = logger.createChild(this.constructor.name);
		this._baseUrlHttpService = baseUrlHttpService;
		this._authRequester = authRequester;
		this._cacheTimeoutMs = cacheTimeoutMs;
	}

	private async _update():Promise<void>{
		if(this._models.length>0 && (Date.now() <= this._lastFetchTimestamp + this._cacheTimeoutMs)){
			return;
		}

		try {
			const url = new URL("/models/", this._baseUrlHttpService).toString();
			const resp = await this._authRequester.fetch(url);

			if(resp.status != 200){
				throw new Error("SettlementModelClient could not get settlement models");
			}

			const data = await resp.json();
			this._models = data;
			this._lastFetchTimestamp = Date.now();
		} catch (e: any) {
			this._logger.error(e);
			if (e instanceof Error) throw e;

			// handle everything else
			throw new Error("SettlementModelClient could not get settlement models - " + e.toString());
		}
	}

	async init(): Promise<void> {
		// do a first update, to fail at start if auth or api is bad
		await this._update();

		return Promise.resolve();
	}

	async destroy(): Promise<void> {
		return Promise.resolve();
	}

	async getSettlementModelId(
		transferAmount: string,
		payerCurrency: string | null,
		payeeCurrency: string | null,
		extensionList: { key: string; value: string; }[]
	): Promise<string> {
		await this._update(); // won't do anything if cache is still valid

		// TODO decide model based on conditions - use models from initialization step (sourced from settlements' api)

		// For now, just return the default id
		return Promise.resolve(DEFAULT_SETTLEMENT_MODEL_ID);
	}
}

/*
export function obtainSettlementModelFrom(
	transferAmount: bigint,
	debitAccountCurrency: string | null,
	creditAccountCurrency: string | null,
	extensionList: { key: string; value: string;}[]
) : Promise<string> {
	if (debitAccountCurrency === null || creditAccountCurrency===null)
		return Promise.resolve('DEFAULT');
	if (debitAccountCurrency !== creditAccountCurrency) {
		return Promise.resolve('FX');
	} else
		return Promise.resolve('DEFAULT');

	// TODO we need to unpack REMITTANCE
}
*/
