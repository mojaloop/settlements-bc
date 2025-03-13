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
 *  - Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

export enum Privileges {
	// NOTE: commenting this as privileges are only for user or other service actions, not automatic actions by self
	CREATE_SETTLEMENT_TRANSFER = "CREATE_SETTLEMENT_TRANSFER",

	CREATE_SETTLEMENT_MATRIX = "CREATE_SETTLEMENT_MATRIX",
	CREATE_SETTLEMENT_CONFIG = "CREATE_SETTLEMENT_CONFIG",
	VIEW_SETTLEMENT_CONFIG = "VIEW_SETTLEMENT_CONFIG",

	SETTLEMENTS_CLOSE_MATRIX = "SETTLEMENTS_CLOSE_MATRIX",
	SETTLEMENTS_SETTLE_MATRIX = "SETTLEMENTS_SETTLE_MATRIX",
	SETTLEMENTS_DISPUTE_MATRIX = "SETTLEMENTS_DISPUTE_MATRIX",
	SETTLEMENTS_LOCK_MATRIX = "SETTLEMENTS_LOCK_MATRIX",
	SETTLEMENTS_UNLOCK_MATRIX = "SETTLEMENTS_UNLOCK_MATRIX",

	// TODO: separate the create matrix from recalculate
	REMOVE_SETTLEMENT_MATRIX_BATCH = "REMOVE_SETTLEMENT_MATRIX_BATCH",
	// RETRIEVE_SETTLEMENT_BATCH_ACCOUNTS = "SETTLEMENTS_RETRIEVE_BATCH_ACCOUNTS",
	// RETRIEVE_SETTLEMENT_TRANSFERS = "SETTLEMENTS_RETRIEVE_TRANSFERS"

	GET_SETTLEMENT_MATRIX = "GET_SETTLEMENT_MATRIX",
	RETRIEVE_SETTLEMENT_BATCH = "RETRIEVE_SETTLEMENT_BATCH"

}


export const SettlementPrivilegesDefinition = [
    {
        privId: Privileges.CREATE_SETTLEMENT_MATRIX,
        labelName: "Create Settlement Matrix",
        description: "Allows the creation of a settlement matrix."
    },

	{
        privId: Privileges.CREATE_SETTLEMENT_CONFIG,
        labelName: "Create Settlement Model",
        description: "Allows the creation of settlement model."
    },

	{
        privId: Privileges.VIEW_SETTLEMENT_CONFIG,
        labelName: "View Settlement Model",
        description: "Allows the retrievel of settlement model."
    },

	{
        privId: Privileges.SETTLEMENTS_CLOSE_MATRIX,
        labelName: "Close Settlement Matrix",
        description: "Allows the closing of a settlement matrix."
    },

	{
        privId: Privileges.SETTLEMENTS_DISPUTE_MATRIX,
        labelName: "Dispute Settlement Matrix",
        description: "Allows the dispute of a settlement matrix."
    },

	{
        privId: Privileges.SETTLEMENTS_SETTLE_MATRIX,
        labelName: "Settle Matrix",
        description: "Allows the settling of a settlement matrix."
    },

	{
        privId: Privileges.SETTLEMENTS_LOCK_MATRIX,
        labelName: "Lock Matrix",
        description: "Allows the locking of a settlement matrix."
    },

	{
        privId: Privileges.SETTLEMENTS_UNLOCK_MATRIX,
        labelName: "Unlock Matrix",
        description: "Allows the unlocking of a settlement matrix."
    },

	{
        privId: Privileges.GET_SETTLEMENT_MATRIX,
        labelName: "Get Matrix",
        description: "Allows the retrieval of a settlement matrix request."
    },

	{
        privId: Privileges.RETRIEVE_SETTLEMENT_BATCH,
        labelName: "Get Settlement batch",
        description: "Allows the retrieval of a settlement batch."
    },

	{
        privId: Privileges.REMOVE_SETTLEMENT_MATRIX_BATCH,
        labelName: "Remove Settlement Matrix from Batch",
        description: "Allows the retrieval of a settlement batch."
    },

];

