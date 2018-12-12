const rq = require('request-promise');
const csv2json = require("csvtojson");
const moment = require('moment');
const winston = require('./winston');


const serverUrl = 'http://10.10.82.196/AQUARIUS/Publish/AquariusPublishRestService.svc/';
const dataSet = require('./aquarius-mapping.json');

const utils = require('./utils');

let {
    fromDate,
    toDate
} = require('./options');

const login = async () => {
    const url = serverUrl + 'GetAuthToken';
    const params = {user: 'rbme', encPwd: 'D@ta!'};
    const response = await rq({uri: url, qs: params, encoding: null});
    return response.toString('utf8');
};


const downloadData = async (endpoint, params) => {

    try {
        const token = await login();
        const url = serverUrl + endpoint;
        params = {...params, token};
        const response = await rq({uri: url, qs: params, encoding: null});
        const responseString = response.toString('utf8');
        return await csv2json().fromString(responseString)
    } catch (error) {
        winston.log({level: 'warn', message: 'Something wired happened ' + JSON.stringify(e)});
    }
};

const form = dataSet.forms[0];
const dataElements = form.dataElements.filter(de => {
    return de.param
});

const fmt = 'Y[July]';

const processWaterData = async () => {
    let periods = [];
    if (fromDate && toDate) {
        periods = utils.enumerateDates(moment(fromDate), moment(toDate), 'year', fmt)
    } else {
        const year = moment().year();
        const period = year - 1 + 'July';
        periods = [period];
    }

    let responses = [];
    try {
        let data = await downloadData('GetDataSetsList', {});
        periods.forEach(async period => {
            let processed = [];

            dataElements.forEach(de => {
                const found = data.filter(d => {
                    return d['Parameter'] === de.param;
                });
                const realData = found.map(d => {
                    const val = {};
                    const date = moment(d['EndTime'], 'YYYY-MM-DD');

                    let financialYear;

                    const year = date.year();
                    const month = date.month();

                    if (month < 7) {
                        financialYear = year - 1 + 'July';
                    } else {
                        financialYear = year + 'July';
                    }

                    val['Parameter'] = de.mapping.value;
                    val['Category'] = 'default';
                    val['Location'] = d['LocationId'];
                    val['Value'] = d['Mean'];
                    val['Year'] = financialYear;
                    return val;
                }).filter(d => {
                    return d.Location && d.Year === period;
                });
                processed = [...processed, ...realData];
            });

            if (processed.length > 0) {
                const dataValues = utils.processData(dataSet, processed);

                const response = utils.insertData({dataValues});
                responses = [...responses, response];
            }
        });

    } catch (e) {
        responses = [...responses, e];
    }

    return responses;
};

processWaterData().then(response => {
    winston.log({level: 'info', message: JSON.stringify(response)})
});