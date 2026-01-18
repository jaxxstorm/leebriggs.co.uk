---
title: "The enshittification of enshittification"
layout: post
category: blog
tags:
- community
- tailscale
---

Over the last six months, I’ve spent a lot of time in the Tailscale community - helping users debug issues, answering questions about how we sell the product and explaining, repeatedly, how we think about the business behind it.

It’s rewarding work. I genuinely enjoy it.

But threaded through almost every conversation is the same quiet fear:

> “Eventually you’re going to take this away from me, aren’t you?”

## Enshittification

That fear usually traces back to [Corey Doctorow's](https://en.wikipedia.org/wiki/Cory_Doctorow) concept of [_enshittification_](https://en.wikipedia.org/wiki/Enshittification): the idea that any service which genuinely solves a problem will, over time, mutate into a platform that extracts value from the people who depend on it.

It’s frequently paired with another well-worn belief:  
“If you’re not paying for anything, you’re the product.”

These ideas have become common shorthand for how people reason about SaaS businesses. They’re not wrong, exactly - but when they’re treated as universal laws rather than patterns, they flatten a lot of important context. Before applying them indiscriminately to everything we like or rely on, it’s worth understanding what actually drives this behavior in the first place.

## The VC-backed engine

Most companies that take venture capital do so for the same basic reason: to grow. Growing a business requires capital, and capital is hard to come by when you’re small. You need to invest in marketing, hire engineers to improve the product, and hire salespeople to bring it to market.

The tradeoff is straightforward. Once you take venture capital, you are no longer optimizing solely for users. You are also obligated to return capital to investors, and that obligation shapes every decision that follows. Growth in revenue, market share, and valuation isn’t just encouraged. It’s required.

When it works, this becomes a flywheel. You spend money to grow. Growth improves your market position. That success unlocks more opportunity. Growing companies are fun places to work. I’ve spent most of my career in them because that energy is infectious and motivating.

What’s discussed far less is how hard sustainable revenue growth actually is. Adding users to a free tier is often easy. Converting those users into paying customers is not, unless your go-to-market motion is exceptional. For a lot of companies, that pressure is where shortcuts start to look tempting.

## Product-led growth, actually

Before going further, it’s worth being clear about my vantage point. I’m not the person who ultimately sets pricing or product strategy. But as Director of Solutions Engineering, I sit in the middle of customers, sales, and the community. When decisions land poorly, I feel it immediately.

From where I sit, Tailscale’s go-to-market motion is product-led growth in a very literal, very unromantic sense. People show up because they have a real connectivity problem in their own lives and want it to stop being annoying. If the product works, they keep using it. If it doesn’t, they leave.

What makes those users valuable isn’t that we extract revenue from them directly. It’s that those same problems inevitably show up at work. And once someone has used a tool that just works, their tolerance for brittle, frustrating alternatives drops fast.

If a company like Tailscale were to start degrading the personal tier in pursuit of short-term revenue, that incentive chain would collapse. It wouldn’t unlock some hidden pool of money. It would remove the very top of the funnel that drives our revenue growth in the first place. Individual users aren’t a loss leader - they’re the mechanism by which trust, familiarity, and adoption propagate into larger rollouts inside organizations.

This is also why comparisons to consumer platforms tend to fall apart. Those businesses operate at enormous scale, where marginal users can be monetized through ads, fees, or data. The market Talscale operates in is different. Secure business connectivity is a multi-tens-of-billions-of-dollars global market, but that revenue comes from companies, not individuals. There simply aren’t enough people with homelabs, side projects, or personal VPN needs to generate meaningful revenue on their own. And trying to squeeze value out of them would actively harm the thing that makes the business work.

I think that's why we’re careful about what we do and don’t gate behind a paid plan. In practice, removing useful features from the personal tier doesn’t create value - it just makes the product worse. And making the product worse at the individual level directly undermines the _business_ trying to grow.

From where I sit, we don’t want people paying us to make their personal networking tolerable. We want companies paying us because their employees already like using the product, and want that same experience at work. What keeps this model working isn’t clever pricing or gradual value extraction. It’s people who like the product enough to say, “Hey, this would make our lives easier,” even when that’s not their job.

I’m literally incentivized, as a sales engineer at Tailscale, to sell the product. And I have very little interest in trying to generate revenue from personal users, because unhappy users don’t advocate for anything. Making them happy isn’t a feature - it’s the whole point.

## Inevitability is lazy thinking

One of the things I struggle with in the enshittification narrative is how quickly it turns into inevitability, like some self-fulfilling prophecy. There's this pervasive idea that every company will eventually betray its users, so we may as well stop expecting anything better and that's just capitalism baby.

I think once we start to bandy around the idea of enshittifiation at literally everything, we've enshittified the concept of enshittification. We've removed all accountability from the equation.

Companies don’t enshittify because time passes. They enshittify because incentives change, leadership priorities shift, or short-term outcomes are allowed to override long-term trust. Cynicism feels realistic, but more often than not it’s just resignation dressed up as wisdom.

## Trust is a business constraint

Trust isn’t a marketing asset - it’s a constraint. Once users believe you will eventually make their experience worse in pursuit of growth, every decision you make is filtered through that assumption and at that point, even good changes are met with suspicion. I've seen Reddit comments recently that have framed "new Tailscale features" as the beginnging of Tailscale's enshittification cycle because _any_ change is now considered enshittification.

For a company like Tailscale, trust compounds slowly and breaks quickly. Our product sits directly in the critical path of how people access their networks and their work. If users stop believing we’re acting in good faith, no amount of pricing optimization or feature bundling will fix that and the most important thing about this is that _everyone who makes decisions at Tailscale knows it_.

## What would actually force this to change

None of this is to say the model is immortal. There are conditions under which it would break. If the personal tier stopped being a meaningful driver of business adoption. If the problems we solve no longer overlapped between individuals and organizations. Or if the economics of running the platform changed in a way that made the current structure unsustainable.

If that day ever comes, the _honest response_ wouldn’t be to degrade the experience and hope people don’t notice or don't care. It would be to explain the tradeoffs openly, change the model explicitly, and accept the consequences of that decision. I suspect in that set of circumstances, Tailscale has enough competitors (including our open source control plane!) that it would lead to a significant drop off in users.

Until then, the incentives are clear. Making personal users happy isn’t charity, and it isn’t a teaser for future monetization. It’s the foundation of how the product grows.