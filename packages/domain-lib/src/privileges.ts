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
	CREATE_SETTLEMENT_BATCH_ACCOUNT = "SETTLEMENTS_CREATE_BATCH_ACCOUNT",
	CREATE_SETTLEMENT_BATCH = "SETTLEMENTS_CREATE_BATCH",
	CREATE_SETTLEMENT_TRANSFER = "SETTLEMENTS_CREATE_TRANSFER",
	CREATE_DYNAMIC_SETTLEMENT_MATRIX = "SETTLEMENTS_CREATE_DYNAMIC_MATRIX",
	CREATE_STATIC_SETTLEMENT_MATRIX = "SETTLEMENTS_CREATE_STATIC_MATRIX",
	CREATE_SETTLEMENT_CONFIG = "SETTLEMENTS_CREATE_MODEL",

	SETTLEMENTS_CLOSE_MATRIX = "SETTLEMENTS_CLOSE_MATRIX",
	SETTLEMENTS_SETTLE_MATRIX = "SETTLEMENTS_SETTLE_MATRIX",
	SETTLEMENTS_DISPUTE_MATRIX = "SETTLEMENTS_DISPUTE_MATRIX",
	SETTLEMENTS_LOCK_MATRIX = "SETTLEMENTS_LOCK_MATRIX",
	SETTLEMENTS_UNLOCK_MATRIX = "SETTLEMENTS_UNLOCK_MATRIX",

	// TODO: separate the create matrix from recalculate
	GET_SETTLEMENT_MATRIX = "SETTLEMENTS_GET_MATRIX",
	RETRIEVE_SETTLEMENT_BATCH = "SETTLEMENTS_RETRIEVE_BATCH",
	RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS = "SETTLEMENTS_RETRIEVE_BATCH_ACCOUNTS",
	RETRIEVE_SETTLEMENT_TRANSFERS = "SETTLEMENTS_RETRIEVE_TRANSFERS",
	MARK_SETTLEMENT_MATRIX_OUT_OF_SYNC = "MARK_SETTLEMENT_MATRIX_OUT_OF_SYNC"
}
