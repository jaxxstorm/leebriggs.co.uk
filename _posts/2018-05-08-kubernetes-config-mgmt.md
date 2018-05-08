---
title: The growing need for Kubernetes Configuration Management
layout: post
category: blog
tags:
- kubernetes
- configuration mgmt
---

It's been over a year since my last blog post, and since then I've been working on Kubernetes almost exclusively for $employer. During that time, I've noticed a growing need for something that many people in the DevOps/SRE/Sysadmin world take for granted. I wanted to come out of my blog post hiatus to discuss that need, and try and create a call to arms around this particular problem.

# The Problem

## Configuration Management

Back in the "old days" - way before I even got started in this game, a bunch of sysadmins got pretty tired of manually configuring their hosts. Sysadmins at the time would configure their fleet of machines, whether it be large or small, using either a set of custom and hand crafted processes and runbooks, or maybe if they were very talented, a set of perl/bash or PHP scripts which would take weeks to figure out for anyone new to the org.

People got pretty tired of this, and a new suite of tools was born - configuration management. From CFEngine, to Puppet, to Chef, to Ansible, these tools came along and revolutionized our industry. 

The driving forces behind this tooling was the need to _know_ that machines looked the way you want them to, and also be able to describe that state with code. The Infrastructure as Code movement started with configuration management, and has evolved even further since then, to bring us tools like Terraform, Habitat and Vagrant.

## What about Kubernetes?

So how does configuration management fit in with Kubernetes? The first thing you _might_ be thinking is that deploying things to Kubernetes _already_ solves the two problems above. Kubernetes is a declarative system, and you can simply define a deployment with a yaml config and Kubernetes takes care of the rest. You have the "code" there (although yaml is a poor imitation of code!) and then Kubernetes takes care of the rest. It will manage your process, ensure it converges and looks the way it should, and continue from there.

So what's the problem? 

## The Kubernetes Abstraction Layer

When you think about what Kubernetes does for an organization, it's worth thinking about what Kubernetes does for an engineering organization.

Before Kubernetes, the management layer generally existed above the Operating System. You would generally operate with individual machines when managing applications, and linking them together involved putting services on top of _other_ operating systems which would allow to link those applications together. You probably automated this process with configuration management, but ultimately the operators worked at the operating system layer.

With Kubernetes hitting the marketplace, that abstraction layer has changed. To deploy an application, operators no longer need to install software on the OS. Kubernetes takes care of all that for you.

So scaling applications at the machine layer was managed by configuration management and automated. You had many machines, and you needed to make sure they all looked the same. However, with Kubernetes coming along, how do you do the same there?

## Kubernetes Components

So now we get to the meat of the problem. At $employer, we run multiple Kubernetes clusters across various "tiers" of infrastructure. Our Development environment currently has 3 clusters, for example.

Generally, we manage the installation of the components for the Kubernetes cluster (the kubelet, api server, controller manager, kube-proxy, scheduler) etc with Puppet. All of these components _live_ at the operating system layer, so using a configuration management tool for the installation makes perfect sense.

But there are components of a Kubernetes cluster that need to be the same across all the clusters that are being managed. Some examples:

 - Ingress Controllers. All clusters generally need an ingress controller of some kind, and you generally want it be the same across all your clusters so there are no surprises.
 - Monitoring. Installing prometheus usually makes sense, and monitoring at the hardware layer is taken care of by DaemonSets. However, how do you make sure the prometheus config works the same across all clusters? Prometheus installations are designed to be small and modular, so you want to repeat this process over and over again.
 - Kubernetes Dashboard. Generally there will be some users who want to see a picture, and the dashboard helps with that.


These are just _some_ examples, but there are more. So, how do you do this?

## Helm

We adopted Helm charts at $employer for a few reasons:

  - The helm charts for bigger projects are generally well maintained, and have sane defaults out of the box.
  - Helm allows you to do reasonable upgrades of things using helm releases.
  - Helm's templating system allows you to manipulate configuration values for cluster level naming etc.

The problem is that syncing helm releases across clusters isn't really very easy. Therein lies the problem: *how do I sync resources across Kubernetes cluster*. Specifically, how do I sync *helm releases* across clusters? I want the same configuration but some slight changes in Helm values.

*I believe this problem is unsolved*. Here's a few of the things I've tried.

# The (unsatisfactory) solutions

## Puppet

Because my mind initially goes towards Puppet as configuration management, my first attempted solution used Puppet alongside Helm. I found the [Puppetlabs Helm Module](https://github.com/puppetlabs/puppetlabs-helm) and got to work. I even refactored it and sent some pull requests to improve its functionality.

Unfortunately, I ran across a few issues, and these mainly related to Puppet's lack of awareness of concepts higher than the OS, Puppet's less than ideal management of staged upgrades, as well as some missing features in the module:

 - Declaring helmcharts as Puppet defined types means they get initialized on all masters. This can cause issues and race conditions. The way Puppet determines if it should install a helm chart is by running a `helm ls` on the machine its operating on and finding the release. This isn't ideal, because if a master gets out of sync with the cluster, you come across problems.
 - The module itself has different defined types for helm chart installations and upgrades. You can't just change the helm module version, or different values for the `--set` or `values.yaml`. This requires custom workflows for helm upgrades and makes it really difficult to manage across multiple installations.
 - Sometimes when updating a helm release, you might want to do certain actions _before_ updating the release, like switch a load balancer config. You can't do this with Puppet, it's a manual process and requires some knowledge of multi-stage deployments. Puppet isn't great at this, so there has to be something else involved.

This is originally when my thoughts around this issue began to form. After coming to the conclusion that Puppet wouldn't quite cut it, I began to look at alternatives..

## Ansible

My initial thought was to use ansible. Ansible has a [native helm module](https://docs.ansible.com/ansible/devel/modules/helm_module.html) and is (by their own admission) designed for multi-stage deployments from the get-go. Great!

Unfortunately, the reality was quite different.

 - The module has at least two different issues open stating that the module is broken, and not ready: [here](https://github.com/ansible/ansible/issues/29661) and [here](https://github.com/ansible/ansible/issues/37148). There is even a comment stating a user switch to the [k8s_raw](https://github.com/ansible/ansible/issues/37148#issuecomment-373234654) ansible module.
 - Setting up and installing pyhelm, the module's dependency, caused us a lot of issues on OS X. We had to run it in a docker container
 - The ansible module relies on you configuring manual access to Tiller (helm's orchestrator inside the k8s cluster) manually, which is not easy to do.

Once it was realised that the ansible helm module isn't really ready for prime time, we reluctantly let Ansible go as an option. I'm hoping for this option to potentially improve in future, as I think personally this is the best approach

## Terraform

Terraform, by Hashicorp, was also considered as a potential option. It epitomizes the ideals of Infrastructure as Code by being both idempotent, as well as declarative. It interacts directly with the APIs of major cloud providers, and has a relatively short ramp-up/learning curve. Hashicorp also provides a well-written provider specifically for [Kubernetes](https://github.com/terraform-providers/terraform-provider-kubernetes) as well as a community written [Helm provider](https://github.com/mcuadros/terraform-provider-helm) and I was keen to give it a try. Unfortunately, we encountered issues that echoed the problems faced with Puppet:

  - Terraform simply defines an endstate, and makes it so, similar to Puppet but at a different level. The multi stage deployments (ie do X, then do Y) aren't really supported in Terraform which causes us problems when switching config.
  - We have several clusters in AWS, but some outside AWS. Having to store state for non AWS resources in an S3 bucket or such like was annoying. Obviously it's possible to store state elsewhere, but it's not a simple process.
  - By default, Terraform destroys and recreates resources you change. You can modify this behaviour using [lifecycle](https://www.terraform.io/docs/internals/lifecycle.html) but it's mentality is very different than the Kubernetes/Helm concepts.

## Ksonnet

I was very excited by [Ksonnet](https://ksonnet.io/) at one point. Ksonnet is a [Heptio](https://heptio.com/) project that is designed to streamline deployments to Kubernetes. It has a bunch of really useful concepts, such as [environments](https://ksonnet.io/docs/concepts#environment) which allow you to tailor components to a unique cluster. This would have been perfect to run from a CI pipeline, unfortunately the issues were:

  - Doesn't support helm ([yet](https://github.com/ksonnet/ksonnet/issues/522)). This means anything you install, you need to take all of the helm configuration that is figured out for you and write it again. A lot of overhead
  - Has a steep learning curve. [Jsonnet](https://jsonnet.org/) (which ksonnet uses under the hood) is a language itself, which takes some learning and isn't well documented.
  - Ksonnet's multi cluster support still [hasn't really been figured out](https://github.com/ksonnet/ksonnet/issues/277), so you need to manage the credentials manually and switch between them across clusters.

# Other Contenders

There were a few other concepts which looked ideal, but we didn't try as they were missing key components.

## Kubed

[kubed](https://github.com/appscode/kubed) can sync configmaps across namespaces and even clusters. If only it could do the same with other resources, it would have been perfect!

## Helmfile

[helmfile](https://github.com/roboll/helmfile) allows you to create a list of helm charts to install, but at the time of looking at it, it didn't really support templating for cluster differences, so it wasn't considered. It now seems to support that, so maybe it's time to reconsider it.

## Ansible k8s_raw

We briefly considered rewriting all the helm charts into standard ansible k8s_raw tasks, and putting the templating into the ansible variables. The amount of work to do that isn't trivial, but we may have to go down that route.

# Wrap up

So, as you can see here, this problem isn't solved. In summary, the requirements seem to be a tool that is:

 - Aware of multiple Kubernetes Clusters
 - Supports templating
 - Can perform operations in stages
 - Understands helm charts and releases
 - Is declarative

Unfortunately, I don't believe this tool exists right now, so the search continues!


