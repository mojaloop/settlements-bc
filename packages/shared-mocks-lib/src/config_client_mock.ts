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

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    IBoundedContextConfigurationClient,
    IConfigurationClient, IGlobalConfigurationClient
} from "@mojaloop/platform-configuration-bc-public-types-lib";
import {BoundedContextConfigurationClientMock, GlobalConfigurationClientMock} from "./configurationset_wrappers";

const BC_NAME = "settlements-bc";
const packageJSON = require("../package.json");
const APP_VERSION = packageJSON.version;
const APP_NAME = "settlements-svc";

export class ConfigurationClientMock implements IConfigurationClient {
    private _changeHandlerFn: (type:"BC"|"GLOBAL")=>void;

	// Properties received through the constructor.
	private readonly logger: ILogger;

	constructor(logger: ILogger) {
		this.logger = logger;
	}

    get applicationName(): string {
        return APP_NAME;
    }

    get applicationVersion(): string {
        return APP_VERSION;
    }

    get boundedContextName(): string {
        return BC_NAME;
    }

	async init(): Promise<void> {
		return;
	}

	async destroy(): Promise<void> {
		return;
	}

    fetch(): Promise<void> {
        return Promise.resolve(undefined);
    }

    bootstrap(ignoreDuplicateError?: boolean): Promise<boolean> {
        return Promise.resolve(true);
    }

    setChangeHandlerFunction(fn: (type: ("BC" | "GLOBAL")) => void): void {
        this._changeHandlerFn = fn;
    }

    get bcConfigs(): IBoundedContextConfigurationClient {
        return new BoundedContextConfigurationClientMock();
    }

    get globalConfigs(): IGlobalConfigurationClient {
        return new GlobalConfigurationClientMock();
    }
}
