
# Signup
`Bank A` is a very progressive FSP that would like to join the buzzing Mojaloop Hub. 
The CEO of `Bank A`, Tshepo, knows Peter from `Bank B` had a good experience signing up for Mojaloop.

Tshepo follows all procedures and is signed up with Mojaloop as `Bank A`, with an initial deposit of `100 TZS`.
```
- Bank A -> 100 TZS (Position)
- Bank B -> 050 TZS (Position)
```

# Clearing
Sally is feeling peckish, and in need of a snack. Fortunately `Chips-R-Us` is right around the corner.

1. Sally (who has an account with `Bank A`) makes a purchase request from `Chips-R-Us` for `10 TZS` using her phone.
   - Mojaloop performs an account lookup using Sally's MSISDN
   - DFSP `Bank B` receives a quote request, quote is send back to `Bank A`
   - DFSP `Bank A` forwards the quote to Sally
2. Sally reviews the quote and is pleasantly surprised by the fair rate and price for her chips, Sally accepts the quote.
   - Mojaloop implements 2-phase transfer technology
   - A transfer prepare with all necessary required transaction information is sent from payer (`Bank A`) to payee (`Bank B`), 
   all the information along with a liquidity check is performed on `Bank A`
   - The reserved position balance for `Bank A` is debited with `10 TZS`
3. Sally leaves the `Chips-R-Us` merchant store.

```
- Bank A -> 100 TZS (Position)
- Bank A -> 090 TZS (Position Reserved)
- Bank B -> 050 TZS (Position)
- Bank B -> 010 TZS (Position Reserved)
```

4. The prepare transfer for Sally's purchase is successful, the transfer prepare is followed by a transfer fulfill
   - A transfer fulfill for the prepared transfer is sent from payer (`Bank A`) to payee (`Bank B`)
```
- Bank A -> 090 TZS (Position)
- Bank B -> 060 TZS (Position)
```

5. Due to the consequence of the transfer, a settlement obligation is created between the payee (`Bank B`) liquidity account 
   and the Mojaloop Hub settlement account
```
- Bank B ->  010 TZS (Liquidity)
- Hub ->    -010 TZS (Settlement)
```

6. At this point, even though `Bank B` has a position balance of `60 TZS`, 
   `Bank B` will only be allowed to transfer a maximum of `50 TZS` due to the `10 TZS` liquidity balance (to be settled)

# Settlement
7. At the time of the 2-phase transfer fulfill, a settlement transfer event was sent to the Settlement service
   - Settlement will allocate the transfer to a calculated batch, according to currency, timestamp, settlement model etc.
   - The status of the batch will remain `OPEN` until closed
   - Settlement accounts are created for `Bank A` and `Bank B` (if one does not exist for the batch)
   - The transfer between payer and payee is recorded (using the original `transferId` as identifier)
```
- Bank A Settlement ->  -010 TZS (Batch Settlement)
- Bank B Settlement ->   010 TZS (Batch Settlement)
```
8. A couple of minutes later, the batch that was used for Sally's transfer is closed automatically by the Settlement 
   service
9. Andre, the multi talented Mojaloop hub operator runs the Settlement reports later during the day to be sent to the 
   various settling banks. Andre is happy with the settlement reports, and decides to send the settlement report for approval 
   - The Settlement service places all the batches for the report in `AWAITING_SETTLEMENT` status.
10. Thabo from accounts review all the settlement reports for the day, and decides to approve the reports created by Andre.
11. All the various settlement reports and created and sent to the relevant settling banks
12. The settlement reports are reviewed by all the banks, and a reconciliation file with the updated balances at the 
    settling bank is sent securely to the Mojoloop hub operator
    - The response file is received, and processed by the 3rd party Mojaloop plugin
13. Thabo is able to verify the updated balances and DFSP account information, Thabo hits the settle button for the settlement report
    - At this point, the batches that formed part of the settlement report, is not settled and each of the batches for
      the report is now in a `SETTLED` status
    - An event is published in order to update the liquidity account for the payee `Bank B` (debit), as well as the settlement account (credit) for the Hub 
```
- Bank B ->  0 TZS (Liquidity)
- Hub ->    -0 TZS (Settlement)
```
14. Now that the settlement obligation has been fulfilled, `Bank B` is allowed to spend the full `60 TZS` 

# Disputes
TODO

# Reference
https://docs.google.com/spreadsheets/d/1ITmAesHjRZICC0EUNV8vUVV8VDnKLjbSKu_dzhEa5Fw/edit#gid=580827044

