---
title: "The 300% Production Problem"
layout: post
category: blog
tags:
- devops
- infrastructure-as-code
---

Earlier this year, I attended CfgMgmtCamp in Ghent and listened to Adam Jacob's "What if Infrastructure as Code never existed" keynote.

{% include note.html content="I'd like to extend a huge thanks to Adam for taking the time to review this post, and for an unnamed person for consistently reviewing these posts and for inspiring the thoughts here." %}

Not only is Adam an excellent speaker, but he can capture thoughts that most people can't articulate and explain them in a way that revolutionises people's thinking. 

This talk was no exception. If you have yet to see it, I'd like to introduce you to something I've always known but have yet to appropriately identify: the 200% knowledge problem.

You can listen to Adam's excellent explanation of the 200% knowledge problem [here](https://youtu.be/5lPa2U239C4?t=2014). My own explanation of this problem is:

> To successfully use an abstraction, you need to understand the problem the abstraction is trying to solve _and also_ understand how the abstraction has solved the problem.

## Terraform Modules

My best example of this is when examining the Terraform module ecosystem. Terraform modules, in theory, are designed to solve specific problems in the cloud provider ecosystem. Taking an example like the AWS VPC module removes the need to understand all of the glue that AWS needs to successfully create a VPC, like route tables, subnets and NAT Gateways.

That's the theory. The reality of these modules is that you need to understand the magical incantation of random functions and use `dynamic` to succeed.

In addition, the desire to create Terraform modules that meet _every single user's possible use case_ means that often, the module will expose the entire surface area of the APIs the module is managing to the user. Usually, this leaves you in a position of having to painstakingly read the whole module's code before using it, and if something breaks, you're shit out of luck.

Hearing Adam describe this problem has had my brain slowly creaking for a while. We've seen lots of literature in the past few years about the explosion of knowledge required to be a successful "DevOps Engineer", "Site Reliability Engineer" or "Platform Engineer" or whatever that role's title is this week. As I've noodled on this for the past few months, I've started to leverage the 200% problem and give it a moniker of my own: "the 300% production problem".

## The 300% Production Problem

The definition of the 300% problem is:

> To successfully get an application into production, you need to be an expert in the application itself, the deployment target and the deployment methodology.

Each of these expertise layers is a full-time job or undertaking. If you're lucky, you have more than one person who needs to be an expert on all these 3 layers. If you're unlucky, you might read this and think, "holy shit, no wonder I'm burned out".

Let's examine these layers and see if we can develop some ideas to reduce the burden.

### The Application

Now, if the application you're deploying is an in-house application written by a team of super-smart developers, you're in a good spot. If you're deploying a third-party application, things get a little trickier.

One of the benefits of open-source third-party software is that it allows you to _become_ an expert in the application itself, either by reading the code or the documentation. What's interesting about the application stack is that there are layers of expertise all the way down. The database tier of the application itself, the software framework it's written in, and how it's packaged and maintained or performs under load or scale are just a few parts of how this breaks down. 

The responsibility of expertise here essentially belongs to the "Dev" side of the "DevOps Divide", especially for business logic applications.

### The Deployment Target

The deployment target is where things start to explode in complexity, and often, the decisions _you_ make as an engineer can directly affect the level of expertise required to succeed.

When discussing the deployment target, we're pointing at the cloud provider and the varying layers under that. Cloud providers are _hard_, and they get even more challenging if you start to sprinkle Kubernetes on stuff to abstract away cloud provider APIs. That's just compute, as well. Once you start factoring in the networking, data, queuing system requirements and all that other crucial production-grade stuff, you begin to realise _just how hard this is_.

### The Deployment Methodology

The deployment methodology refers to the _way_ you get your application _and_ your infrastructure into a production level. If you've read other posts on this blog, you'll know that my primary focus is Infrastructure as Code and being an expert in that IaC tool is a _requirement_ to successfully get things into production. Now, I'm not going to turn this into another rant about why DSLs are stupid, but when you consider here that the language you use to author your infrastructure is part of this expertise, I'd ask myself this question: do you really only want 4 or 5 people in your company to be the experts in the deployment methodology, or do you want lots of experts?

## Multiplying the problem

Once you start to think about problems through the lens of the 300% Production Problem, you begin to realise why there's a burgeoning backlash against some popular ideas in our industry.

### Microservices

Microservices took off as an idea because of the enormous scale needed for some organisations, but what ends up happening is that you multiply the 300% problem across a shitload of applications. Give those application teams the full power and responsibility of "owning their applications in production". You can offset some of this by letting them choose their infrastructure and deployment methodology, but it's a lot to ask everyone to be an expert in all 3 of these domains.

### Kubernetes

It's an established meme now that adding Kubernetes increases complexity, but it multiplies the complexity in two areas of the 300% problem. Not only is Kubernetes layered on top of your existing infrastructure, but it also requires you to be an expert in all of the facets of the deployment methodology, whether it be the abject misery of Go templated Helm Charts or building an operator for everything which is the proposed solution of some people who really just want to watch the world burn.

### Cloud

Yes. There's a cloud backlash slowly starting to form. I'm not going to share my thoughts in this post, but if you consider the surface area of most cloud providers, the sheer amount of services and the idiosyncrasies of those services, it's unsurprising that people are starting to feel cognitive overload trying to meet their third of the 300% problem on the infrastructure side.

## What do we do?

The ultimate solution to the 300% problem will be the same across the 3 pillars. _Simplicity_. Making decisions that reduce the amount of knowledge required to become an expert in one of those 3 pillars will dramatically affect your overall success rate at getting your applications into production.

This isn't new ground. People have been writing about keeping "Keep it simple stupid" for a long time. The problem is that the "simplicity" is often defined by the people building the system, and those people are _experts_ already in the system they're building.

When I shared this post with [Adam](https://x.com/adamhjk), he gave me an excellent analogy which helped me round this post out:

> You want simplicity where it benefits the _user_, which often requires increased complexity for the _developer_. My analogy for this is how complex modern cars are, but you push a button to “start” them. Vs a very simple model t, that breaks your arm if you start it wrong.

As usual, Adam has done a much better job of encapsulating the core ideas in this post than I have, but to expand on it, the missing piece to me is the "producification" of the systems we're building. 

What is often overlooked is how important it is that decisions and responsibilities that can be shared are made to appease the opinions of a small number of potential experts rather than the broader organisation. Intelligent individuals with political power will happily introduce this framework, that deployment model, or the other tool because they like it and are experts and they _believe_ it's simple, which ultimately it is - to them.

Hopefully, if you're reading this and you're trying to build something that simplifies a process in your organisation, you'll consider the 300% problem, and make it simple for everyone, not just yourself.






