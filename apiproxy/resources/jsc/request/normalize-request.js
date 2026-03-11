const requestBody = JSON.parse(request.content);


const accountId = requestBody.accountId || requestBody.queryParams.accountId || undefined;
const content = requestBody.content || formatContent(requestBody.content) || undefined;

const payload = requestBody.payload ? formatContent(requestBody.payload) : {};

remove(requestBody, "payload")

var params = mergedObject(requestBody, ["params", "additional_information"])

if(!params.value){
    if(requestBody.value){
        params.value = requestBody.value;
    } else if(params.amount){
        params.value = params.amount;
        remove(params, "amount");
    }
}


const normalizedRequest = {
    account_id: accountId,
    safe_place: JSON.parse(context.getVariable("safe_place")),
    params: params,
    content: content,
    payload: payload
}

request.content = JSON.stringify(normalizedRequest, null, 4);