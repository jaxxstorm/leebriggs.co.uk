---
title: "IaC Ergonomics: Choosing an Infrastructure as Code Tool"
layout: post
category: blog
tags:
- devops
- infrastructure-as-code
- pulumi
- terraform
- crossplane
- cloudformation
- arm
---

{% include note.html content="I am a [Pulumi](https://pulumi.com) employee which means I have an agenda when writing this post. That said, my intent here is to accurate describe the state of the infrastructure as code market, so will endeavour to be objective with my opinions." %}

As a person with more than a vested interest in the infrastructure as code market, I see a whole lot of conversations in the public sphere about choosing an infrastructure as code tool. I'll often see people having discussions about their favourite tool on Twitter, Reddit or <insert other online platform here> and undoubtedly come across a lot of strong opinions.

I have strong opinions myself. They're so strong I voluntarily joined an infrastructure as code startup because I believed in the product. Hell, I sell the damn thing to people. As a result, I have to be hyper focused on the way our product and our competitor's products change, and need to be able to speak to the value of them in order to try and understand what's going through a user's mind.

A common pattern I've seen as the industry has evolved and new competitors have joined the growing market is the habit of creating an article that compares _features_ of the tools. These often look like this:

![Comparison](/img/iac-comparison-table.png)

Now, if you're comparing two or three tools, a comparison table can often be helpful, but it's my personal unsolicited opinions that these tables are useless. 

- They don't help a prospective user understand the value of the tools.
- They don't cover the massive, broad capabilities of the tools.
- They don't actually cover the options available to you.
- They're often out of date as soon as you publish them.

If you're unfortunate enough to have had this post come across your screen, ask yourself the question: If I saw this table, would it help me choose an Infrastructure as Code tool? If the answer is yes, close the tab and move on with your life. If the answer is "no" then keep reading, because I'm going for something different.

## Defining Infrastructure as Code Ergonomics

While features are undoubtedly important to any user, I've discovered that people generally want to boil down their Infrastructure as Code choices down to the experience they're going to have when using the tool. Programming languages have the concept of "language ergonomics" which helps to define the friction you experience while trying to get things done using the tool, and considering we've decided that we're going to define our _Infrastructure_ as _Code_ it seems fair to consider the ergonomics of the tool.

Now, ergonomics is ultimately a subjective thing: everyone will have a different experience while using the different IaC tools available. In order to try and bring some objectivity to the matter, I'm going to break down Infrastructure as Code ergonomics into 3 distinct experience.

### The Authoring Experience

The **authoring experience** is defined as what mechanisms you have at your disposal to express your infrastructure. We already decided in [my last post]({% post_url 2022-07-20-nobody-knows-what-declarative-is %}) that generally, Infrastructure as Code tools have settled on the idea that they're declarative, and what's important is your ability to manipulate the way the declarative graph is built. There are 3 main camps that have been defined for the authoring experience:

#### Domain Specific Languages

A domain specific language is what it sounds like: a language defined specifically for that domain. 

DSLs often have a shallow learning curve, and are built specifically for that purpose meaning they are often well suited to the purpose. They are often not [turing complete](https://en.wikipedia.org/wiki/Turing_completeness) on their own and have a "ceiling" in terms of how expressive they are.

Some people will argue that DSLs are favourable for Infrastructure as Code because they revent you from creating complexity because of that limited expressiveness. Those people are wrong, because ultimately badly written DSL code is just as complex and hard to refactor and understand as badly written code in a general purpose language, but I've found people are very very willing to die on that hill.

#### Programming Languages

Programming languages are the language you know and love from application development or scripting. Python, TypeScript, Go, Java and many more are options in the Infrastructure as Code space, and they all bring their own toolchains, syntax and idiosyncrosies.

What's common across those languages is that they have a slightly higher learning curve than DSLs. This increase in complexity brings with it a dramatic increase in expressibility and control. Again, some people don't think this is a good thing but my experience has been that those people are just scared of programming languages.

Personally, I believe the Infrastructure as Code industry is trending the way of programming languages by default for the authoring experience for 2 reasons:

- What you learn is reusable in other functions, like application development
- Infrastructure is complicated, so you need the ability to represent it correctly when defining it.

Most of the major Infrastructure as Code tools have invested some time in a programming language authoring model at this point, so the winds seem to be changing.

#### Configuration Languages

The last option is configuration languages. These have the least amount of expressibility, and usually need a templating language bolted on top to create any ability to get your job done. We've already decided that's [completely stupid]({% post_url 2019-02-07-why-are-we-templating-yaml %}), so I won't say any more about that.

### The Execution Experience

Once you've defined your infrastructure using the authoring experience, you'll then need to let your cloud provider know about what you've written. I'm defining this as the **execution experience**. There are a few different options in this space.

#### Client Side Experience

The client side experience - you run a command line tool which talks to an API. You might run it from your personal machine or from a CI/CD pipeline, but ultimately you're responsible for that. The graph is built locally by the tool.

With local execution experience, the tool will almost always need some mechanism to store its state. The state storage models differ by tool, and is generally where the open source tools start to embrace monetization. The necessity to have a state store comes from the need to compare the current state of the world (ie: what exists in the cloud provider) with the code you've written during the authoring model stage.

People will often argue that introducing state storage adds complexity and management overhead, but the tools have evolved significantly to the point where state storage becomes less of a problem. I'll talk more about this when I examine the tools themselves.

#### Server Side Experience

The server side experience is the practice of handing off the execution to your cloud provider. You dispatch your authored IaC off to the cloud providers service, and it takes care of building a graph for you and managing how it runs.

THis removes the need for state storage, but also completely removes your ability to manipulate the workflow and how it executes. You have zero control over prioritization, you can't speed it up (or slow it down, if necessary) and you have very little control over the feedback loop for your developers. 

#### The Unique Experience

Most Infrastructure as Code tools fall into the above two categories, but Pulumi has a fairly unique mechanism that separates it from all of the above. I'll call this the "choose your own adventure" experience which is sort of an extension of the client side experience. More information on that when we examine Pulumi in-depth.

### The Cloud Provider Experience

The final experience I'll define is the **cloud provider experience**. This is as simple as defining which cloud providers the tool supports. There are two camps to choose from.

#### Multi Cloud Support

Multi cloud support - The tool allows you to interact with multiple cloud providers and often pass values from one cloud provider to another. If you define a load balancer in AWS, you can pass the resulting CNAME from that to Cloudflare, for example.

#### Single Cloud Support

With single cloud support, the tool only gives a shit about the cloud that provides it. Advocates of CloudFormation will often exclaim that you can extend the single cloud tools out to other clouds, but in practice nobody does that because it's a ridiculous maintenance burden nobody wants to undertake.

Personally, I can't ever see why I'd use a single cloud tool, not because I'd advocate for a multi cloud strategy for compute, but mainly because I want the choice to choose another DNS provider or monitoring tool, and I want to be able to manage it with Infrastructure as Code. Ultimately though, you do you.

## The Choices

Now we've defined the ergonomics, we need to bring in all of the contenders and see where they fit within these experiences. Let's have a look!

### Terraform

Terraform has been around since 2014, and I was lucky enough to be a user of Terraform 0.1. I'm also fortunate enough to regularly work and socialize with people who defined the way Terraform works and operates and contributed thousands of lines of code to it.

### The Authoring Experience

The _primary_ Terraform authoring experience is [HCL](https://github.com/hashicorp/hcl). The original incarnation of HCL was quite rigid, didn't support abstractions or have mechanisms to create loops or use conditionals. The language is still evolving but as with all DSLs, it's got a single purpose: You define infrastructure with it. 

Lot's of people love HCL. I don't, but I promised this post would be reasonably objective, so I won't expand on why.

Terraform has invested a lot of effort into a programming language authoring experience it calls [CDK for Terraform](https://www.terraform.io/cdktf) which enables users to get the programming language authoring experience. Interestingly, if you examine the [Terraform roadmap from 2021](https://www.hashicorp.com/resources/the-terraform-roadmap-hashiconf-global-2021), most of the conversation is around CDK for Terraform, and there is seemingly very little investment in HCL. Make of that what you will.

### The Execution Experience

The execution experience of Terraform centres around the Terraform CLI, the managed service offerings for Terraform help you abstract that way from the end user. Using Terraform Cloud will mean you don't have to define a CI/CD pipeline, but ultimately, you're going to follow a CLI driven workflow.

There is a programming language SDK wrapper mechanism for Terraform called [terraform-exec](https://github.com/hashicorp/terraform-exec) but it's only available in the Go progamming. If you want to build custom workflows for Terraform outside Go, you're on your own.

### The Cloud Provider Experience

The [Terraform Registry](https://registry.terraform.io/)

### CloudFormation

### Crossplane

### Azure Resource Manager

### Pulumi