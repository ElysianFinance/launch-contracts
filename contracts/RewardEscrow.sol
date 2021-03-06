// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;

// Inheritance
import "./OwnedwManager.sol";
import "./MixinResolver.sol";

// Libraries
import "./SafeDecimalMath.sol";

// Internal references
import "./interfaces/IERC20.sol";
import "./interfaces/IElysian.sol";
import "./interfaces/IMyTreasury.sol";

interface IRewardEscrow {
    // Views
    function balanceOf(address account) external view returns (uint);

    function numVestingEntries(address account) external view returns (uint);

    function totalEscrowedAccountBalance(address account) external view returns (uint);

    function totalVestedAccountBalance(address account) external view returns (uint);

    // Mutative functions
    function appendVestingEntry(address account, uint quantity) external;

    function vest() external;
}

contract RewardEscrow is OwnedwManager, IRewardEscrow, MixinResolver {
    using SafeMath for uint;

    /* The corresponding Elysian contract. */
    IElysian public elysian;
    IMyTreasury public treasury;

    /* Lists of (timestamp, quantity) pairs per account, sorted in ascending time order.
     * These are the times at which each given quantity of LYS vests. */
    mapping(address => uint[2][]) public vestingSchedules;

    /* An account's total escrowed elysian balance to save recomputing this for fee extraction purposes. */
    mapping(address => uint) public override totalEscrowedAccountBalance;

    /* An account's total vested reward elysian. */
    mapping(address => uint) public override totalVestedAccountBalance;

    /* The total remaining escrowed balance, for verifying the actual elysian balance of this contract against. */
    uint public  totalEscrowedBalance;

    uint internal constant TIME_INDEX = 0;
    uint internal constant QUANTITY_INDEX = 1;

    /* Limit vesting entries to disallow unbounded iteration over vesting schedules.
     * There are 5 years of the supply schedule */
    uint public constant MAX_VESTING_ENTRIES = 52 * 5;

    /* ========== ADDRESS RESOLVER CONFIGURATION ========== */
    bytes32 private constant CONTRACT_MYTREASURY = "MyTreasury";
    bytes32 private constant CONTRACT_LYSSIAN = "Elysian";

    bytes32[2] private addressesToCache = [
        CONTRACT_MYTREASURY,
        CONTRACT_LYSSIAN
    ];

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _owner,
        address _resolver
    ) public OwnedwManager(_owner, _owner) MixinResolver(_resolver) {
    }
 

    /* ========== VIEW FUNCTIONS ========== */

    /**
     * @notice A simple alias to totalEscrowedAccountBalance: provides ERC20 balance integration.
     */
    function balanceOf(address account) public override view returns (uint) {
        return totalEscrowedAccountBalance[account];
    }

    function _numVestingEntries(address account) internal view returns (uint) {
        return vestingSchedules[account].length;
    }

    /**
     * @notice The number of vesting dates in an account's schedule.
     */
    function numVestingEntries(address account) external override view returns (uint) {
        return vestingSchedules[account].length;
    }

    /**
     * @notice Get a particular schedule entry for an account.
     * @return A pair of uints: (timestamp, elysian quantity).
     */
    function getVestingScheduleEntry(address account, uint index) public view returns (uint[2] memory) {
        return vestingSchedules[account][index];
    }

    /**
     * @notice Get the time at which a given schedule entry will vest.
     */
    function getVestingTime(address account, uint index) public view returns (uint) {
        return getVestingScheduleEntry(account, index)[TIME_INDEX];
    }

    /**
     * @notice Get the quantity of LYS associated with a given schedule entry.
     */
    function getVestingQuantity(address account, uint index) public view returns (uint) {
        return getVestingScheduleEntry(account, index)[QUANTITY_INDEX];
    }

    /**
     * @notice Obtain the index of the next schedule entry that will vest for a given user.
     */
    function getNextVestingIndex(address account) public view returns (uint) {
        uint len = _numVestingEntries(account);
        for (uint i = 0; i < len; i++) {
            if (getVestingTime(account, i) != 0) {
                return i;
            }
        }
        return len;
    }

    /**
     * @notice Obtain the next schedule entry that will vest for a given user.
     * @return A pair of uints: (timestamp, elysian quantity). */
    function getNextVestingEntry(address account) public view returns (uint[2] memory) {
        uint index = getNextVestingIndex(account);
        if (index == _numVestingEntries(account)) {
            return [uint(0), 0];
        }
        return getVestingScheduleEntry(account, index);
    }

    /**
     * @notice Obtain the time at which the next schedule entry will vest for a given user.
     */
    function getNextVestingTime(address account) external view returns (uint) {
        return getNextVestingEntry(account)[TIME_INDEX];
    }

    /**
     * @notice Obtain the quantity which the next schedule entry will vest for a given user.
     */
    function getNextVestingQuantity(address account) external view returns (uint) {
        return getNextVestingEntry(account)[QUANTITY_INDEX];
    }

    /**
     * @notice return the full vesting schedule entries vest for a given user.
     * @dev For DApps to display the vesting schedule for the
     * inflationary supply over 5 years. Solidity cant return variable length arrays
     * so this is returning pairs of data. Vesting Time at [0] and quantity at [1] and so on
     */
    function checkAccountSchedule(address account) public view returns (uint[520] memory) {
        uint[520] memory _result;
        uint schedules = _numVestingEntries(account);
        for (uint i = 0; i < schedules; i++) {
            uint[2] memory pair = getVestingScheduleEntry(account, i);
            _result[i * 2] = pair[0];
            _result[i * 2 + 1] = pair[1];
        }
        return _result;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function _appendVestingEntry(address account, uint quantity) internal {
        /* No empty or already-passed vesting entries allowed. */
        require(quantity != 0, "Quantity cannot be zero");

        /* There must be enough balance in the contract to provide for the vesting entry. */
        totalEscrowedBalance = totalEscrowedBalance.add(quantity);
        //require(
        //    totalEscrowedBalance <= IERC20(address(elysian)).balanceOf(address(this)),
        //    "Must be enough balance in the contract to provide for the vesting entry"
        //);

        /* Disallow arbitrarily long vesting schedules in light of the gas limit. */
        uint scheduleLength = vestingSchedules[account].length;
        require(scheduleLength <= MAX_VESTING_ENTRIES, "Vesting schedule is too long");

        /* Escrow the tokens for 1 year. */
        uint time = block.timestamp + 52 weeks;

        if (scheduleLength == 0) {
            totalEscrowedAccountBalance[account] = quantity;
        } else {
            /* Disallow adding new vested LYS earlier than the last one.
             * Since entries are only appended, this means that no vesting date can be repeated. */
            require(
                getVestingTime(account, scheduleLength - 1) < time,
                "Cannot add new vested entries earlier than the last one"
            );
            totalEscrowedAccountBalance[account] = totalEscrowedAccountBalance[account].add(quantity);
        }

        vestingSchedules[account].push([time, quantity]);

        emit VestingEntryCreated(account, block.timestamp, quantity);
    }

    /**
     * @notice Add a new vesting entry at a given time and quantity to an account's schedule.
     * @dev A call to this should accompany a previous successful call to elysian.transfer(rewardEscrow, amount),
     * to ensure that when the funds are withdrawn, there is enough balance.
     * Note; although this function could technically be used to produce unbounded
     * arrays, it's only withinn the 4 year period of the weekly inflation schedule.
     * @param account The account to append a new vesting entry to.
     * @param quantity The quantity of LYS that will be escrowed.
     */
    function appendVestingEntry(address account, uint quantity) external override onlyInternalContracts {
        _appendVestingEntry(account, quantity);
    }

    /**
     * @notice Allow a user to withdraw any LYS in their schedule that have vested.
     */
    function vest() external override {
        uint numEntries = _numVestingEntries(msg.sender);
        uint total;
        for (uint i = 0; i < numEntries; i++) {
            uint time = getVestingTime(msg.sender, i);
            /* The list is sorted; when we reach the first future time, bail out. */
            if (time > block.timestamp) {
                break;
            }
            uint qty = getVestingQuantity(msg.sender, i);
            if (qty > 0) {
                vestingSchedules[msg.sender][i] = [0, 0];
                total = total.add(qty);
            }
        }

        if (total != 0) {
            totalEscrowedBalance = totalEscrowedBalance.sub(total);
            totalEscrowedAccountBalance[msg.sender] = totalEscrowedAccountBalance[msg.sender].sub(total);
            totalVestedAccountBalance[msg.sender] = totalVestedAccountBalance[msg.sender].add(total);
            IERC20(address(elysian)).transfer(msg.sender, total);
            emit Vested(msg.sender, block.timestamp, total);
        }
    }

    /* ========== MODIFIERS ========== */

    modifier onlyTreasury() {
        address treasury = resolver.requireAndGetAddress(CONTRACT_MYTREASURY, "Missing Treasury address");
        require(msg.sender == treasury, "Only Treasury can invoke this");
        _;
    }

    modifier onlyElysian() {
        address elysian = resolver.requireAndGetAddress(CONTRACT_LYSSIAN, "Missing Elysian address");
        require(msg.sender == elysian, "Only Elysian can invoke this");
        _;
    }
    modifier onlyInternalContracts() {
        address treasury = resolver.requireAndGetAddress(CONTRACT_MYTREASURY, "Missing Treasury address");
        address elysian = resolver.requireAndGetAddress(CONTRACT_LYSSIAN, "Missing Elysian address");

        bool isElysian = msg.sender == elysian;
        bool isTreasury = msg.sender == treasury;

        require(
            isElysian || isTreasury,
            "Only Elysian, Treasury contracts allowed"
        );
        _;
    }

    /* ========== EVENTS ========== */
    event ElysianUpdated(address newElysian);
    event TreasuryUpdated(address newFeePool);
    event Vested(address indexed beneficiary, uint time, uint value);
    event VestingEntryCreated(address indexed beneficiary, uint time, uint value);
}
