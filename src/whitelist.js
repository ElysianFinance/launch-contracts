const deployment = require("../deployed/ganache/deployment.json");

const whitelist = [
    //Tokens accepted
    {name:"DAI", address: "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3"}, 
    {name:"ETH", address: "0x0000000000000000000000000000000000000000"},
    {name:"ExchangeRates", address: deployment.targets["ExchangeRates"].address},
    {name:"User1", address: "0x73122a294E2cb6c22947206E45fa7B8314158fd4"}, 
    {name:"User2", address: "0x315C81fbfECb0E8CEd3e000e2f8817C45d1998c8"}, 
]

module.exports = whitelist;