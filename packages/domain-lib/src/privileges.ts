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

export enum Privileges {
	// NOTE: commenting this as privileges are only for user or other service actions, not automatic actions by self
	CREATE_SETTLEMENT_TRANSFER = "CREATE_SETTLEMENT_TRANSFER",

	CREATE_DYNAMIC_SETTLEMENT_MATRIX = "CREATE_DYNAMIC_SETTLEMENT_MATRIX",
	CREATE_STATIC_SETTLEMENT_MATRIX = "CREATE_STATIC_SETTLEMENT_MATRIX",
	CREATE_SETTLEMENT_CONFIG = "CREATE_SETTLEMENT_CONFIG",

	SETTLEMENTS_CLOSE_MATRIX = "SETTLEMENTS_CLOSE_MATRIX",
	SETTLEMENTS_SETTLE_MATRIX = "SETTLEMENTS_SETTLE_MATRIX",
	SETTLEMENTS_DISPUTE_MATRIX = "SETTLEMENTS_DISPUTE_MATRIX",
	SETTLEMENTS_LOCK_MATRIX = "SETTLEMENTS_LOCK_MATRIX",
	SETTLEMENTS_UNLOCK_MATRIX = "SETTLEMENTS_UNLOCK_MATRIX",

	GET_SETTLEMENT_MATRIX = "GET_SETTLEMENT_MATRIX",
	RETRIEVE_SETTLEMENT_BATCH = "RETRIEVE_SETTLEMENT_BATCH"
}
