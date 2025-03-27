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

* Coil

* - Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import nock from "nock";

export class AuthenticationServiceMock {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	// Other properties.
	static readonly ISSUER_NAME: string = "http://localhost:3201/";
	static readonly JWKS_URL: string = "http://localhost:3201/.well-known/jwks.json";
	static readonly AUDIENCE: string = "mojaloop.vnext.default_audience";
	static readonly VALID_ACCESS_TOKEN: string = "VALID_ACCESS_TOKEN_GOES_HERE";

	constructor(logger: ILogger) {
		this.logger = logger;

		this.setUp();
	}

	private setUp(): void {
		const jwksUrl = new URL(AuthenticationServiceMock.JWKS_URL); // TODO: verify.
		nock(jwksUrl.origin)
		.persist()
		.get(jwksUrl.pathname)
		.reply(
			200,
			{
				"keys": [
					{
						"kty": "RSA",
						"kid": "sR0uhOhi3NUnbe11yH6m9FmpZM7bbEYvs7ilc_jsu0s",
						"n": "u_I1vrX2yWHmRL9iS9FQSJh2u7wmV_uOz540V78vo6A6bGxjKplgxGdlRhKtFCkE1qt3E4L_67DU2HdXW_IfpyPlIUi-P-dL0RhjSnxDFG371J-N3iq09ZXGZ9W5iyVU9b9Fi0nahHkOFjXHT6mqHniYmSpOo8UHqtd3--r_Pk16Eid58GwuLgMb5VMmD-PdvxF57s6LKydNF49TJlAofQ47NEhW1C8tOJh73ri452GpBv8n6lAZrB0KWrON3Wzvw7ZWb4IuCc2kltiZs68C2URErUafysQYc7lWDDIN4isHOV3_JVXIZDzlZIjsnNTCUGvk0D2poTIg0Kjr_hqkaQ",
						"e": "AQAB"
					}
				]
			}
		);
	}
}
