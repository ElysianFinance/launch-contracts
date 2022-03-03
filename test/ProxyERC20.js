
const { ensureOnlyExpectedMutativeFunctions, toUnit, toBN, mockToken} = require('../src/utils');
const chai = require("chai");
const chaiBnEqual = require("chai-bn-equal");
const chaiAsPromised = require("chai-as-promised");
const TokenState = artifacts.require('TokenState');
const truffleAssert = require('truffle-assertions');
const ProxyERC20 = artifacts.require("ProxyERC20");

chai.use(chaiAsPromised);
chai.use(chaiBnEqual);
chai.should();

contract('ProxyERC20', accounts => {

    const account_owner = accounts[0];
    const account_user1 = accounts[1];
    const account_user2 = accounts[2];

	it('Deploy mock token and test transfers', async () => {
        const { token, tokenState, proxy } = await mockToken({
			accounts
		});

		// Give some tokens to account1 and account2
		await token.__transferByProxy(account_owner, account_user1, toUnit('100'), {
			from: account_owner,
		});
		await token.__transferByProxy(account_owner, account_user2, toUnit('100'), {
			from: account_owner,
		});
	});

	it('only known functions are mutative', async () => {
        const { token, tokenState, proxy } = await mockToken({
			accounts
		});

		ensureOnlyExpectedMutativeFunctions({
			abi: proxy.abi,
			ignoreParents: ['Proxy'],
			hasFallback: true,
			expected: ['transfer', 'transferFrom', 'approve'],
		});
	});
});