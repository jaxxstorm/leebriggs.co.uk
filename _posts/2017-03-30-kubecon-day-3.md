---
title: KubeCon - Day 3 Recap
layout: post
category: blog
tags:
- kubernetes
- conference
- recap
---

Day 3 of Kubecon! Before I begin, I have to make it clear that this was another day of frustration for me. As it was yesterday, all of the talks I really wanted to see were completely overflowing, and this was despite me making efforts to get to the talks well in advance.

The organisers did what they could to alleviate this, such as moving the deep dive track into the larger main conference room, but ultimately people paid _vast_ sums of money to attend this conference, and I firmly believe they over subscribed the event and it was detrimental to the people attending. The building can hold X number of people, and it was obvious that this number of tickets were sold, but the smaller breakout rooms were very popular and ultimately it was impossible to take in the fantastic content because of the overcrowding.

# Keynotes

## Huawei

I found the short Huawei talk very interesting. Firstly, [the scale they're operating at](https://twitter.com/briggsl/status/847349431473119233) is inspirational, and the way they've solved those problems and the [benefits they've reaped](https://twitter.com/briggsl/status/847349644250161152) from implementing a cloud native approach is very impressive.

I was also intrigued by their in house/custom networking solution, [iCAN](https://twitter.com/briggsl/status/847350529302732805). Always interesting to see how large enterprise innovate, given the resources at their disposal.

## Scaling Kubernetes Users

[Joe Beda](https://twitter.com/jbeda) of [Heptio](https://www.heptio.com/) talked a little bit about the user experience of Kubernetes. Starting with the mantra of "Kubernetes sucks, like all software" is an interesting opening gambit from a co-founder of Kubernetes, but he backed this up with detailed examples of how the user experience can improve. One of my favourite thoughts of his was the idea that [operators build software for people like us](https://twitter.com/briggsl/status/847352146920001536) and this definitely ties with my experiences of Kubernetes being intimating to the average user.

## Federation

Finally, [Kelsey Hightower](https://twitter.com/kelseyhightower) talked about Federation, and how he sees it being used in the Kubernetes landscape. As usual, Kelsey was a quote machine. Some of the more memorable ones:

 - ["Hybrid Cloud" means absolutely nothing!"](https://twitter.com/briggsl/status/847357068008759297)
 - ["If you can run your business on one node, congratulations! You can go home and watch other people's postmortems"](https://twitter.com/briggsl/status/847357406493331456)
 - ["If you have 2 nodes, and you're running Kubernetes, we're going to have a conversation"](https://twitter.com/danielbryantuk/status/847357665839783937)
 - ["The result of configuration mgmt was devops, group therapy for inefficient tools"](https://twitter.com/briggsl/status/847358340929802240)
 
After Kelsey was done cracking the audience up, there was a demo of ingress federation and the expected results. This was quite interesting to me, because one of the things I've been hoping to do is use federation to move workloads, but Kelsey's argument is that you absolutely should _not_ do that. It's meant to be used to get an overview of the cluster as a whole, not magically move workloads around. As always, a very useful talk from Kelsey.

# Using the k8s go client

[Aaron Schlesinger](https://twitter.com/arschles) did a fantastic demo of writing a custom thirdparty resource (in his case, a backup resource) using the golang API client. It was very informative, even for someone like myself who has written quite a few things that use the golang client. I highly recommend checking out the [github repo](https://github.com/arschles/2017-KubeCon-EU) to get an idea what was covered.

# Prometheus Storage

I half attended a storage talk by [Björn Rabenstein](https://github.com/beorn7) detailing some of the ways of dealing with storage in Prometheus. This seemed interesting, but again it was difficult because of how full the room was. Essentially, what I took away from it was that storage in prometheus is not plug and play, and it's worth reading the [docs](https://prometheus.io/docs/operating/storage/) to ensure you're doing it right.

# k8sniff

The guys at kubermatic detailed [k8sniff](https://github.com/kubermatic/k8sniff) an interesting layer 3 TLS load balancer, that can terminate TLS down to the pod level. For those people offering kubernetes as a service to customers, this seems invaluable for separating traffic for different customers, however this isn't a problem I've personally seen.

# Consul & Ingress at Concur

Finally, I saw a fantastic talk about leveraging Consul & Ingress controllers to route traffic to pods. There was a discussion about the existing method, which used a custom load balancer endpoint and the pitfalls, and then porting that to a consul/ingress model. I thought this was quite interesting, but I also felt like you'd be losing some of the advantages of kubernetes by using consul to hit your pod endpoint IPs directly, such as the advantage of service IPs, as well as integrating your pod network to make it routable to external infrastructure. Nevertheless, it was very interesting to hear how a large company like Concur manages to sovle these complex problems.

