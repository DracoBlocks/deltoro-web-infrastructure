#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { Config } from '../lib/config';
import { Website } from '../lib/website';

const app = new cdk.App();
const config = new Config(app, "prod");

new Website(app, 'WebsiteStack', config);
