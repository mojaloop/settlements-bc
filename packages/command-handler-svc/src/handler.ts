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

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

"use strict";
import {IAuditClient} from "@mojaloop/auditing-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IMessage,IMessageConsumer, CommandMsg} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {SettlementsBCTopics} from "@mojaloop/platform-shared-lib-public-messages-lib";

import {
	CloseMatrixCmd, CloseMatrixCmdPayload,
	CreateStaticMatrixCmd, CreateStaticMatrixCmdPayload,
	CreateDynamicMatrixCmd, CreateDynamicMatrixCmdPayload,
	ProcessTransferCmd, RecalculateMatrixCmd, RecalculateMatrixCmdPayload,
	SettlementsAggregate
} from "@mojaloop/settlements-bc-domain-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-public-types-lib/dist/index";
import {MLKafkaJsonConsumer} from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib/dist/rdkafka_json_consumer";
import {ILoginHelper, ITokenHelper, UnauthorizedError} from "@mojaloop/security-bc-public-types-lib";

export class SettlementsCommandHandler{
	private _logger: ILogger;
	private _auditClient: IAuditClient;
	private _messageConsumer: IMessageConsumer;
	private _settlementsAgg: SettlementsAggregate;
	private _loginHelper: ILoginHelper;

    constructor(logger: ILogger, auditClient:IAuditClient, messageConsumer: IMessageConsumer, agg: SettlementsAggregate, loginHelper:ILoginHelper) {
		this._logger = logger.createChild(this.constructor.name);
		this._auditClient = auditClient;
		this._messageConsumer = messageConsumer;
		this._settlementsAgg = agg;
		this._loginHelper = loginHelper;
	}

	async start():Promise<void>{
		this._messageConsumer.setTopics([SettlementsBCTopics.DomainRequests]);
		this._messageConsumer.setCallbackFn(this._msgHandler.bind(this));
		await this._messageConsumer.connect();
		await this._messageConsumer.start();

		return new Promise<void>((resolve, reject) => {
			// create and start the consumer handler
			(this._messageConsumer as MLKafkaJsonConsumer).on("rebalance", async (type: "assign" | "revoke", assignments: any) => {
				if (type==="assign") {
					resolve();
				}
			});
		});
	}

	private async _msgHandler(message: IMessage): Promise<void>{
		// eslint-disable-next-line no-async-promise-executor
		return await new Promise<void>(async (resolve) => {
			this._logger.debug(`Got message in TransfersCommandHandler with name: ${message.msgName}`);
			try {
				const sectCtx = await this._getServiceSecContext();

				switch (message.msgName) {
					case ProcessTransferCmd.name:
						await this._settlementsAgg.processTransferCmd(sectCtx, message as ProcessTransferCmd);
						break;
					case CreateDynamicMatrixCmd.name:
						// eslint-disable-next-line no-case-declarations
						const createPayload = message.payload as CreateDynamicMatrixCmdPayload;
						await this._settlementsAgg.createDynamicSettlementMatrix(
							sectCtx,
							createPayload.matrixId,
							createPayload.settlementModel,
							createPayload.currencyCode,
							createPayload.fromDate,
							createPayload.toDate
						);
						break;
					case RecalculateMatrixCmd.name:
						// eslint-disable-next-line no-case-declarations
						const recalcPayload = message.payload as RecalculateMatrixCmdPayload;
						await this._settlementsAgg.recalculateSettlementMatrix(
							sectCtx,
							recalcPayload.matrixId
						);
						break;
					case CloseMatrixCmd.name:
						// eslint-disable-next-line no-case-declarations
						const closePayload = message.payload as CloseMatrixCmdPayload;
						await this._settlementsAgg.closeSettlementMatrix(
							sectCtx,
							closePayload.matrixId
						);
						break;
					case CreateStaticMatrixCmd.name:
						// eslint-disable-next-line no-case-declarations
						const staticMatrix = message.payload as CreateStaticMatrixCmdPayload;
						await this._settlementsAgg.createStaticSettlementMatrix(
							sectCtx,
							staticMatrix.matrixId,
							staticMatrix.batchIds,
							staticMatrix.batchStateOutcome
						);
						break;
					default: {
						this._logger.isWarnEnabled() && this._logger.warn(`TransfersCommandHandler - unknown command - msgName: ${message?.msgName} msgKey: ${message?.msgKey} msgId: ${message?.msgId}`);
					}
				}

			}catch(err: unknown){
				this._logger.error(err, `TransfersCommandHandler - processing command - ${message?.msgName}:${message?.msgKey}:${message?.msgId} - Error: ${(err as Error)?.message?.toString()}`);
			}finally {
				resolve();
			}
		});
	}

	private async _getServiceSecContext():Promise<CallSecurityContext>{
		// this will only fetch a new token when the current one is expired or null
		const token = await this._loginHelper.getToken();
		if(!token){
			throw new UnauthorizedError("Could not get a token for SettlementsCommandHandler");
		}

		// TODO producing a CallSecurityContext from a token should be from the security client lib, not here
		const secCts: CallSecurityContext = {
			clientId: token.payload.azp,
			accessToken: token.accessToken,
			rolesIds:token.payload.roles,
			username: null
		};
		return secCts;
	}


	async stop():Promise<void>{
		await this._messageConsumer.stop();
	}

}
