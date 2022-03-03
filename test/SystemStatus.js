const { assert } = require('chai');
const { BN, constants, expectEvent, shouldFail } = require('openzeppelin-test-helpers');
const SystemStatus = artifacts.require("SystemStatus");
const w3utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const {toBytes32} = require("../src/utils");

contract("SystemStatus", accounts => {

    const account_owner = accounts[0];
    const account_user1 = accounts[1];
    const account_user2 = accounts[2];
 
    it("Should be owned by first account", async () => {
        const instance = await SystemStatus.deployed();
        const owner = await instance.owner.call();
        assert.equal(owner, account_owner);
    })

    it("Should not fail querying system status", async () => {
        const instance = await SystemStatus.deployed();

        await truffleAssert.passes(
            instance.requireSystemActive.call()
        );
    })

    it("Should fail suspending system", async () => {

        const instance = await SystemStatus.deployed();

        await truffleAssert.reverts(
            instance.suspendSystem(1024, {from: account_user1}),
            "Restricted to access control list."
        );
        
    })
    it("Should update access control", async () => {
        const instance = await SystemStatus.deployed();

        await truffleAssert.passes(
            instance.updateAccessControl(
                toBytes32("System"),
                account_owner,
                true,
                true
            )
        );
    })
 
    it("Should resume system", async () => {
        const instance = await SystemStatus.deployed();

        await truffleAssert.passes(
            instance.resumeSystem()
        );
    })
})