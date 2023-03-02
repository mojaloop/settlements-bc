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
	InvalidExternalIdError, InvalidTimestampError,
	SettlementBatchNotFoundError,
	UnableToGetAccountError,
	UnauthorizedError, SettlementMatrixNotFoundError, SettlementMatrixIsBusyError, SettlementMatrixIsClosedError
} from "@mojaloop/settlements-bc-domain-lib";
import {CallSecurityContext} from "@mojaloop/security-bc-client-lib";
import {
ISettlementBatchTransfer,
} from "@mojaloop/settlements-bc-public-types-lib";
import express from "express";
import {ITokenHelper} from "@mojaloop/security-bc-public-types-lib/dist/index";

// Extend express request to include our security fields.
declare module "express-serve-static-core" {
	export interface Request {
		securityContext: CallSecurityContext | null;
	}
}

export class ExpressRoutes {
	private readonly _logger: ILogger;
	private readonly _tokenHelper: ITokenHelper;
	private readonly _aggregate: SettlementsAggregate;
	private static readonly UNKNOWN_ERROR_MESSAGE: string = "unknown error";
	private readonly _router: express.Router;

	constructor(
		logger: ILogger,
		tokenHelper: ITokenHelper,
		aggregate: SettlementsAggregate
	) {
		this._logger = logger.createChild(this.constructor.name);
		this._tokenHelper = tokenHelper;
		this._aggregate = aggregate;

		this._router = express.Router();

		// NOTE: ORDER MATTERS HERE!!!

		// Inject authentication - all requests require a valid token.
		this._router.use(this._authenticationMiddleware.bind(this)); // All requests require authentication.
		
		// transfer inject
		// this is for tests only, normal path is though events (event/command handler)
		this._router.post("/transfer", this.postHandleTransfer.bind(this));

		// Batches
		this._router.get("/batches/:id", this.getSettlementBatch.bind(this));
		this._router.get("/batches", this.getSettlementBatches.bind(this));
		// this._router.get("/settlement_accounts", this.getSettlementBatchAccounts.bind(this)); // TODO is this necessary? batches already have the accounts
		this._router.get("/transfers", this.getSettlementBatchTransfers.bind(this));


		// Settlement Matrix

		// create matrix
		this._router.post("/matrix", this.postCreateMatrix.bind(this));

		// request recalculation of matrix
		this._router.post("/matrix/:id/recalculate", this.postRecalculateMatrix.bind(this));
		// request execution/closure of matrix
		this._router.post("/matrix/:id/close", this.postCloseSettlementMatrix.bind(this));
		// get matrix by id - static get, no recalculate
		this._router.get("/matrix/:id", this.getSettlementMatrix.bind(this));
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

	private async getSettlementBatch(req: express.Request, res: express.Response): Promise<void> {
		const batchId = req.params.id as string;
		try {
			this._logger.debug(`Got getSettlementBatch request for bathchId: ${batchId}`);
			const settlementBatch = await this._aggregate.getSettlementBatch(req.securityContext!, batchId);
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
		try {
			if(batchName){
				this._logger.debug(`got getSettlementBatches request - batchName: ${batchName}`);
				const settlementBatches = await this._aggregate.getSettlementBatchesByName(
					req.securityContext!,
					batchName
				);
				if (!settlementBatches || settlementBatches.length<=0) {
					res.sendStatus(404);
					return;
				}
				this.sendSuccessResponse(res, 200, settlementBatches);// OK
			}else{
				this._logger.debug(`got getSettlementBatches request - Now is [${Date.now()}] Settlement Batches from [${new Date(Number(fromDate))}] to [${new Date(Number(toDate))}] on [${settlementModel}].`);
				const settlementBatches = await this._aggregate.getSettlementBatchesByCriteria(
					req.securityContext!,
					settlementModel,
					currencyCode,
					Number(fromDate),
					Number(toDate)
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
		const batchId = req.query.batchId as string || req.query.batchid as string;
		const batchName = req.query.batchName as string || req.query.batchname as string;
		try {
			let settlementTransfers:ISettlementBatchTransfer[];
			if(batchId){
				settlementTransfers = await this._aggregate.getSettlementBatchTransfersByBatchId(
					req.securityContext!, batchId
				);
			}else if(batchName){
				settlementTransfers = await this._aggregate.getSettlementBatchTransfersByBatchName(
					req.securityContext!, batchName
				);
			}else{
				settlementTransfers = [];
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

	private async postCreateMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			const currencyCode = req.body.currencyCode;
			const settlementModel = req.body.settlementModel;
			const fromDate = req.body.fromDate;
			const toDate = req.body.toDate;

			const matrixId = await this._aggregate.createSettlementMatrix(
				req.securityContext!,
				settlementModel,
				currencyCode,
				Number(fromDate),
				Number(toDate)
			);
			this.sendSuccessResponse(res, 202, matrixId);
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
			await this._aggregate.recalculateSettlementMatrix(req.securityContext!, matrixId);

			this.sendSuccessResponse(res, 202, matrixId);
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


	/*
	* Old below
	* */

	private async postCloseSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			const id = req.params.id as string;
			await this._aggregate.closeSettlementMatrix(req.securityContext!, id);
			this.sendSuccessResponse(res, 202, null);
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
		try {
			const id = req.params.id as string;

			const resp = await this._aggregate.getSettlementMatrix(req.securityContext!, id);
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



/*	private async getSettlementBatchAccounts(req: express.Request, res: express.Response): Promise<void> {
		const batchIdentifier = req.query.batchIdentifier as string;
		const batchId = req.query.batchId as string;
		try {
			let settlementAccounts = [];
			if (batchId !== null && batchId !== undefined && batchId.trim().length > 0) {
				settlementAccounts = await this._aggregate.getSettlementBatch(
					batchId, req.securityContext!);
			} else {
				settlementAccounts = await this._aggregate.getSettlementBatchAccountsByBatchIdentifier(
					batchIdentifier, req.securityContext!);
			}
			this.sendSuccessResponse(res, 200, settlementAccounts);// OK
		} catch (error: any) {
			this._logger.error(error);
			if (error instanceof SettlementBatchNotFoundError) {
				this.sendErrorResponse(res, 400, error.message);
			} else {
				this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}*/


	private sendErrorResponse(res: express.Response, statusCode: number, message: string) {
		res.status(statusCode).json({message: message});
	}

	private sendSuccessResponse(res: express.Response, statusCode: number, data: any) {
		res.status(statusCode).json(data);
	}

}
