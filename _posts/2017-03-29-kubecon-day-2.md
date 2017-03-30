---
title: KubeCon - Day 2 Recap
layout: post
category: blog
tags:
- kubernetes
- conference
- recap
---

Day 2 of KubeCon was absolutely jam packed! There were lots of tracks, so I won't be able to cover everything that happened, but hopefully I can recap some of the stuff I found interesting.

One thing to note is that the Technical deep dive rooms were dramatically over subscribed, to the point where I walked out of some of them halfway through because the environment was unbearable. Maybe someone else will be able to recap those.

# kubernetes 1.6
The kubernetes 1.6 announcement was done during the keynote, and we had a fantastic demo by [Aparna Sinha](https://twitter.com/apbhatnagar) of some of these features.

## Pod Affinity/Anti Affinity

The pod affinity/anti affinity was shown off, which allows you to schedule workloads on certain nodes in your cluster. Anti affinity seemed particularly interesting to me, because it means you can say "if pod has label X, don't schedule anything with the same label on a node" which is very powerful for environments where you need to ensure failure domains stay low. It also seems very obvious in terms of affinity, where you need to schedule workloads on certain nodes and ensure they stay there. As our master of ceremonies [Kelsey Hightower](https://twitter.com/kelseyhightower) would say - super dope!

## Dynamic Storage Provisioning

Another thing that caught my eyes was the dynamic storage provisioning becoming a standard within 1.6. This has been around a while, and it basically goes off and creates volumes for you (EBS, GKE etc etc) and then creates a persistent volume claim for your pod to consume. Aparna did a [demo](https://pbs.twimg.com/media/C8Egj0mWkAAfPZq.jpg) of this and it really showed the power of this model when creating dynamic workloads. I've been doing this in the beta/alpha tree for a while, and I hope to have a blog post up soon showing this off for [FlexVolumes](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/flexvolume) and how you can extend it with out of tree provisioners!

## Roadmap

Some really great things on the 1.7 [roadmap](https://pbs.twimg.com/media/C8EialzXQAEvEIZ.jpg). Of particular interest is the [service-catalog](https://github.com/kubernetes-incubator/service-catalog) work, allowing you to provision resources that might not be in kubernetes. More about that later

# Monzo & Linkerd
I attended a fantastically interesting talk co-chaired by [Monzo](https://monzo.com/) and [Buoyant](https://buoyant.io/) to talk about how they worked together at Monzo. Monzo is incredibly interesting in that they built a _bank_ (yes, you read that right, a fucking **bank**) powered by Kubernetes.

The story started with Monzo explaining how their previous architecture relied on infrastructure services like RabbitMQ to ensure high reliability, but this was failing them. They were very candid about a recent outage they had, which meant payment processing stopped. This seems like an incredible nightmare for a bank, if you can't buy stuff because you can't use your card, it can cause a real drop in trust. However, along came Linkerd to operate as a fabric in their k8s cluster which vastly increased their reliability.

[Oilver Gould](https://twitter.com/olix0r) then took us through some of the features of linkerd, and the sell was compelling. I'd highly recommend [reviewing the slides](https://speakerdeck.com/olix0r/when-failure-is-not-an-option-processing-real-money-at-monzo-with-kubernetes-and-linkerd) and I'll be taking a look at linkerd soon.

# Service Catalog

There were several talks about service catalog maturing as an API, and this is a relatively new concept to me in kubernetes, but it's incredibly interesting. After a great chat with the folks at the Deis booth, it made more sense.

Essentially, the service catalog will allow developers/applications to consume resources that may or may not live outside the API. The best example of this that I got during the day is as follows.

* You may or may not run your database outside your cluster. 
* Your developers want to be able to provision and consume that resource, by creating a new database for their app and/or creating credentials to login
* Traditionally, you would have this be a manual process
* However, with a service catalog resource, you can make an API call, and it will provision the database and then you can bind to the resource, which will provide you with API generated credentials.

Needless to say, the potential here is mind boggling. With full kubernetes audit logging, and API driven provisioning of external components to the cluster, it becomes really obvious how you can create a _programmable datacenter_ even outside of AWS/Google clouds. 

The most up to date example of this is [Steward by Deis](https://github.com/deis/steward). This is still in alpha state, but it's definitely something I think needs to be considered when moving towards "Cloud native" workloads.

# Everything Else

Some other fun tidbits I picked up today:

[James Munnelly](https://twitter.com/jamesmunnelly) of [Jetstack](https://jetstack.io) has created a very awesome [keepalived](https://github.com/munnerz/keepalived-cloud-provider) cloud provider, which operates as an out of tree load balancer type, allowing those of us unlucky enough to be running bare metal based kubernetes clusters to use the load balancer service type.

[Quay](https://quay.io/) - the container registry from [CoreOS](https://coreos.com/) now supports [serving helm charts](https://coreos.com/blog/quay-application-registry-for-kubernetes.html) from its registry which is obviously super useful for those people using quay.

The kubernetes job market is looking pretty healthy based on the [job board](https://twitter.com/briggsl/status/847141270984310788)

Having a [grafana dashboard](https://twitter.com/pracucci/status/847128032368361472) or the conference wifi network is pretty awesome
