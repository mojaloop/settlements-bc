# Signup
`Bank A` is a progressive FSP that would like to join the buzzing Mojaloop Hub.
The CEO of `Bank A`, Tshepo, knows Peter from `Bank B` who had an excellent experience signing up for Mojaloop.

Tshepo follows all procedures and is signed up with Mojaloop as `Bank A`, with an initial deposit of `100 TZS` credit.
```
Balances:
            - Bank A -> CR 100 TZS (Position)
            - Bank B -> CR  50 TZS (Position)
```

# Clearing
Sally is feeling peckish and in need of a snack. Fortunately, `Chips-R-Us` is right around the corner.

1. Sally, who has an account with `Bank A` can purchase from `Chips-R-Us`, a merchant on the `SuperBigHubs` Mojaloop Hub. 
   Sally makes the purchase for `10 TZS` using her phone.
   - Mojaloop performs an account lookup using Sally's MSISDN
   - DFSP `Bank B` receives a quote request, and the quote is sent back to `Bank A`
   - DFSP `Bank A` forwards the quote to Sally

2. Sally reviews the quote and is pleasantly surprised by the fair rate and price for her chips. Sally accepts the quotation.
   - Mojaloop implements 2-phase transfer technology
   - A transfer preparation with all necessary required transaction information is sent from the payer (`Bank A`) to the payee (`Bank B`),
     all the information, along with a liquidity check, is performed on `Bank A`
   - The reserved position account for `Bank A` is debited with `10 TZS`, whilst `Bank B` reservation position account is credited with `10 TZS`
```
Balances:
            - Bank A -> CR 100 TZS (Position)
            - Bank A -> CR  90 TZS (Position Reserved)
            - Bank B -> CR  50 TZS (Position)
            - Bank B -> CR  10 TZS (Position Reserved)
```

3. The prepared transfer for Sally's purchase is successful. The transfer preparation is followed by a transfer fulfil
   - A transfer fulfil is sent from the payer (`Bank A`) to the payee (`Bank B`), which matches the transfer prepare
```
Balances:
            - Bank A -> CR 90 TZS (Position)
            - Bank B -> CR 60 TZS (Position)
```

4. Sally leaves the `Chips-R-Us` merchant store, feeling satisfied and replenished.

5. Due to the consequence of the transfer, a settlement obligation is created between the payee (`Bank B`) liquidity account
   and the Mojaloop Hub settlement account
```
Balances:
            - Hub    -> DR 10 TZS (Settlement)
            - Bank B -> CR 10 TZS (Liquidity)
```

6. At this point, even though `Bank B` has a position balance of `60 TZS`, `Bank B` will only be allowed to 
   transfer a maximum of `50 TZS` due to the `10 TZS` liquidity balance that is to be settled

# Settlement
7. At the time of the 2-phase transfer fulfilment, a settlement transfer event was published to the Settlement service.
   - Settlement will allocate the transfer to a calculated batch according to currency, timestamp, settlement model etc.
   - The status of the batch will remain `OPEN` until closed
   - Settlement accounts are created for `Bank A` and `Bank B` (if one does not exist for the batch)
   - The transfer between payer and payee is recorded (using the original `transferId` as an identifier)
```
Balances:
            - Bank A Settlement ->  DR 10 TZS (Batch Settlement)
            - Bank B Settlement ->  CR 10 TZS (Batch Settlement)
```
8. A couple of minutes later, the batch that was used for Sally's transfer is closed automatically by the settlement
   service, which placed the batch in `CLOSED` status.

# Disputes
9. Much later, during the same day, the Hub operator `SuperBigHubs` received a call from the central bank of Tanzania that `Bank A`'s CEO, Tshepo,
   had not provided all documentation to participate in the `SuperBigHubs` Mojaloop hub. Andre, who is an employee for `SuperBigHubs` was able
   to locate and dispute the transfer Sally made earlier at `Chips-R-Us`, which placed a `DISPUTE` status on the batch. It is important
   to note that the batch is marked for `DISPUTE`, not the individual transfer. A disputed batch will never be settled. As a result `Bank A`
   would not be able to transfer beyond the net debit cap (liquidity limit) until the dispute is resolved and batch is settled.

10. `SuperBigHubs` is on the ball and was able to reach Tshepo to provide the missing documentation. Tshepo was able to
    send the missing documents via email, which was promptly reviewed and accepted by Andre. Andre closed the dispute,
    which in turn updated the `DISPUTE` status to a `CLOSED` status, making the batch eligible for settlement.

11. It just so happens that the dispute was resolved before the settling bank report was generated for `Bank A`. If `Bank A` would have
    missed the window, the settling bank report would have excluded settling the disputed batch for the daily settling window

# Reconciliation
12. Andre, the multi-talented Mojaloop hub operator, runs the Settlement reports later during the day, to be sent to the
    various settling banks. Andre is happy with the settlement reports and has decided to send the settlement report for approval
   - The Settlement service places all the batches for the report in `AWAITING_SETTLEMENT` status.

13. Thabo from accounts reviewed all the settlement reports for the day and decided to approve the report statements created by Andre.

14. All the various settlement reports and created and sent to the relevant settling banks

15. The settlement reports are reviewed by all the banks, and a reconciliation file with the updated balances at the
    settling bank is sent securely to the Mojoloop hub operator
   - The response file is received and processed by a 3rd party Mojaloop plugin

16. Thabo can verify the updated balances and DFSP account information; Thabo then hits the settle button to action a settlement for the settlement report
   - At this point, the batches that formed part of the settlement report are settled, and each of the batches for
     the report is now in a `SETTLED` status
   - An event is published to update the liquidity account for the payee `Bank B` (debit), as well as the settlement account (credit) for the Hub
```
Balances:
            - Bank B -> 0 TZS (Liquidity)
            - Hub    -> 0 TZS (Settlement)
```

17. Now that the settlement obligation has been fulfilled, `Bank B` is allowed to spend the full `60 TZS`


# Reference
https://docs.google.com/spreadsheets/d/1ITmAesHjRZICC0EUNV8vUVV8VDnKLjbSKu_dzhEa5Fw/edit#gid=580827044
