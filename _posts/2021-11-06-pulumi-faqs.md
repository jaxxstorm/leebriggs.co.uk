---
title: 5 things you've heard about Pulumi that aren't true
layout: post
category: blog
tags:
- infrastructure-as-code
- infrastructure-as-software
- pulumi
---

Engaging with the Pulumi community has been one of the most enjoyable parts of my time so far at Pulumi. If you've used the [Pulumi Community Slack](https://slack.pulumi.com/) or asked about Pulumi on [Twitter](https://twitter.com/search?q=pulumi), [Reddit](https://www.reddit.com/user/jaxxstorm/) or [Stack Overflow](https://stackoverflow.com/users/645002/jaxxstorm) there's a reasonable chance interacted with me! 

In the 18 months I've been at Pulumi answering community questions, I've also found that the same topics tend to reappear regularly. 

So why don't we answer some of those questions? I love answering questions, and I haven't written a blog post in a while, so let's get right to it.

## Doesn't Pulumi use Terraform "under the hood" ?

Let's start by asking what "under the hood" actually means? Pulumi does sound like a good name for a car (McLaren Pulumi, anyone?) but I've never understood exactly what people are asking when this question is asked.

This misconception is pretty easy to understand, and it's because Pulumi "bridges" Terraform providers for many popular cloud providers (and perhaps one day, maybe even some [unpopular ones](https://github.com/pulumi/pulumi/issues/6446)). 

### So Pulumi _uses_ Terraform providers?

Well, yes and no. 

When we say Pulumi "bridges" Terraform providers, what we mean is that Pulumi _some_ Pulumi providers use the Terraform schema in order to be able to map the cloud provider API.

In order for Pulumi to be able to create resources in your cloud of choice, Pulumi needs to know what resources are available, what parameters are available on that resources API and what the return and response attributes are. If you've taken a look at one of the major cloud providers recently, you'll notice that there's at _least_ 1 trillion different resources and parameters for those APIs. Mapping the entire surface of the cloud provider itself is going to take a very long time.

Luckily, someone has already done this! The lovely folks at Hashicorp set out building providers for those cloud providers years ago, and like the lovely folks they are, they used a permissive MPL 2.0 license. The maintainers and community using the Terraform providers have already painstakingly mapped the surface area of cloud providers so that the [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) operations needed to create resources are embedded inside the Terraform provider schema.

Pulumi simply reads that schema to understand what those operations need to be. 

Of course, in an ideal world, the cloud providers would have mapped those operations themselves, and many cloud providers _are_ doing just this.

Pulumi builds _native_ providers from the cloud provider APIs, where they're available. If you see `-native` in the name, you can be sure Pulumi is figuring out the CRUD lifecycle of resources directly from the cloud provider.

The actual execution logic, the engine, the CLI and state management are all unique to Pulumi, and differ in large ways from Terraform.

### Summary

Pulumi doesn't "use" Terraform under the hood at all, it uses Terraform _providers_ in order to map the cloud provider API surface. 

## Isn't Pulumi imperative?

_(In the last 10 years of my career, I must have used the word declarative so many times I've lost count, and yet I still have to look up if there's an "e" or an "a" after the "l")_

If you've provisioned infrastructure with other infrastructure as code tooling, you've probably used a DSL that compiles to JSON or used JSON/YAML directly to define your infrastructure. Using those configuration languages means you're defining the end state of your infrastructure, and the intermediate tool drives towards that desired configuration. It's declarative.

When you see Pulumi, with its scary application language workflow, it's easy to panic. 

 -"Hang on a minute, do I have to check if my provisioning operation is successful?" 
 - "Am I going to have to _check errors_?" 
 - I swear to god if I have to use a `try` or `catch` I'm going to quit.

These are all understandable reactions. They are thankfully, premature reactions.

If you were unlucky enough to write a provisioning script at any point in your life, you'll have remembered you have to create a sequence of statements in order to desire your end goal. Take this bash, for example:

```bash
if create_kubernetes_cluster(); then
    echo "Welcome to YAML purgatory, Kubernetes cluster creator"
else
    echo "Congratulations, your Kubernetes cluster failed to create and now you're in actual hell"
fi
```

The fact you have to check for these errors means you're writing imperative code. Defining your creation steps, chaining them in a series of statements and deciding how your program proceeds when things happen is a hallmark of imperative creation and it can be _really_ hard work.

However, Pulumi only uses imperative languages to define your infrastructure, but Pulumi itself is still declarative.

### Wait, what?

I know, it's a bit of a head trip. 

To understand it though, let's go ahead and create a Kubernetes cluster with Pulumi's DotNet SDK in C#:

```csharp
using Pulumi;
using Pulumi.Eks;

class MyCluster : Stack
{
    [Output("kubeconfig")]
    public Output<object> Kubeconfig { get; set; }

    public MyCluster()
    {
        var cluster = new Cluster("example");
        // Export the clusters' kubeconfig.
        Kubeconfig = cluster.Kubeconfig;
    }
}
```

Do you see any conditionals there? Of course you don't, because Pulumi is declarative!

Pulumi's uses these "imperative" languages to define a state to drive towards. Pulumi uses a *language host* to interpret the program you're writing, and list and states all the resources inside that program.

It passes all the resources you want to create to the Pulumi *engine* which computes a desired end state. It doesn't actually create a blog of JSON, but for the purposes of this explanation, let's pretend it does. The Pulumi engine passes that imaginary fake blob of JSON to the correct Pulumi *resource plugin* which actually goes off to the cloud provider and does the operations.

If the operation has already happened and the cloud provider resource already exists, Pulumi doesn't do _anything_. The reason? Because Pulumi is declarative. It's already got the defined end state where it wants to be, so it just hangs out. Probably with a beer, because Pulumi is chill like that.

### Summary

Pulumi is a declarative tool that uses familiar but imperative languages to define your end state. The language is only used for authoring your program, it's not used for actually talking to the cloud provider API.

## Pulumi locks you into their API! You can't escape!

{% include note.html content="As a Pulumi employee, I am invested in Pulumi's success and really want you to try out the Pulumi SaaS. If you try out and like Pulumi's open source backends, please consider donating to a charity you care about" %}

In order for Pulumi to do its thing, Pulumi needs to store the result of operations somewhere. When you create a Pulumi resource, Pulumi makes a call to the cloud providers' API and then it needs to stores the result of that API call somewhere so it knows what happened.  The place where Pulumi stores that result is called the "state". 

It's true, the original release of Pulumi had no support for storing state anywhere but Pulumi's SaaS state storage. Funnily enough, I was the person who [opened the issue requesting state storage in S3](https://github.com/pulumi/pulumi/issues/1966).

So once upon a time, you were locked in to Pulumi's backend, with no way to escape the "evil" clutches of Pulumi. However, this is no longer true, and [hasn't been true since April 2019](https://github.com/pulumi/pulumi/pull/2455)

In fact, Pulumi even has a page directly in their documentation about using "OSS Backend" and even [how to migrate between them](https://www.pulumi.com/docs/intro/concepts/state/#migrating-between-backends). 

### Summary

You can store Pulumi state in Amazon S3, Azure Blob Storage or Google Cloud Storage Buckets. However, I'd really like you to buy Pulumi Enterprise so I can retire early and own a farm where I adopt greyhounds and let them roam free being noodle horses, so don't use them.

{% include note.html content="This is a joke. Use the backend that suits you!" %}

## Isn't TypeScript supported better than the other languages?

When Pulumi was first released, the initial language support was TypeScript. Since then, Pulumi has added support for Python, Go, and DotNet, but TypeScript was the first out of the gate when Pulumi was launched.

Pulumi community uses will often ask which language to use, and many end up choosing TypeScript. Pulumi uses both new and returning will often say that TypeScript our "primary language".

The idea that TypeScript is our "primary language" seems to be some sort of [Mandela Effect](https://en.wikipedia.org/wiki/Mandela_Effect_(disambiguation)) that won't go away.

### What's Nelson Mandela got to do with this?

Well, nothing. The Mandela Effect reference is because I can't find any reference to anyone from Pulumi saying there was a "primary language". All of Pulumi's language support is equally supported, and there are large customers using Pulumi in all supported languages.

In terms of a "feature matrix" across language, there's one feature that is only supported in 2 of our language SDKs (Node & Python) and that's [dynamic providers](https://www.pulumi.com/blog/dynamic-providers/) and one feature only supported in TypeScript: [function serialization](https://www.pulumi.com/docs/intro/concepts/function-serialization/). The reason isn't because we don't like Go, DotNet and to a lesser extent Python though. It's because implementing these features in those languages is really bloody hard, and not always possible. If you want to understand why, have a read of the [GitHub issue asking for dynamic provider support in DotNet](https://github.com/pulumi/pulumi/issues/3638).

If you've used more than one of our SDKs, you might have felt that the TypeScript one was "better" and therefore "better supported". I will say that from my own perspective, it also feels like that too. However, the reason isn't because we have better support for TypeScript, it's because TypeScript is actually really bloody good for defining infrastructure. It's a language really well suited to define end states, so it _feels_ better. That's it. There's no secret cabal lead by our CTO to make TypeScript our only supported language, it's just really good at it. Although now I think about it, our [CTO did cofound TypeScript](https://about.sourcegraph.com/podcast/luke-hoban/) so maybe there is a secret plot?

### Summary

TypeScript is not our "best supported" language. We love all our languages equally, but some parts of Pulumi's feature set are harder to implement in certain languages than others.

Some languages like Python are just really hard to love, but that's just, like, my opinion.

## Pulumi won't make you more productive than \<insert other IaC tool here\>

{% include note.html content="Unlike the other 4 points, this one is personal opinion" %}

If you're used to defining infrastructure in configuration languages, you might be forgiven for having this of opinion. 

However, as a former user of other IaC tools, moving to Pulumi made me _infinitely_ more productive for a single reason.

I don't have to look shit up.

### Give me a break, everyone looks shit up..

No wait, hear me out.

If you're using configuration languages like YAML and defining your infrastructure in `vi` like a badass sysadmin, you're probably having to look things up. You'll have to cross reference your configuration parameters, and unless you have an incredible memory, you're not going to remember _every_ possible property you need to define, so you're going to have to look it up.

For me, this was really really arduous. You can get into a rhythm, but you're still doubling the time it takes.

Pulumi's uses of strongly typed languages with programming languages that support [Intellisense](https://code.visualstudio.com/docs/editor/intellisense) and the [Language Server Protocol](https://en.wikipedia.org/wiki/Language_Server_Protocol) means when I'm defining Pulumi programs, I very very rarely need to leave my IDE. I can simply "Go to Definition" directly in my IDE to see the input properties of any resource. It's so incredibly productive, I'm sort of annoyed at myself for not doing it earlier. 

### Summary

It took me far too long to use an IDE instead of `vi`, but switching to Pulumi helped me see the light

## Wrap Up

So there we have it. 5 commonly stated points, all taken care of in a single blog post. That's it. That's the blogpost.







