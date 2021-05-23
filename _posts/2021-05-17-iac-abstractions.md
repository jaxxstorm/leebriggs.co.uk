---
title: Understanding Pulumi Packages
layout: post
category: blog
tags:
- infrastructure-as-code
- pulumi
---

Building reusable abstractions is one of the most important and rewarding parts of any infrastructure as code journey. Allowing users to be able to quickly define infrastructure from well defined, repeatable patterns can quickly help your community grow.

The incumbent software in the IaC space like [Terraform](https://terraform.io), [CloudFormation](https://aws.amazon.com/cloudformation/) and [Azure Resource Manager](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/overview) each have their own mechanisms for defining these patterns. Terraform has [modules](https://www.terraform.io/docs/language/modules/index.html) and an ever growing [registry](https://registry.terraform.io/) of community built modules. CloudFormation has [templates](https://aws.amazon.com/cloudformation/resources/templates/) and its related product, [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) has [Constructs](https://docs.aws.amazon.com/cdk/latest/guide/home.html) and finally, ARM also has [templates](https://azure.microsoft.com/en-us/resources/templates/) which allow you to quickly get off the ground with your Azure resources.

Pulumi also has the ability to create reusable abstractions, and it takes advantage of some of the mechanisms you'd expect by allowing the use of [turing complete](https://en.wikipedia.org/wiki/Turing_completeness) programming languages. However, up until now there's been a barrier to these.

In this post, we're going to look at Pulumi's mechanism for creating reusable abstractions and examine and extremely exciting new capability. So let's peer behind the curtain.

# Components

When defining logical groupings of Pulumi programs, you have a couple of options available to you, primarily because of the ability to use all of the constructs from your programming language of choice.

A common pattern is to define functions or methods which create a bunch of Pulumi resources. This allows you to call this function as often as you like, and you might even import it into other programs. 

Here's a TypeScript example of creating a Kubernetes service account using the Pulumi Kubernetes SDK:

```typescript
interface ServiceAccountArgs {
    namespace: pulumi.Input<string>;
    provider: k8s.Provider;
}

export function makeServiceAccount(
    name: string,
    args: ServiceAccountArgs,
): k8s.core.v1.ServiceAccount {
    return new k8s.core.v1.ServiceAccount(
        name,
        {
            metadata: {
                namespace: args.namespace,
            },
        },
        {
            provider: args.provider,
        },
    );
}
```

This is reusable and helpful for sharing these patterns. I can import this like any other TypeScript function and call it within my Pulumi program:

```typescript
import * as sa from "./serviceAccount";

const serviceAccount = sa.makeServiceAccount(name, {
    namespace: "default",
    provider: provider,
});
```

If you've ever tried to scale this sort function declared nonsense, you'll know it gets pretty boring quickly. Languages have evolved to have considerations like Object Orientation to ensure you don't have to work like this.

In addition to this, if you're building functions that create multiple Pulumi resources, what do you return, exactly? It gets messy quickly if you're trying to resolve Outputs from created resources within a function.

Luckily, there's a built in solution for this. They're called *Component Resources*.

## Being Resourceful

If you want to build abstractions that other Pulumi users can install and use easily, you almost certainly want to build a Component Resource.

Component Resources are fully represented Pulumi resources. If you build one, you get all of the benefits of the Pulumi engine. You register the component with a name, and then add logical groupings of other Pulumi resources to that Component Resource.

An example of this I like to use is a hypothetical "Production Ready Application". As a platform owner, you can define a reusable component resource which can allow you to specify options for it, and then abstract away all of the painful parts for your users.

To define a Component Resource, you need to define the _shape_ of it (ie, the arguments you want to allow the user to pass) and then the actual resource itself. Here's an example of a "ProductionApp" resource in Python:

```python

# define the configurable values we want to allow the user to specify
class ProductionAppArgs:
    def __init__(
        self,
        image: pulumi.Input[str],
    ):
        self.image = image

# Now we define a Production app component resource
class ProductionApp(pulumi.ComponentResource):
    def __init__(
        self, name: str, args: ProductionAppArgs, opts: pulumi.ResourceOptions = None
    ):
        super().__init__("productionapp:index:ProductionApp", name, {}, opts)

        app_labels = {"name": name}

        deployment = k8s.apps.v1.Deployment(
            name,
            spec=k8s.apps.v1.DeploymentSpecArgs(
                replicas=3,
                selector=k8s.meta.v1.LabelSelectorArgs(match_labels=app_labels),
                template=k8s.core.v1.PodTemplateSpecArgs(
                    metadata=k8s.meta.v1.ObjectMetaArgs(labels=app_labels),
                    spec=k8s.core.v1.PodSpecArgs(
                        containers=[
                            k8s.core.v1.ContainerArgs(
                                name=name,
                                image=args.image,
                                ports=[
                                    k8s.core.v1.ContainerPortArgs(
                                        name="http", container_port=8080
                                    )
                                ],
                            )
                        ]
                    ),
                ),
            ),
        )
```

We've defined a couple dozen lines of code here, but the user experience for someone consuming this is dramatically improved. You can package this up into a Python package and publish it to [PyPi](https://pypi.org/) and allow other users to consume it with just a couple lines of code:

```python
from app import ProductionApp, ProductionAppArgs
app = ProductionApp("nginx", ProductionAppArgs(image="nginx:latest"))
```

You _still_ get all the benefits of your language's type system and the power of Pulumi's resource model, but you get to define a user interface that makes _sense_ to your software developer colleagues.

## I've got 4 problems and the language is one

Component Resources have been available for a while in Pulumi, and lots of our happy customers have built extensive internal SDKs that bring productivity to their teams. This starts to break down for community maintainers for a simple reason: management overhead.

If you want to write Pulumi components that reach all of Pulumi's supported SDKs, you had to rewrite it in every language. Even if you were up for the challenge of writing the same thing in four different languages, what happens when Pulumi adds a new language? Congratulations, your maintenance burden has now increased.

There are some [excellent](https://github.com/Place1/kloudlib) [examples](https://github.com/mitodl/ol-infrastructure/tree/main/src/ol_infrastructure/components/aws) of components in GitHub, and [some users](https://github.com/jen20/pulumi-aws-vpc) even went to the trouble of rewriting their component to support multiple languages, but it's unreasonable to expect our users and community to tackle this burden. We even felt this pain ourselves with our [Amazon EKS](https://github.com/pulumi/pulumi-eks/) component - users wanted access to this across all our language ecosystems, and we knew what kind of overhead it would create to write support in all four languages.

So the Pulumi team set about trying to figure this out. The result, is [Pulumi Packages](https://www.pulumi.com/docs/guides/pulumi-packages)

# What is a Pulumi Package?

Pulumi's ability to support multiple languages is driven by the ability to generate usable SDKs for all its supported languages automatically. Support for this has been available with our native providers (ie: [Kubernetes](https://github.com/pulumi/pulumi-kubernetes), [Azure](https://github.com/pulumi/pulumi-azure-native/) and the [Google Preview](https://github.com/pulumi/pulumi-google-native/)) and the "bridged" terraform providers (such as [AWS](https://github.com/pulumi/pulumi-aws) and many others). A roundabout way of describing how this works is that the surface of the API you're calling needs to be defined, and Pulumi then generates a "schema" for that API. You can actually see what that [generated schema](https://raw.githubusercontent.com/pulumi/pulumi-aws/master/provider/cmd/pulumi-resource-aws/schema.json) looks like for the bridged terraform providers and this can help give a mental model of how Pulumi works.

With the introduction of Pulumi Packages, this language generation capability has been brought to Component Resources. My perspective is that this is an incredible techical achievement, but it's also the beginning of being able to see Pulumi community members create reusable components and reach a wide range of language ecosystems. You can write a Pulumi Component Package in TypeScript, and it's now available to every Pulumi SDK user, regardless of whether they're using the same language as you.

# AWS LoadBalancer Controller

In order to illustrate this point, I wrote my first Pulumi multi language package for the [AWS LoadBalancer Controller](https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html).

The code for it can be found [here](https://github.com/jaxxstorm/pulumi-awsloadbalancercontroller). Using it is as simple as installing the SDL in your language of choice, and then consuming it. Here's an example in TypeScript:

```typescript
import * as lb from "@jaxxstorm/pulumi-awsloadbalancercontroller";

const loadbalancer = new lb.Deployment("example", {
    oidcIssuer: "oidc.eks.us-west-2.amazonaws.com/id/D4064024788B184AFFA7747591BD643D",
    oidcProvider: "arn:aws:iam::616138583583:oidc-provider/oidc.eks.us-west-2.amazonaws.com/id/D4064024788B184AFFA7747591BD643D",
    namespace: "aws-loadbalancer-controller",
    installCRDs: true,
    clusterName: "example-cluster",
})
```

and in Python:

```python
import jaxxstorm_pulumi_awsloadbalancercontroller as lb

loadbalancer = lb.Deployment("example",
    cluster_name="example-cluster",
    install_crds=True,
    namespace="aws-loadbalancer-controller",
    oidc_provider="arn:aws:iam::616138583583:oidc-provider/oidc.eks.us-west-2.amazonaws.com/id/6F5EB6A0B6482BE2960BD584BA77B7FB",
    oidc_issuer="oidc.eks.us-west-2.amazonaws.com/id/6F5EB6A0B6482BE2960BD584BA77B7FB"
)
```

This few lines of code allows you to provision your loadbalancer controller without having to use multiple tools, as the AWS docs describe. Pulumi's ability to manage and configure AWS and Kubernetes alike means you get to use a single provisioning tool for all of your infrastructure.

## Building a Pulumi Multi language Package

Building a Pulumi component is straightforward. You need to define a _schema_ which declares the inputs and expected outputs for your component. Here's a short example `schema.json`:

```json
{
    "name": "examplecomponent",
    "pluginDownloadURL": "https://lbriggs.jfrog.io/artifactory/pulumi-packages/pulumi-examplecomponent",
    "resources": {
        "examplecomponent:index:example": {
            "isComponent": true,
            "inputProperties": {
                "requiredInput": {
                    "type": "string",
                    "description": "This input is required."
                },
                "plainInput": {
                    "type": "boolean",
                    "description": "This input is plain, meaning you can do conditional logic on it."
                },
               
            },
            "requiredInputs": [
                "requiredInput"
            ],
            "plainInputs": [
              "plainInput"
            ],
            "properties": {
            },
            "required": []
        }
    },
    "language": {
        "csharp": {
            "packageReferences": {
                "Pulumi": "3.*",
                "Pulumi.Aws": "4.*"
            }
        },
        "go": {
            "generateResourceContainerTypes": true,
            "importBasePath": "github.com/jaxxstorm/pulumi-examplecomponent/sdk/go/examplecomponent"
        },
        "nodejs": {
            "dependencies": {
                "@pulumi/kubernetes": "^3.0.0",
                "@pulumi/aws": "^4.0.0"
            },
            "devDependencies": {
                "typescript": "^3.7.0"
            },
            "packageName": "@jaxxstorm/pulumi-examplecomponent"
        },
        "python": {
            "packageName": "jaxxstorm_pulumi_examplecomponent",
            "requires": {
                "pulumi": ">=3.0.0,<4.0.0",
                "pulumi-kubernetes": ">=3.0.0,<4.0.0",
                "pulumi-aws": ">=4.0.0,<5.0.0"
            }
        }
    }
}
```

You'll notice here that you have to specify some parts of the schema that are language dependent, like the downstream nodejs dependencies. The most important part of this component is the inputs, which can then be used inside your component.

The next part is to build your Pulumi component. It's possible to do this in each of our supported language, and it's best to look at the component boilerplate repos to use as inspiration:

  - [Go](https://github.com/pulumi/pulumi-component-provider-go-boilerplate)
  - [Python](https://github.com/pulumi/pulumi-component-provider-py-boilerplate)
  - [TypeScript](https://github.com/pulumi/pulumi-component-provider-ts-boilerplate)
  - DotNet (Coming Soon)

  The language you create your multi language component in is ultimately up to you, but my intention is to build the components I author in the Go programming language. The main reason for this is that it'll mean my downstream users don't require additional dependencies for my components. If you author a component in TypeScript, for example, your users _must_ have the `node` binary installed. Go's ability to build sealed binaries for each OS is a powerful complement which I intend to make use of.

  # Wrap-Up

  Pulumi Packages are an exciting new feature which I can't wait for users to find. The ability to share code across all of our supported ecosystems is a powerful force multiplier for our community, and is only the first step in a long journey of growing our community. Give them a try!













