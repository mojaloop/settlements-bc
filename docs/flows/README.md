# Settlement Flows
This document describes the data and flow for settlements.

## Settlement Transfer
Settlement transfer is the process of settlement receiving the settlement transfers to be settled.

### Settlement Transfer - Central-Ledger
The flow below is how a fulfilled transfer is posted to Settlements:
## ![Settlement Transfer Flow for Central-Ledger](./01-settlement-transfer-cl.svg "Settlement Transfer Central-Ledger")

## Settlement Transfer - Transfers BC
The flow below is how a fulfilled transfer is posted to Settlements:
## ![Settlement Transfer Flow for Transfers BC](./01-settlement-transfer-bc.svg "Settlement Transfer Transfers BC")

### Settlement Transfer Model `(ISettlementTransferDto)`
The table below illustrates the Settlement Transfer fields:

| Field              | Definition                         | Description                                                                                                                   |
|--------------------|------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `id`               | `null / string`                    | The global unique identifier for settlement transfer. Assigned by Settlement.                                                 |
| `externalId`       | `string`                           | An external id used by the external system (Central-Ledger / Transfers BC) used to identify a transaction                     |
| `currencyCode`     | `string`                           | The currency code as described in ISO-4217                                                                                    |
| `currencyDecimals` | `number / null`                    | The number of decimal precisions for the `currencyCode`                                                                       |
| `amount`           | `string`                           | The transfer amount in minor denomination format (cents/fills) as text (`string)                                              |
| `debitAccount`     | `ISettlementBatchAccountDto`       | The account to be debited. The actual settlement account will be derived from the provided debit account during a transfer.   |
| `creditAccount`    | `ISettlementBatchAccountDto`       | The account to be credited. The actual settlement account will be derived from the provided credit account during a transfer. |
| `timestamp`        | `number`                           | The timestamp of the original committed/fulfilled transfer. Very important to                                                 |
| `batch`            | `ISettlementBatchDto` __Optional__ | The settlement batch the settlement transfer has been assigned to                                                             |

### Settlement Batch Account Model `(ISettlementBatchAccountDto)`
The table below illustrates the Settlement Batch Account fields:

| Field                    | Definition      | Description                                                                                               |
|--------------------------|-----------------|-----------------------------------------------------------------------------------------------------------|
| `id`                     | `null / string` | The global unique identifier for settlement batch account. Assigned by Settlement.                        |
| `externalId`             | `string`        | An external id used by the external system (Central-Ledger / Transfers BC) used to identify a transaction |


## Settlement Matrix
Settlement matrix is the process of requesting the current settlement matrix for a specified timespan (among other selection criteria).
The processing request for the settlement matrix would also close any `OPEN` settlement batches that form part of the selection criteria, 
as a consequence the external system would be notified of the settlement transfers now being fulfilled.

### Settlement Transfer - Central-Ledger
The flow below is how a Settlement Matrix is created in Central-Ledger:
## ![Settlement Transfer Flow for Central-Ledger](./01-settlement-transfer-cl.svg "ST CL")

## Settlement Transfer - Transfers BC
The flow below is how a fulfilled transfer is posted to Settlements:
## ![Settlement Transfer Flow for Transfers BC](./01-settlement-transfer-bc.svg "ST TBC")


### Settlement Matrix Model `(ISettlementMatrixDto)`

| Field                   | Definition                    | Description                                                          |
|-------------------------|-------------------------------|----------------------------------------------------------------------|
| `fromDate`              | `number`                      | The from date to which to generate the settlement matrix from        |
| `toDate`                | `number`                      | The from date to which to generate the settlement matrix until       |
| `settlementModel`       | `string`                      | The settlement model for which the settlement model is generated.    |
| `generationDuration`    | `number`                      | The time in milliseconds it took to generate the settlement matrix   |
| `batches`               | `ISettlementMatrixBatchDto[]` | The settlement matrix batches that were processed                    |


### Settlement Matrix Batch Model `(ISettlementMatrixBatchDto)`

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

| Field             | Definition | Description |
|-------------------|------------|-------------|
| `id`              | `string`   | sd          |
| `externalId`      | `string`   | sd          |

