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

import {IAuthorizationClient} from "@mojaloop/security-bc-public-types-lib";

/* eslint-disable @typescript-eslint/no-unused-vars */

export class AuthorizationClientMock implements IAuthorizationClient {
	// Properties received through the constructor.
	private readonly hasPrivilege: boolean;

	constructor(hasPrivilege : boolean) {
		this.hasPrivilege = hasPrivilege;
	}

	async init(): Promise<void> {
		return;
	}

	async destroy(): Promise<void> {
		return;
	}

	roleHasPrivilege(roleId: string, privilegeId: string): boolean {
		return this.hasPrivilege;
	}

	rolesHavePrivilege(roleIds: string[], privilegeId: string): boolean {
		return this.hasPrivilege;
	}

	addPrivilege(privId: string, labelName: string, description: string): void {
		// mock
	}

	addPrivilegesArray(privsArray: { privId: string; labelName: string; description: string }[]): void {
		// mock
	}
}
