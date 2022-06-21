---
title: DevOps is a failure
layout: post
category: blog
tags:
- devops
---

It's probably impossible for most people to recall the first time they heard a word, but I remember hearing the word "DevOps" for the first time. I was having a beer with a colleague in 2013 who has taught me almost everything I knew at that point and I'd been lucky enough to bring him along to a new job I started where he could do lots of smart things and I could ride his coattails. We were discussing some of the problems we'd seen in the new job that probably feel familiar to most people now: we couldn't get the application running in production.

He was talking about how we needed to get involved earlier in the lifecycle to ensure we were all on the same page. In his imitable Australian accent he mentioned the word "DevOps" and it stuck with me.

2013 was relatively late to the game in DevOps. If you ask most people about the origin of the term, the two things pivotal moments everyone seems to agree on are Patrick Debois and Andrew Clay Shafer meeting at the Agile Conference in Toronto, and the talk by [John Allspaw and Paul Hammond at Velocity '09](https://www.youtube.com/watch?v=LdOe18KhtT4)

The ideas back then were simple: fix the culture. Since then, the term has taken on a life of its own. We now have "DevOps Engineer" as a job title.

What's always been curious to me about DevOps as a discipline is how much the term has skewed towards the operations side of the fence. I think anyone reading this would agree that in order for "DevOps" to be successful, both sides of the divide need to participate, but if I think back to all the DevOps days conferences I've ever attended, the anecdotal evidence I've gathered has been that the conference are _heavily_ attended by operations, and less attended by developers.

## DevOps is just Operations

5 years on from that conversation with my Australian friend, I was sat in another meeting at the same employer when a director level colleague leading the development of one of our products mentioned that his teams were "true devops". I remember being incredibly confused by this. They'd never spoken to us about their operational needs, we didn't even know what they were doing - all we knew is they were using AWS ECS to deploy their application. How could they be "true devops" if our operations team weren't even involved.

As I started to have conversations with the developers on the team, I realised what he meant: his developers were handling the entire lifecycle of the application. They were using `boto3` and writing deployment scripts and applications to ship new releases. They were hiring "full stack engineers" who were versed in AWS as well as backend engineer tasks.
As an early adopter to the platform engineering mindset, I was sort of confused why this was going on. We were well on the way to building a [Netflix style paved road](https://www.infoq.com/news/2017/06/paved-paas-netflix/) and the entire reason for this was to make their lives easier, to remove all the pain of deploying and managing the deployment and infrastructure lifecycle. All they meant when they said they were "true devops" was that they were doing their own ops work. Why were they doing it this way?

## A turning point

The conversation that followed would fundamentally change my entire world view with regards to DevOps but not until many years later, when I joined Pulumi. We were building our paved road with tried and tested tools that operations folks know and love, we had some GitLab CI, we had some Terraform, we were even starting to sprinkle some Kubernetes on the problem. It went a little bit like this:

> Hey, you should try using our platform! We've fixed all of this stuff and it's way better than the stuff you've built

> Thanks, but we're not interested

> Err why? It's more reliable, faster and uses industry standard tools

> Yeah but we don't know any of those things. We understand the stuff we've built.

I threw up my hands in despair and walked away, believing that one day they'd see the error of their ways and come begging for us to help them. After all, we were _operations_. We know how to run software in the cloud.

None of this was unique at this point. I had spent _years_ trying to bring the developers to the table and own their operational overhead. I had tried to convince them to attend DevOps days conferences. I had done internal brown bags explaining what the platform we'd been building did and how it was going to help them. I'd argued, fought and generally bullied my way into developers conversations trying desperately to bring a "DevOps" mindset to the whole company and the way it had been interpreted by this team was "we'll do it ourselves, thanks".

Around 18 months later, I was moving on. Here I am 2 years after that saying how fundamentally wrong I was and that DevOps as we know it is an abject failure.

## It's only hubris if I fail

Looking back at that time, it's obvious to me why this attempt to change the culture failed, but at the time I couldn't see it. Remembering the ideas from DevOps at its inception, the point was to remove the friction between developers and operations: have operations stop saying "no" and developers stop saying "yolo lets ship it". Those ideas and goals are still noble, and organisations should still aspire to them today, but what does the world of DevOps actually look like?

Ultimately, my assessment of DevOps in 2022 is this:

_DevOps is about people on the operations side of the fence trying to convince Developers to do things their way_

Almost all the tooling marketed as "DevOps tooling" is focused on operations. If you browse /r/devops you'll see post after post of people talking about operations and operational tooling. If you look at a DevOps engineer job description, it looks remarkably similar to a System Administrator role from 2013, but with some containers and cloud provider management instead of racking and stacking servers.

If DevOps was supposed to be about changing the overall culture, it can't be seen as a successful movement. People on the operations side of the fence will happily say "well, we're trying!" but what they mean by that is they're attempting to be a pied piper towards operational considerations - its not a two way street.

It's worth remembering as an operations person, we are generally out numbered at least 5/1 in any given engineering organisation. Trying to convince every last developer to do things "the operations way" and "use operations tooling" ultimately is a fools errand. We need a change.

## What can we do about it?

Ultimately, I think it's too late to save the term "DevOps". If people are selling you DevOps, it's probably too late. What I'd like to see happen from here is a fundamental shift in how DevOps people think in their day to day role.

It's hard to remember sometimes, but as operations focused people, our role is to enable and facilitate developers in getting features into the hands of customers (or whatever other business objective they might have). Creating the path of least resistance is a vital part of forging and maintaining velocity for developers shipping products and features, and having the developers learn and maintain all of the operations practices just isn't scaleable or feasible. 

If you've read this far and agree that "DevOps" was the attempt to bring developers over the fence into the world of operations, and you _also_ agree that largely that attempt has failed, you might agree that we need a new term.

So I'm throwing one out there. Let's try *SoftOps*.

# SoftOps: Operations for Software Developers

If your first thought is "that's a shitty name" then you're right, but it's a shitty name you'll remember. 

SoftOps is the idea that we're going to build operational practices focused on making developers lives better. We're not going to _tell_ them what to do, we're going to _ask_ them what they want to do, operationally, and then make it as easy as we possibly can for them. 

Gone will be the days of "download this tool, read this 48 page man page and tell your PM you're missing your sprint deadlines" and in addition to that, gone are the days of "just give it to me and I'll do it for you". 

SoftOps is the idea that you'll but the developers first, as your primary customer. Building operational practices that speak to a developers world and needs should (in theory) bring developers to the table in order to work collaboratively. Maybe if we focus on that goal alone, we'll ultimately solve the issues DevOps tried to solve all the way back in 2009.

Who's with me?



