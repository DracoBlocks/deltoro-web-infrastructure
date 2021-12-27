exports.handler = function (event, _context, callback) {
  var queryStringParameters = event.queryStringParameters;

  if (queryStringParameters.authToken === process.env.PAYPAL_AUTH_TOKEN) {
    callback(null, generateAllow("me", event.methodArn));
  } else {
    callback(null, generateDeny("me", event.methodArn));
  }
};

// Helper function to generate an IAM policy
var generatePolicy = function (principalId, effect, resource) {
  var authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    var policyDocument = {};
    policyDocument.Version = "2012-10-17";
    policyDocument.Statement = [];
    var statementOne = {};
    statementOne.Action = "execute-api:Invoke";
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

var generateAllow = function (principalId, resource) {
  return generatePolicy(principalId, "Allow", resource);
};

var generateDeny = function (principalId, resource) {
  return generatePolicy(principalId, "Deny", resource);
};
