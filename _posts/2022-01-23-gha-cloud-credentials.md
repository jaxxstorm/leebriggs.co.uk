---
title: Never use cloud credentials in your GitHub Actions again!
layout: post
category: blog
tags:
- infrastructure-as-code
- infrastructure-as-software
- pulumi
- security
---

Picture the scene. You're configuring your automation pipelines, whether it's deploying infrastructure, applications or any other piece of your CI/CD pipeline that needs to access a cloud provider. You want to do things properly, so you define a well scoped role with a minimum set of permissions that you need for the pipeline to be successful. Then you assign those permissions to your cloud provider's authentication mechanism. If you're lucky, your CI/CD pipeline runs in the cloud too, so you never need to define a set of static credentials.

If you're not using self hosted runners for your CI/CD pipeline, you might pause for a second. "I need to remember to rotate these credentials" you think. Maybe you'll set a reminder to rotate them in a month's time, or perhaps you'll set up some elaborate mechanism to rotate them. More likely than not, you'll forget about it completely until your wonderful InfoSec team bug you about them, hopefully it'll be for a compliance reasons and not because someone got hold of them.

Until recently, these hard coded credentials have been not only dangeorus, but unavoidable. Mechanisms for accessing cloud provider from _outside_ the cloud provider itself have been almost non-existent. You defined an IAM user/service principal/service account/insert other mechanism here and you just...hoped. 

In addition to these credentials being static and hard to rotate, often the credentials stored in CI/CD services can have extremely broad and permissive privileges. If you're running infrastructure automation, for example, you might need to scope the credentials to basically admin permissions, which is an extremely worrying prospect.

The good news is, this is starting to change, and a well defined protocol is in the middle of these changes. 

If you're using GitHub Actions to as your CI/CD tool of choice, you can now use OIDC with the 3 major cloud providers to securely authenticate to that provider. You can find a long, well defined document in the GitHub documentation [here](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect). This document clearly states the benefit of using OIDC, but for posterity, we'll repeat them here:

> *No cloud secrets*: You won't need to duplicate your cloud credentials as long-lived GitHub secrets. Instead, you can configure the OIDC trust on your cloud provider, and then update your workflows to request a short-lived access token from the cloud provider through OIDC.

> *Authentication and authorization management*: You have more granular control over how workflows can use credentials, using your cloud provider's authentication (authN) and authorization (authZ) tools to control access to cloud resources.

> *Rotating credentials*: With OIDC, your cloud provider issues a short-lived access token that is only valid for a single workflow run, and then automatically expires.

This all sounds pretty amazing right? No cloud credentials?! How do I set this up?

In the rest of this blog post, we'll look at how you can use [Pulumi](https://pulumi.com)'s TypeScript SDKs to quickly an easy set up GitHub actions, so you don't have to manually configure the access!

It's of course quite possible to use Pulumi's other SDKs, as well as other infrastructure as code tools to do the setup, but we'll use Pulumi in this walkthrough. If you don't want to read a whole blog post, you can go directly to the code [here](https://github.com/jaxxstorm/secure-cloud-access) with example actions running to show you this does really work, honest.

{% include note.html content="To jump directly to your cloud provider, use these links: [AWS](#aws) | [Azure](#azure) | [Google Cloud](#google-cloud)" %}

# AWS

{% include note.html content="The complete code for this example can be found [here](https://github.com/jaxxstorm/secure-cloud-access/tree/main/aws)" %}

AWS has leaned into OIDC as an authentication mechanism since they introduced [IAM roles for service accounts](https://aws.amazon.com/blogs/opensource/introducing-fine-grained-iam-roles-service-accounts/) back in 2019. The ability to use OIDC as an authentication mechanism has also been extended to other services, and GitHub actions is one of them.

We'll need the [Pulumi AWS provider](https://www.pulumi.com/registry/packages/aws/) in order to interact with AWS, as well as the [GitHub provider](https://www.pulumi.com/registry/packages/github/), so make sure you've got those installed in your Pulumi program like so:

```yaml
npm install @pulumi/aws @pulumi/github
```

## Create an OIDC Provider

The first step in being able to use OIDC in GitHub actions is to define an OIDC provider. 

```typescript
const oidcProvider = new aws.iam.OpenIdConnectProvider("example", {
  thumbprintLists: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
  clientIdLists: ["https://github.com/jaxxstorm", "sts.amazonaws.com"],
  url: "https://token.actions.githubusercontent.com",
});
```

The URL is important here, as it the thumprint. You can essentially copy and paste these static values. The `clientIDList` needs to be updated to use your GitHub organization, and this can be used across repositories within your GitHub Org.

## Define an IAM Role

Next up, we'll need to define an IAM role. We'll set a condition on this IAM role to scope the role to repository in the `Condition` field. You can scope the access to anything that exists in the [OIDC token](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect#understanding-the-oidc-token) - in this example we're allowing all, because YOLO.

```typescript
const role = new aws.iam.Role("secure-cloud-access", {
  description: "Access for github.com/jaxxstorm/secure-cloud-access",
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: ["sts:AssumeRoleWithWebIdentity"],
        Effect: "Allow",
        Condition: {
          StringLike: {
            "token.actions.githubusercontent.com:sub":
              "repo:jaxxstorm/secure-cloud-access:*", // replace with your repo
          },
        },
        Principal: {
          Federated: [oidcProvider.arn],
        },
      },
    ],
  } as aws.iam.PolicyDocument,
});
```

Next up, we'll need to attach a policy to this role, to define what this repository will be able to do in AWS. In this example I'm going to just add `ReadOnly permissions, but we'll need to be considerate about what this repo is going to do.

```typescript
// get our AWS account ID
const partition = aws.getPartition();

// Attack the readonlyaccess policy
partition.then((p) => {
  new aws.iam.PolicyAttachment("readOnly", {
    policyArn: `arn:${p.partition}:iam::aws:policy/ReadOnlyAccess`,
    roles: [role.name],
  });
});
```

Our final step is to use Pulumi's `GitHub` provider to store the role name in a GitHub actions secret, so we can quickly and easy access it from a workflow:

```typescript
new github.ActionsSecret("roleArn", {
  repository: "secure-cloud-access",
  secretName: "ROLE_ARN",
  plaintextValue: role.arn,
});
```

Your final Pulumi program will look a bit like this:

```typescript
import * as aws from "@pulumi/aws";
import * as github from "@pulumi/github"

const oidcProvider = new aws.iam.OpenIdConnectProvider("secure-cloud-access", {
  thumbprintLists: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
  clientIdLists: ["https://github.com/jaxxstorm", "sts.amazonaws.com"],
  url: "https://token.actions.githubusercontent.com",
});

const role = new aws.iam.Role("secure-cloud-access", {
  description: "Access for github.com/jaxxstorm/secure-cloud-access",
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: ["sts:AssumeRoleWithWebIdentity"],
        Effect: "Allow",
        Condition: {
          StringLike: {
            "token.actions.githubusercontent.com:sub":
              "repo:jaxxstorm/secure-cloud-access:*",
          },
        },
        Principal: {
          Federated: [oidcProvider.arn],
        },
      },
    ],
  } as aws.iam.PolicyDocument,
});

const partition = aws.getPartition();

partition.then((p) => {
  new aws.iam.PolicyAttachment("readOnly", {
    policyArn: `arn:${p.partition}:iam::aws:policy/ReadOnlyAccess`,
    roles: [role.name],
  });
});

new github.ActionsSecret("roleArn", {
  repository: "secure-cloud-access",
  secretName: "ROLE_ARN",
  plaintextValue: role.arn,
});

export const roleArn = role.arn;
```

## Define your GitHub Actions workflow

Now, let's define a workflow to verify what credentials we got:

```yaml
# The workflow Creates static website using aws s3
name: AWS Workflow
on:
  push
permissions:
  id-token: write
  contents: read
jobs:
  CheckAccess:
    runs-on: ubuntu-latest
    steps:
      - name: Git clone the repository
        uses: actions/checkout@v2
      - name: configure aws credentials
        uses: aws-actions/configure-aws-credentials@master
        with:
          role-to-assume: ${{ secrets.ROLE_ARN }}
          role-session-name: githubactions
          aws-region: us-west-2
      - name:  Check permissions
        run: |
          aws sts get-caller-identity
```

You'll notice we're passing the `ROLE_ARN` from the repository secret directly, so we don't have to hardcode anything. Now, run your Pulumi program to create all the AWS resources needed, and check everything in. You should have access to AWS with `ReadOnly` access, without having to specify any AWS credentials!

# Azure

{% include note.html content="The complete code for this example can be found [here](https://github.com/jaxxstorm/secure-cloud-access/tree/main/azure)" %}

To configure "credentialless access" in Azure, we can follow a similar pattern. We'll need to use Pulumi's [Azure AD](https://www.pulumi.com/registry/packages/azuread/) provider, the [GitHub](https://www.pulumi.com/registry/packages/github/) as well as the [Azure Native](https://www.pulumi.com/registry/packages/azure-native/) provider. We're also going to use the Azure SDK to make our life a little easier, so make sure you've run the following in your Pulumi program before you proceed:

```yaml
npm install @pulumi/azure-native @pulumi/azuread @pulumi/github @azure/arm-authorization @azure/ms-rest-js
```

## Create an Azure AD Application and Service Principal

Our first step is to define the user that GitHub actions will use to get its permissions. We create an Azure AD Application, a Service Principal and a random password, like so:

```typescript
// create an azure AD application
const adApp = new azuread.Application("gha", {
  displayName: "githubActions",
});

// create a service principal
const adSp = new azuread.ServicePrincipal(
  "ghaSp",
  { applicationId: adApp.applicationId },
  { parent: adApp }
);

// mandatory SP password
const adSpPassword = new azuread.ServicePrincipalPassword(
  "aksSpPassword",
  {
    servicePrincipalId: adSp.id,
    endDate: "2099-01-01T00:00:00Z",
  },
  { parent: adSp }
);
```

## Create a Federated Identity Credential

Now here comes the magic. We're going to create a Federated Identity credential, which has a subject for our repository in it. Azure is stricter about the subject than AWS, so we'll need to define what part of the OIDC token we want to allow access. In this example, I'm allowing the main branch access, but you can use any part of the [OIDC token](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect#understanding-the-oidc-token) like the environment.

```typescript
/*
 * This is the magic. We set the subject to the repo we're running from
 * Also need to ensure your AD Application is the one where access is defined
 */
new azuread.ApplicationFederatedIdentityCredential(
  "gha",
  {
    audiences: ["api://AzureADTokenExchange"],
    subject: "repo:jaxxstorm/secure-cloud-access:ref:refs/heads/main", // this can be any ref
    issuer: "https://token.actions.githubusercontent.com",
    applicationObjectId: adApp.objectId,
    displayName: "github-actions",
  },
  { parent: adApp }
);
```

## Define a permissions this application gets

Now we've got the federated identity credential, we need to create a role assignment. There's going to be a lot to unpack here, so let's look at the code first, then walk through it.

```typescript

import { AuthorizationManagementClient } from "@azure/arm-authorization";
import { TokenCredentials } from "@azure/ms-rest-js";
import * as authorization from "@pulumi/azure-native/authorization";

async function getAuthorizationManagementClient(): Promise<AuthorizationManagementClient> {
  const config = await authorization.getClientConfig();
  const token = await authorization.getClientToken();
  const credentials = new TokenCredentials(token.token);
  // Note: reuse the credentials and/or the client in case your scenario needs
  // multiple calls to Azure SDKs.
  return new AuthorizationManagementClient(credentials, config.subscriptionId);
}

async function getRoleIdByName(
  roleName: string,
  scope?: string
): Promise<string> {
  const client = await getAuthorizationManagementClient();
  const roles = await client.roleDefinitions.list(scope || "", {
    filter: `roleName eq '${roleName}'`,
  });
  if (roles.length === 0) {
    throw new Error(`role "${roleName}" not found at scope "${scope}"`);
  }
  if (roles.length > 1) {
    throw new Error(
      `too many roles "${roleName}" found at scope "${scope}". Found: ${roles.length}`
    );
  }
  const role = roles[0];
  return role.id!;
}

const subInfo = authorization.getClientConfig();

subInfo.then((info) => {
    new authorization.RoleAssignment("readOnly", {
    principalId: adSp.id,
    principalType: authorization.PrincipalType.ServicePrincipal,
    scope: pulumi.interpolate`/subscriptions/${info.subscriptionId}`,
    roleDefinitionId: getRoleIdByName("Reader"),
  });
});
```

{% include note.html content="Huge thanks to [Mikhail Shilkov](https://twitter.com/mikhailshilkov) here for his prior art on retrieving the `roleDefinitionId`" %}

Why do we need all this? Well, we could hard code the `roleDefinitionId` but looking it up is cleaner. Let's step through it:

First we define an auth client to talk to Azure using the Azure TypeScript SDK

```typescript
async function getAuthorizationManagementClient():  Promise<AuthorizationManagementClient> {
  const config = await authorization.getClientConfig();
  const token = await authorization.getClientToken();
  const credentials = new TokenCredentials(token.token);
  // Note: reuse the credentials and/or the client in case your scenario needs
  // multiple calls to Azure SDKs.
  return new AuthorizationManagementClient(credentials, config.subscriptionId);
}
```

Then, we define a function which can look up an Azure role by its name, rather than the long string you define it by:

```typescript
async function getRoleIdByName(
  roleName: string,
  scope?: string
): Promise<string> {
  const client = await getAuthorizationManagementClient();
  const roles = await client.roleDefinitions.list(scope || "", {
    filter: `roleName eq '${roleName}'`,
  });
  if (roles.length === 0) {
    throw new Error(`role "${roleName}" not found at scope "${scope}"`);
  }
  if (roles.length > 1) {
    throw new Error(
      `too many roles "${roleName}" found at scope "${scope}". Found: ${roles.length}`
    );
  }
  const role = roles[0];
  return role.id!;
}
```

Now, we use `azure-native`'s `authorization` package to get the current client information:

```typescript
const subInfo = authorization.getClientConfig();
```

Now, we can create a role assignment for our service principal that defines the ReadOnly permission:

```typescript
subInfo.then((info) => {
    new authorization.RoleAssignment("readOnly", {
    principalId: adSp.id,
    principalType: authorization.PrincipalType.ServicePrincipal,
    scope: pulumi.interpolate`/subscriptions/${info.subscriptionId}`,
    roleDefinitionId: getRoleIdByName("Reader"),
  });
});
```

At this stage, our service principal has read only permissions on the subscription we're using. Now, let's allow GitHub actions to use it.

## Define GitHub secrets

Our final step is to define the GitHub secrets that we use in our workflow:

```typescript
subInfo.then((info) => {

  // define some github actions secrets so your AZ login is correct
  new github.ActionsSecret("tenantId", {
    repository: "secure-cloud-access",
    secretName: "AZURE_TENANT_ID",
    plaintextValue: info.tenantId,
  });

  new github.ActionsSecret("subscriptionId", {
    repository: "secure-cloud-access",
    secretName: "AZURE_SUBSCRIPTION_ID",
    plaintextValue: info.subscriptionId,
  });
});

// finally, we set the client id to be the application we created
new github.ActionsSecret("clientId", {
  repository: "secure-cloud-access",
  secretName: "AZURE_CLIENT_ID",
  plaintextValue: adApp.applicationId,
});
```

Note, we need to define the `tenantId` and `subcriptionId` inside the promise returned by the `subInfo` call. The `clientId` is set to our Azure AD application client id.

Our complete Pulumi program looks like this:

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as authorization from "@pulumi/azure-native/authorization";
import * as azuread from "@pulumi/azuread";
import * as github from "@pulumi/github";

import { AuthorizationManagementClient } from "@azure/arm-authorization";
import { TokenCredentials } from "@azure/ms-rest-js";

async function getAuthorizationManagementClient(): Promise<AuthorizationManagementClient> {
  const config = await authorization.getClientConfig();
  const token = await authorization.getClientToken();
  const credentials = new TokenCredentials(token.token);
  // Note: reuse the credentials and/or the client in case your scenario needs
  // multiple calls to Azure SDKs.
  return new AuthorizationManagementClient(credentials, config.subscriptionId);
}

async function getRoleIdByName(
  roleName: string,
  scope?: string
): Promise<string> {
  const client = await getAuthorizationManagementClient();
  const roles = await client.roleDefinitions.list(scope || "", {
    filter: `roleName eq '${roleName}'`,
  });
  if (roles.length === 0) {
    throw new Error(`role "${roleName}" not found at scope "${scope}"`);
  }
  if (roles.length > 1) {
    throw new Error(
      `too many roles "${roleName}" found at scope "${scope}". Found: ${roles.length}`
    );
  }
  const role = roles[0];
  return role.id!;
}


// create an azure AD application
const adApp = new azuread.Application("gha", {
  displayName: "githubActions",
});

// create a service principal
const adSp = new azuread.ServicePrincipal(
  "ghaSp",
  { applicationId: adApp.applicationId },
  { parent: adApp }
);

// mandatory SP password
const adSpPassword = new azuread.ServicePrincipalPassword(
  "aksSpPassword",
  {
    servicePrincipalId: adSp.id,
    endDate: "2099-01-01T00:00:00Z",
  },
  { parent: adSp }
);

/*
 * This is the magic. We set the subject to the repo we're running from
 * Also need to ensure your AD Application is the one where access is defined
 */
new azuread.ApplicationFederatedIdentityCredential(
  "gha",
  {
    audiences: ["api://AzureADTokenExchange"],
    subject: "repo:jaxxstorm/secure-cloud-access:ref:refs/heads/main", // this can be any ref
    issuer: "https://token.actions.githubusercontent.com",
    applicationObjectId: adApp.objectId,
    displayName: "github-actions",
  },
  { parent: adApp }
);

// retrieve the current tenant and subscription
const subInfo = authorization.getClientConfig();

subInfo.then((info) => {

  // define some github actions secrets so your AZ login is correct
  new github.ActionsSecret("tenantId", {
    repository: "secure-cloud-access",
    secretName: "AZURE_TENANT_ID",
    plaintextValue: info.tenantId,
  });

  new github.ActionsSecret("subscriptionId", {
    repository: "secure-cloud-access",
    secretName: "AZURE_SUBSCRIPTION_ID",
    plaintextValue: info.subscriptionId,
  });


  /* define a role assignment so we have permissions on the subscription
   * We use the helper to get the role by name, but you can of course define it explicitly
   */
  new authorization.RoleAssignment("readOnly", {
    principalId: adSp.id,
    principalType: authorization.PrincipalType.ServicePrincipal,
    scope: pulumi.interpolate`/subscriptions/${info.subscriptionId}`,
    roleDefinitionId: getRoleIdByName("Reader"),
  });
});

// finally, we set the client id to be the application we created
new github.ActionsSecret("clientId", {
  repository: "secure-cloud-access",
  secretName: "AZURE_CLIENT_ID",
  plaintextValue: adApp.applicationId,
});
```

Run your Pulumi program and define all your infrastructure, then we can define our workflow.

## Define the GitHub Actions workflow

Our GitHub actions workflow will use the secrets we defined to know how to authenticate. It looks a little bit like this:

```yaml
name: Run Azure Login with OpenID Connect
on: [push]

permissions:
  id-token: write
  contents: read
      
jobs: 
  CheckAccess:
    runs-on: ubuntu-latest
    steps:
    - name: 'Az CLI login'
      uses: azure/login@v1
      with:
        client-id: ${{ secrets.AZURE_CLIENT_ID }}
        tenant-id: ${{ secrets.AZURE_TENANT_ID }}
        subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
  
    - name: 'Run Azure CLI commands'
      run: |
          az account show
          az group list
          pwd 
```

Check all this in, and watch the magic as GitHub Actions is now authenticated against Azure!

# Google Cloud

{% include note.html content="The complete code for this example can be found [here](https://github.com/jaxxstorm/secure-cloud-access/tree/main/gcp)" %}

Google Cloud supports OIDC authentication using workflow providers. We'll use the `@pulumi/gcp` and `@pulumi/google-native` to achieve our goals here, so make sure the following packages are installed in your Pulumi program:

```yaml
npm install @pulumi/gcp @pulumi/google-native
```

## Define the Service Account

We'll need a GCP service account to for GitHub actions to use. We'll assign the service account the `viewer` role:

```typescript
const serviceAccount = new google.iam.v1.ServiceAccount(name, {
    accountId: "github-actions"
})

new gcp.projects.IAMMember("github-actions", {
    role: "roles/viewer",
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`
})
```

## Create a WorkloadIdentityPool

Now we'll define a workload identity pool for GitHub actions to use

```typescript
const identityPool = new gcp.iam.WorkloadIdentityPool("github-actions", {
  disabled: false,
  workloadIdentityPoolId: `github-actions`,
});
```

## Create a WorkloadIdentityPoolProvider

We'll now need to define a provider for this workload identity pool. The mappings section is important, here is where we map Google OIDC subjects to the OIDC token objects. The following works pretty well:

```typescript
const identityPoolProvider = new gcp.iam.WorkloadIdentityPoolProvider(
  "github-actions",
  {
    workloadIdentityPoolId: identityPool.workloadIdentityPoolId,
    workloadIdentityPoolProviderId: "github-actions",
    oidc: {
      issuerUri: "https://token.actions.githubusercontent.com",
    },
    attributeMapping: {
      "google.subject": "assertion.sub",
      "attribute.actor": "assertion.actor",
      "attribute.repository": "assertion.repository",
    },
  }
);
```

## Assign the workload identity permission

Now we've defined the workload identity and provider, we need to allow our earlier defined service account to use these new resources:

```typescript
new gcp.serviceaccount.IAMMember("repository", {
    serviceAccountId: serviceAccount.name,
    role: "roles/iam.workloadIdentityUser",
    member: pulumi.interpolate`principalSet://iam.googleapis.com/${identityPool.name}/attribute.repository/jaxxstorm/secure-cloud-access`
})
```

Notice here that we interpolate the name of the identity pool, and also the name of the repository that we want to access.

## Create the GitHub actions secrets

Now we'll store some important information in GitHub secrets so we don't have to hardcode them in our workflow:

```typescript
new github.ActionsSecret("identityProvider", {
  repository: "secure-cloud-access",
  secretName: "WORKLOAD_IDENTITY_PROVIDER",
  plaintextValue: identityPoolProvider.name,
});

new github.ActionsSecret("subscriptionId", {
  repository: "secure-cloud-access",
  secretName: "SERVICE_ACCOUNT_EMAIL",
  plaintextValue: serviceAccount.email,
});
```

We're storing the identity pool provider name, and the service account we created's email address as actions.

Your complete Pulumi program should look like this:

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as google from "@pulumi/google-native";
import * as github from "@pulumi/github";

const name = "github-actions";

const serviceAccount = new google.iam.v1.ServiceAccount(name, {
  accountId: "github-actions",
});

new gcp.projects.IAMMember("github-actions", {
  role: "roles/viewer",
  member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
});

const identityPool = new gcp.iam.WorkloadIdentityPool("github-actions", {
  disabled: false,
  workloadIdentityPoolId: `${name}-4`,
});

const identityPoolProvider = new gcp.iam.WorkloadIdentityPoolProvider(
  "github-actions",
  {
    workloadIdentityPoolId: identityPool.workloadIdentityPoolId,
    workloadIdentityPoolProviderId: `${name}`,
    oidc: {
      issuerUri: "https://token.actions.githubusercontent.com",
    },
    attributeMapping: {
      "google.subject": "assertion.sub",
      "attribute.actor": "assertion.actor",
      "attribute.repository": "assertion.repository",
    },
  }
);

new gcp.serviceaccount.IAMMember("repository", {
  serviceAccountId: serviceAccount.name,
  role: "roles/iam.workloadIdentityUser",
  member: pulumi.interpolate`principalSet://iam.googleapis.com/${identityPool.name}/attribute.repository/jaxxstorm/secure-cloud-access`,
});

new github.ActionsSecret("identityProvider", {
  repository: "secure-cloud-access",
  secretName: "WORKLOAD_IDENTITY_PROVIDER",
  plaintextValue: identityPoolProvider.name,
});

new github.ActionsSecret("subscriptionId", {
  repository: "secure-cloud-access",
  secretName: "SERVICE_ACCOUNT_EMAIL",
  plaintextValue: serviceAccount.email,
});

export const workloadIdentityProviderUrl = identityPoolProvider.name;
export const serviceAccountEmail = serviceAccount.email;
```

Run your Pulumi program, created the needed resources and then we can define our workflow.

## Define the workflow

Now we've configured all the access we need, we can define a workflow to check our access:

```yaml
name: List services in GCP
on:
  push

permissions:
  id-token: write

jobs:
  Get_OIDC_ID_token:
    runs-on: ubuntu-latest
    steps:
    - id: 'auth'
      name: 'Authenticate to GCP'
      uses: 'google-github-actions/auth@v0.3.1'
      with:
          create_credentials_file: 'true'
          workload_identity_provider: ${{ secrets.WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.SERVICE_ACCOUNT_EMAIL }}
    - id: 'gcloud'
      name: 'gcloud'
      run: |-
        gcloud auth login --brief --cred-file="${{ steps.auth.outputs.credentials_file_path }}" --project briggs-237615
        gcloud auth list
```

We're using the `auth` action, creating a credentials file and then verifying we're authenticated.

Check all this in, and watch in awe as your GitHub action runs with GCP access without any hardcoded credentials!

# Wrap Up

This blog post guides you through accessing the 3 major cloud providers with GitHub Actions without specifying hardcoded credentials. It's my hope that more CI/CD providers will offer this support soon, as well as other awesome cloud providers. 
