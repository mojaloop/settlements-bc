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
	Aggregate,
	InvalidCreditAccountError,
	InvalidCurrencyCodeError,
	InvalidDebitAccountError,
	InvalidExternalIdError, InvalidTimestampError,
	SettlementBatchNotFoundError, SettlementMatrixRequestClosedError,
	UnableToGetAccountError,
	UnauthorizedError
} from "@mojaloop/settlements-bc-domain-lib";
import {TokenHelper, CallSecurityContext} from "@mojaloop/security-bc-client-lib";
import {
	ISettlementTransferDto,
	ISettlementMatrixDto, ISettlementMatrixRequestDto
} from "@mojaloop/settlements-bc-public-types-lib";
import {NextFunction, Request, Response, Router} from "express";

const BEARER_LENGTH: number = 2; // TODO: why 2?

// Extend express request to include our security fields. TODO: clarify.
declare module "express-serve-static-core" {
	export interface Request {
		securityContext: CallSecurityContext | null;
	}
}

export class ExpressRoutes {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	private readonly tokenHelper: TokenHelper;
	private readonly aggregate: Aggregate;
	// Other properties.
	private static readonly UNKNOWN_ERROR_MESSAGE: string = "unknown error";
	private readonly _router: Router;

	constructor(
		logger: ILogger,
		tokenHelper: TokenHelper,
		aggregate: Aggregate
	) {
		this.logger = logger;
		this.tokenHelper = tokenHelper;
		this.aggregate = aggregate;

		this._router = Router();
		this.setUp();
	}

	private setUp(): void {
		// Inject authentication - all requests require a valid token. TODO: Need to provide.
		this._router.use(this.authenticate.bind(this)); // All requests require authentication.
		// Posts:
		this._router.post("/transfer", this.postSettlementTransfer.bind(this));

		// Gets:
		this._router.get("/settlement_batches", this.getSettlementBatches.bind(this));
		this._router.get("/settlement_accounts", this.getSettlementBatchAccounts.bind(this));
		this._router.get("/settlement_transfers", this.getSettlementBatchTransfers.bind(this));

		this._router.get("/settlement_matrix_request", this.getSettlementMatrixRequest.bind(this));

		// Settlement Matrix:
		this._router.post("/settlement_matrix_request", this.postSettlementMatrixRequest.bind(this));
		this._router.get("/execute_settlement_matrix", this.postExecuteSettlementMatrix.bind(this));
	}

	get router(): Router {
		return this._router;
	}

	// TODO: name; NextFunction; clarify; why returns? logs vs error responses. all status codes 403?
	private async authenticate(
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> {
		if (true) {
			this.logger.info('authenticate!!! this.authenticate.bind(this) is temporarily disabled:');
			next();
			return;
		}

		const authorizationHeader: string | undefined = req.headers["authorization"]; // TODO: type.
		if (authorizationHeader === undefined) {
			this.sendErrorResponse(res, 403, "unauthorized");// TODO: verify.
			return;
		}

		const bearer: string[] = authorizationHeader!.trim().split(" "); // TODO: name.
		if (bearer.length != BEARER_LENGTH) {
			this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			return;
		}

		const bearerToken: string = bearer[1];
		let verified: boolean;
		try {
			verified = await this.tokenHelper.verifyToken(bearerToken);
		} catch (error: unknown) {
			this.logger.error(error);
			this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			return;
		}
		if (!verified) {
			this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			return;
		}

		const decodedToken: any = this.tokenHelper.decodeToken(bearerToken); // TODO: type.
		if (decodedToken === undefined // TODO: undefined?
			|| decodedToken === null // TODO: null?
			|| decodedToken.sub.indexOf("::") === -1) {
			this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			return;
		}

		const subSplit = decodedToken.sub.split("::"); // TODO: type.
		const subjectType = subSplit[0]; // TODO: type.
		const subject = subSplit[1]; // TODO: type.

		req.securityContext = {
			username: subjectType.toUpperCase().startsWith("USER") ? subject : null, // TODO: null?
			clientId: subjectType.toUpperCase().startsWith("APP") ? subject : null, // TODO: null?
			rolesIds: decodedToken.roles,
			accessToken: bearerToken
		};
		next();
	}

	private async postSettlementTransfer(req: Request, res: Response): Promise<void> {
		try {
			this.logger.debug(`Settlement Transfer Req Body: ${JSON.stringify(req.body)}`);
			const settlementTransfer: ISettlementTransferDto = await this.aggregate.createSettlementTransfer(req.body, req.securityContext!);
			this.sendSuccessResponse(res, 201,
				{
					settlementTransferId: settlementTransfer.id,
					batchId: settlementTransfer.batch!.id,
					batchIdentifier: settlementTransfer.batch!.batchIdentifier
				}
			); // Created
		} catch (error: any) {
			this.logger.error(error);
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
				this.sendErrorResponse(res, 500, ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async postExecuteSettlementMatrix(req: Request, res: Response): Promise<void> {
		try {
			const settlementMatrixReqId = req.query.settlementMatrixReqId as string;

			const settlementMatrix: ISettlementMatrixDto = await this.aggregate.executeSettlementMatrix(
				settlementMatrixReqId, req.securityContext!);
			this.sendSuccessResponse(res, 200, settlementMatrix);// OK
		} catch (error: any) {
			this.logger.error(error);
			if (error instanceof SettlementMatrixRequestClosedError) {
				this.sendErrorResponse(res, 406, error.message);
			} else if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else {
				this.sendErrorResponse(res, 500, ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}

		}
	}

	private async postSettlementMatrixRequest(req: Request, res: Response): Promise<void> {
		try {
			const settlementModel = req.query.settlementModel as string;
			const fromDate = req.query.fromDate as string;
			const toDate = req.query.toDate as string;

			const settlementMatrixReq: ISettlementMatrixRequestDto = await this.aggregate.settlementMatrixRequest(
				settlementModel,
				Number(fromDate),
				Number(toDate),
				req.securityContext!
			);
			this.sendSuccessResponse(res, 200, settlementMatrixReq);// OK
		} catch (error: unknown) {
			this.logger.error(error);
			if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else {
				this.sendErrorResponse(res, 500, ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async getSettlementMatrixRequest(req: Request, res: Response): Promise<void> {
		try {
			const settlementMatrixRequestId = req.query.settlementMatrixRequestId as string;

			const settlementMatrixReq: ISettlementMatrixRequestDto = await this.aggregate.getSettlementMatrixRequestById(
				settlementMatrixRequestId, req.securityContext!);
			this.sendSuccessResponse(res, 200, settlementMatrixReq);// OK
		} catch (error: unknown) {
			this.logger.error(error);
			if (error instanceof UnauthorizedError) {
				this.sendErrorResponse(res, 403, "unauthorized"); // TODO: verify.
			} else {
				this.sendErrorResponse(res, 500, ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async getSettlementBatches(req: Request, res: Response): Promise<void> {
		const settlementModel = req.query.settlementModel as string;
		const fromDate = req.query.fromDate as string;
		const toDate = req.query.toDate as string;
		try {
			this.logger.debug(`Now is [${Date.now()}] Settlement Batches from [${new Date(Number(fromDate))}] to [${new Date(Number(toDate))}] on [${settlementModel}].`);
			const settlementBatches = await this.aggregate.getSettlementBatches(
				settlementModel,
				Number(fromDate),
				Number(toDate),
				req.securityContext!
			);
			this.sendSuccessResponse(res, 200, settlementBatches);// OK
		} catch (error: any) {
			this.logger.error(error);
			this.sendErrorResponse(res, 500, ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementBatchAccounts(req: Request, res: Response): Promise<void> {
		const batchIdentifier = req.query.batchIdentifier as string;
		const batchId = req.query.batchId as string;
		try {
			let settlementAccounts = [];
			if (batchId !== null && batchId !== undefined && batchId.trim().length > 0) {
				settlementAccounts = await this.aggregate.getSettlementBatchAccountsByBatchId(
					batchId, req.securityContext!);
			} else {
				settlementAccounts = await this.aggregate.getSettlementBatchAccountsByBatchIdentifier(
					batchIdentifier, req.securityContext!);
			}
			this.sendSuccessResponse(res, 200, settlementAccounts);// OK
		} catch (error: any) {
			this.logger.error(error);
			if (error instanceof SettlementBatchNotFoundError) {
				this.sendErrorResponse(res, 400, error.message);
			} else {
				this.sendErrorResponse(res, 500, ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private async getSettlementBatchTransfers(req: Request, res: Response): Promise<void> {
		const batchIdentifier = req.query.batchIdentifier as string;
		const batchId = req.query.batchId as string;
		try {
			let settlementTransfers = [];
			if (batchId !== null && batchId !== undefined && batchId.trim().length > 0) {
				settlementTransfers = await this.aggregate.getSettlementBatchTransfersByBatchId(
					batchId, req.securityContext!);
			} else {
				settlementTransfers = await this.aggregate.getSettlementBatchTransfersByBatchIdentifier(
					batchIdentifier, req.securityContext!);
			}
			this.sendSuccessResponse(res, 200, settlementTransfers);// OK
		} catch (error: any) {
			this.logger.error(error);
			if (error instanceof SettlementBatchNotFoundError) {
				this.sendErrorResponse(res, 400, error.message);
			} else {
				this.sendErrorResponse(res, 500, ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
			}
		}
	}

	private sendErrorResponse(res: Response, statusCode: number, message: string) {
		res.status(statusCode).json({message: message});
	}

	private sendSuccessResponse(res: Response, statusCode: number, data: any) {
		res.status(statusCode).json(data);
	}

}
