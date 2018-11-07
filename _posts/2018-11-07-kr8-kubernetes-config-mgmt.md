---
title: kr8 - Configuration Management for Kubernetes Cluster
layout: post
category: blog
tags:
  - kubernetes
  - configuration mgmt
  - jsonnet
  - kr8
---

Previous visitors to this blog will remember I wrote about configuration mgmt for Kubernetes clusters, and how the space was lacking. For those not familiar, the problem statement is this: it's really hard to maintain and manage configuration for components of multiple Kubernetes clusters. As the number of clusters you have starts to scale, keeping the things you need to run in them (such as ingress controllers) configured and in sync, as well as managed the subtle differences that need to be managed across accounts and regions.

With that in mind, it's my pleasure to announce that at my employer, [Apptio](https://www.apptio.com) we have tried to solve this problem with [kr8](https://github.com/apptio/kr8). kr8 is an opinionated Kubernetes cluster configuration management tool, designed to be simple, flexible and use off the shelf tools where possible. This blog post will detail some of the design goals of kr8, as well as detail some of the benefits and a few examples.

# Design Goals

The intention when making kr8 was to allow us to generate manifests for a variety of Kubernetes clusters, but give us the ability to template and override yaml parameters where possible. We took inspiration from a variety of different tools such as [Kustomize](https://github.com/kubernetes-sigs/kustomize), [Kasane](https://github.com/google/kasane), [Ksonnet](https://github.com/ksonnet/ksonnet) and many others on our journey to creating a configuration management framework that is relatively simple to use, but follows some of the practices we're used to as Puppet administrators.

Other design goals included:
  - No templating engine
  - Flexibility 
  - Compatibility with existing deployment tools, like [Helm](https://www.helm.sh/)
  - Small binaries, with off the shelf tools used where needed

The end goal was to be able to take existing helm charts, or yaml installation manifests, then manipulate them to our needs. We chose to use [jsonnet](https://jsonnet.org/) as the language of kr8 due to its data templating capabilities and ability to work with both JSON and YAML.

# Terminology & Tools

## kr8

kr8 itself is the only component of the kr8 framework that we wrote at Apptio. It's purposes are:

  - Discover clusters in a [hierarchical directory tree](https://github.com/apptio/kr8-configs/tree/master/clusters)
  - Discover components in a [components directory](https://github.com/apptio/kr8-configs/tree/master/components)
  - Map components to clusters, using a [cluster.jsonnet](https://github.com/apptio/kr8-configs/blob/master/clusters/gke/cluster.jsonnet) file

You can see the result of these purposes using a few of the tools in the kr8 binary, for example, listing clusters:

{% highlight bash %}
kr8 cluster list
+--------------------+--------------------------------------------------------------------+
|        NAME        |                                PATH                                |
+--------------------+--------------------------------------------------------------------+
| do                 | /Users/Lee/github/cluster_config/clusters/do                       |
| gcloud             | /Users/Lee/github/cluster_config/clusters/gcloud                   |
| kops               | /Users/Lee/github/cluster_config/clusters/kops                     |
| docker-for-desktop | /Users/Lee/github/cluster_config/clusters/local/docker-for-desktop |
| minikube           | /Users/Lee/github/cluster_config/clusters/local/minikube           |
+--------------------+--------------------------------------------------------------------+
{% endhighlight %}

However, using the kr8 binary alone is probably not what you want to do. We bundle and use a variety of other tools with kr8 to achieve the ability to generate manifests for multiple clusters and deploy them.

## Task

[Task](https://github.com/go-task/task) does a lot of the heavy lifting for kr8. It is a task runner, much like [Make](https://www.gnu.org/software/make/) but with a more flexible DSL (yep, it's yaml/json!) and the ability to run tasks in parallel. We use [Taskfiles](https://taskfile.org/#/usage?id=getting-started) for each component to allow us to build the component config. This gives us the flexibility to use rendering options for each component that make sense, whether it be pulling in a Helm chart or plain yaml. We can then input that yaml with kr8, and manipulate it with jsonnet code to add, modify the resulting kubernetes manifest.
Alongside this, we use a taskfile to generate deployment tasks and to generate _all_ components for a Task. This gives us the ability to execute lots of generate jobs in relatively short periods of time.

## Kubecfg

We use [Kubecfg](https://github.com/ksonnet/kubecfg) to do the actual deployment of these manifests. Kubecfg gives us the ability to validate, diff and iteratively deploy Kubernetes manifests which `kubectl` does not. The kubecfg jobs are generally inside Taskfiles at the cluster level.

# Components

Components are very similar to helm charts. They are installable resource collections for something you'd like to deploy to your Kubernetes clusters. A component has 3 minimal requirements:

  - `params.jsonnet`: contains configurable params for the component
  - `Taskfile.yml`: Instructions to render the component
  - An installation source: This can be anything from a pure jsonnet file to a helm input values file. Ultimately, this needs to be able to generate some yaml

I intend to write many more kr8 blog posts and docs, detailing how kr8 can work, examples of different components and tutorials. Until then, take a look at these resources:

  - [kr8](https://github.com/apptio/kr8) binary
  - [kr8-configs](https://github.com/apptio/kr8-configs) example repo
  - [cluster_config](https://github.com/jaxxstorm/cluster_config) my personal cluster configuration repo


# Thanks

I'd like to thank Colin Spargo, who came up with the original concept of kr8 and how it might work, as well as contributing large amounts of the kr8 code. I'd also like to thank Sanyu Melwani, who had valuable input into the concept, as well as writing many kr8 components.
