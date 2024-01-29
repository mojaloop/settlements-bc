import request from "supertest";

import {
    AccountsBalancesAdapterMock,
    AuditClientMock,
    AuthorizationClientMock,
    MessageCache,
    MessageProducerMock,
    ParticipantAccountNotifierMock,
    SettlementBatchRepoMock,
    SettlementBatchTransferRepoMock,
    SettlementConfigRepoMock,
    SettlementMatrixRequestRepoMock,
    TokenHelperMock
} from "@mojaloop/settlements-bc-shared-mocks-lib";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { ITokenHelper } from "@mojaloop/security-bc-public-types-lib";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {
    AddBatchesToMatrixCmdPayload,
    IAccountsBalancesAdapter,
    IParticipantAccountNotifier,
    ISettlementBatchRepo,
    ISettlementConfigRepo,
    ISettlementMatrixRequestRepo
} from "@mojaloop/settlements-bc-domain-lib";
import { IAuthorizationClient, CallSecurityContext } from "@mojaloop/security-bc-public-types-lib";
import { IAuditClient } from "@mojaloop/auditing-bc-public-types-lib";
import { Service } from "../../src/service";
import {
    ISettlementBatch,
    ISettlementBatchTransfer,
    ISettlementMatrix,
    ISettlementMatrixBatch,
    ISettlementMatrixBatchAccount,
    ISettlementMatrixBalanceByCurrency,
    ISettlementMatrixBalanceByParticipant,
    ISettlementMatrixBalanceByStateAndCurrency
} from "@mojaloop/settlements-bc-public-types-lib";
import { randomUUID } from "crypto";


const logger: ILogger = new ConsoleLogger();
const msgCache: MessageCache = new MessageCache();
const tokenHelper: ITokenHelper = new TokenHelperMock();

const mockBatchRepo: ISettlementBatchRepo = new SettlementBatchRepoMock();
const mockBatchTransferRepo = new SettlementBatchTransferRepoMock();
const mockMatrixRequestRepo: ISettlementMatrixRequestRepo = new SettlementMatrixRequestRepoMock();

const mockMessageProducer: IMessageProducer = new MessageProducerMock(logger, msgCache);

const mockAuthorizationClient: IAuthorizationClient = new AuthorizationClientMock(logger, true);
const mockAuthorizationClientNoAuth: IAuthorizationClient = new AuthorizationClientMock(logger, false);
const mockAuditClient: IAuditClient = new AuditClientMock(logger);
const mockAccountsAndBalancesAdapter: IAccountsBalancesAdapter = new AccountsBalancesAdapterMock();
const mockConfigRepo: ISettlementConfigRepo = new SettlementConfigRepoMock();
const mockParticipantAccountNotifier: IParticipantAccountNotifier = new ParticipantAccountNotifierMock();

const server = (process.env["SETTLEMENT_SVC_URL"] || "http://localhost:3600");
const AUTH_TOKEN = "bearer: FAKETOKEN";

let mockedSettlementBatch: ISettlementBatch;
let mockedSettlementBatchTransfers: ISettlementBatchTransfer[];
let mockedSettlementMatrix: ISettlementMatrix;
let mockedSettlementMatrixBatches: ISettlementMatrixBatch[];
let mockedSettlementMatrixBatchAccount: ISettlementMatrixBatchAccount[];
let mockedSettlementMatrixBalancesPart: ISettlementMatrixBalanceByParticipant[];
let mockedSettlementMatrixBalancesCurrency: ISettlementMatrixBalanceByCurrency[];
let mockedSettlementMatrixBalancesStateAndCurrency: ISettlementMatrixBalanceByStateAndCurrency[];

const securityContext: CallSecurityContext = {
    "accessToken": 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkxQb3JsS1JRV0trZHItb0VleGVEaXZSTG55aTgyMkFUcHdMUFRwdHdjQ3MifQ.eyJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzZWN1cml0eS1iYy11aSIsInVzZXJUeXBlIjoiSFVCIiwicGxhdGZvcm1Sb2xlcyI6WyJodWJfb3BlcmF0b3IiXSwicGFydGljaXBhbnRSb2xlcyI6W10sImlhdCI6MTcwNjI2MjU3MywiZXhwIjoxNzA2ODY3MzczLCJhdWQiOiJtb2phbG9vcC52bmV4dC5kZXYuZGVmYXVsdF9hdWRpZW5jZSIsImlzcyI6Im1vamFsb29wLnZuZXh0LmRldi5kZWZhdWx0X2lzc3VlciIsInN1YiI6InVzZXI6OnVzZXIiLCJqdGkiOiI4YjZmY2M5My1iOGIzLTQ3ZWItOWNiMi04NDg0MjZkM2U1MTIifQ.TXw_WPSzFWTj0j-g2-58bI86U0PUmaZJ3twJMVVSFhmkGdZ9jU4gPkFV49Drwe-JaySGW2i1UIf4cajxaHCth6YCo7YSQ2HC7ubqx_LD7SPHBlcCvlc1t_nEZvEbJ4QkSYW88-JfoX8oG9Abo1SM8pqTTsqwy-LkWQS9mcN1wkKiWlb6ypXIs9rl7lzZVNLCAPqzo6CB2sxA_bHnohvmih9J3_HNolvt8xzwWCiUUrRWj_iGkdO6mSDerLnyV3ZeElIkFOFXWthBHs7QZRtwmZUcOq2eitQb4bOAtXU8CSpbEJOdT7sRVsXdru2Ku_t3dPlXUeNy23N4KqBtW21DXw',
    "clientId": "null",
    "username": 'user',
    "platformRoleIds": ['hub_operator']
}

describe("Settlement BC api-svc route test", () => {
    beforeAll(async () => {


        await Service.start(
            logger,
            tokenHelper,
            mockAuthorizationClient,
            //mockAuthorizationClientNoAuth,
            mockAuditClient,
            mockConfigRepo,
            mockBatchRepo,
            mockBatchTransferRepo,
            mockMatrixRequestRepo,
            mockParticipantAccountNotifier,
            mockMessageProducer
        );

        //Prepare mocked batch data
        mockedSettlementBatch =
        {
            id: "DEFAULT.USD.2023.06.19.08.30.001",
            timestamp: Date.now(),
            settlementModel: "DEFAULT",
            currencyCode: "USD",
            batchName: "DEFAULT.USD.2023.06.19.08.30",
            batchSequence: 2, //100 EURO
            state: "OPEN",
            accounts: [],
            ownerMatrixId: null
        };

        //Prepare mocked batchTransfer data
        mockedSettlementBatchTransfers = [
            {
                transferId: "T001",
                transferTimestamp: Date.now(),
                payerFspId: "FSP-A",
                payeeFspId: "FSP-B",
                currencyCode: "USD",
                amount: "10",
                batchId: "DEFAULT.USD.2023.06.19.08.30.001",
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                journalEntryId: "string",
                matrixId: "SM001",
            },
            {
                transferId: "T002",
                transferTimestamp: Date.now(),
                payerFspId: "FSP-A",
                payeeFspId: "FSP-B",
                currencyCode: "USD",
                amount: "5",
                batchId: "DEFAULT.USD.2023.06.19.08.30.001",
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                journalEntryId: "string",
                matrixId: "SM001"
            }
        ];

        await mockBatchTransferRepo.storeBatchTransfer(mockedSettlementBatchTransfers[0], mockedSettlementBatchTransfers[1]);


        //Prepare mocked Settlement Matrix Account
        mockedSettlementMatrixBatchAccount = [
            {
                id: "SMBA001",
                participantId: "FSP-A",
                accountExtId: "string",
                debitBalance: "10",
                creditBalance: "0"
            },
            {
                id: "SMBA002",
                participantId: "FSP-B",
                accountExtId: "string",
                debitBalance: "0",
                creditBalance: "10"
            }
        ];

        //Prepare mocked Settlement Matrix Participant Balances
        mockedSettlementMatrixBalancesPart = [
            {
                participantId: "FSP-A",
                currencyCode: "EUR",
                state: "OPEN",
                debitBalance: "10",
                creditBalance: "0"
            },
            {
                participantId: "FSP-B",
                currencyCode: "EUR",
                state: "OPEN",
                debitBalance: "0",
                creditBalance: "10"
            }
        ]

        //Prepare mocked Settlement Matrix batch
        mockedSettlementMatrixBatches = [{
            id: "DEFAULT.USD.2023.06.19.08.30.001",
            name: "DEFAULT.USD.2023.06.19.08.30",
            currencyCode: "USD",
            batchDebitBalance: "10",
            batchCreditBalance: "10",
            state: "OPEN",
            batchAccounts: mockedSettlementMatrixBatchAccount
        }]

        //Prepare mocked Matrix
        mockedSettlementMatrix = {
            id: "SM001",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["USD"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: mockedSettlementMatrixBatches,
            balancesByParticipant: mockedSettlementMatrixBalancesPart,
            balancesByStateAndCurrency: mockedSettlementMatrixBalancesStateAndCurrency,
            balancesByCurrency: mockedSettlementMatrixBalancesCurrency,
            state: "FINALIZED",
            type: "STATIC",
            generationDurationSecs: 2
        }
    })

    afterAll(async () => {
        await Service.stop();
    });

    /**Happy-path Test Cases */

    test("GET /batches/:id - should fetch settlement batch by id", async () => {

        //Arrange
        const mockBatches: ISettlementBatch[] = [
            {
                id: "DEFAULT.USD.2023.06.19.08.30.001",
                timestamp: Date.now(),
                settlementModel: "DEFAULT",
                currencyCode: "USD",
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                batchSequence: 2, //100 EURO
                state: "OPEN",
                accounts: [],
                ownerMatrixId: null
            },
            {
                id: "DEFAULT.USD.2023.06.20.01.20.001",
                timestamp: Date.now(),
                settlementModel: "CBX",
                currencyCode: "USD",
                batchName: "DEFAULT.USD.2023.06.20.01.20",
                batchSequence: 1, //100 EURO
                state: "CLOSED",
                accounts: [],
                ownerMatrixId: null
            }
        ];

        await mockBatchRepo.storeNewBatch(mockBatches[0]);
        await mockBatchRepo.storeNewBatch(mockBatches[1]);

        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);

        // Batch by unique identifier:
        const responseId = await request(server)
            .get(`/batches/${mockBatches[0].id}`)
            .set('authorization', AUTH_TOKEN);
        expect(responseId.status).toBe(200);
        expect(responseId.body).toEqual(mockBatches[0]);
    });


    test("GET /batches/:id - should send a 500 error response", async () => {

        //Arrange 
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);

        //Act - request with non-existing batchId
        const response = await request(server)
            .get(`/batches`)
            .query({ id: 123 })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(404);
    });

    test("GET /batches - should fetch settlement batch by 'non-id'", async () => {

        //Arrange

        const mockBatches: ISettlementBatch[] = [
            {
                id: "DEFAULT.USD.2023.06.19.08.30.001",
                timestamp: Date.now(),
                settlementModel: 'DEFAULT',
                currencyCode: "USD",
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                batchSequence: 2, //100 EURO
                state: "OPEN",
                accounts: [],
                ownerMatrixId: null
            },
            {
                id: "CBX.USD.2023.06.20.01.20.001",
                timestamp: Date.now(),
                settlementModel: "CBX",
                currencyCode: "USD",
                batchName: "CBX.USD.2023.06.20.01.20",
                batchSequence: 1, //100 EURO
                state: "CLOSED",
                accounts: [],
                ownerMatrixId: null
            }
        ];

        await mockBatchRepo.storeNewBatch(mockBatches[0]);
        await mockBatchRepo.storeNewBatch(mockBatches[1]);


        // Batch by name:

        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);

        const responseBatchName = await request(server)
            .get(`/batches`)
            .query({
                batchName: "CBX.USD.2023.06.20.01.20"
            })
            .set('authorization', AUTH_TOKEN);

        expect(responseBatchName.status).toBe(200);
        expect(Array.isArray(responseBatchName.body.items)).toBe(true);
        expect(responseBatchName.body.items.length).toBe(1);

        const dateTo = (Date.now() + 5000);
        const dateFrom = (Date.now() - 5000);



        // Batch by settlement models:

        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);

        const responseSettlementModels = await request(server)
            .get(`/batches`)
            .query({
                fromDate: dateFrom,
                toDate: dateTo,
                settlementModel: "DEFAULT"
            })
            .set('authorization', AUTH_TOKEN);
        expect(responseSettlementModels.status).toBe(200);
        expect(Array.isArray(responseSettlementModels.body.items)).toBe(true);
        expect(responseSettlementModels.body.items.length).toBe(1);

        // Batch by currency:

        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        const responseCurrency = await request(server)
            .get(`/batches`)
            .query({
                fromDate: dateFrom,
                toDate: dateTo,
                currencyCodes: ["USD", "EUR"]
            })
            .set('authorization', AUTH_TOKEN);


        expect(responseCurrency.status).toBe(200);
        expect(Array.isArray(responseCurrency.body.items)).toBe(true);
        expect(responseCurrency.body.items.length).toBeGreaterThan(1);

        // Batch by currency:
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);

        const responseStatus = await request(server)
            .get(`/batches`)
            .query({
                fromDate: dateFrom,
                toDate: dateTo,
                batchStatuses: ["OPEN", "CLOSED"]
            })
            .set('authorization', AUTH_TOKEN);
        expect(responseStatus.status).toBe(200);
        expect(Array.isArray(responseStatus.body.items)).toBe(true);
        expect(responseStatus.body.items.length).toBeGreaterThan(1);
    });

    test("GET /transfers - should fetch batchTransfers by batchId", async () => {

        //Arrange

        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                batchId: `${mockedSettlementBatch.id}`
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
        expect(response.body.items.length).toBe(2);
    });

    test("GET /transfers - should fetch batchTransfers by batchName", async () => {

        //Arrange
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                batchName: `${mockedSettlementBatch.batchName}`
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
    });


    test("GET /transfers - should fetch batchTransfer by transactionId", async () => {

        //Arrange
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);

        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                transferId: "T002"
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
        expect(response.body.items[0]).toEqual(mockedSettlementBatchTransfers[1]);
    });

    test("GET /transfers - should fetch batchTransfer by matrixId", async () => {

        //Arrange
        await mockMatrixRequestRepo.storeMatrix(mockedSettlementMatrix);
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                matrixId: "SM001"
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
        expect(response.body.items.length).toEqual(2);
    });


    /**Settlement Matrix Routes' Tests */
    test("POST /matrix - should create matrix if doesn't exist", async () => {

        //Arrange
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Prepare mocked Settlement Matrix Account
        const settlementMatrixBatchAccount: ISettlementMatrixBatchAccount[] = [
            {
                id: "SMBA001",
                participantId: "FSP-A",
                accountExtId: "string",
                debitBalance: "10",
                creditBalance: "0"
            },
            {
                id: "SMBA002",
                participantId: "FSP-B",
                accountExtId: "string",
                debitBalance: "0",
                creditBalance: "10"
            }
        ];

        //Prepare mocked Settlement Matrix Participant Balances
        const settlementMatrixParticipantBalances: ISettlementMatrixBalanceByParticipant[] = [
            {
                participantId: "FSP-A",
                currencyCode: "EUR",
                state: "OPEN",
                debitBalance: "5",
                creditBalance: "0"
            },
            {
                participantId: "FSP-B",
                currencyCode: "EUR",
                state: "OPEN",
                debitBalance: "0",
                creditBalance: "5"
            }
        ];

        //Prepare mocked Settlement Matrix batch
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [{
            id: "DEFAULT.EUR.2023.06.19.08.30.001",
            name: "DEFAULT.EUR.2023.06.19.08.30",
            currencyCode: 'EUR',
            batchDebitBalance: "5",
            batchCreditBalance: "5",
            state: "OPEN",
            batchAccounts: settlementMatrixBatchAccount
        }];

        const newMatrixId = randomUUID();

        const newMatrix: ISettlementMatrix = {
            id: newMatrixId,
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: mockedSettlementMatrixBalancesPart,
            balancesByStateAndCurrency: mockedSettlementMatrixBalancesStateAndCurrency,
            balancesByCurrency: mockedSettlementMatrixBalancesCurrency,
            state: "FINALIZED",
            type: "STATIC",
            generationDurationSecs: 2
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .post(`/matrix`)
            .send(newMatrix)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
    });

    /**Settlement Matrix Routes' Tests */
    test("POST /matrix/:id/batches - should add batches to the given matrix", async () => {

        //Arrange

        //Prepare mocked Settlement Matrix batches
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.19.08.30.001",
                name: "DEFAULT.EUR.2023.06.19.08.30",
                currencyCode: "USD",
                batchDebitBalance: "5",
                batchCreditBalance: "5",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.23.08.22.001",
                name: "DEFAULT.USD.2023.06.23.08.22",
                currencyCode: "USD",
                batchDebitBalance: "5",
                batchCreditBalance: "5",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        const newMatrixId = randomUUID();

        const newMatrix: ISettlementMatrix = {
            id: newMatrixId,
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: mockedSettlementMatrixBalancesPart,
            balancesByStateAndCurrency: mockedSettlementMatrixBalancesStateAndCurrency,
            balancesByCurrency: mockedSettlementMatrixBalancesCurrency,
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        const payload: AddBatchesToMatrixCmdPayload = {
            matrixId: newMatrix.id,
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);

        //Act
        const response = await request(server)
            .post(`/matrix/${newMatrix.id}/batches`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual(newMatrix.id);

    });

    test("DELETE /matrix/:id/batches should send message RemoveBatchesFromMatrixCmd to kafka queue", async () => {
        //Arrange


        //Prepare mocked Settlement Matrix batches
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        const newMatrixId = randomUUID();

        const newMatrix: ISettlementMatrix = {
            id: newMatrixId,
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        const payload: AddBatchesToMatrixCmdPayload = {
            matrixId: newMatrix.id,
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .delete(`/matrix/${newMatrix.id}/batches`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual(newMatrix.id);
    });

    test("POST /matrix/:id/recalculate should send message RecalculateMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        const newMatrix: ISettlementMatrix = {
            id: "TestMatrix",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        const payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix/recalculate`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix");
    });


    test("POST /matrix/:id/close should send message CloseMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        const newMatrix: ISettlementMatrix = {
            id: "TestMatrix1",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        const payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix1",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix1/close`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix1");
    });

    test("POST /matrix/:id/settle should send message SettleMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        const newMatrix: ISettlementMatrix = {
            id: "TestMatrix2",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        const payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix2",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix2/settle`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix2");
    });

    test("POST /matrix/:id/dispute should send message DisputeMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        const newMatrix: ISettlementMatrix = {
            id: "TestMatrix3",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        const payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix3",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix3/dispute`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix3");
    });

    test("GET /matrix/:id should get SettlementMatrix by Id", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        const settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                currencyCode: "EUR",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        const newMatrix: ISettlementMatrix = {
            id: "TestMatrix4",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: settlementSettlementMatrixBatches,
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);
        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .get(`/matrix/TestMatrix4`)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(newMatrix);
    });

    test("GET /matrix should get list of Matrices", async () => {
        //Arrange
        const matrix1: ISettlementMatrix = {
            id: "matrix1",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: [],
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        const matrix2: ISettlementMatrix = {
            id: "matrix2",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCodes: ["EUR"],
            settlementModel: "DEFAULT",
            batchStatuses: [],
            batches: [],
            balancesByParticipant: [],
            balancesByStateAndCurrency: [],
            balancesByCurrency: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2
        };

        await mockMatrixRequestRepo.storeMatrix(matrix1);
        await mockMatrixRequestRepo.storeMatrix(matrix2);

        jest.spyOn(tokenHelper, "getCallSecurityContextFromAccessToken")
            .mockResolvedValueOnce(securityContext);
        //Act
        const response = await request(server)
            .get(`/matrix`)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.items)).toBe(true);
    });
});
