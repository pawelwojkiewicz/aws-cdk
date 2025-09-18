#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CloudStack } from '../lib/cloud-stack';

const app = new cdk.App();

// Środowisko Produkcyjne
new CloudStack(app, 'prod-CloudStack', {
  stage: 'prod',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-north-1',
  },
});

// Środowisko Testowe
new CloudStack(app, 'test-CloudStack', {
  stage: 'test',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-north-1',
  },
});
