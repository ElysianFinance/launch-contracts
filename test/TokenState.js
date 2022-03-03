const {
    ensureOnlyExpectedMutativeFunctions,
    toUnit,
    toBN
} = require('../src/utils');
const chai = require("chai");
const chaiBnEqual = require("chai-bn-equal");
const chaiAsPromised = require("chai-as-promised");
const TokenState = artifacts.require('TokenState');
const truffleAssert = require('truffle-assertions');
const w3utils = require('web3-utils');

chai.use(chaiBnEqual);
chai.use(chaiAsPromised);
chai.should();

contract('TokenState', accounts => {

    const account_owner = accounts[0];
    const account_user1 = accounts[1];
    const account_user2 = accounts[2];


    it('ensure only known functions are mutative', async () => {
        ensureOnlyExpectedMutativeFunctions({
            abi: TokenState.abi,
            ignoreParents: ['State'],
            expected: ['setAllowance', 'setBalanceOf'],
        });
    });

    it('when invoked, it sets the correct allowance', async () => {

        let instance = await TokenState.new(account_owner, account_owner, {
            from: account_owner,
        });

        assert.equal(await instance.allowance(account_owner, account_user1), '0');
        await instance.setAllowance(account_owner, account_user1, toUnit('100'), {
            from: account_owner
        });

        const allowance = await instance.allowance(account_owner, account_user1);
        assert.equal((w3utils.fromWei(allowance, "ether")).toString(), '100');

        //But not for any other user
        assert.equal(await instance.allowance(account_user1, account_owner), '0');
        assert.equal(await instance.allowance(account_owner, account_user2), '0');
    });

    it('setBalance should fail from user account', async () => {
        let instance = await TokenState.new(account_owner, account_owner, {
            from: account_owner,
        });

        await truffleAssert.reverts(
            instance.setBalanceOf(account_user2, toUnit('25'), {
                from: account_user1
            }),
            'Only the associated contract can perform this action.'
        );
    })

    it('when invoked, it sets the correct balance', async () => {
        let instance = await TokenState.new(account_owner, account_owner, {
            from: account_owner,
        });

        assert.equal(await instance.balanceOf(account_user2), '0');
        await instance.setBalanceOf(account_user2, toUnit('25'), {
            from: account_owner
        });
        const balance = await instance.balanceOf(account_user2)
        assert.equal((w3utils.fromWei(balance, "ether")).toString(), '25');

        // but not for any other user
        assert.equal(await instance.balanceOf(account_user1), '0');
    });


});