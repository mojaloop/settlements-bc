# Settlement Flows
This document describes the data and flow for;
- [Create Settlement Transfers](#settlement-transfer) (creation of settlement obligation)
- [Generation of Settlement Matrix](#settlement-matrix) (fulfilment of settlement obligation)
- [Settlement Transfer Batch Assignment](#settlement-transfer-batch-assignment) (process of assigning transfers to batches)

## Settlement Transfer
Settlement transfer is the process of settlement receiving the settlement transfers to be settled.
Once a settlement transfer has been created successfully, the settlement obligation has been created for the payer (debtor) and payee (creditor).

It is the responsibility of the settlement component to settle settlement batches in order to restore liquidity limits for the DFSP's (Participant Accounts). 
The Settlement Matrix generation process is responsible for notifying the external system of the settlement completion. 

### Settlement Transfer - Central-Ledger
The flow below is how a fulfilled transfer is posted to Settlements:
## ![Settlement Transfer Flow for Central-Ledger](./01-settlement-transfer-cl.svg "Settlement Transfer Central-Ledger")

## Settlement Transfer - Transfers BC
The flow below is how a fulfilled transfer is posted to Settlements:
## ![Settlement Transfer Flow for Transfers BC](./01-settlement-transfer-bc.svg "Settlement Transfer Transfers BC")

### Settlement Transfer Model `(ISettlementTransferDto)`
The table below illustrates the Settlement Transfer fields:

| Field              | Definition                                | Description                                                                                                                                        |
|--------------------|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`               | `null / string`                           | The global unique identifier for settlement transfer. Assigned by Settlement                                                                       |
| `externalId`       | `string`                                  | An external id used by the external system (Central-Ledger / Transfers BC) used to identify a transaction                                          |
| `currencyCode`     | `string`                                  | The currency code for a settlement transfer as described in ISO-4217                                                                               |
| `currencyDecimals` | `number / null`                           | The number of decimal precisions for the `currencyCode`                                                                                            |
| `amount`           | `string`                                  | The transfer amount in minor denomination format (cents/fills) as text (`string)                                                                   |
| `debitAccount`     | `ISettlementBatchAccountDto`              | The account to be debited. The actual settlement account will be derived from the provided debit account during a transfer                         |
| `creditAccount`    | `ISettlementBatchAccountDto`              | The account to be credited. The actual settlement account will be derived from the provided credit account during a transfer                       |
| `timestamp`        | `number`                                  | The timestamp of the original committed/fulfilled transfer. Settlement batch processing make use of the timestamp to allocate transfers to batches |
| `batch`            | `null / ISettlementBatchDto` __Optional__ | The settlement batch the settlement transfer has been assigned to                                                                                  |

### Settlement Batch Account Model `(ISettlementBatchAccountDto)`
The table below illustrates the Settlement Batch Account fields:

| Field              | Definition                                | Description                                                                                               |
|--------------------|-------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `id`               | `null / string`                           | The global unique identifier for settlement batch account. Assigned by Settlement                         |
| `externalId`       | `string`                                  | An external id used by the external system (Central-Ledger / Transfers BC) used to identify an account    |
| `settlementBatch`  | `null / ISettlementBatchDto` __Optional__ | The settlement batch the account is assigned to                                                           |
| `currencyCode`     | `string`                                  | The currency code for a settlement batch account as described in ISO-4217                                 |
| `currencyDecimals` | `number / null`                           | The number of decimal precisions for the `currencyCode`                                                   |
| `debitBalance`     | `string`                                  | The settlement account debit balance amount in minor denomination format (cents/fills) as text (`string)  |
| `creditBalance`    | `string`                                  | The settlement account credit balance amount in minor denomination format (cents/fills) as text (`string) |
| `timestamp`        | `number`                                  | The timestamp for when the settlement batch account was created                                           |

## Settlement Matrix
Settlement matrix is the process of requesting the current settlement matrix for a specified timespan (along with other selection criteria).
The processing request for the settlement matrix would close any `OPEN` settlement batches that form part of the selection criteria, 
as a consequence the external system would be notified of the settlement transfers now being fulfilled (central-ledger, Participants-BC etc.).

### Settlement Matrix - Central-Ledger
The flow below is how a Settlement Matrix is created for Central-Ledger:
## ![Settlement Matrix Flow for Central-Ledger](./02-settlement-matrix-cl.svg "ST CL")

## Settlement Matrix - Participants BC
The flow below is how a fulfilled Matrix is created for Participants BC:
## ![Settlement Matrix Flow for Transfers BC](./02-settlement-matrix-bc.svg "ST TBC")

### Settlement Matrix Model `(ISettlementMatrixDto)`
The table below illustrates the Settlement Matrix fields:

| Field                   | Definition                    | Description                                                        |
|-------------------------|-------------------------------|--------------------------------------------------------------------|
| `fromDate`              | `number`                      | The from date to which to generate the settlement matrix from      |
| `toDate`                | `number`                      | The from date to which to generate the settlement matrix until     |
| `settlementModel`       | `string`                      | The settlement model for which the settlement model is generated   |
| `generationDuration`    | `number`                      | The time in milliseconds it took to generate the settlement matrix |
| `batches`               | `ISettlementMatrixBatchDto[]` | The settlement matrix batches that were processed                  |


### Settlement Matrix Batch Model `(ISettlementMatrixBatchDto)`
The table below illustrates the Settlement Matrix Batch fields:

| Field              | Definition                                     | Description                                                                                             |
|--------------------|------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `batchIdentifier`  | `string`                                       | The batch matrix unique batch identifier `e.g DEFAULT.USD:USD.2023.1.24.14.28.1`                        |
| `batchStatus`      | `SettlementBatchStatus`                        | The batch status prior to the settlement matrix being generated                                         |
| `batchStatusNew`   | `SettlementBatchStatus`                        | The current batch status as a result of the settlement matrix request                                   |
| `currencyCode`     | `string`                                       | The currency code as described in ISO-4217                                                              |
| `debitBalance`     | `string`                                       | The settlement batch debit balance amount in minor denomination format (cents/fills) as text (`string)  |
| `creditBalance`    | `string`                                       | The settlement batch credit balance amount in minor denomination format (cents/fills) as text (`string) |
| `batchAccounts`    | `ISettlementMatrixSettlementBatchAccountDto[]` | The credit balance amount in minor denomination format (cents/fills) as text (`string)                  |

### Settlement Matrix Batch Account Model `(ISettlementMatrixSettlementBatchAccountDto)`
The table below illustrates the Settlement Matrix Batch Account fields:

| Field              | Definition                    | Description                                                                                                     |
|--------------------|-------------------------------|-----------------------------------------------------------------------------------------------------------------|
| `id`               | `null / string`               | The global unique identifier for settlement batch account. Assigned by Settlement                               |
| `externalId`       | `string`                      | An external id used by the external system (Central-Ledger / Transfers BC) used to identify a settled account   |
| `currencyCode`     | `string`                      | The currency code as described in ISO-4217 for the batch account                                                |
| `debitBalance`     | `string`                      | The settlement batch account debit balance amount in minor denomination format (cents/fills) as text (`string)  |
| `creditBalance`    | `string`                      | The settlement batch account credit balance amount in minor denomination format (cents/fills) as text (`string) |


## Settlement Transfer Batch Assignment
Instead of assigning a settlement transfer to the current open settlement window, the Settlement vNext would be responsible for allocating the transfer itself.
Transfers-BC / Central-Ledger: At time of fulfil, produce an event to be consumed eventually by Settlement. 
Settlement-BC would then be responsible for allocating a transfer to a settlement batch and settlement model, independently of other components.

Late settlement transactions will be allocated to a newly created batch (since the batch for timespan X would have already been closed).
Example: 
Lets assume that the transfer timestamp for a late transaction is `2023.1.26.13.33.59`. 
The batch meant for the "late" / delayed transfer is meant for batch:
- `DEFAULT.USD:USD.2023.1.26.13.33.001`
Due to the batch being in a closed state, the following batch will be created for the transfer:
- `DEFAULT.USD:USD.2023.1.26.13.33.002`

The above ensures the requirements are met:
- Transfers will always be allocated to a batch, irrespective of the timestamp and batch statuses
- Settlement batches that are in a `CLOSED` state cannot be altered 
- Reconciliation is achieved by re-running the Settlement Matrix for the delayed transfer, which will automatically rectify settlement inconsistencies 


