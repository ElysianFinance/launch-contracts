const MixinResolver = artifacts.require('MixinResolver');
const TestableMixinResolver = artifacts.require('TestableMixinResolver');
const AddressResolver = artifacts.require('AddressResolver');
const truffleAssert = require('truffle-assertions');

const {
	ensureOnlyExpectedMutativeFunctions,
	toBytes32,
	fromBytes32,
	constants: {
		ZERO_ADDRESS
	},
} = require('../src/utils.js');

contract('MixinResolver', async accounts => {
	const [deployerAccount, owner, account1, account2, account3] = accounts;
	const addressesToCache = [{
			name: 'Example_1',
			address: ZERO_ADDRESS
		},
		{
			name: 'Example_2',
			address: ZERO_ADDRESS
		},
		{
			name: 'Example_3',
			address: ZERO_ADDRESS
		}
	];


	it('ensure only known functions are mutative', () => {
		ensureOnlyExpectedMutativeFunctions({
			abi: MixinResolver.abi,
			ignoreParents: ['OwnedwManager'],
			expected: ['rebuildCache'],
		});
	});

	it('it fails when instantiated directly', async () => {
		try {
			let resolver = await AddressResolver.new(owner, {
				from: deployerAccount
			});

			await MixinResolver.new(resolver.address, new Array(24).fill('').map(toBytes32));
			assert.fail('Should not have succeeded');
		} catch (err) {
			// Note: this fails with the below:
			// 		Error: MixinResolver error: contract binary not set. Can't deploy new instance.
			// 		This contract may be abstract, not implement an abstract parent's methods completely
			// 		or not invoke an inherited contract's constructor correctly
			// This is because the contract's bytecode is empty as solc can tell it doesn't implement the superclass
			// of Owned in its constructor
		}
	});

	it('resolver set on construction', async () => {
		let resolver = await AddressResolver.new(owner, {
			from: deployerAccount
		});
		let instance = await TestableMixinResolver.new(owner, resolver.address, {
			from: deployerAccount,
		});


		const actual = await instance.resolver();
		assert.equal(actual, resolver.address);
	});


});