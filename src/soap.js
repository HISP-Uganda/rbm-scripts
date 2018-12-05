const soap = require('soap');
const url = 'http://10.10.69.141:4740/LAISWebServiceP/RBME?WSDL';
const args = {period: '2017Q1'};
soap.createClient(url, function(err, client) {
    client.getlistOfLAM08(args, function(err, result) {
        console.log(err);
        console.log(result);
    });
});