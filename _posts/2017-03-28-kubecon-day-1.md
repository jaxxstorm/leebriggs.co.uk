---
title: KubeCon - Day 1 Recap
layout: post
category: blog
tags:
- kubernetes
- conference
- recap
---

I was lucky enough to be able to attend [CloudNativeCon/Kubecon](http://events.linuxfoundation.org/events/cloudnativecon-and-kubecon-europe) in Berlin, Germany. This is my recap of the first half day of lightning talks, panels and project updates.

_Note - this is not an exhaustive recap. The stuff here is mainly what caught my eye during the first evening. Things are definitely missing_

# Fluentd update

First up, we had an update from [Eduardo Silva](https://twitter.com/edsiper) from [TreasureData](https://www.treasuredata.com/) about the fantastic [FluentD](http://www.fluentd.org/) project. The main highlight I can remember is that Fluentd now supports Windows logging. Eduardo's made a [joke](https://twitter.com/briggsl/status/846753046667448320) about "Windows being a serious system" and got a great laugh. There was a brief discussion of how fluentd solves the logging pipeline problem, and it's definitely something I'll be investigating as we try and better ship logs in our Kubernetes implementation.

# OpenTracing update

Next, we had [Priyanka Sharma](https://twitter.com/pritianka) on stage to talk about [OpenTracing](http://opentracing.io/). This is something I was aware of, but hadn't fully investigated, and Priyanka made it much clearer by demoing a custom "donut order" application she'd written with OpenTracing built in. She did a demo of the app (as a side note, she also asked everyone in the conference room to open a website, which I thought was crazy given the traditional state of conference wifi, but it worked!) and then drilled down into performance problems using OpenTracing. It was a fantastic visualization of how OpenTracing can solve problems, and I got a lot of value out of it!

# Linkerd update

Next up was [Oliver Gould](https://twitter.com/olix0r) with an update about [Linkerd](https://linkerd.io/) and the big news here is that Linkerd [now has TCP Support!](https://github.com/linkerd/linkerd-tcp). This is a massive step forward, and judging by reaction to my [tweet](https://twitter.com/briggsl/status/846757094359519234) the community agrees!

Additionally, something that caught me eye is that linkerd now supports [kubernetes ingress](https://twitter.com/briggsl/status/846756604477353986) in its config. I found a [great blog post about this](https://blog.buoyant.io/2016/11/18/a-service-mesh-for-kubernetes-part-v-dogfood-environments-ingress-and-edge-routing/) on the bouyant blog, and this has me really excited.

# CoreDNS update

The next thing I really paid attention to was the [CoreDNS](https://coredns.io/) update by [Miek Gieben](https://twitter.com/miekg) and this really stuck in my mind because I've really had some trouble and concerns around the kube-dns/skyDNS implementation currently being used in Kube. For some reason, a go shim coupled with dnsmasq and a sidecar container just doesn't feel like the right way to do something that's a critical component of the kubernetes stack.

With that in mind, Miek provided an update on CoreDNS, what it can do and why it's "better" than kube-dns. [This slide](https://twitter.com/briggsl/status/846759289104613377) stood out to me, and after reading some of the [available middleware plugins](https://github.com/coredns/coredns/tree/master/middleware) I'm looking to replace kube-dns with CoreDNS as soon as I can!

# Panel

The panel was a real disappointment for me. It consisted of 3 senior/executive level employees of TicketMaster, Amadeus and Haufe-Lexware discussiong their transition to Kubernetes. I would have loved to have my bosses, and _their_ bosses watch this panel, because there was some good conversation around how to transition organisations to new ways of thinking, but it was nothing I hadn't already heard. I would have loved to have had maybe 5/10 operators on stage talking war stories of Kubernetes in production, with a little less "media training" feel to it. I understand there's a wide range of attendees at this conference though, and I'm sure more people got value out of it than I did.

As a side note, I was very disappointed at the lack of diversity in the panel. I'm sure we could have found someone from a more diverse background/gender to be involved in the discussions.

# Helm with AppController

There was a nice short talk about the capabilities of the [Mirantis Appcontroller](https://github.com/Mirantis/k8s-AppController) and this seems like a really interesting project. Essentially, this brings orchestration to your kubernetes cluster, and allows staged deployments (ie, don't deploy the web app until your database is initialized) - I can see this getting heavy usage once it's in Beta/ready to test, but as it stands it seems fairly new.

# BGP Routing in Kubernetes

This talk confused me, because it basically described what [Calico](http://projectcalico.org/) already does, unless I'm missing something? Would love someone to fill in the gaps here.

# Fluentd Logging Pipelines

The last talk I really tuned in on was one that really stuck with me. [Jakob Karalus](https://twitter.com/krallistic) talked about how he'd built a flexible logging service inside Kubernetes, using annotations and fluentd. [This tweet](https://twitter.com/briggsl/status/846782137328160770) should give you an idea of how it works. This is a really interesting solution to a problem that is definitely on my mind at the moment - with Docker you can simple set [the logging driver per container](https://docs.docker.com/engine/admin/logging/overview/) but this is currently not possible in kubernetes (see [this](https://github.com/kubernetes/kubernetes/issues/15478) issue for more details. Jakob's solution provides an interesting mechanism for developers to be able to decide where they want their logs to go, and I think flexibility is always key. Check out [his github repo](https://github.com/krallistic/kubernetes-fluentd) to see how it works.

# Wrap Up

I'm hoping to write one of these for each day, but the amount of content may make that difficult! Let me know if you think I missed anything important!
