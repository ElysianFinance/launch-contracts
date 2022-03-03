const fs = require('fs');
const path = require('path');
const { toBN, toWei, fromWei, hexToAscii, rightPad, asciiToHex} = require('web3-utils');
const chaiBnEqual = require("chai-bn-equal");
 
const constants = {
	BUILD_FOLDER: 'build',
	CONTRACTS_FOLDER: 'contracts',
	COMPILED_FOLDER: 'compiled',
	FLATTENED_FOLDER: 'flattened',
	CONFIG_FILENAME: 'config.json',
	OWNER_ACTIONS_FILENAME: 'owner-actions.json',
	DEPLOYMENT_FILENAME: 'deployment.json',
    DEPLOY_PARAMETERS_FILENAME: 'parameters.json',
	ZERO_ADDRESS: '0x' + '0'.repeat(40),
};

const networks = ['local', 'kovan', 'rinkeby', 'ropsten', 'mainnet', 'goerli', 'ganache', 'tests'];

const chainIdMapping = Object.entries({
	1: {
		network: 'mainnet',
	},
	3: {
		network: 'ropsten',
	},
	4: {
		network: 'rinkeby',
	},
	5: {
		network: 'goerli',
	},
	42: {
		network: 'kovan',
	},
    // Ganache fork of bsc
	1337: {
		network: 'bsc',
		fork: true,
	},    
	// Hardhat fork of mainnet: https://hardhat.org/config/#hardhat-network
	31337: {
		network: 'mainnet',
		fork: true,
	},
	// OVM networks: see https://github.com/ethereum-optimism/regenesis/
	10: {
		network: 'mainnet',
		useOvm: true,
	},
	69: {
		network: 'kovan',
		useOvm: true,
	},
	'-1': {
		// no chain ID for this currently
		network: 'goerli',
		useOvm: true,
	},
	// now append any defaults
}).reduce((memo, [id, body]) => {
	memo[id] = Object.assign({ useOvm: false, fork: false }, body);
	return memo;
}, {});

const getNetworkFromId = ({ id }) => chainIdMapping[id];

const ensureNetwork = network => {
	if (!networks.includes(network)) {
		throw Error(
			`Invalid network name of "${network}" supplied. Must be one of ${networks.join(', ')}.`
		);
	}
};
 
const loadConnections = ({ network }) => {
	let providerUrl;

    switch (network) {
        case 'local':
            providerUrl = `http://`
            break;
        case `kovan`:
            providerUrl = `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
            break;
        case `rinkeby`:
            providerUrl = `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
            break;
        case `ropsten`:
            providerUrl = `https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
            break;
        case `mainnet`:
            providerUrl = `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
            break;
        case `goerli`:
            providerUrl = `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
            break;
        case `ganache`:
            providerUrl = `http://localhost:8545`
            break;
        default:
            providerUrl = `http://`
            break;
    }

	
	const privateKey = process.env.PRIVATE_KEY;

	const etherscanUrl =
		network === 'bsc' ? 'https://api.bscscan.com/api' : `https://api-${network}.bscscan.com/api`;

	const etherscanLinkPrefix = `https://${network !== 'bsc' ? network + '.' : ''}bscscan.com`;
	return { providerUrl, privateKey, etherscanUrl, etherscanLinkPrefix };
};

const getPathToNetwork = ({ network, file = 'deployment.json' } = {}) => {
    const dirName = `${__dirname}`.replace("\src", "")
    return path.join(dirName, 'deployed', network, file);
}
	
const toBytes32 = key => rightPad(asciiToHex(key), 64);

function ensureOnlyExpectedMutativeFunctions({
	abi,
	hasFallback = false,
	expected = [],
	ignoreParents = [],
}) {

	arrayEquals = function(a, b) {
		return (
		  a.length === b.length &&
		  a.every((value, index) => value === b[index])
		);
	};
	
	const removeSignatureProp = abiEntry => {
		// Clone to not mutate anything processed by truffle
		const clone = JSON.parse(JSON.stringify(abiEntry));
		// remove the signature in the cases where it's in the parent ABI but not the subclass
		delete clone.signature;
		return clone;
	};

	const combinedParentsABI = ignoreParents
		.reduce(
			(memo, parent) => memo.concat(artifacts.require(parent, { ignoreLegacy: true }).abi),
			[]
		)
		.map(removeSignatureProp);

	const fncs = abi
		.filter(
			({ type, stateMutability }) =>
				type === 'function' && stateMutability !== 'view' && stateMutability !== 'pure'
		)
		.map(removeSignatureProp)
		.filter(
			entry =>
				!combinedParentsABI.find(
					parentABIEntry => JSON.stringify(parentABIEntry) === JSON.stringify(entry)
				)
		)
		.map(({ name }) => name);

	let compare = arrayEquals(fncs.sort(), expected.sort())
	assert(compare == true, 'Mutative functions should only be those expected.')

	const fallbackFnc = abi.filter(({ type, stateMutability }) => type === 'fallback');

	assert.equal(
		fallbackFnc.length > 0,
		hasFallback,
		hasFallback ? 'No fallback function found' : 'Fallback function found when not expected'
	);
};

async function mockToken ({
	accounts,
	name = 'name',
	symbol = 'ABC',
	decimals = 18,
	supply = 1e8,
	skipInitialAllocation = false,
}) {
	const [deployerAccount, owner] = accounts;
	const totalSupply = toWei(supply.toString());

	const proxy = await artifacts.require('ProxyERC20').new(owner, { from: deployerAccount });
	// set associated contract as deployerAccount so we can setBalanceOf to the owner below
	const tokenState = await artifacts
		.require('TokenState')
		.new(owner, deployerAccount, { from: deployerAccount });

	if (!skipInitialAllocation && supply > 0) {
		await tokenState.setBalanceOf(deployerAccount, totalSupply, { from: deployerAccount });
	}

	const token = await artifacts.require("ExternStateToken").new(
		...[proxy.address, tokenState.address, name, symbol, totalSupply, decimals, owner]
	);
	await Promise.all([
		tokenState.setAssociatedContract(token.address, { from: owner }),
		proxy.setTarget(token.address, { from: owner }),
	]);
	 
	return { token, tokenState, proxy };
};

const toUnit = amount => toBN(toWei(amount.toString(), 'ether'));
const fromUnit = amount => fromWei(amount, 'ether');

module.exports = {
    constants,
	networks,
    ensureNetwork,
    loadConnections,
    getPathToNetwork,
    toBytes32,
	ensureOnlyExpectedMutativeFunctions,
	toUnit,
	toBN,
	mockToken
};
