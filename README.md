# Lab 10 — Auto Lending Marketplace

React dApp and Solidity smart contract for an auto loan marketplace connecting vehicle dealers, lenders, and customers. The contract has been deployed on Rootstock Testnet and the dApp is configured to use the deployed address and ABI.

## Deployment

- Network: Rootstock Testnet (chain ID 31)
- Contract: `0x14940624C4696e93792fBE63fa42Da2aDdcAD16a`
- Explorer: [Rootstock Testnet Explorer](https://explorer.testnet.rootstock.io/address/0x14940624C4696e93792fBE63fa42Da2aDdcAD16a)
- RPC: `https://public-node.testnet.rsk.co`
- ABI: `artifacts/AutoLendingMarketplace.abi.json` (the ABI supplied for this deployment)

The deployed contract is reachable on Rootstock Testnet. Its current vehicle, offer, and application counts are zero.

## Project files

- `contracts/AutoLendingMarketplace.sol` — Solidity source.
- `src/` — React + Vite interface with customer, dealer, and lender views.
- `src/lib/contract.js` — Rootstock Testnet wallet connection and contract configuration.
- `artifacts/` — deployed contract ABI and compiler bytecode.
- `screenshots/01_marketplace_demo_preview.png` — frontend preview; preview cards are sample data, not on-chain records.
- `BTech3rdSem_CSET352_ROLLNO_Lab10.docx` — assignment report; student name and roll number fields still need filling.

## Run the dApp

1. Install Node.js 20 or newer.
2. Open this folder in a terminal and run `npm install`.
3. Run `npm run dev` and open the local address printed by Vite.
4. Connect MetaMask and switch to Rootstock Testnet. Use test RBTC (tRBTC) only.

## Contract workflow

1. A dealer calls `listVehicle` to publish vehicle details and a VIN hash.
2. A lender calls `createOffer` with principal, APR, and term.
3. A customer calls `applyForLoan` and sends the down payment, which is held by the contract.
4. The dealer accepts or rejects the application. Rejection refunds the down payment.
5. The selected lender funds the exact principal.
6. The dealer confirms delivery. The contract releases the down payment and loan principal to the dealer and starts the 30-day payment schedule.
7. The customer pays each scheduled installment. After a missed due date plus the seven-day grace period, any account can mark the loan defaulted.

## Recompile or redeploy

1. Open [Remix](https://remix.ethereum.org/) and load `contracts/AutoLendingMarketplace.sol`.
2. Compile with Solidity 0.8.20.
3. Connect MetaMask to Rootstock Testnet (chain ID 31; RPC `https://public-node.testnet.rsk.co`).
4. If needed, request test RBTC from the [Rootstock faucet](https://faucet.rootstock.io/).
5. In Remix Deploy & Run, select **Injected Provider - MetaMask**, then deploy and approve the wallet transaction.
6. If a new deployment is created, update `CONTRACT_ADDRESS` in `src/lib/contract.js` and replace the ABI in `artifacts/AutoLendingMarketplace.abi.json` with Remix's ABI.

## Scope and safety

This is an educational prototype and has not received a professional security audit. It must not be used with real funds. Loan interest uses simple interest. Payments use 30-day periods. A default flag cannot physically repossess a vehicle or enforce a legal claim. KYC, insurance, credit scores, title documents, and original VINs remain off-chain; do not put personal information on a public chain.

For LMS submission, replace the student and roll number blanks, rename the report to the institute's required roll-number format, and capture screenshots of the contract deployment and actual dApp transaction flow. The included dashboard screenshot is explicitly a demo preview.
