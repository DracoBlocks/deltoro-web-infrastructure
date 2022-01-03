import * as cdk from "@aws-cdk/core";
import { ApiGatewayToSqs } from "@aws-solutions-constructs/aws-apigateway-sqs";
import {} from "@aws-cdk/aws-lambda";
import { Config } from "./config";

export class PaymentQueue extends cdk.Stack {
  private readonly config: Config;

  constructor(
    scope: cdk.App,
    id: string,
    config: Config,
    props?: cdk.StackProps,
  ) {
    super(scope, id, config.getStackProps(props));

    this.config = config;
    this.createApiGatewayWithSqs();
  }

  private createApiGatewayWithSqs() {
    new ApiGatewayToSqs(this, "PaymentAPIGatewaySQS", {
      deployDeadLetterQueue: true,
      allowCreateOperation: true,
      allowReadOperation: false,
      allowDeleteOperation: false,
    });
  }

  //TODO: need to deploy with infra as code:
  /*
    - Lambda authorizer
    - Lambda mint
    - SQS Settings
    - API Gateway Settings
    - SQS triggering lambda mint
    - Dead letter queue?
    - IAM roles / permissions needed for all of this
  */
}
