const responseBody = JSON.parse(response.content);
const anotherScCall = context.getVariable("sc.response");

response.content = JSON.stringify({
  main: responseBody,
  another: anotherScCall,
});
