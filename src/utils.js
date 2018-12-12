const url = require('url').URL;
const _ = require('lodash');
const rq = require('request-promise');
const moment = require('moment');

// TODO remove username and password from script
const username = 'Jeric';
const password = '20SeraPkp8FA!18';
const dhisUrl = 'https://rbme.environment.gov.rw';

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
            return [o.name.toLocaleLowerCase(), o.id];
        } else if (dataSet.orgUnitStrategy.value === 'code') {
            return [o.code.toLocaleLowerCase(), o.id];
        }
        return [o.id, o.id];
    }));
    let validatedData = [];


    forms.forEach(f => {
        f.dataElements.forEach(element => {
            if (element.mapping) {
                const foundData = data[element.mapping.value];
                if (foundData) {
                    const groupedData = foundData.map(d => {
                        return {
                            period: d[dataSet.periodColumn.value],
                            value: d[dataSet.dataValueColumn.value],
                            orgUnit: d[dataSet.orgUnitColumn.value] ? d[dataSet.orgUnitColumn.value].toLocaleLowerCase() : null,
                            dataElement: element.id,
                            categoryOptionCombo: d[dataSet.categoryOptionComboColumn.value] ? d[dataSet.categoryOptionComboColumn.value].toLocaleLowerCase() : null
                        }
                    });
                    validatedData = [...validatedData, ...groupedData];
                }
            }
        });

        f.categoryOptionCombos.forEach(coc => {
            _.forOwn(coc.mapping, (mapping, dataElement) => {
                validatedData.filter(v => {
                    return v.categoryOptionCombo === mapping.value.toLocaleLowerCase() && v.dataElement === dataElement;
                }).forEach(d => {
                    if (d['orgUnit']) {
                        const orgUnit = dataSetUnits[d['orgUnit']];
                        if (orgUnit) {
                            dataValues = [...dataValues, {
                                dataElement,
                                value: d['value'],
                                period: d['period'],
                                categoryOptionCombo: coc.id,
                                orgUnit
                            }]
                        }
                    }
                });
            });
        });
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

module.exports.enumerateDates = (startDate, endDate, addition, format) => {
    const dates = [];
    const currDate = moment(startDate).startOf(addition);
    const lastDate = moment(endDate).startOf(addition);
    dates.push(currDate.clone().format(format));
    while (currDate.add(1, addition).diff(lastDate) <= 0) {
        dates.push(currDate.clone().format(format));
    }
    return dates;
};