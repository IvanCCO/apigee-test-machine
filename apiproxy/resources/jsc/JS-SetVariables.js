const variable = context.getVariable("Context.variable1");
const variable2 = context.getVariable("SC.variable2");
const variable3 = context.getVariable("SC.Context.variable3");


context.setVariable("Context.variable1", 2);
context.setVariable("SC.variable2", 3);
context.setVariable("SC.Context.variable3", 4);


response.content = JSON.stringify({
    variable1: variable,
    variable2: variable2,
    variable3: variable3,
});