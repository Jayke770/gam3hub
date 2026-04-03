// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Gam3Hub} from "../src/Gam3Hub.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Gam3HubScript is Script {
    address public initialOwner;

    function setUp() public {
        // Set initial owner from env or default to sender
        initialOwner = vm.envOr("INITIAL_OWNER", msg.sender);
    }

    function run() public {
        vm.startBroadcast();

        // 1. Deploy Implementation
        Gam3Hub implementation = new Gam3Hub();

        // 2. Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            Gam3Hub.initialize.selector,
            initialOwner
        );

        // 3. Deploy Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );

        vm.stopBroadcast();
        
        // Log the Proxy address (this is the address users will interact with)
        // console.log("Gam3Hub Proxy deployed at:", address(proxy));
    }
}
