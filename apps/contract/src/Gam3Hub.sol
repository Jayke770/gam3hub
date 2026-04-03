// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title Gam3Hub
 * @dev High-performance Coinflip game with UUPS upgradeability.
 */
contract Gam3Hub is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    struct Player {
        address playerAddress;
        uint8 side; // 1 head, 0 tail
        uint256 betAmount;
        bool hasClaimed;
    }

    struct Game {
        bytes32 gameId;
        mapping(address => Player) players;
        uint256 totalPlayers;
        uint256 headsPool;
        uint256 tailsPool;
        uint256 poolForWinners;
        uint256 gameCreated;
        uint256 gameEnd;
        uint8 gameOutcome;
        bool isActive;
        bytes32 commitment; 
        uint256 prevRandao; 
        bytes32 serverSeed; 
    }

    struct GameView {
        bytes32 gameId;
        bool isActive;
        uint256 gameCreated;
        uint256 gameEnd;
        uint256 totalPlayers;
        uint256 headsPool;
        uint256 tailsPool;
        uint8 gameOutcome;
        bytes32 commitment;
        uint256 prevRandao;
        bytes32 serverSeed;
    }

    bytes32 public currentGameId; 
    event GameCreated(bytes32 indexed gameId, bytes32 commitment);
    event PlayerJoined(bytes32 indexed gameId, uint8 side, address indexed player, uint256 betAmount);
    event GameEnded(bytes32 indexed gameId, uint8 outcomeSide, bytes32 serverSeed);

    uint256 public platformFeePercentage; 
    uint256 private gameNonce; 

    mapping(bytes32 => Game) public games;
    mapping(address => bool) private admins;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        admins[initialOwner] = true;
        platformFeePercentage = 0;
        gameNonce = 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin can call");
        _;
    }

    function addAdmin(address _admin) public onlyOwner {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) public onlyOwner {
        admins[_admin] = false;
    }

    function setPlatformFeePercentage(uint256 _feePercentage) public onlyOwner {
        require(_feePercentage <= 100, "Fee percentage cannot exceed 100");
        platformFeePercentage = _feePercentage;
    }

    function adminWithdraw(uint256 _amount) public onlyOwner {
        require(address(this).balance >= _amount, "Insufficient native balance");
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Withdraw failed");
    }

    function joinGame(uint8 _side, bytes calldata _signature) public payable nonReentrant whenNotPaused {
        require(currentGameId != bytes32(0), "No active game");

        bytes32 messageHash = keccak256(abi.encodePacked(address(this), msg.sender, _side, currentGameId));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ECDSA.recover(ethSignedMessageHash, _signature);
        require(admins[signer], "Unauthorized: Call must be signed by admin");

        Game storage g = games[currentGameId];
        require(g.isActive, "Game not active");
        require(g.players[msg.sender].playerAddress == address(0), "Already joined");
        require(msg.value > 0, "Must bet greater than zero");
        
        g.players[msg.sender] = Player({
            playerAddress: msg.sender,
            side: _side,
            betAmount: msg.value,
            hasClaimed: false
        });
        
        if (_side == 1) {
            g.headsPool += msg.value;
        } else {
            g.tailsPool += msg.value;
        }
        g.totalPlayers++;

        emit PlayerJoined(currentGameId, _side, msg.sender, msg.value);
    }

    function settleGame(bytes32 _serverSeed, bytes32 _nextCommitment) public onlyAdmin nonReentrant whenNotPaused {
        require(currentGameId != bytes32(0), "No active game");
        Game storage g = games[currentGameId];
        require(g.isActive, "Game not active");
        require(keccak256(abi.encodePacked(_serverSeed)) == g.commitment, "Invalid server seed reveal");

        uint256 entropy = block.prevrandao;
        uint8 outcome = uint8(uint256(keccak256(abi.encodePacked(_serverSeed, entropy))) % 2);
        g.gameOutcome = outcome;
        g.prevRandao = entropy;
        g.serverSeed = _serverSeed;
        
        uint256 totalPot = g.headsPool + g.tailsPool;
        uint256 winningPool = (outcome == 1) ? g.headsPool : g.tailsPool;
        
        if (winningPool > 0) {
            g.poolForWinners = totalPot;
        }
        
        g.isActive = false;
        g.gameEnd = block.timestamp;
        bytes32 finishedGameId = currentGameId;
        currentGameId = bytes32(0); 
        
        emit GameEnded(finishedGameId, outcome, _serverSeed);
        _createGame(_nextCommitment);
    }

    function claim(bytes32 _gameId) public nonReentrant whenNotPaused {
        Game storage g = games[_gameId];
        require(!g.isActive, "Game is still active");
        require(g.gameEnd > 0, "Game has not ended");
        
        Player storage p = g.players[msg.sender];
        require(p.playerAddress != address(0), "You did not join this game");
        require(!p.hasClaimed, "Already claimed");
        require(p.side == g.gameOutcome, "You did not win this game");
        
        uint256 winningPool = (g.gameOutcome == 1) ? g.headsPool : g.tailsPool;
        require(winningPool > 0, "No winners");
        
        uint256 grossPayout = (p.betAmount * g.poolForWinners) / winningPool;
        require(grossPayout > 0, "Payout must be positive");

        uint256 fee = (grossPayout * platformFeePercentage) / 100;
        uint256 finalPayout = grossPayout - fee;

        p.hasClaimed = true;
        
        if (fee > 0) {
            (bool feeSuccess, ) = owner().call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }
        
        (bool success, ) = msg.sender.call{value: finalPayout}("");
        require(success, "Payout failed");
    }

    function createGame(bytes32 _commitment) public onlyAdmin nonReentrant whenNotPaused returns (bytes32) {
        require(currentGameId == bytes32(0), "There is already an active game");
        return _createGame(_commitment);
    }

    function _createGame(bytes32 _commitment) internal returns (bytes32) {
        bytes32 id = generateGameId();
        Game storage g = games[id];
        g.gameId = id;
        g.commitment = _commitment;
        g.gameCreated = block.timestamp;
        g.gameEnd = 0;
        g.totalPlayers = 0;
        g.headsPool = 0;
        g.tailsPool = 0;
        g.poolForWinners = 0;
        g.isActive = true;

        currentGameId = id; 

        emit GameCreated(id, _commitment);
        return id;
    }

    function getGame(bytes32 _gameId) public view returns (GameView memory) {
        Game storage g = games[_gameId];
        return GameView({
            gameId: g.gameId,
            isActive: g.isActive, 
            gameCreated: g.gameCreated,
            gameEnd: g.gameEnd, 
            totalPlayers: g.totalPlayers,
            headsPool: g.headsPool,
            tailsPool: g.tailsPool,
            gameOutcome: g.gameOutcome,
            commitment: g.commitment,
            prevRandao: g.prevRandao,
            serverSeed: g.serverSeed
        });
    }

    function verifyGameOutcome(bytes32 _serverSeed, uint256 _prevRandao) public pure returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(_serverSeed, _prevRandao))) % 2);
    }

    function generateGameId() private returns (bytes32) {
        gameNonce++;
        return keccak256(
            abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, gameNonce)
        );
    }

    function getPlayerInfo(bytes32 _gameId, address _player) public view returns (Player memory) {
        return games[_gameId].players[_player];
    }

    // Reserved storage slots for future version upgrades
    uint256[50] private __gap;
}