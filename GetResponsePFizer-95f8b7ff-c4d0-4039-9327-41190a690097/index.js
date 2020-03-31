'use strict';

var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({ region: 'us-east-1' });
var documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

exports.handler = (event, context, callback) => {
    console.log(event);
    try {
        dispatch(event,
            (response) => {
                
                callback(null, response);
            });
    }
    catch (err) {
        callback(err);
    }
};

function dispatch(intentRequest, callback) {

    if (!intentRequest.currentIntent.slots.DrugName && !intentRequest.sessionAttributes.DrugName) {
        callback(elicitSlot(intentRequest.sessionAttributes, { 'contentType': 'PlainText', 'content': 'What is the drug name?' }, intentRequest.currentIntent.name, { 'DrugName': null }, 'DrugName'));
    }
    if (intentRequest.currentIntent.slots.DrugName) {
        intentRequest.sessionAttributes = {
            "DrugName": intentRequest.currentIntent.slots.DrugName,
            "customerType": intentRequest.sessionAttributes !=null? intentRequest.sessionAttributes.customerType ? intentRequest.sessionAttributes.customerType : "CONSUMER"
            :"CONSUMER"
        }
    }
    if(intentRequest.sessionAttributes.DrugName)
    {
        intentRequest.sessionAttributes.DrugName = intentRequest.sessionAttributes.DrugName.replace(/[.]/g,"");
    }
    getDynamoData(intentRequest).then((result) => {
            console.log(intentRequest.sessionAttributes);
            callback(close(intentRequest.sessionAttributes, 'Fulfilled', { 'contentType': 'PlainText', 'content': `${result}` }));
        })
        .catch((error) => {
            console.log(error);

            callback(close(intentRequest.sessionAttributes, 'Failed', { 'contentType': 'PlainText', 'content': `Error Ocured : ${error}` }));
        });

}

function elicitSlot(sessionAttributes, message, intentName, slots, slotToElicit) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitSlot',
            message,
            intentName,
            slots,
            slotToElicit
        },
    };
}

function close(sessionAttributes, fulfillmentState, message) {
    
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState,
            message,
        },
    };
}



function getDynamoData(intentRequest) {

    const intentName = intentRequest.currentIntent.name;
    const slots = intentRequest.currentIntent.slots;
    let drugName = "";
    if (slots.DrugName) {
        drugName = slots.DrugName.toUpperCase();
        
    }
    else {
        drugName = intentRequest.sessionAttributes.DrugName.toUpperCase();
    }
    console.log(drugName);
    
    
    

    let customerType = "";
    if (intentRequest.sessionAttributes.customerType) {
        customerType = intentRequest.sessionAttributes.customerType.toUpperCase();
    }
    else {
        customerType = "";
    }
    var params = {
        TableName: 'PfizerDB',
        ExpressionAttributeValues: {
            ':drugName': drugName
        },
        KeyConditionExpression: 'DrugName=:drugName',

    };

    return new Promise((resolve, reject) => {
        documentClient.query(params, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(fetchData(data, intentName, customerType, drugName));
            }

        });
    });

}

function fetchData(data, intentName, customerType, drugName) {
    var name;
    var name1;
    for (var i = 0; i < data.Items.length; i++) {
        for (name in data.Items[i]) {
            if (name === intentName) {
                for (name1 in data.Items[i][name]) {
                    if (name1 === customerType || customerType === "") {
                        if (customerType === "") {
                            name1 = "CONSUMER";
                        }
                        if (data.Items[i][name][name1].AnswerType === "Static") {
                            return (data.Items[i][name][name1].Answer);
                        }
                        else if (data.Items[i][name][name1].AnswerType === "BinaryDynamic") {
                            if (data.Items[i][name][name1].Value === "Yes") {
                                return (data.Items[i][name][name1].AnswerYes.replace(/{DrugName}/g, drugName).replace(/{AttributeValue}/g, "Yes"));
                            }
                            else {
                                return (data.Items[i][name][name1].AnswerNo.replace(/{DrugName}/g, drugName).replace(/{AttributeValue}/g, "No"));
                            }
                        }
                        else if (data.Items[i][name][name1].AnswerType === "CardinalDynamic") {
                            var Values = data.Items[i][name][name1].Value;
                            return (data.Items[i][name][name1].Answer.replace(/{DrugName}/g, drugName).replace(/{AttributeValue}/g, Values));

                        }
                        else if (data.Items[i][name][name1].AnswerType === "Dynamic") {
                            return (data.Items[i][name][name1].Answer.replace(/{DrugName}/g, drugName).replace(/{AttributeValue}/g, data.Items[i][name][name1].Value));
                        }

                    }
                }


            }
        }




    }
}
