const url = require('url').URL;
const _ = require('lodash');
const rq = require('request-promise');
const username = 'Jeric';
const password = '20SeraPkp8FA!18';
const dhisUrl = 'http://localhost:8080';

const dhis2 = new url(dhisUrl);

dhis2.username = username;
dhis2.password = password;

const baseUrl = dhis2.toString() + 'api/';

const DATA_URL = baseUrl + 'dataValueSets';

module.exports.ouMappings = require('./orgUnitMapping.json');

const nest = (seq, keys) => {
    if (!keys.length)
        return seq;
    const first = keys[0];
    const rest = keys.slice(1);
    return _.mapValues(_.groupBy(seq, first), (value) => {
        return nest(value, rest)
    });
};

module.exports.processData = (dataSet, data) => {
    const forms = dataSet.forms;
    let dataValues = [];
    data = nest(data, [dataSet.dataElementColumn.value]);
    const dataSetUnits = _.fromPairs(dataSet.organisationUnits.map(o => {
        if (dataSet.orgUnitStrategy.value === 'name') {
            return [o.name, o.id];
        } else if (dataSet.orgUnitStrategy.value === 'code') {
            return [o.code, o.id];
        }
        return [o.id, o.id];
    }));

    forms.forEach(f => {
        let p = {};
        f.dataElements.forEach(element => {
            if (element.mapping) {
                const foundData = data[element.mapping.value];
                // console.log(foundData);
                let groupedData = {};
                if (foundData) {
                    groupedData = _.fromPairs(foundData.map(d => {
                        return [d[dataSet.categoryOptionComboColumn.value], {
                            period: d[dataSet.periodColumn.value],
                            value: d[dataSet.dataValueColumn.value],
                            orgUnit: d[dataSet.orgUnitColumn.value]
                        }]
                    }));

                    const obj = _.fromPairs([[element.id, groupedData]]);
                    p = {...p, ...obj}
                }
            }
        });
        data = p;
        if (data) {
            f.categoryOptionCombos.forEach(coc => {
                _.forOwn(coc.mapping, (mapping, dataElement) => {
                    // console.log(dataElement);
                    if (data[dataElement]) {
                        const orgUnit = dataSetUnits[data[dataElement][mapping.value]['orgUnit']];
                        if (orgUnit) {
                            dataValues = [...dataValues, {
                                dataElement,
                                value: data[dataElement][mapping.value]['value'],
                                period: data[dataElement][mapping.value]['period'],
                                categoryOptionCombo: coc.id,
                                orgUnit
                            }]
                        }
                    }
                })
            });
        }
    });

    return dataValues;
};

module.exports.insertData = data => {
    const options = {
        method: 'POST',
        uri: DATA_URL,
        body: data,
        json: true
    };
    return rq(options);
};