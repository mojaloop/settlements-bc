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
	SettlementsAggregate,
	InvalidCreditAccountError,
	InvalidCurrencyCodeError,
	InvalidDebitAccountError,
	InvalidExternalIdError,
	InvalidTimestampError,
	SettlementBatchNotFoundError,
	UnableToGetAccountError,
	UnauthorizedError,
	SettlementMatrixNotFoundError,
	SettlementMatrixIsBusyError,
	SettlementMatrixIsClosedError,
	ISettlementBatchRepo,
	ISettlementMatrixRequestRepo,
	ISettlementBatchTransferRepo,
	CreateStaticMatrixCmd,
	CreateStaticMatrixCmdPayload,
	RecalculateMatrixCmd,
	CloseMatrixCmd,
	CreateDynamicMatrixCmd,
	CreateDynamicMatrixCmdPayload
} from "@mojaloop/settlements-bc-domain-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-public-types-lib";
import {
ISettlementBatchTransfer,
} from "@mojaloop/settlements-bc-public-types-lib";
import express from "express";
import {ITokenHelper} from "@mojaloop/security-bc-public-types-lib";
import {randomUUID} from "crypto";
import {IMessageProducer} from "@mojaloop/platform-shared-lib-messaging-types-lib/dist/index";

// Extend express request to include our security fields.
declare module "express-serve-static-core" {
	export interface Request {
		securityContext: CallSecurityContext | null;
	}
}

export class ExpressRoutes {
	private readonly _logger: ILogger;
	private readonly _tokenHelper: ITokenHelper;
	// private readonly _aggregate: SettlementsAggregate;
	private readonly _batchRepo: ISettlementBatchRepo;
	private readonly _batchTransferRepo: ISettlementBatchTransferRepo;
	private readonly _matrixRepo: ISettlementMatrixRequestRepo;
	private readonly _messageProducer: IMessageProducer;
	private static readonly UNKNOWN_ERROR_MESSAGE: string = "unknown error";
	private readonly _router: express.Router;

	constructor(
		logger: ILogger,
		tokenHelper: ITokenHelper,
		batchRepo: ISettlementBatchRepo,
		batchTransferRepo: ISettlementBatchTransferRepo,
		matrixRepo: ISettlementMatrixRequestRepo,
		messageProducer: IMessageProducer,
		// aggregate: SettlementsAggregate
	) {
		this._logger = logger.createChild(this.constructor.name);
		this._tokenHelper = tokenHelper;
		this._batchRepo = batchRepo;
		this._batchTransferRepo = batchTransferRepo;
		this._matrixRepo = matrixRepo;
		this._messageProducer = messageProducer;
		// this._aggregate = aggregate;

		this._router = express.Router();

		// NOTE: ORDER MATTERS HERE!!!

		// Inject authentication - all requests require a valid token.
		this._router.use(this._authenticationMiddleware.bind(this)); // All requests require authentication.
		
		// transfer inject
		// this is for tests only, normal path is though events (event/command handler)
		// this._router.post("/transfer", this.postHandleTransfer.bind(this));

		// Batches
		this._router.get("/batches/:id", this.getSettlementBatch.bind(this));
		this._router.get("/batches", this.getSettlementBatches.bind(this));
		// this._router.get("/settlement_accounts", this.getSettlementBatchAccounts.bind(this)); // TODO is this necessary? batches already have the accounts
		this._router.get("/transfers", this.getSettlementBatchTransfers.bind(this));

		// Settlement Matrix:
		this._router.post("/matrix", this.postCreateDynamicMatrix.bind(this));

		// request recalculation of matrix
		this._router.post("/matrix/:id/recalculate", this.postRecalculateMatrix.bind(this));
		// request execution/closure of matrix
		this._router.post("/matrix/:id/close", this.postCloseSettlementMatrix.bind(this));
		// request dispute of matrix
		this._router.post("/matrix/static", this.postCreateStaticMatrix.bind(this));
		// get matrix by id - static get, no recalculate
		this._router.get("/matrix/:id", this.getSettlementMatrix.bind(this));
		// get matrices - static get, no recalculate
		this._router.get("/matrix", this.getSettlementMatrices.bind(this));
	}


	private async _authenticationMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
		const authorizationHeader = req.headers["authorization"];

		if (!authorizationHeader)
			return res.sendStatus(401);

		const bearer = authorizationHeader.trim().split(" ");
		if (bearer.length!=2 || !bearer[1]) {
			return res.sendStatus(401);
		}

		const bearerToken = bearer[1];
		let verified;
		try {
			verified = await this._tokenHelper.verifyToken(bearerToken);
		} catch (err) {
			this._logger.error(err, "unable to verify token");
			return res.sendStatus(401);
		}
		if (!verified) {
			return res.sendStatus(401);
		}

		const decoded = this._tokenHelper.decodeToken(bearerToken);
		if (!decoded.sub || decoded.sub.indexOf("::")== -1) {
			return res.sendStatus(401);
		}

		const subSplit = decoded.sub.split("::");
		const subjectType = subSplit[0];
		const subject = subSplit[1];

		req.securityContext = {
			accessToken: bearerToken,
			clientId: subjectType.toUpperCase().startsWith("APP") ? subject:null,
			username: subjectType.toUpperCase().startsWith("USER") ? subject:null,
			rolesIds: decoded.roles
		};

		return next();
	}

	get MainRouter(): express.Router {
		return this._router;
	}

	/*
	// this is for tests only, normal path is though events (event/command handler)
	private async postHandleTransfer(req: express.Request, res: express.Response): Promise<void> {
		try {
			this._logger.debug(`Settlement postHandleTransfer - Transfer Req Body: ${JSON.stringify(req.body)}`);
			const batchId = await this._aggregate.handleTransfer(req.securityContext!, req.body);
			this.sendSuccessResponse(res, 202, batchId);
			return;
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized");// TODO: verify.
			} else if (error instanceof InvalidExternalIdError) {
				this.sendErrorResponse(res, 400, "invalid external id");
			} else if (error instanceof InvalidCurrencyCodeError) {
				this.sendErrorResponse(res, 400, "invalid currency code");
			} else if (error instanceof InvalidCreditAccountError) {
				this.sendErrorResponse(res, 400, "invalid credit account id");
			} else if (error instanceof InvalidDebitAccountError) {
				this.sendErrorResponse(res, 400, "invalid debit account id");
			} else if (error instanceof UnableToGetAccountError) {
				this.sendErrorResponse(res, 400, "invalid account");
			} else if (error instanceof InvalidTimestampError) {
				this.sendErrorResponse(res, 400, "invalid timestamp");
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}
	*/

	private async getSettlementBatch(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		const batchId = req.params.id as string;
		try {
			this._logger.debug(`Got getSettlementBatch request for batchId: ${batchId}`);
			const settlementBatch = await this._batchRepo.getBatch(batchId);
			if(!settlementBatch){
				res.sendStatus(404);
				return;
			}
			this.sendSuccessResponse(res, 200, settlementBatch);// OK
		} catch (error: any) {
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementBatches(req: express.Request, res: express.Response): Promise<void> {
		const batchName = req.query.batchName as string || req.query.batchname as string;
		const settlementModel = req.query.settlementModel as string;
		const currencyCode = req.query.currencyCode as string;
		const fromDate = req.query.fromDate as string;
		const toDate = req.query.toDate as string;

		// TODO enforce privileges

		try {
			if(batchName){
				const settlementBatches = await this._batchRepo.getBatchesByName(
					batchName
				);
				if (!settlementBatches || settlementBatches.length<=0) {
					res.sendStatus(404);
					return;
				}
				this.sendSuccessResponse(res, 200, settlementBatches);// OK
			}else{
				this._logger.debug(`got getSettlementBatches request - Now is [${Date.now()}] Settlement Batches from [${new Date(Number(fromDate))}] to [${new Date(Number(toDate))}] on [${settlementModel}].`);

				const settlementBatches = await this._batchRepo.getBatchesByCriteria(
					Number(fromDate),
					Number(toDate),
					currencyCode,
					settlementModel
				);
				if (!settlementBatches || settlementBatches.length <= 0) {
					res.sendStatus(404);
					return;
				}
				this.sendSuccessResponse(res, 200, settlementBatches);// OK
			}
		} catch (error: any) {
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementBatchTransfers(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges
		const batchId = req.query.batchId as string || req.query.batchid as string;
		const batchName = req.query.batchName as string || req.query.batchname as string;
		const transferId = req.query.transferId as string || req.query.transferid as string;
		const matrixId = req.query.matrixId as string || req.query.matrixid as string;
		try {
			let settlementTransfers:ISettlementBatchTransfer[];
			if(batchId){
				settlementTransfers = await this._batchTransferRepo.getBatchTransfersByBatchIds([batchId]);
			}else if(batchName){
				settlementTransfers = await this._batchTransferRepo.getBatchTransfersByBatchNames([batchName]);
			}else if(transferId){
				settlementTransfers = await this._batchTransferRepo.getBatchTransfersByTransferId(transferId);
			}else if(matrixId){
				const matrix = await this._matrixRepo.getMatrixById(matrixId);
				if(!matrix){
					res.status(404).json({message: "matrix not found"});
					return;
				}
				const batchIds = matrix.batches.map(item => item.id);
				settlementTransfers = await this._batchTransferRepo.getBatchTransfersByBatchIds(batchIds);
			}else{
				settlementTransfers = await this._batchTransferRepo.getBatchTransfers();
			}

			if (!settlementTransfers || settlementTransfers.length <= 0) {
				res.sendStatus(404);
				return;
			}
			this.sendSuccessResponse(res, 200, settlementTransfers);// OK
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof SettlementBatchNotFoundError) {
				this.sendErrorResponse(res, 400, error.message);
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async postCreateDynamicMatrix(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		try {
			const matrixId = req.body.matrixiId || randomUUID();
			const currencyCode = req.body.currencyCode;
			const settlementModel = req.body.settlementModel;
			const fromDate = req.body.fromDate;
			const toDate = req.body.toDate;

			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (matrix) {
				return this.sendErrorResponse(res,400, "Matrix with the same id already exists");
			}

			const cmdPayload:CreateDynamicMatrixCmdPayload = {
				matrixId: matrixId,
				fromDate: fromDate,
				toDate: toDate,
				currencyCode: currencyCode,
				settlementModel: settlementModel
			};
			const cmd = new CreateDynamicMatrixCmd(cmdPayload);

			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, {id: matrixId});
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async postRecalculateMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			const matrixId = req.params.id as string;
			const includeNewBatches = req.body.includeNewBatches as string;

			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if(!matrix){
				return this.sendErrorResponse(res,404, "Matrix not found");
			}

			const cmd = new RecalculateMatrixCmd({
				matrixId:matrixId,
				includeNewBatches: Boolean(includeNewBatches) || true
			});
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, {id: matrixId});
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof SettlementMatrixIsClosedError || error instanceof SettlementMatrixIsBusyError) {
				this.sendErrorResponse(res, 406, error.message);
			} else if (error instanceof SettlementMatrixNotFoundError) {
				this.sendErrorResponse(res, 404, error.message);
			}else if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			}else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}


	private async postCloseSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			const matrixId = req.params.id as string;

			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if(!matrix){
				return this.sendErrorResponse(res,404, "Matrix not found");
			}

			const cmd = new CloseMatrixCmd({matrixId:matrixId});
			await this._messageProducer.send(cmd);


			this.sendSuccessResponse(res, 202, {id: matrixId});
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof SettlementMatrixIsClosedError || error instanceof SettlementMatrixIsBusyError) {
				this.sendErrorResponse(res, 406, error.message);
			} else if (error instanceof SettlementMatrixNotFoundError) {
				this.sendErrorResponse(res, 404, error.message);
			} else if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async postCreateStaticMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			const matrixId = req.params.id as string;
			const disputePayloadReq = req.body as CreateStaticMatrixCmdPayload;

			const cmd = new CreateStaticMatrixCmd(disputePayloadReq);
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, {id: matrixId});
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof SettlementMatrixIsClosedError || error instanceof SettlementMatrixIsBusyError) {
				this.sendErrorResponse(res, 406, error.message);
			} else if (error instanceof SettlementMatrixNotFoundError) {
				this.sendErrorResponse(res, 404, error.message);
			} else if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async getSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		try {
			const id = req.params.id as string;

			const resp = await this._matrixRepo.getMatrixById(id);
			if(!resp){
				return this.sendErrorResponse(res, 404, "Matrix not found");
			}
			this.sendSuccessResponse(res, 200, resp);// OK
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else if (error instanceof SettlementMatrixNotFoundError) {
				this.sendErrorResponse(res, 404, error.message);
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async getSettlementMatrices(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		try {
			const state = req.params.state as string;

			const resp = await this._matrixRepo.getMatrices(state ?? null);

			if(!resp || resp.length<=0){
				return this.sendErrorResponse(res, 404, "No matrices found");
			}
			this.sendSuccessResponse(res, 200, resp);// OK
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else if (error instanceof SettlementMatrixNotFoundError) {
				this.sendErrorResponse(res, 404, error.message);
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}


	private sendErrorResponse(res: express.Response, statusCode: number, message: string) {
		res.status(statusCode).json({message: message});
	}

	private sendSuccessResponse(res: express.Response, statusCode: number, data: any) {
		res.status(statusCode).json(data);
	}

}
