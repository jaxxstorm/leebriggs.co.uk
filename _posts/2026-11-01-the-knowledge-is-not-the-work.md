---
title: "The knowledge is not the work"
layout: post
category: blog
tags:
- leadership
- software development
- technology
---

In 2024 I made a career decision I had previously avoided: I was going to move into people management. I had toyed with this idea for most of my career, but felt I needed a combination of the right environment and personal growth. I don't really like doing something and not being good at it, which is a slightly inconvenient personality trait when you're trying something new.

At Tailscale, I saw what I thought was the right fit. A high performing team, a fast growing company and a product that people loved. All I had to do was figure out how to scale the solutions engineering team in a way that helped customers be successful. Easy, right?

As I've grown into management, and from there into a manager of managers role, I've started to reconsider some of the things I valued about myself as an individual contributor. They're still useful, but I'm realising that I gave myself rather a lot of credit for having them without thinking enough about how I applied them.

The one I keep coming back to is knowing things.

![knowing-things](/img/drinking-knowing.jpg)

{% include note.html content="as of yet, nobody has offered to pay me for the drinking part" %}

If you've spent any amount of time in a technical role, you'll probably recognise how this happens. You spend years learning how things work, usually by breaking them in increasingly interesting ways, and eventually become the person people come to when they need an answer.

You know that person. Maybe you *are* that person. Someone asks a question in Slack and you immediately know the answer. You've seen this before, you understand how it works, and you jump into the thread: "Hey, it's actually this!"

It feels good. People trust you, your opinions carry weight, and a few emoji reactions provide the dopamine hit that confirms you've been helpful. You can go back to whatever you were doing, safe in the knowledge that you've contributed.

And you probably have! I'm not suggesting that answering someone's question is a waste of time. But it's very easy to become attached to being the person who knows, and considerably less interested in what happens after you've told everyone.

This is the distinction I've found myself explaining a lot recently. Knowing things has value, but that doesn't automatically translate into value for a business. At some point, someone has to use that knowledge to make a decision, fix a problem or help a customer. If that part never happens, how useful was it?

## Knowing the answer is only the start

Let's say someone drops a question in Slack you've seen a dozen times before:

> Hey, can X do Y?

You know that X cannot do Y. You also know *why* X cannot do Y, because you were involved in the discussion when someone decided it shouldn't. So you helpfully explain:

> Unfortunately not. Given Z constraint, we decided to do ABC instead.

This is a perfectly reasonable answer. Sometimes it's exactly what the person needed, and everyone can get on with their day.

But sometimes you've just explained why they're stuck.

You might also know an alternative. You might know how another customer solved the same problem, or that there's someone on another team who has spent the last month working on precisely this. None of that helps the person asking unless you tell them.

"We don't support Y, but here's how we've helped customers with similar requirements using ABC" takes a little more effort. You have to think about how what you know applies to their situation. You might have to find an example, explain a tradeoff or introduce them to someone.

That extra bit is quite often where the value is.

Sales engineering makes this particularly obvious. If a colleague is preparing a recommendation for a customer, they need more than an explanation of why a feature doesn't exist. They need to understand what we can recommend instead, where it falls short and whether they can confidently tell the customer it'll solve their problem.

You might already know all of that. Your colleague doesn't. Giving them enough context to have that conversation is a meaningful part of your job, even if it takes longer than posting the technically correct answer and disappearing.

I don't think you have to personally take over every problem you know something about. That would be a fairly quick way to make yourself miserable. But there's a reasonable distance between owning the entire problem and leaving someone with "no, that won't work". We should be willing to cover some of it.

## Okay, but did it help?

I've started to think about this in three stages:

| Activity | What you've contributed | What might still be missing |
| --- | --- | --- |
| Knowing something | You have the expertise and context | It's still in your head |
| Expressing it | You've answered the question or written the document | The person reading it might still have no idea how to proceed |
| Making it useful | You've helped someone apply that knowledge | They might need further help, but they have a way forward |

The middle row is a comfortable place to stop. You've written something down. You've explained it in the meeting. If it comes up again, you can point to the thread where you already covered it.

"I already answered this" might be true. It's also worth considering why someone still needs help.

This is where my thinking about performance has changed. I care about outcomes. If you tell me you've spent all week answering questions in Slack, I want to understand whether it helped. Were people able to do something they couldn't do before? And if you keep getting the same questions, why are we still relying on you to answer them individually?

There might be a good reason. There might also be an opportunity to spend an afternoon making it possible for the rest of the team to handle them without you. You'd get fewer opportunities to demonstrate your expertise, but everyone else would get on with their work. I would consider that a good result.

The annoying part, now that I'm a manager, is that figuring this out requires more effort than noticing who's active in Slack. I can see who posts the answer. I might completely miss the colleague who reads it, realises it won't make sense to the customer, and spends an hour helping them work through it.

If I'm giving all the credit to the person who posted the answer, I'm part of the problem. I can talk about outcomes as much as I like, but people will notice what actually gets recognised.

I'm also not going to pretend that good work always ends with a happy customer and a signed contract. I've worked in sales long enough now to know that you can do everything right and still lose. I care about what your involvement changed, including the things we decided *not* to do.

If your knowledge helped us establish that we weren't a good fit before six people spent a month on a pointless proof of concept, thank you. Please keep doing that.

## And of course, the AI of it all

You didn't think you were going to get through a technology blog post in 2026 without an AI mention, did you?

Getting an answer to a technical question has become incredibly easy. Whether it's a *correct* answer is another matter, but you can get an explanation, ask follow-up questions and generate an example without waiting for the person who knows that particular thing to finish their lunch.

Stack Overflow is a fairly obvious example of the shift. For years, you went there to find someone who knew more than you did. People built substantial reputations by answering questions, and the rest of us relied on those answers to get things working.

A [community analysis on Stack Overflow's Meta site](https://meta.stackoverflow.com/questions/438596/stack-overflow-is-becoming-a-ghost-town-now-what) reported around 88 questions a day in February 2026, compared with more than 6,700 at its peak in 2014. The decline started before ChatGPT, so attributing all of it to AI would be convenient rather than accurate. But [Stack Overflow's own 2026 survey](https://survey.stackoverflow.co/2026/community/data/so-change) found that 64% of respondents to its question about AI's impact said they visited less for simple questions.

The experts haven't suddenly become stupid. People have found another way to get answers to many of their questions.

If being the person with the answer is a large part of how you think about your contribution, it's probably worth thinking about what those numbers mean to you.

Your colleague can now turn up with three suggested solutions and a convincing explanation of each. Someone still has to establish whether any of them make sense for the customer. Perhaps the proposed approach relies on something they can't deploy. Perhaps it solves the immediate problem while creating a much worse one. Perhaps the entire explanation is bollocks, but it's well formatted bollocks.

Your experience should help you work that out. It should also help you explain what to do next.

And yes, AI can help with that part too. It can adapt the example, draft the explanation and help test your assumptions. I'm not particularly interested in drawing a line around some part of my job and declaring that a computer will never be able to do it. I'd much rather use the tools to help people get further than they could before.

What I don't want is for us to produce ten times as many answers and congratulate ourselves without checking whether anyone got anywhere.

## Still learning

When I moved into management, I expected to have plenty to learn. I hadn't really considered how much I'd need to rethink the things I already thought I was good at.

I'm still working on this. I like knowing things, and I definitely like having opinions about them, as anyone who's had the misfortune of spending time with me will confirm. It's satisfying to have the answer. It's less satisfying to discover that your excellent explanation hasn't helped and you need to have another go.

But that's something I need to get better at, and something I want to recognise in the people I lead. If your expertise means a colleague can handle the next customer conversation without you, you've done something valuable.

You might not be in the thread getting the emoji reactions this time. Your colleague got the customer moving without needing you. I'm learning to be quite happy with that.