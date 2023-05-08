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
import {IMessage,IMessageConsumer, IMessageProducer, CommandMsg} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
	SettlementsBCTopics,
	TransfersBCTopics,
	TransferCommittedFulfiledEvtPayload,
	TransferCommittedFulfiledEvt
} from "@mojaloop/platform-shared-lib-public-messages-lib";
import {ProcessTransferCmd, ProcessTransferCmdPayload} from "@mojaloop/settlements-bc-domain-lib";


export class SettlementsEventHandler{
	private _logger: ILogger;
	private _auditClient: IAuditClient;
	private _messageConsumer: IMessageConsumer;
	private _messageProducer: IMessageProducer;

	constructor(logger: ILogger, auditClient:IAuditClient, messageConsumer: IMessageConsumer, messageProducer: IMessageProducer) {
		this._logger = logger.createChild(this.constructor.name);
		this._auditClient = auditClient;
		this._messageConsumer = messageConsumer;
		this._messageProducer = messageProducer;
	}

	async start():Promise<void>{
		// connect the producer
		await this._messageProducer.connect();

		// create and start the consumer handler
		this._messageConsumer.setTopics([TransfersBCTopics.DomainEvents]);

		this._messageConsumer.setCallbackFn(this._msgHandler.bind(this));
		await this._messageConsumer.connect();
		await this._messageConsumer.start();
	}

	private async _msgHandler(message: IMessage): Promise<void>{
		// eslint-disable-next-line no-async-promise-executor
		return await new Promise<void>(async (resolve) => {
			this._logger.debug(`Got message in SettlementsEventHandler with name: ${message.msgName}`);
			try {
				let settlementsCmd: CommandMsg | null = null;

				switch (message.msgName) {
					case TransferCommittedFulfiledEvt.name:
						// TODO make sure transferState === COMPLETED (should always be the case in a TransferCommittedFulfiledEvt
						// eslint-disable-next-line no-case-declarations
						//const msgPayload = message.payload as TransferCommittedFulfiledEvtPayload;
						// eslint-disable-next-line no-case-declarations
						settlementsCmd = this._TransferCommittedFulfiledEvtToProcessTransfCmd(message as TransferCommittedFulfiledEvt);
						break;

					default: {
						this._logger.isWarnEnabled() && this._logger.warn(`SettlementsEventHandler - Skipping unknown event - msgName: ${message?.msgName} msgKey: ${message?.msgKey} msgId: ${message?.msgId}`);
					}
				}

				if (settlementsCmd) {
					this._logger.info(`SettlementsEventHandler - publishing cmd - ${message?.msgName}:${message?.msgKey}:${message?.msgId} - Cmd: ${settlementsCmd.msgName}:${settlementsCmd.msgId}`);
					await this._messageProducer.send(settlementsCmd);
					this._logger.info(`SettlementsEventHandler - publishing cmd Finished - ${message?.msgName}:${message?.msgKey}:${message?.msgId}`);
				}
			}catch(err: unknown){
				this._logger.error(err, `SettlementsEventHandler - processing event - ${message?.msgName}:${message?.msgKey}:${message?.msgId} - Error: ${(err as Error)?.message?.toString()}`);
			}finally {
				resolve();
			}
		});
	}

	private _TransferCommittedFulfiledEvtToProcessTransfCmd(evt: TransferCommittedFulfiledEvt): ProcessTransferCmd {
		const cmdPayload: ProcessTransferCmdPayload = {
			transferId: evt.payload.transferId,
			completedTimestamp: evt.payload.completedTimestamp!,
			payerFspId: evt.payload.payerFspId,
			payeeFspId: evt.payload.payeeFspId,
			currencyCode: evt.payload.currencyCode,
			amount: evt.payload.amount,
			settlementModel: evt.payload.settlementModel,
		};

		const cmd = new ProcessTransferCmd(cmdPayload);
		return cmd;
	}

	async stop():Promise<void>{
		await this._messageConsumer.stop();
	}
}