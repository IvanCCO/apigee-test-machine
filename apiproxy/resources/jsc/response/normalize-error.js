const responseBody = JSON.parse(error.content);

context.setVariable("error.errorType", responseBody.code || "INTERNAL_ERROR");
context.setVariable( "error.errorMessage", responseBody.message || "An unknown error occurred",);
context.setVariable("error.errorStatusCode", responseBody.details || 500);
