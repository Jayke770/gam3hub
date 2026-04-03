// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Gam3Hub} from "../src/Gam3Hub.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Gam3HubTest is Test {
    Gam3Hub public gam3hub;

    address owner = address(this);
    address admin = makeAddr("admin");
    address player1 = makeAddr("player1");
    address player2 = makeAddr("player2");
    address player3 = makeAddr("player3");

    uint256 constant BASE_BET = 0.01 ether;
    uint256 adminPk = 0xA11CE; // Sample admin private key
    address adminAddr;

    receive() external payable {}

    function setUp() public {
        adminAddr = vm.addr(adminPk);
        
        // Deploy implementation
        Gam3Hub implementation = new Gam3Hub();
        
        // Deploy proxy and initialize
        bytes memory initData = abi.encodeWithSelector(Gam3Hub.initialize.selector, owner);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        
        // Wrap the proxy address in the Gam3Hub interface
        gam3hub = Gam3Hub(address(proxy));
        
        gam3hub.addAdmin(adminAddr);

        // Fund players
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);
    }

    function _getSig(address player, uint8 side, bytes32 gameId) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(abi.encodePacked(address(gam3hub), player, side, gameId));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(adminPk, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }

    function _getCommitment(bytes32 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(seed));
    }

    // =========================================================================
    //                          CREATE GAME TESTS
    // =========================================================================

    function test_CreateGame() public {
        bytes32 commitment = _getCommitment(bytes32(uint256(1)));
        bytes32 gameId = gam3hub.createGame(commitment);

        assertTrue(gameId != bytes32(0), "Game ID should not be zero");
        assertEq(gam3hub.currentGameId(), gameId, "Current game ID should match");

        Gam3Hub.GameView memory game = gam3hub.getGame(gameId);
        assertTrue(game.isActive, "Game should be active");
        assertEq(game.commitment, commitment, "Commitment should be stored");
    }

    function test_CreateGame_EmitsEvent() public {
        bytes32 commitment = _getCommitment(bytes32(uint256(1)));
        vm.expectEmit(false, false, false, true);
        emit Gam3Hub.GameCreated(bytes32(0), commitment);
        gam3hub.createGame(commitment);
    }

    function test_CreateGame_RevertWhenActiveGameExists() public {
        gam3hub.createGame(_getCommitment("1"));
        vm.expectRevert("There is already an active game");
        gam3hub.createGame(_getCommitment("2"));
    }

    function test_CreateGame_RevertWhenNotAdmin() public {
        vm.prank(player1);
        vm.expectRevert("Only admin can call");
        gam3hub.createGame(_getCommitment("1"));
    }

    function test_CreateGame_AsAddedAdmin() public {
        gam3hub.addAdmin(admin);
        vm.prank(admin);
        bytes32 gameId = gam3hub.createGame(_getCommitment("1"));
        assertTrue(gameId != bytes32(0), "Admin should be able to create game");
    }

    // =========================================================================
    //                          JOIN GAME TESTS
    // =========================================================================

    function test_JoinGame_Heads() public {
        bytes32 gameId = gam3hub.createGame(_getCommitment("seed1"));

        vm.prank(player1);
        gam3hub.joinGame{value: BASE_BET}(1, _getSig(player1, 1, gameId)); 

        Gam3Hub.GameView memory game = gam3hub.getGame(gameId);
        assertEq(game.totalPlayers, 1, "Should have 1 player");
    }

    function test_JoinGame_Tails() public {
        bytes32 gameId = gam3hub.createGame(_getCommitment("seed1"));

        vm.prank(player1);
        gam3hub.joinGame{value: 2 ether}(0, _getSig(player1, 0, gameId)); 

        Gam3Hub.GameView memory game = gam3hub.getGame(gameId);
        assertEq(game.tailsPool, 2 ether);
    }

    function test_JoinGame_RevertUnauthorizedSignature() public {
        bytes32 gameId = gam3hub.createGame(_getCommitment("seed1"));
        
        // Try to join with a signature signed by a non-admin (player2)
        uint256 fakePk = 0xBAD;
        bytes32 messageHash = keccak256(abi.encodePacked(address(gam3hub), player1, uint8(1), gameId));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(fakePk, ethSignedMessageHash);
        bytes memory fakeSig = abi.encodePacked(r, s, v);

        vm.prank(player1);
        vm.expectRevert("Unauthorized: Call must be signed by admin");
        gam3hub.joinGame{value: BASE_BET}(1, fakeSig);
    }

    function test_JoinGame_RevertWrongPlayerInSignature() public {
        bytes32 gameId = gam3hub.createGame(_getCommitment("seed1"));
        
        // Signature is for player2, but player1 is calling
        bytes memory sigForP2 = _getSig(player2, 1, gameId);

        vm.prank(player1);
        vm.expectRevert("Unauthorized: Call must be signed by admin");
        gam3hub.joinGame{value: BASE_BET}(1, sigForP2);
    }

    function test_JoinGame_MultiplePlayers() public {
        bytes32 gameId = gam3hub.createGame(_getCommitment("seed1"));

        vm.prank(player1);
        gam3hub.joinGame{value: 1 ether}(1, _getSig(player1, 1, gameId));

        vm.prank(player2);
        gam3hub.joinGame{value: 2 ether}(0, _getSig(player2, 0, gameId));

        vm.prank(player3);
        gam3hub.joinGame{value: 3 ether}(1, _getSig(player3, 1, gameId));

        Gam3Hub.GameView memory game = gam3hub.getGame(gameId);
        assertEq(game.totalPlayers, 3);
    }

    function test_SettleGame() public {
        bytes32 seed = "seed1";
        bytes32 gameId = gam3hub.createGame(_getCommitment(seed));
        gam3hub.setPlatformFeePercentage(0);

        vm.prank(player1);
        gam3hub.joinGame{value: 1 ether}(1, _getSig(player1, 1, gameId)); 
        
        vm.prank(player2);
        gam3hub.joinGame{value: 2 ether}(0, _getSig(player2, 0, gameId)); 

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;
        
        gam3hub.settleGame(seed, _getCommitment("seed2"));
        Gam3Hub.GameView memory game = gam3hub.getGame(gameId);

        if (game.gameOutcome == 1) {
            vm.prank(player1);
            gam3hub.claim(gameId);
            assertEq(player1.balance, p1BalBefore + 3 ether);
        } else {
            vm.prank(player2);
            gam3hub.claim(gameId);
            assertEq(player2.balance, p2BalBefore + 3 ether);
        }
    }

    function test_SettleGame_VerifyProvablyFair() public {
        bytes32 seed = "provably_fair_seed";
        bytes32 gameId = gam3hub.createGame(_getCommitment(seed));

        vm.prank(player1);
        gam3hub.joinGame{value: 1 ether}(1, _getSig(player1, 1, gameId));

        gam3hub.settleGame(seed, _getCommitment("next_seed"));
        Gam3Hub.GameView memory game = gam3hub.getGame(gameId);

        // Verify using the public helper function
        uint8 verifiedOutcome = gam3hub.verifyGameOutcome(seed, game.prevRandao);
        assertEq(game.gameOutcome, verifiedOutcome, "Outcome must be verifiable with the same inputs");
    }
}
