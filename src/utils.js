const fs = require('fs');
const path = require('path');
const {
	toBN,
	toWei,
	fromWei,
	hexToAscii,
	rightPad,
	asciiToHex
} = require('web3-utils');
const chaiBnEqual = require("chai-bn-equal");
const truffleAssert = require('truffle-assertions');
const BN = require('bn.js');

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
	memo[id] = Object.assign({
		useOvm: false,
		fork: false
	}, body);
	return memo;
}, {});

const getNetworkFromId = ({
	id
}) => chainIdMapping[id];

const ensureNetwork = network => {
	if (!networks.includes(network)) {
		throw Error(
			`Invalid network name of "${network}" supplied. Must be one of ${networks.join(', ')}.`
		);
	}
};

const loadConnections = ({
	network
}) => {
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
	return {
		providerUrl,
		privateKey,
		etherscanUrl,
		etherscanLinkPrefix
	};
};

const getPathToNetwork = ({
	network,
	file = 'deployment.json'
} = {}) => {
	const dirName = `${__dirname}`.replace("\src", "")
	return path.join(dirName, 'deployed', network, file);
}

const toBytes32 = key => rightPad(asciiToHex(key), 64);
const fromBytes32 = key => hexToAscii(key);

function ensureOnlyExpectedMutativeFunctions({
	abi,
	hasFallback = false,
	expected = [],
	ignoreParents = [],
}) {

	arrayEquals = function (a, b) {
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
			(memo, parent) => memo.concat(artifacts.require(parent, {
				ignoreLegacy: true
			}).abi),
			[]
		)
		.map(removeSignatureProp);

	const fncs = abi
		.filter(
			({
				type,
				stateMutability
			}) =>
			type === 'function' && stateMutability !== 'view' && stateMutability !== 'pure'
		)
		.map(removeSignatureProp)
		.filter(
			entry =>
			!combinedParentsABI.find(
				parentABIEntry => JSON.stringify(parentABIEntry) === JSON.stringify(entry)
			)
		)
		.map(({
			name
		}) => name);

	let compare = arrayEquals(fncs.sort(), expected.sort())
	assert(compare == true, 'Mutative functions should only be those expected.')

	const fallbackFnc = abi.filter(({
		type,
		stateMutability
	}) => type === 'fallback');

	assert.equal(
		fallbackFnc.length > 0,
		hasFallback,
		hasFallback ? 'No fallback function found' : 'Fallback function found when not expected'
	);
};

async function mockToken({
	accounts,
	name = 'name',
	symbol = 'ABC',
	decimals = 18,
	supply = 1e8,
	skipInitialAllocation = false,
}) {
	const [deployerAccount, owner] = accounts;
	const totalSupply = toWei(supply.toString());

	const proxy = await artifacts.require('ProxyERC20').new(owner, {
		from: deployerAccount
	});
	// set associated contract as deployerAccount so we can setBalanceOf to the owner below
	const tokenState = await artifacts
		.require('TokenState')
		.new(owner, deployerAccount, {
			from: deployerAccount
		});

	if (!skipInitialAllocation && supply > 0) {
		await tokenState.setBalanceOf(deployerAccount, totalSupply, {
			from: deployerAccount
		});
	}

	const token = await artifacts.require("ExternStateToken").new(
		...[proxy.address, tokenState.address, name, symbol, totalSupply, decimals, owner]
	);
	await Promise.all([
		tokenState.setAssociatedContract(token.address, {
			from: owner
		}),
		proxy.setTarget(token.address, {
			from: owner
		}),
	]);

	return {
		token,
		tokenState,
		proxy
	};
};

async function onlyGivenAddressCanInvoke({
	fnc,
	args,
	accounts,
	address = undefined,
	skipPassCheck = false,
	reason = ""
}) {
	for (const user of accounts) {
		if (user === address) {
			continue;
		}
		await truffleAssert.reverts(
			fnc(...args, {
				from: user
			}),
			reason
		);
	}
	if (!skipPassCheck && address) {
		await fnc(...args, {
			from: address
		});
	}
};

// Invoke a function on a proxy target via the proxy. It's like magic!
async function proxyThruTo({
	proxy,
	target,
	fncName,
	from,
	call = false,
	args = [], 
	web3
}) {
	const abiEntry = target.abi.find(({
		name
	}) => name === fncName);
	const data = web3.eth.abi.encodeFunctionCall(abiEntry, args);

	if (call) {
		const response = await web3.eth.call({
			to: proxy.address,
			data
		});
		const decoded = web3.eth.abi.decodeParameters(abiEntry.outputs, response);

		// if there are more than 1 returned params, return the entire object, otherwise
		// just the single parameter as web3 does using regular contract calls
		return abiEntry.outputs.length > 1 ? decoded : decoded[0];
	} else {
		return proxy.sendTransaction({
			data,
			from
		});
	}
}

async function mockGenericContractFnc ({ instance, fncName, mock, returns = [], web3 }) {
	// Adapted from: https://github.com/EthWorks/Doppelganger/blob/master/lib/index.ts
	const abiEntryForFnc = artifacts.require(mock).abi.find(({ name }) => name === fncName);

	if (!fncName || !abiEntryForFnc) {
		throw Error(`Cannot find function "${fncName}" in the ABI of contract "${mock}"`);
	}
	const signature = web3.eth.abi.encodeFunctionSignature(abiEntryForFnc);
	const outputTypes = abiEntryForFnc.outputs.map(({ type }) => type);
	const responseAsEncodedData = web3.eth.abi.encodeParameters(outputTypes, returns);

	await instance.mockReturns(signature, responseAsEncodedData);
};

function send(payload, web3) {
    if (!payload.jsonrpc) payload.jsonrpc = '2.0';
    if (!payload.id) payload.id = new Date().getTime();

    return new Promise((resolve, reject) => {
        web3.currentProvider.send(payload, (error, result) => {
            if (error) return reject(error);

            return resolve(result);
        });
    });
};

/**
 *  Mines a single block in Ganache (evm_mine is non-standard)
 */
function mineBlock(web3) {
	send({ method: 'evm_mine' }, web3);
} 

/**
 *  Gets the time of the last block.
 */
const currentTime = async () => {
    const { timestamp } = await web3.eth.getBlock('latest');
    return timestamp;
};

/**
 *  Increases the time in the EVM.
 *  @param seconds Number of seconds to increase the time by
 */
async function fastForward(seconds, web3) {
    // It's handy to be able to be able to pass big numbers in as we can just
    // query them from the contract, then send them back. If not changed to
    // a number, this causes much larger fast forwards than expected without error.
    if (BN.isBN(seconds)) seconds = seconds.toNumber();

    // And same with strings.
    if (typeof seconds === 'string') seconds = parseFloat(seconds);

    let params = {
        method: 'evm_increaseTime',
        params: [seconds],
    };

    /*if (hardhat.ovm) {
        params = {
            method: 'evm_setNextBlockTimestamp',
            params: [(await currentTime()) + seconds],
        };
    }*/

    await send(params, web3);
    await mineBlock(web3);
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
	fromBytes32,
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	toUnit,
	toBN,
	mockToken,
	proxyThruTo,
	mockGenericContractFnc,
	fastForward,
	currentTime,

};