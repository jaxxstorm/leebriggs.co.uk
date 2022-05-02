---
title: Using Pulumi for Kubernetes configuration management
layout: post
category: blog
tags:
- pulumi
- kubernetes
- configuration mgmt
---

A few months back, I wrote an article which got a bit of interest around the issues configuring and maintaining multiple clusters, and keeping the components required to make them useful in sync. Essentially, the missing piece of the puzzle was that there was no _cluster aware_ configuration management tool.

Internally, we created an excellent tool at `$work` to solve this using [jsonnet](http://jsonnet.org/), which has been very nice because it's meant we get to use actual code to solve this problem. The only issue is that the code we have to write in is relatively niche!

When [Pulumi](https://pulumi.io/) was announced back in June, I got very excited. After seeing the that Pulumi [now supports Kubernetes natively](https://blog.pulumi.com/cloud-native-infrastructure-with-kubernetes-and-pulumi), I wanted to dig in and see if it would help with the configuration management problem.

# Introductory Concepts

Before I speak about the Kubernete--specific components, I want to do a brief introduction into what Pulumi actually is.

Pulumi is a tool which allows you to create cloud resources using real programming languages. In my personal opinion, it is essentially [terraform](https://www.terraform.io/) with full programming languages on top of it, instead of [HCL](https://github.com/hashicorp/hcl). 

Having real programming languages means you can make the resources you configure as flexible or complex as you like. Each _provider_ (AWS, GCE, Azure and Kubernetes) has support for different languages. Currently, the AWS provider has support for Go, Python and Javascript/Typescript whereas the Kubernetes provider has support only for Javascript/Typescript at the moment.

## Stacks

Pulumi uses the concept of a [stack](https://pulumi.io/reference/stack.html) to segregate things like environments or feature branches. For example, you may have a stack for your development environment and one for your production environment.

These stacks [store their state](https://pulumi.io/reference/state.html) in a similar fashion to terraform. You can either store the state in:

- The public pulumi web backend
- locally on the filesystem

There is also an enterprise hosted stack storage provider. Hopefully it'll be possible to have an open source stack storage some time soon.

## Components

[Components](https://pulumi.io/reference/component-tutorial.html) allow you to share reusable modules, in a similar manner to terraform modules. This means you can write reusable code and create boilerplate for regularly reused resources, like S3 buckets.

## Configuration

Finally, there's [configuration ability](https://pulumi.io/reference/config.html) within Pulumi stacks and components. What this allows you to do is differentiation configuration in the code depending on the stack you're using. You specify these configuration values like so:

```
pulumi config set name my_name
```

And then you can reference that within your code!

# Kubernetes Configuration Management

If you remember back to my [previous post](https://leebriggs.co.uk/blog/2018/05/08/kubernetes-config-mgmt.html), the issue I was trying to solve was being able to install components that every cluster needs (as an example, an ingress controller) to all the clusters but with often differing configuration values (for example, the path to a certificate arn in AWS ACM). Helm helps with this in that it allows you to specify values when installing, but then managing, maintaining and storing those values for each cluster becomes difficult, and applying them also becomes hard.

## Pulumi

There are two main reasons Pulumi is helping here. Firstly, it allows you to differentiate kubernetes clusters within stacks. As an example, let's say I have two clusters - one in GKE and one in Digital Ocean. Here you can see them in my kubernetes contexts:

```bash
kubectx
digitalocean
lbrlabs@gcloud
```

I can initiate a _stack_ for each of these clusters with Pulumi, like so:

```bash
# create a Pulumi.yml first!
cat <<EOF > Pulumi.yml
name: nginx
runtime: nodejs
description: An example stack for Pulumi
EOF
pulumi stack init gcloud
pulumi config set kubernetes:context lbrlabs@gcloud
```

Obviously, you'd repeat the stack and config steps for each cluster!

Now, if I want to actually deploy something to the stack, I need to write some code. If you're not familiar with typescript (I wasn't, until I wrote this) you'll need to generate a `package.json` and a `tsconfig.json`

Fortunately, Pulumi automates this for us!

```bash
pulumi new --generate-only --force
```

If you're doing a Kubernetes thing, you'll need to select kubernetes-typescript from the template prompt.

Now we're ready to finally write some code!

### Deploying a standard Kubernetes resource

When you ran `pulumi new`, you got an `index.ts` file. In it, it imports pulumi:

```typescript
import * as k8s from "@pulumi/kubernetes";
```

You can now write standard typescript and generate Kubernetes resources. Here's an example nginx pod as a deployment:

```typescript
import * as k8s from "@pulumi/kubernetes";

// set some defaults
const defaults = {
  name: "nginx",
  namespace: "default",
  labels: {app: "nginx"},
  serviceSelector: {app: "nginx"},
};

// create the deployment
const apacheDeployment = new k8s.apps.v1.Deployment(
  defaults.name,
  {
    metadata: {
      namespace: defaults.namespace,
      name: defaults.name,
      labels: defaults.labels
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: defaults.labels,
      },
      template: {
        metadata: {
          labels: defaults.labels
        },
        spec: {
          containers: [
            {
              name: defaults.name,
              image: `nginx:1.7.9`,
              ports: [
                {
                  name: "http",
                  containerPort: 80,
                },
                {
                  name: "https",
                  containerPort: 443,
                }
              ],
            }
          ],
        },
      },
    }
  });
```

Here you can already see the power that writing true code has - defining a constant for defaults and allowing us to use those values in the declaration of the resource means less duplicated code and less copy/pasting.

The real power comes when using the config options we set earlier. Assuming we have two Pulumi stacks, `gcloud` and `digitalocean`:

```bash
pulumi stack ls
NAME                                             LAST UPDATE              RESOURCE COUNT
digitalocean*                                    n/a                      n/a
gcloud                                           n/a                      n/a
```

and these stacks are mapped to different contexts, like so:

```bash
pulumi config -s gcloud
KEY                                              VALUE
kubernetes:context                               lbrlabs@gcloud
pulumi config -s digitalocean
KEY                                              VALUE
kubernetes:context                               digitalocean
```

you can now also set different configuration options and keys which can be used in the code.

```bash
pulumi config set imageTag 1.14-alpine -s gcloud
pulumi config set imageTag 1.15-alpine -s digitalocean
```

This will write out these values into a `Pulumi.<stackname>.yaml` in the project directory:

```bash
cat Pulumi.digitalocean.yaml
config:
  kubernetes:context: digitalocean
  pulumi-example:imageTag: 1.15-alpine
```

and we can now use this in the code very easily:

```typescript
let config = new pulumi.Config("pulumi-example"); // use the name field in the Pulumi.yaml here
let imageTag = config.require("imageTag");

// this is part of the pod spec, you'll need the rest of the code too!
image: `nginx:${imageTag}`,
```

Now, use Pulumi from your project's root to see what would happen:

```bash
pulumi up -s gcloud
Previewing update of stack 'gcloud'
Previewing changes:

     Type                           Name                   Plan       Info
 +   pulumi:pulumi:Stack            pulumi-example-gcloud  create
 +   └─ kubernetes:apps:Deployment  nginx                  create

info: 2 changes previewed:
    + 2 resources to create

Do you want to perform this update? yes
Updating stack 'gcloud'
Performing changes:

     Type                           Name                   Status      Info
 +   pulumi:pulumi:Stack            pulumi-example-gcloud  created
 +   └─ kubernetes:apps:Deployment  nginx                  created

info: 2 changes performed:
    + 2 resources created
Update duration: 17.704161467s

Permalink: file:///Users/Lee/.pulumi/stacks/gcloud.json
```

Obviously you can specify whicever stack you need as required!

Let's verify what happened...

```bash
kubectx digitalocean # switch to DO context
kubectl get deployment -o wide
NAME      DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE       CONTAINERS   IMAGES              SELECTOR
nginx     1         1         1            1           1m        nginx        nginx:1.15-alpine   app=nginx

kubectx lbrlabs@gcloud # let's look now at gcloud context
Switched to context "lbrlabs@gcloud".
k get deployment -o wide
NAME      DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE       CONTAINERS   IMAGES              SELECTOR
nginx     1         1         1            1           3m        nginx        nginx:1.14-alpine   app=nginx
```

Okay, so as you can see here, I've deployed an nginx deployment to two different clusters, with two different images with very little effort and energy. Awesome!

## Going further - Helm

What makes this _really really_ awesome is that Pulumi already supports Helm charts!

In my previous post, I made the comment that Helm has lots of community supported charts which have done a whole load of configuration for you. However, Helm suffers from 2 main problems (in my humble opinion)

  - Templating yaml with Go templates is extremely painful when doing complex tasks
  - The helm chart community can be slow to merge pull requests. This means if you find an issue with a chart, you unfortunately have to fork it, and host it yourself.

Pulumi really helps and solves this problem. Let me show you how!

First, let's create a Pulumi component using a helm chart:

```typescript
import * as k8s from "@pulumi/kubernetes";

const redis = new k8s.helm.v2.Chart("redis", {
    repo: "stable",
    chart: "redis",
    version: "3.10.0",
    values: {
        usePassword: true,
        rbac: { create: true },
    }
});
```

And now preview what would happen on this stack:

```bash
pulumi preview -s digitalocean
Previewing update of stack 'digitalocean'
Previewing changes:

     Type                                                    Name                              Plan       Info
 +   pulumi:pulumi:Stack                                     pulumi-helm-example-digitalocean  create
 +   └─ kubernetes:helm.sh:Chart                             redis                             create
 +      ├─ kubernetes:core:Secret                            redis                             create
 +      ├─ kubernetes:rbac.authorization.k8s.io:RoleBinding  redis                             create
 +      ├─ kubernetes:core:Service                           redis-slave                       create
 +      ├─ kubernetes:core:Service                           redis-master                      create
 +      ├─ kubernetes:core:ConfigMap                         redis-health                      create
 +      ├─ kubernetes:apps:StatefulSet                       redis-master                      create
 +      └─ kubernetes:extensions:Deployment                  redis-slave                       create

info: 9 changes previewed:
    + 9 resources to create
```

As you can see, we're generating the resources automatically because Pulumi renders the helm chart for us, and then creates the resources, which really is very awesome.

However, it gets more awesome when you see there's a callback called `transformations`. This allows you to patch and manipulate the generated resources! For example:

```typescript
import * as k8s from "@pulumi/kubernetes";

const redis = new k8s.helm.v2.Chart("redis", {
    repo: "stable",
    chart: "redis",
    version: "3.10.0",
    values: {
        usePassword: true,
        rbac: { create: true },
    },
    transformations: [
        // Make every service private to the cluster, i.e., turn all services into ClusterIP instead of
        // LoadBalancer.
        (obj: any) => {
            if (obj.kind == "Service" && obj.apiVersion == "v1") {
                if (obj.spec && obj.spec.type && obj.spec.type == "LoadBalancer") {
                    obj.spec.type = "ClusterIP";
                }
            }
        }
    ]
});
```

Of course, you can combine this with the configuration options from before as well, so you can override these as needed.

I think it's worth emphasising that this improves the implementation time for any Kubernetes deployed resource *dramatically*. Before, if you wanted to use something _other_ than helm to deploy something, you had to write it from scratch. Pulumi's ability to import and them manipulate rendered helm charts is a massive massive win for the operator and the community!

# Wrap up

I think Pulumi is going to change the way we deploy things to Kubernetes, but it's also definitely in the running to solve the configuration management problem. Writing resources in code is much much better than writing yaml or even jsonnet, and having the ability to be flexible with your deployments and manifests using the Pulumi concepts is really exciting.

I've put the code examples from the blog post in a [github repo](https://github.com/jaxxstorm/pulumi-kubernetes-example) for people to look at and improve. I really hope people try out Pulumi!
