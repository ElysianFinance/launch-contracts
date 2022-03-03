const {
    assert
} = require('chai');
const {
    BN,
    constants,
    expectEvent,
    shouldFail
} = require('openzeppelin-test-helpers');
const Presale = artifacts.require("Presale");
const w3utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');

const deployPathPLYS = "/data/code/BSC/Elysian/C-pLYS/";
const deployment = require("../deployed/ganache/deployment.json");
const ancillaryContracts = require(`${deployPathPLYS}deployment.json`);
const otherAbis = require(`${deployPathPLYS}build/contracts/PreElysianToken.json`);

const IERC20 = artifacts.require("IERC20");
const {
    toBytes32
} = require("../src/utils");

contract("Presale", accounts => {

    const preElysian = "";
    const account_owner = accounts[0];
    const account_user1 = accounts[1];
    const account_user2 = accounts[2];

    it("Should be owned by first account", async () => {
        const instance = await Presale.deployed();
        const owner = await instance.owner.call();
        assert.equal(owner, account_owner);
    })

    it("Should disable contract", async () => {
        const instance = await Presale.deployed();

        await truffleAssert.passes(
            instance.flagExecution(
                true, {
                    from: account_owner
                }
            )
        );
    })

    it("Should set PreElysian", async () => {
        const instance = await Presale.deployed();

        await truffleAssert.passes(
            instance.setPreElysian(
                ancillaryContracts.networks["ganache"].PreElysianToken, {
                    from: account_owner
                }
            )
        );

    })

    it("Should enable contract", async () => {
        const instance = await Presale.deployed();

        await truffleAssert.passes(
            instance.flagExecution(
                false, {
                    from: account_owner
                }
            )
        );

    })
    /*
        it("Should collect pLYS with DAI", async () => {
            const DAI = await IERC20.at("0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3");
            const instance = await Presale.deployed();
            
            await truffleAssert.passes(
                DAI.approve(
                    deployment.targets["Presale"].address,
                    w3utils.toWei(`${1000000}`, "ether"),
                    {from: account_user1}
                )
            );

            await truffleAssert.passes(
                instance.collectPLYS(
                    w3utils.toWei(`${100}`, "ether"),
                    toBytes32("DAI"),
                    {from: account_user1}
                )
            );
        })   

        it("Should collect pLYS with ETH", async () => {
            const instance = await Presale.deployed();
            
            await truffleAssert.passes(
                 instance.collectPLYSEth(
                    w3utils.toWei(`${1}`, "ether"),
                    {
                      from: account_user1,
                      value: w3utils.toWei(`${0.1}`, "ether")
                    }
                )
            );
        })    
    */

});