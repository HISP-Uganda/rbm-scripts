const rq = require('request-promise');
const soap = require('./soap');

const winston = require('./winston');


const dataSet = require('./lands-quarterly-mapping.json');


const processQuarterly = async () => {

    const lam08 = await soap.getLAM08('2017Q1');

    return lam08;

};

processQuarterly().then(response => {
    console.log(response);
});