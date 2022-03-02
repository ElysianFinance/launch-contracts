// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../OwnedwManager.sol";
import "../interfaces/IERC721.sol";

contract Bounty is OwnedwManager, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // State variables
    bool public isPaused;

    //Pre-Elysian token
    IERC20 public pLYS;

    //NFT for council seats
    IERC721 public CouncilNFT;

    //Multisig
    address public multisig;

    // @notice How many seats on the Elysian Council
    uint public numOfSeats;

    // @notice The length of a report voting period
    uint public reportPeriod;

    // report severity rating
    enum SeverityScale{ UNASSIGNED, LOW, MEDIUM, HIGH }

    //payouts mapping
    mapping (SeverityScale => uint) payoutsTable;

    struct ReportLog {
        // @notice The ipfs hash of a particular report
        string reportHash;
        //  @notice The timestamp which the voting period begins
        uint start;
        // @notice The timestamp which the voting period of the proposal ends
        uint end;
        // @notice A boolean value to check whether a proposal log exists
        bool exist;
        //reporter
        address reporter;
        //@notice Severity of the report
        SeverityScale severity;
        //report is settled
        bool settled;
    }

    // @notice Given a report hash, return the ReportLog struct associated
    mapping(string => ReportLog) public reportHashToLog;
    
    //Counter for report logs
    uint256 public numReportLogs;

    //Council votes
    mapping (string => mapping (address => bool)) votes;

    // @notice An event emitted when the proposal period is modified
    event ReportPeriodModified(uint previousReportPeriod, uint newReportPeriod);

    // @notice An event emitted when a new ReportLog is created
    event ReportLogged(string reportHash, uint start, uint end);

    // ========== CONSTRUCTOR ==========
    // @notice Initialises the contract with a 5 council seats and a report period period of 3 days
    constructor(address _owner, address _preElysian, address _councilNFT, address _multisig) public OwnedwManager(_owner, _owner) {
        numOfSeats = 5;
        reportPeriod = 3 days;
        pLYS = IERC20(_preElysian);
        CouncilNFT = IERC721(_councilNFT);
        multisig = _multisig;
        //payouts table, UNASSIGNED is included for informational purposes.
        payoutsTable[SeverityScale.UNASSIGNED] = 0 ether;
        payoutsTable[SeverityScale.LOW]        = 100 ether;
        payoutsTable[SeverityScale.MEDIUM]     = 500 ether;
        payoutsTable[SeverityScale.HIGH]       = 1500 ether;
    }

    function submitReport(
        //ipfs hash of the report
        string calldata reportHash,
        //address of reporter
        address _reporter
    ) external 
        notPaused
    returns (string memory) {
        require(!reportHashToLog[reportHash].exist, "report hash is not unique");
        require(bytes(reportHash).length > 0, "report hash must not be empty");
        uint start = block.timestamp;
        uint end = start + reportPeriod;
        //if reporter address is null fallback to msg.sender
        address _reporter = _reporter != address(0) ? _reporter : msg.sender;
        ReportLog memory newReportLog = ReportLog(reportHash, start, end, true, _reporter, SeverityScale.UNASSIGNED, false);
        reportHashToLog[reportHash] = newReportLog;
        emit ReportLogged(reportHash, start, end);
        return reportHash;         
    }

    function flagReport(
        string calldata reportHash, 
        SeverityScale _severity
    ) external 
        onlyCouncil 
        notPaused {
        require(reportHashToLog[reportHash].exist, "Report not found");
        require(block.timestamp < reportHashToLog[reportHash].end, "flagging period ended.");
        require(votes[reportHash][msg.sender] == false, "Council member already flagged this report");
        ReportLog memory _report;
        _report = reportHashToLog[reportHash];
        //flag severity
        _report.severity = _severity;
        votes[reportHash][msg.sender] = true;      
    }

    function settleReport(string calldata reportHash) external nonReentrant 
        notPaused {
        require(reportHashToLog[reportHash].exist, "Report not found");
        require(!reportHashToLog[reportHash].settled, "Already settled");
        require(block.timestamp > reportHashToLog[reportHash].end, "flagging period in progress.");
        ReportLog storage _report = reportHashToLog[reportHash];
        SeverityScale reportSeverity = _report.severity;
        address _reporter = _report.reporter;
        //mark as settled
        _report.settled = true;
        //UNASSIGNED reports do not get rewards
        if (reportSeverity != SeverityScale.UNASSIGNED) {
            uint _reward = payoutsTable[reportSeverity];
            require(pLYS.balanceOf(address(this)) >= _reward, "Not enough balance in contract.");
            //transfer tokens
            pLYS.transfer(_reporter, _reward);
        }
    }

    function getReport(string calldata reportHash) external view returns (ReportLog memory) {
        ReportLog memory _report = reportHashToLog[reportHash];
        return _report;
    }

    // ========== ADMIN FUNCTIONS ==========
    
    function updatePayoutTable(SeverityScale _severityRating, uint _amount) external onlyOwner {
        payoutsTable[_severityRating] = _amount;
    }
    
    function flagExecution(bool _isPaused) external onlyOwner {
        isPaused = _isPaused;
    }

    //Requires the contract to be paused first
    function setPreElysian(address _preElysian) external onlyOwner {
        require(isPaused, "Contract must be paused");
        pLYS = IERC20(_preElysian);
    }

    //Requires the contract to be paused first
    function setCouncilNFT(address _councilNFT) external onlyOwner {
        require(isPaused, "Contract must be paused");
        CouncilNFT = IERC721(_councilNFT);
    }

    //Requires the contract to be paused first
    function setMultisig(address _multisig) external onlyOwner {
        require(isPaused, "Contract must be paused");
        multisig = _multisig;
    }

    function modifyReportPeriod(uint _reportPeriod) external onlyOwner {
        uint oldReportPeriod = reportPeriod;
        reportPeriod = _reportPeriod;
        emit ReportPeriodModified(oldReportPeriod, reportPeriod);
    }

    // ========== INTERNAL FUNCTIONS ==========

    function isInitialized() internal {
        require(address(pLYS) != address(0),       "pLYS address is not set");
        require(address(multisig) != address(0),   "Multisig not set");
        require(address(CouncilNFT) != address(0), "Council NFT not set");
    }

    // ========== MODIFIERS ==========

    modifier onlyCouncil() {
        bool isSeat1 = CouncilNFT.ownerOf(1) == msg.sender;
        bool isSeat2 = CouncilNFT.ownerOf(2) == msg.sender;
        bool isSeat3 = CouncilNFT.ownerOf(3) == msg.sender;
        bool isSeat4 = CouncilNFT.ownerOf(4) == msg.sender;
        bool isSeat5 = CouncilNFT.ownerOf(5) == msg.sender;

        require(
            isSeat1 || isSeat2 || isSeat3 || isSeat4 || isSeat5,
            "Only council members allowed"
        );
        _;
    }

    modifier notPaused() {
        require(!isPaused, "Contract is paused.");
        _;
    }

    modifier onlyMultisig() {
        require(msg.sender == multisig, "Only multisig allowed.");
        _;
    }

    // ========== EMERGENCY FUNCTIONS ==========

    //Recover tokens
    function transferTokens(address _multisig) external onlyMultisig {
        uint balance = pLYS.balanceOf(address(this));
        require(balance > 0, "No tokens to transfer");
        pLYS.transfer(_multisig, balance);
    }

    //Recover any ETH sent accidentally
    function transferEth(address _multisig) external onlyMultisig {
        address payable multisig = payable(_multisig);
        multisig.transfer(address(this).balance);
    }
}