const fs = require('fs');
const path = require('path');
const w3utils =  require('web3-utils');

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
	
const toBytes32 = key => w3utils.rightPad(w3utils.asciiToHex(key), 64);

module.exports = {
    constants,
	networks,
    ensureNetwork,
    loadConnections,
    getPathToNetwork,
    toBytes32
};
