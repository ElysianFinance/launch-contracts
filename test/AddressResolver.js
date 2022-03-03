

const { assert } = require('chai');
const { BN, constants, expectEvent, shouldFail } = require('openzeppelin-test-helpers');
const w3utils = require('web3-utils');
const truffleAssert = require('truffle-assertions');
const {toBytes32} = require("../src/utils");
const AddressResolver = artifacts.require("AddressResolver");

contract("AddressResolver", accounts => {

    const account_owner = accounts[0];
    const account_user1 = accounts[1];
    const account_user2 = accounts[2];

	it('when invoked with no entries, reverts', async () => {
        const resolver = await AddressResolver.deployed();
		await truffleAssert.reverts(
			resolver.requireAndGetAddress(toBytes32('xxx'), 'Some error'),
			'Some error'
		);
	});
 
    it('should add three separate addresses', async () => {
        const resolver = await AddressResolver.deployed();

        await truffleAssert.passes(
            resolver.importAddresses(
                ['first', 'second', 'third'].map(toBytes32),
                [account_owner, account_user1, account_user2],
                { from: account_owner }
            )
        )
    });

    it('then requireAndGetAddress() returns the same as the public mapping', async () => {
        const resolver = await AddressResolver.deployed();

        assert.equal(await resolver.requireAndGetAddress(toBytes32('third'), 'Error'), account_user2);
        assert.equal(await resolver.requireAndGetAddress(toBytes32('second'), 'Error'), account_user1);
    });

    it('when invoked with an unknown entry, reverts', async () => {
        const resolver = await AddressResolver.deployed();

        await truffleAssert.reverts(
            resolver.requireAndGetAddress(toBytes32('other'), 'Some error again'),
            'Some error again'
        );
    }); 

})