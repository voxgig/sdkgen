The v3.2 identity code (base32/tools at d2e3b26), kept so that rekey.js can
compute the OLD class and sentence ids of any record keyed by them. The only
change: ledger.js and blocks.js record each class's occurrences (`occ`).
Never edited otherwise; never used by the one command.
