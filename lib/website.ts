import { Certificate } from "@aws-cdk/aws-certificatemanager";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import { ViewerProtocolPolicy } from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";
import * as route53 from "@aws-cdk/aws-route53";
import * as alias from "@aws-cdk/aws-route53-targets";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3deploy from "@aws-cdk/aws-s3-deployment";
import * as cdk from "@aws-cdk/core";
import { Duration } from "@aws-cdk/core";
import { Config } from "./config";

export class Website extends cdk.Stack {
  private readonly config: Config;
  private readonly bucket: s3.Bucket;

  constructor(
    scope: cdk.App,
    id: string,
    config: Config,
    props?: cdk.StackProps,
  ) {
    super(scope, id, config.getStackProps(props));

    this.config = config;

    this.bucket = this.createS3Bucket();
    this.createCloudfrontDistribution();
    this.deployWebsite();
  }

  private createS3Bucket() {
    return new s3.Bucket(this, "MainWebsiteBucket", {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      bucketName: this.config.getEnvParam("mainWebsiteBucketName"),
      versioned: false,
      websiteErrorDocument: "404.html",
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
  }

  private deployWebsite() {
    const staticContentFolders = ["_next", "images", "videos"];
    const staticContentFiles = ["favicon.ico"];

    new s3deploy.BucketDeployment(this, "MainWebsiteMoreDynamicPages", {
      sources: [
        s3deploy.Source.asset("../out", {
          exclude: [...staticContentFolders, ...staticContentFiles],
        }),
      ],
      exclude: [...staticContentFolders, ...staticContentFiles],
      destinationBucket: this.bucket,
      cacheControl: [
        s3deploy.CacheControl.maxAge(Duration.seconds(30)),
        s3deploy.CacheControl.mustRevalidate(),
        s3deploy.CacheControl.noCache(),
        s3deploy.CacheControl.fromString("no-store"),
      ],
      prune: true,
    });

    new s3deploy.BucketDeployment(this, "MainWebsiteStaticContent", {
      sources: [
        s3deploy.Source.asset("../out", {
          exclude: [
            "**",
            ...staticContentFolders
              .map((item) => [
                "!" + item.replace(/[/]$/, ""),
                "!" + item.replace(/[/]$/, "") + "/**",
              ])
              .reduce((a, b) => {
                return [...a, ...b];
              }),
            ...staticContentFiles.map((item) => "!" + item),
          ],
        }),
      ],
      destinationBucket: this.bucket,
      cacheControl: [
        s3deploy.CacheControl.maxAge(Duration.days(365)),
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.fromString("immutable"),
      ],
      prune: false,
    });
  }

  private createCloudfrontDistribution() {
    const origin = new origins.S3Origin(this.bucket);

    const domainName = this.config.getEnvParam("baseDomain");

    const mainWebsiteCachePolicy = new cloudfront.CachePolicy(
      this,
      "MainWebsiteCachePolicy",
      {
        cachePolicyName: "MainWebsiteCachePolicy",
        comment: "Default policy for the Main Website",
        defaultTtl: Duration.days(1),
        minTtl: Duration.seconds(30), //Even for static pages like the index, we create a 30-second cache in cloudfront to prevent spam-refreshing
        maxTtl: Duration.days(365),
        cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        headerBehavior: cloudfront.CacheHeaderBehavior.none(),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );

    const distribution = new cloudfront.Distribution(
      this,
      "MainWebsiteDistribution",
      {
        defaultBehavior: {
          origin: origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: mainWebsiteCachePolicy,
        },
        domainNames: [domainName],
        certificate: Certificate.fromCertificateArn(
          this,
          "Certificate",
          this.config.getEnvParam("wildcardCertificateArn"),
        ),
      },
    );

    new route53.ARecord(this, "MainWebsiteCloudfrontDNS", {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new alias.CloudFrontTarget(distribution),
      ),
      zone: route53.HostedZone.fromLookup(this, "HostedZone", {
        domainName: domainName,
      }),
    });
  }
}
