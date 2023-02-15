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
 * - Jason Bruwer <jason.bruwer@coil.com>
 --------------
 ******/

"use strict";

import axios, {AxiosError, AxiosInstance, AxiosResponse} from "axios";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {ISettlementTransferDto} from "@mojaloop/settlements-bc-public-types-lib";

export class AuxiliarySettlementsHttpClient {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	// Other properties.
	private readonly httpClient: AxiosInstance;

	constructor(
		logger: ILogger,
		baseUrlHttpService: string,
		timeoutMs: number,
		accessToken: string
	) {
		this.logger = logger;

		this.httpClient = axios.create({
			baseURL: baseUrlHttpService,
			timeout: timeoutMs
		});
		// "headers: {"Authorization": `Bearer ${accessToken}`}" could be passed to axios.create(), but that way, due
		// to a bug, it wouldn't be possible to change the access token later.
		this.setAccessToken(accessToken);
	}

	setAccessToken(accessToken: string): void {
		this.httpClient.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
	}

	async createSettlementTransfer(settleTransferDto: ISettlementTransferDto): Promise<number> {
		try {
			const axiosResponse: AxiosResponse = await this.httpClient.post("/transfer", settleTransferDto);
			return axiosResponse.status;
		} catch (error) {
			return (error as AxiosError).response?.status ?? -1;
		}
	}
}
