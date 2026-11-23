// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Auto Lending Marketplace
/// @notice A teaching prototype for a dealer, lender, and customer auto-loan flow.
/// @dev Vehicle identity documents and KYC data must stay off-chain. This contract
///      records only a VIN hash and loan state. Default flags collateral for manual
///      legal/physical recovery; a blockchain cannot repossess a real vehicle.
contract AutoLendingMarketplace {
    uint256 public constant BPS = 10_000;
    uint256 public constant GRACE_PERIOD = 7 days;
    uint256 public constant PAYMENT_PERIOD = 30 days;

    enum LoanState { Pending, Accepted, Funded, Active, Paid, Defaulted, Rejected }

    struct Vehicle {
        address dealer;
        bytes32 vinHash;
        string make;
        string model;
        uint16 year;
        uint256 priceWei;
        bool listed;
    }

    struct LoanOffer {
        address lender;
        uint256 principalWei;
        uint16 aprBps;
        uint16 termMonths;
        bool active;
    }

    struct LoanApplication {
        uint256 vehicleId;
        uint256 offerId;
        address customer;
        address dealer;
        uint256 downPaymentWei;
        uint256 totalDueWei;
        uint256 paidWei;
        uint256 nextDueAt;
        uint16 paymentsMade;
        LoanState state;
    }

    Vehicle[] private vehicles;
    LoanOffer[] private offers;
    LoanApplication[] private applications;
    mapping(uint256 => uint256) private escrowedPrincipal;
    uint256 private entered = 1;

    event VehicleListed(uint256 indexed vehicleId, address indexed dealer, string make, string model);
    event OfferCreated(uint256 indexed offerId, address indexed lender, uint256 principalWei);
    event LoanApplied(uint256 indexed applicationId, uint256 indexed vehicleId, uint256 indexed offerId, address customer);
    event ApplicationAccepted(uint256 indexed applicationId, address indexed dealer);
    event LoanFunded(uint256 indexed applicationId, address indexed lender, uint256 amountWei);
    event VehicleDelivered(uint256 indexed applicationId, uint256 dueAt);
    event PaymentMade(uint256 indexed applicationId, uint256 amountWei, uint256 paidWei);
    event LoanDefaulted(uint256 indexed applicationId, uint256 remainingWei);

    modifier nonReentrant() {
        require(entered == 1, "Reentrant call");
        entered = 2;
        _;
        entered = 1;
    }

    function vehicleCount() external view returns (uint256) { return vehicles.length; }
    function offerCount() external view returns (uint256) { return offers.length; }
    function applicationCount() external view returns (uint256) { return applications.length; }
    function getVehicle(uint256 id) external view returns (Vehicle memory) { return vehicles[id]; }
    function getOffer(uint256 id) external view returns (LoanOffer memory) { return offers[id]; }
    function getApplication(uint256 id) external view returns (LoanApplication memory) { return applications[id]; }
    function escrowedPrincipalFor(uint256 id) external view returns (uint256) { return escrowedPrincipal[id]; }

    function listVehicle(bytes32 vinHash, string calldata make, string calldata model, uint16 year, uint256 priceWei)
        external returns (uint256 vehicleId)
    {
        require(vinHash != bytes32(0), "VIN hash required");
        require(bytes(make).length > 0 && bytes(model).length > 0, "Vehicle details required");
        require(year >= 1980 && year <= 2100, "Invalid year");
        require(priceWei > 0, "Price must be positive");
        vehicleId = vehicles.length;
        vehicles.push(Vehicle(msg.sender, vinHash, make, model, year, priceWei, true));
        emit VehicleListed(vehicleId, msg.sender, make, model);
    }

    function createOffer(uint256 principalWei, uint16 aprBps, uint16 termMonths) external returns (uint256 offerId) {
        require(principalWei > 0, "Principal must be positive");
        require(aprBps <= 5_000, "APR exceeds 50 percent");
        require(termMonths > 0 && termMonths <= 120, "Term must be 1-120 months");
        offerId = offers.length;
        offers.push(LoanOffer(msg.sender, principalWei, aprBps, termMonths, true));
        emit OfferCreated(offerId, msg.sender, principalWei);
    }

    function applyForLoan(uint256 vehicleId, uint256 offerId) external payable returns (uint256 applicationId) {
        Vehicle storage vehicle = vehicles[vehicleId];
        LoanOffer storage offer = offers[offerId];
        require(vehicle.listed, "Vehicle unavailable");
        require(msg.sender != vehicle.dealer, "Dealer cannot apply for own vehicle");
        require(offer.active, "Offer inactive");
        require(msg.value + offer.principalWei >= vehicle.priceWei, "Down payment and loan do not cover price");
        applicationId = applications.length;
        applications.push(LoanApplication({
            vehicleId: vehicleId,
            offerId: offerId,
            customer: msg.sender,
            dealer: vehicle.dealer,
            downPaymentWei: msg.value,
            totalDueWei: offer.principalWei + (offer.principalWei * offer.aprBps * offer.termMonths / (BPS * 12)),
            paidWei: 0,
            nextDueAt: 0,
            paymentsMade: 0,
            state: LoanState.Pending
        }));
        emit LoanApplied(applicationId, vehicleId, offerId, msg.sender);
    }

    function acceptApplication(uint256 applicationId) external {
        LoanApplication storage application = applications[applicationId];
        require(application.state == LoanState.Pending, "Application is not pending");
        require(msg.sender == application.dealer, "Only the dealer can accept");
        require(vehicles[application.vehicleId].listed, "Vehicle is already reserved");
        vehicles[application.vehicleId].listed = false;
        application.state = LoanState.Accepted;
        emit ApplicationAccepted(applicationId, msg.sender);
    }

    function rejectApplication(uint256 applicationId) external nonReentrant {
        LoanApplication storage application = applications[applicationId];
        LoanState previousState = application.state;
        require(previousState == LoanState.Pending || previousState == LoanState.Accepted || previousState == LoanState.Funded, "Application cannot be rejected");
        LoanOffer storage offer = offers[application.offerId];
        if (previousState == LoanState.Funded) {
            require(msg.sender == application.dealer || msg.sender == offer.lender, "Only dealer or lender can cancel funding");
        } else {
            require(msg.sender == application.dealer, "Only the dealer can reject");
        }
        if (previousState != LoanState.Pending) vehicles[application.vehicleId].listed = true;
        application.state = LoanState.Rejected;
        uint256 refund = application.downPaymentWei;
        application.downPaymentWei = 0;
        uint256 principalRefund = escrowedPrincipal[applicationId];
        escrowedPrincipal[applicationId] = 0;
        if (refund > 0) {
            (bool ok,) = payable(application.customer).call{value: refund}("");
            require(ok, "Down payment refund failed");
        }
        if (principalRefund > 0) {
            (bool ok,) = payable(offer.lender).call{value: principalRefund}("");
            require(ok, "Lender refund failed");
        }
    }

    function fundLoan(uint256 applicationId) external payable {
        LoanApplication storage application = applications[applicationId];
        LoanOffer storage offer = offers[application.offerId];
        require(application.state == LoanState.Accepted, "Application not accepted");
        require(msg.sender == offer.lender, "Only selected lender can fund");
        require(msg.value == offer.principalWei, "Send exact principal");
        escrowedPrincipal[applicationId] = msg.value;
        application.state = LoanState.Funded;
        emit LoanFunded(applicationId, msg.sender, msg.value);
    }

    function confirmDelivery(uint256 applicationId) external nonReentrant {
        LoanApplication storage application = applications[applicationId];
        require(application.state == LoanState.Funded, "Loan is not funded");
        require(msg.sender == application.dealer, "Only the dealer can confirm delivery");
        uint256 releaseAmount = application.downPaymentWei + escrowedPrincipal[applicationId];
        application.downPaymentWei = 0;
        escrowedPrincipal[applicationId] = 0;
        application.nextDueAt = block.timestamp + PAYMENT_PERIOD;
        application.state = LoanState.Active;
        (bool ok,) = payable(application.dealer).call{value: releaseAmount}("");
        require(ok, "Dealer settlement failed");
        emit VehicleDelivered(applicationId, application.nextDueAt);
    }

    function repay(uint256 applicationId) external payable nonReentrant {
        LoanApplication storage application = applications[applicationId];
        require(msg.sender == application.customer, "Only customer can repay");
        require(application.state == LoanState.Active, "Loan is not active");
        require(block.timestamp <= application.nextDueAt + GRACE_PERIOD, "Payment is overdue; default may be declared");
        uint256 remaining = application.totalDueWei - application.paidWei;
        uint256 installmentsLeft = uint256(offers[application.offerId].termMonths) - application.paymentsMade;
        uint256 installment = (remaining + installmentsLeft - 1) / installmentsLeft;
        uint256 payment = msg.value;
        require(payment == installment || payment == remaining, "Send the scheduled installment or payoff amount");
        application.paidWei += payment;
        application.paymentsMade += 1;
        LoanOffer storage offer = offers[application.offerId];
        (bool ok,) = payable(offer.lender).call{value: payment}("");
        require(ok, "Lender payment failed");
        if (application.paidWei >= application.totalDueWei) {
            application.state = LoanState.Paid;
        } else {
            application.nextDueAt += PAYMENT_PERIOD;
        }
        emit PaymentMade(applicationId, payment, application.paidWei);
    }

    function declareDefault(uint256 applicationId) external {
        LoanApplication storage application = applications[applicationId];
        require(application.state == LoanState.Active, "Loan is not active");
        require(block.timestamp > application.nextDueAt + GRACE_PERIOD, "Grace period has not elapsed");
        application.state = LoanState.Defaulted;
        emit LoanDefaulted(applicationId, application.totalDueWei - application.paidWei);
    }
}
