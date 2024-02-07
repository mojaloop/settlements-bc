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

import { ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {
	ISettlementBatchRepo,
	ISettlementMatrixRequestRepo,
	ISettlementBatchTransferRepo,
	CreateStaticMatrixCmd,
	CreateStaticMatrixCmdPayload,
	RecalculateMatrixCmd,
	CloseMatrixCmd,
	CreateDynamicMatrixCmd,
	CreateDynamicMatrixCmdPayload,
	SettleMatrixCmd,
	DisputeMatrixCmd,
	AddBatchesToMatrixCmdPayload,
	AddBatchesToMatrixCmd,
	RemoveBatchesFromMatrixCmdPayload,
	RemoveBatchesFromMatrixCmd,
	CreateSettlementModelCmd, LockMatrixCmd, UnlockMatrixCmd
} from "@mojaloop/settlements-bc-domain-lib";
import { CallSecurityContext, ForbiddenError, UnauthorizedError } from "@mojaloop/security-bc-public-types-lib";
import {
	BatchSearchResults, BatchTransferSearchResults, ISettlementConfig
} from "@mojaloop/settlements-bc-public-types-lib";
import express from "express";
import { ITokenHelper, IAuthorizationClient } from "@mojaloop/security-bc-public-types-lib";
import { randomUUID } from "crypto";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { CommandMsg } from "@mojaloop/platform-shared-lib-messaging-types-lib/dist/index";
import { ISettlementConfigRepo } from "@mojaloop/settlements-bc-domain-lib/dist/index";
import { Privileges } from "@mojaloop/settlements-bc-domain-lib/dist/privileges";

// Extend express request to include our security fields.
declare module "express-serve-static-core" {
	export interface Request {
		securityContext: CallSecurityContext | null;
	}
}

const MAX_ENTRIES_PER_PAGE = 100;

export class ExpressRoutes {
	private readonly _logger: ILogger;
	private readonly _tokenHelper: ITokenHelper;
	// private readonly _aggregate: SettlementsAggregate;
	private readonly _configRepo: ISettlementConfigRepo;
	private readonly _batchRepo: ISettlementBatchRepo;
	private readonly _batchTransferRepo: ISettlementBatchTransferRepo;
	private readonly _matrixRepo: ISettlementMatrixRequestRepo;
	private readonly _messageProducer: IMessageProducer;
	private static readonly UNKNOWN_ERROR_MESSAGE: string = "unknown error";
	private readonly _router: express.Router;
	private readonly _authorizationClient: IAuthorizationClient;

	constructor(
		logger: ILogger,
		tokenHelper: ITokenHelper,
		configRepo: ISettlementConfigRepo,
		batchRepo: ISettlementBatchRepo,
		batchTransferRepo: ISettlementBatchTransferRepo,
		matrixRepo: ISettlementMatrixRequestRepo,
		messageProducer: IMessageProducer,
		authorizationClient: IAuthorizationClient
	) {
		this._logger = logger.createChild(this.constructor.name);
		this._tokenHelper = tokenHelper;
		this._batchRepo = batchRepo;
		this._configRepo = configRepo;
		this._batchTransferRepo = batchTransferRepo;
		this._matrixRepo = matrixRepo;
		this._messageProducer = messageProducer;
		this._authorizationClient = authorizationClient;

		this._router = express.Router();

		// NOTE: ORDER MATTERS HERE!!!

		// Inject authentication - all requests require a valid token.
		this._router.use(this._authenticationMiddleware.bind(this)); // All requests require authentication.

		// transfer inject
		// this is for tests only, normal path is though events (event/command handler)
		// this._router.post("/transfer", this.postHandleTransfer.bind(this));

		// models
		this._router.get("/models", this.getSettlementModels.bind(this));
		this._router.get("/models/:id", this.getSettlementModelById.bind(this));
		this._router.post("/models", this.postCreateSettlementModel.bind(this));

		// Batches
		this._router.get("/batches/:id", this.getSettlementBatch.bind(this));
		this._router.get("/batches", this.getSettlementBatches.bind(this));
		// this._router.get("/settlement_accounts", this.getSettlementBatchAccounts.bind(this)); // TODO is this necessary? batches already have the accounts
		this._router.get("/transfers", this.getSettlementBatchTransfers.bind(this));

		// Settlement Matrix:
		this._router.post("/matrix", this.postCreateMatrix.bind(this));
		this._router.post("/matrix/:id/batches", this.postAddBatchToStaticMatrix.bind(this));
		this._router.delete("/matrix/:id/batches", this.postRemoveBatchFromStaticMatrix.bind(this));

		// request recalculation of matrix
		this._router.post("/matrix/:id/recalculate", this.postRecalculateMatrix.bind(this));
		// request closure of a matrix
		this._router.post("/matrix/:id/close", this.postCloseSettlementMatrix.bind(this));
		// request settlement of a matrix
		this._router.post("/matrix/:id/settle", this.postSettleSettlementMatrix.bind(this));
		// request dispute of a matrix
		this._router.post("/matrix/:id/dispute", this.postDisputeSettlementMatrix.bind(this));
		// get matrix by id - static get, no recalculate
		this._router.get("/matrix/:id", this.getSettlementMatrix.bind(this));
		// get matrices - static get, no recalculate
		this._router.get("/matrix", this.getSettlementMatrices.bind(this));

		// request lock of a matrix
		this._router.post("/matrix/:id/lock", this.postLockSettlementMatrix.bind(this));
		// request un-lock of a matrix
		this._router.post("/matrix/:id/unlock", this.postUnlockSettlementMatrix.bind(this));
	}


	private async _authenticationMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
		const authorizationHeader = req.headers["authorization"];

		if (!authorizationHeader)
			return res.sendStatus(401);

		const bearer = authorizationHeader.trim().split(" ");
		if (bearer.length != 2 || !bearer[1]) {
			return res.sendStatus(401);
		}

		const bearerToken = bearer[1];

		const callSecCtx: CallSecurityContext | null = await this._tokenHelper.getCallSecurityContextFromAccessToken(bearerToken);

		if (!callSecCtx) {
			return res.sendStatus(401);
		}

		req.securityContext = callSecCtx;

		return next();
	}

	// add enforcingPrivilege 
	private _enforcePrivilege(secCtx: CallSecurityContext, privName: string): void {
		for (const roleId of secCtx.platformRoleIds) {
			if (this._authorizationClient.roleHasPrivilege(roleId, privName)) return;
		}
		throw new ForbiddenError(`Required privilege "${privName}" not held by caller`);
	}

	// handle unauthorize
	protected _handleUnauthorizedError(err: Error, res: express.Response): boolean {
		if (err instanceof UnauthorizedError) {
			this._logger.warn(err.message);
			res.status(401).json({
				status: "error",
				msg: err.message,
			});
			return true;
		} else if (err instanceof ForbiddenError) {
			this._logger.warn(err.message);
			res.status(403).json({
				status: "error",
				msg: err.message,
			});
			return true;
		}

		return false;
	}

	get MainRouter(): express.Router {
		return this._router;
	}

	private async getSettlementModels(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges


		const name = req.query.name as string;
		try {
			this._enforcePrivilege(req.securityContext!, Privileges.VIEW_SETTLEMENT_CONFIG);
			let retModels: ISettlementConfig[] = [];
			if (name) {
				this._logger.debug(`Got getSettlementModels request for model name: ${name}`);
				const found = await this._configRepo.getSettlementConfigByModelName(name);
				if (found) retModels.push(found);
			} else {
				this._logger.debug("Got getSettlementModels request");
				retModels = await this._configRepo.getAllSettlementConfigs();
			}

			this.sendSuccessResponse(res, 200, retModels);
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementModelById(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		const modelId = req.params.id as string;
		try {
			this._enforcePrivilege(req.securityContext!, Privileges.VIEW_SETTLEMENT_CONFIG);
			this._logger.debug(`Got getSettlementModels request for modelId: ${modelId}`);
			const settlementModel = await this._configRepo.getSettlementConfig(modelId);
			if (!settlementModel) {
				res.sendStatus(404);
				return;
			}
			this.sendSuccessResponse(res, 200, settlementModel);// OK
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postCreateSettlementModel(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		let id = req.body.id;
		const name = req.body.settlementModel;
		const batchCreateInterval = req.body.batchCreateInterval;
		const createdBy = req.body.createdBy;

		try {
			this._enforcePrivilege(req.securityContext!, Privileges.CREATE_SETTLEMENT_CONFIG)
			if (!name) {
				this._logger.warn("Invalid Name on Settlement Model creation");
				return this.sendErrorResponse(res, 400, "Invalid Name on Settlement Model creation");
			}

			const existingModelName = await this._configRepo.getSettlementConfigByModelName(name);
			if (existingModelName) {
				this._logger.warn("Duplicate Model Name on Settlement Model creation");
				return this.sendErrorResponse(res, 400, "Duplicate Model Name on Settlement Model creation");
			}

			if (!id) id = name.toUpperCase();
			const existingModelId = await this._configRepo.getSettlementConfig(id);
			if (existingModelId) {
				this._logger.warn("Duplicate Model ID on Settlement Model creation");
				return this.sendErrorResponse(res, 400, "Duplicate Model ID on Settlement Model creation");
			}

			this._logger.debug(`Got postCreateSettlementModel request for model name: ${name}`);


			const cmd = new CreateSettlementModelCmd({
				id: id,
				settlementModel: name,
				batchCreateInterval: batchCreateInterval,
				createdBy: createdBy,
			});


			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: id });

			this._logger.debug(`Settlement Model created, with id: '${id}'`);
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementBatch(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		const batchId = req.params.id as string;
		try {
			this._enforcePrivilege(req.securityContext!, Privileges.RETRIEVE_SETTLEMENT_BATCH);
			this._logger.debug(`Got getSettlementBatch request for batchId: ${batchId}`);
			const settlementBatch = await this._batchRepo.getBatch(batchId);
			if (!settlementBatch) {
				res.sendStatus(404);
				return;
			}
			this.sendSuccessResponse(res, 200, settlementBatch);// OK
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementBatches(req: express.Request, res: express.Response): Promise<void> {

		const fromDate = req.query.fromDate as string;
		const toDate = req.query.toDate as string;
		const settlementModel = req.query.settlementModel as string || req.query.settlementmodel as string;
		const batchName = req.query.batchName as string || req.query.batchname as string;

		let currencyCodesStr = req.query.currencyCodes as string;
		let batchStatusesStr = req.query.batchStatuses as string;

		// Optional pagination
		const pageIndexStr = req.query.pageIndex as string || req.query.pageindex as string;
		const pageIndex = pageIndexStr ? parseInt(pageIndexStr) : 0;

		const pageSizeStr = req.query.pageSize as string || req.query.pagesize as string;
		const pageSize = pageSizeStr ? parseInt(pageSizeStr) : MAX_ENTRIES_PER_PAGE;

		let currencyCodes: string[] = [];
		let batchStatuses: string[] = [];

		try {
			this._enforcePrivilege(req.securityContext!, Privileges.RETRIEVE_SETTLEMENT_BATCH);
			if (currencyCodesStr && Array.isArray(currencyCodesStr)) {
				currencyCodes = currencyCodesStr;
			} else if (currencyCodesStr) {
				currencyCodesStr = decodeURIComponent(currencyCodesStr);
				currencyCodes = JSON.parse(currencyCodesStr);
			}

			if (batchStatusesStr && Array.isArray(batchStatusesStr)) {
				batchStatuses = batchStatusesStr;
			} else if (batchStatusesStr) {
				batchStatusesStr = decodeURIComponent(batchStatusesStr);
				batchStatuses = JSON.parse(batchStatusesStr);
			}
		} catch (err) {
			if (this._handleUnauthorizedError((err as Error), res)) return;
			this._logger.error(err);
			this.sendErrorResponse(res, 500, "Invalid settlementModels, currencyCodes or batchStatuses query parameters received");
			return;
		}

		// TODO enforce privileges
		try {


			let results: BatchSearchResults;
			if (batchName) {
				results = await this._batchRepo.getBatchesByName(batchName, pageIndex, pageSize);

			} else {
				this._logger.debug(`got getSettlementBatches request - Settlement Batches model: ${settlementModel} from [${new Date(Number(fromDate))}] to [${new Date(Number(toDate))}].`);
				results = await this._batchRepo.getBatchesByCriteria(
					Number(fromDate),
					Number(toDate),
					settlementModel,
					currencyCodes,
					batchStatuses,
					pageIndex,
					pageSize,
				);
			}
			if (!results || !results.items || results.items.length <= 0) {
				res.sendStatus(404);
				return;
			}
			this.sendSuccessResponse(res, 200, results);// OK
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

		// Optional pagination
		const pageIndexStr = req.query.pageIndex as string || req.query.pageindex as string;
		const pageIndex = pageIndexStr ? parseInt(pageIndexStr) : 0;

		const pageSizeStr = req.query.pageSize as string || req.query.pagesize as string;
		const pageSize = pageSizeStr ? parseInt(pageSizeStr) : MAX_ENTRIES_PER_PAGE;

		try {
			this._enforcePrivilege(req.securityContext!, Privileges.RETRIEVE_SETTLEMENT_BATCH);

			let result: BatchTransferSearchResults;
			if (batchId) {
				result = await this._batchTransferRepo.getBatchTransfersByBatchIds([batchId], pageIndex, pageSize);
			} else if (batchName) {
				const transfers = await this._batchTransferRepo.getBatchTransfersByBatchNames([batchName]);
				result = {
					pageIndex: 0,
					pageSize: 1,
					items: transfers,
					totalPages: 1
				};
			} else if (transferId) {
				const transfers = await this._batchTransferRepo.getBatchTransfersByTransferId(transferId);
				result = {
					pageIndex: 0,
					pageSize: 1,
					items: transfers,
					totalPages: 1
				};
			} else if (matrixId) {
				const matrix = await this._matrixRepo.getMatrixById(matrixId);
				if (!matrix) {
					res.status(404).json({ message: "matrix not found" });
					return;
				}
				const batchIds = matrix.batches.map(item => item.id);
				result = await this._batchTransferRepo.getBatchTransfersByBatchIds(batchIds);
			} else {
				// TODO this one also needs pagination
				result = await this._batchTransferRepo.getBatchTransfers(pageIndex, pageSize);
			}

			if (!result || !result.items) {
				res.sendStatus(404);
				return;
			}
			this.sendSuccessResponse(res, 200, result);// OK
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postCreateMatrix(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		try {

			this._enforcePrivilege(req.securityContext!, Privileges.CREATE_SETTLEMENT_MATRIX)
			const matrixId = req.body.matrixiId || randomUUID();
			const type = req.body.type as string || null;

			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (matrix) {
				return this.sendErrorResponse(res, 400, "Matrix with the same id already exists");
			}

			if (!type) {
				return this.sendErrorResponse(res, 400, "Invalid Matrix type");
			}

			let cmd: CommandMsg;
			if (type === "STATIC") {
				
				const cmdPayload: CreateStaticMatrixCmdPayload = {
					matrixId: matrixId,
					batchIds: req.body.batchIds
				};
				cmd = new CreateStaticMatrixCmd(cmdPayload);
			} else if (type === "DYNAMIC") {
				const currencyCodes = req.body.currencyCodes as string[];
				const settlementModel = req.body.settlementModel as string;
				const batchStatuses = req.body.batchStatuses as string[];
				const fromDate = req.body.fromDate;
				const toDate = req.body.toDate;

				const cmdPayload: CreateDynamicMatrixCmdPayload = {
					matrixId: matrixId,
					fromDate: fromDate,
					toDate: toDate,
					currencyCodes: currencyCodes,
					settlementModel: settlementModel,
					batchStatuses: batchStatuses
				};
				cmd = new CreateDynamicMatrixCmd(cmdPayload);
			} else {
				return this.sendErrorResponse(res, 400, "Invalid Matrix type");
			}
			cmd.validatePayload();

			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);

			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postRecalculateMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {

			this._enforcePrivilege(req.securityContext!, Privileges.GET_SETTLEMENT_MATRIX)
			const matrixId = req.params.id as string;

			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (!matrix) {
				return this.sendErrorResponse(res, 404, "Matrix not found");
			}

			const cmd = new RecalculateMatrixCmd({
				matrixId: matrixId
			});
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postCloseSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			this._enforcePrivilege(req.securityContext!, Privileges.SETTLEMENTS_CLOSE_MATRIX)
			const matrixId = req.params.id as string;
			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (!matrix) return this.sendErrorResponse(res, 404, "Matrix not found");

			const cmd = new CloseMatrixCmd({ matrixId: matrixId });
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postSettleSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {

			this._enforcePrivilege(req.securityContext!, Privileges.SETTLEMENTS_SETTLE_MATRIX);
			const matrixId = req.params.id as string;
			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (!matrix) return this.sendErrorResponse(res, 404, "Matrix not found");

			const cmd = new SettleMatrixCmd({ matrixId: matrixId });
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postDisputeSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			this._enforcePrivilege(req.securityContext!, Privileges.SETTLEMENTS_DISPUTE_MATRIX);
			const matrixId = req.params.id as string;
			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (!matrix) return this.sendErrorResponse(res, 404, "Matrix not found");

			const cmd = new DisputeMatrixCmd({ matrixId: matrixId });
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postAddBatchToStaticMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {
			this._enforcePrivilege(req.securityContext!, Privileges.CREATE_SETTLEMENT_MATRIX);
			const matrixId = req.params.id as string;
			const addReqPayload = req.body as AddBatchesToMatrixCmdPayload;

			const cmd = new AddBatchesToMatrixCmd(addReqPayload);
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postRemoveBatchFromStaticMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {

			this._enforcePrivilege(req.securityContext!, Privileges.REMOVE_SETTLEMENT_MATRIX_BATCH);
			const matrixId = req.params.id as string;
			const removeReqPayload = req.body as RemoveBatchesFromMatrixCmdPayload;

			const cmd = new RemoveBatchesFromMatrixCmd(removeReqPayload);
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges

		try {

			this._enforcePrivilege(req.securityContext!, Privileges.GET_SETTLEMENT_MATRIX);
			const id = req.params.id as string;

			const resp = await this._matrixRepo.getMatrixById(id);
			if (!resp) {
				return this.sendErrorResponse(res, 404, "Matrix not found");
			}
			this.sendSuccessResponse(res, 200, resp);// OK
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async getSettlementMatrices(req: express.Request, res: express.Response): Promise<void> {
		// TODO enforce privileges


		try {

			this._enforcePrivilege(req.securityContext!, Privileges.GET_SETTLEMENT_MATRIX);
			const matrixId = req.query.matrixId as string;
			const type = req.query.type as string;
			const state = req.query.state as string;
			const model = req.query.model as string;
			let currencyCodesStr = req.query.currencyCodes as string;
			const startDateStr = req.query.startDate as string || req.query.startdate as string;
			const startDate = startDateStr ? parseInt(startDateStr) : undefined;
			const endDateStr = req.query.endDate as string || req.query.enddate as string;
			const endDate = endDateStr ? parseInt(endDateStr) : undefined;


			// Optional pagination
			const pageIndexStr = req.query.pageIndex as string || req.query.pageindex as string;
			const pageIndex = pageIndexStr ? parseInt(pageIndexStr) : 0;

			const pageSizeStr = req.query.pageSize as string || req.query.pagesize as string;
			const pageSize = pageSizeStr ? parseInt(pageSizeStr) : MAX_ENTRIES_PER_PAGE;

			let currencyCodes: string[] = [];
			if (currencyCodesStr && Array.isArray(currencyCodesStr)) {
				currencyCodes = currencyCodesStr;
			} else if (currencyCodesStr) {
				currencyCodesStr = decodeURIComponent(currencyCodesStr);
				currencyCodes = JSON.parse(currencyCodesStr);
			}

			const resp = await this._matrixRepo.getMatrices(
				matrixId,
				type,
				state,
				model,
				currencyCodes,
				startDate,
				endDate,
				pageIndex,
				pageSize
			);

			if (!resp || !resp.items || resp.items.length <= 0) {
				return this.sendErrorResponse(res, 404, "No matrices found");
			}

			this.sendSuccessResponse(res, 200, resp);// OK

		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postLockSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {

			this._enforcePrivilege(req.securityContext!, Privileges.SETTLEMENTS_LOCK_MATRIX);
			const matrixId = req.params.id as string;
			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (!matrix) return this.sendErrorResponse(res, 404, "Matrix not found");

			const cmd = new LockMatrixCmd({ matrixId: matrixId });
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {
			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}

	private async postUnlockSettlementMatrix(req: express.Request, res: express.Response): Promise<void> {
		try {

			this._enforcePrivilege(req.securityContext!, Privileges.SETTLEMENTS_UNLOCK_MATRIX);
			const matrixId = req.params.id as string;
			const matrix = await this._matrixRepo.getMatrixById(matrixId);
			if (!matrix) return this.sendErrorResponse(res, 404, "Matrix not found");

			const cmd = new UnlockMatrixCmd({ matrixId: matrixId });
			await this._messageProducer.send(cmd);

			this.sendSuccessResponse(res, 202, { id: matrixId });
		} catch (error: any) {

			if (this._handleUnauthorizedError((error as Error), res)) return;
			this._logger.error(error);
			this.sendErrorResponse(res, 500, error.message || ExpressRoutes.UNKNOWN_ERROR_MESSAGE);
		}
	}


	private sendErrorResponse(res: express.Response, statusCode: number, message: string) {
		res.status(statusCode).json({ message: message });
	}

	private sendSuccessResponse(res: express.Response, statusCode: number, data: any) {
		res.status(statusCode).json(data);
	}

}
