---
title: Draw your own conclusions
layout: post
category: blog
tags:
- politics
- tech
- why-am-i-having-to-write-this
---

The year is 2020, and the US election is a matter of days away. While the world deals with an unprecedented pandemic and Americans on both sides of the aisle fight for what they believe to be the very soul of their nation, conservative media is in a frenzy about a laptop that contains emails from [Hunter Biden](https://en.wikipedia.org/wiki/Hunter_Biden), which has been procured by [Rudy Giuliani](https://en.wikipedia.org/wiki/Rudy_Giuliani), who was named President Donald Trump's [cybersecurity expert](https://www.washingtonpost.com/news/powerpost/wp/2017/01/12/trump-names-rudy-giuliani-as-cybersecurity-adviser/) in 2017.

Now, anyone who has previously read this blog will wonder why on earth I'm writing about this topic. To be quite honest, it's past 10pm on a Thursday evening and I'm sort of wondering why myself. However, I saw a set of tweets in my timeline which raised my eyebrows. Here's the first tweet in the thread:

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">So as I blogged before, the emails contained DKIM information, which the original reporters could and should have verified. So I eventually got a copy of the email and run DKIM verification on it. It passed: <a href="https://t.co/HVjOlMq7QV">https://t.co/HVjOlMq7QV</a></p>&mdash; Robᵉʳᵗ Graham😷, provocateur (@ErrataRob) <a href="https://twitter.com/ErrataRob/status/1322007153415200768?ref_src=twsrc%5Etfw">October 30, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

To provide some context, the Daily Caller (a news organization founded by [Tucker Carlson](https://en.wikipedia.org/wiki/Tucker_Carlson) among others) have printed a story on their website in which they cite evidence from Rob Graham, a well respected Information Security researcher (who is has written powerful and widely used tools). Rob has gone out of his way to retrieve a copy of an email from the Hunter Biden "laptop from hell" and verified the [DKIM signature](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail) of one of the most damning emails.

To quote the Daily Caller, this information _authenticates_ these emails. Here is the exact quote ([at the time of writing](https://web.archive.org/web/20201030052504/https://dailycaller.com/2020/10/29/cybersecurity-expert-authenticates-hunter-biden-burisma-email/)) from the Daily Caller article:

_Graham, who has been cited as a cybersecurity expert in The Washington Post, the Associated Press, Wired, Engadget and other news and technology outlets, told the DCNF that he used a cryptographic signature found in the email’s metadata to validate that Vadym Pozharsky, an advisor to Burisma’s board of directors, emailed Hunter Biden on April 17, 2015._

Before I examine this particular claim, I'd like to assert that I am not an internet security researcher that has been cited in the Washington Post like Rob. I do, however, have a fairly good understanding of how email, DKIM, the internet and computers in general work. 

I can say with a very high degree of certainty that the quote from the article is spurious at best, and utter horseshit at worst. It is impossible to verify that Vadym Pozharsky sent that email from a DKIM signature alone.

## Let's talk about email

Anyone with even a passing interest in IT and computers may have heard that email is insecure by design. At its very core, email was designed to send communications between people in plaintext, and every attempt to secure it since its conception has been a bolted on attempt to try and fix it, with varying degrees of success.

There's a reason you get so much spam in your inbox, and it's the same reason you get told by people at your employer not to click on links in emails you don't trust. To provide a non-exhaustive list:

  - It's very easy to forge the `from:` field of an email address
  - It's possible to intercept an email and read its content without a whole lot of legwork
  - Email providers are notoriously lax with who they allow to create accounts

DKIM was created in 2011 to try and attempt to stop some of the issues around the above issues, with varying degrees of success.

## What the fuck is DKIM?

DKIM is an email enhancement which is designed to prevent the forging of sender addresses in email. It works by using [Public-key cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography) to "sign" emails when they are sent.

When you send an email with DKIM enabled, it's signed by a private key which is held by your outbound mail server (although, not exclusively, but that's beyond the scope of this article). When this happens, your email server embeds an [email header](https://en.wikipedia.org/wiki/Email#Header_fields) into the outgoing email, with key information such as who the sender is, and the location of the public key used in the keypair which can be used to verify the email's origin.

Many of the large email providers enable DKIM by default on outbound mail, because it works wonders in preventing spam originating from their domains. It's for this reason that spammers will often try and hijack the credentials for your email accounts and use them as part of their spam bots - getting access to a valid account on a respected email provider with DKIM enabled will almost always bypass any spam protection the recpient has enabled.

Knowing this information, we can make some very strong assertions from the email (which is available [here](https://github.com/robertdavidgraham/hunter-dkim/blob/main/Meeting%20for%20coffee.eml) with the DKIM header included).

### What we can verify

Rob did the heavy lifting for us. The email contains a DKIM signature and Rob verified that the signature was valid:

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">So you search the Internet for &quot;TXT 20120113._domainkey.gmail.com&quot; and you&#39;ll find lots of answers what the key was 6 years ago:<a href="https://t.co/eK6kHNd9Mn">https://t.co/eK6kHNd9Mn</a></p>&mdash; Robᵉʳᵗ Graham😷, provocateur (@ErrataRob) <a href="https://twitter.com/ErrataRob/status/1322009696149164032?ref_src=twsrc%5Etfw">October 30, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

We can say with a very high degree of certainty that the email linked above originated from a _genuine google email address_. The address the email came from is `v.pozharskyi.ukraine@gmail.com` and if we consider the definition of *authentic* that we can verify the emails' origin, we could arguably say that this email is *authentic*.

However, if we recall the original article from the Daily Caller, they didn't just claim the email is authentic, they actually said this:

_...told the DCNF that he used a cryptographic signature found in the email’s metadata to validate that Vadym Pozharsky, an advisor to Burisma’s board of directors, emailed Hunter Biden on April 17, 2015._

### What we cannot verify

Here's the problem with this whole affair. There is absolutely no way, at all, to verify that Vadym Pozharskyi is the owner or has access to the `v.pozharskyi.ukraine@gmail.com` email address. It's possible that he is the owner. Some people reading this might even say it's _likely_ he's the owner of that account. Information may come to light after I publish this post that it is factually correct that Vadym Pozharskyi owns this email address.

What I have a considerable problem with here is that Rob Graham, a well respected security researcher, is being quoted in a popular website as claiming that DKIM _proves_ that Vadym Pozharskyi sent this email. 

If you quickly scroll back to my list of reasons email isn't secure, you'll notice that I make the assertion that anyone can register an email account with Google. In fact, I registered one in seconds:

![](https://i.ibb.co/Wn7cYRh/Elj-Pm-j-Vo-AA9gl-A.jpg)

Again, I cannot claim that this email is _not_ from Vadym Pozharskyi, but I also know that Rob Graham knows that the information being spread by the Daily Caller cannot be verified to back up the claims they're making from a DKIM signature, and it is dishonest to claim otherwise.

## Draw your own conclusions

I have a high degree of respect for Rob, despite the fact I don't agree with his political opinions. What has begun to frustrate me more than anything about discourse in the 21st century is the tendency to provide only enough information to support your argument, and omit vital pieces of information. With that in mind, I'd like to finish this post with a couple of extra pieces of information you might consider:

  - [DKIM is not a flawless protocol](https://noxxi.de/research/breaking-dkim-on-purpose-and-by-chance.html#spoofed_body_dhl), and can be spoofed
  - There is [allegedly evidence](https://blog.intelx.io/2020/10/14/an-osint-investigation-into-the-alleged-hunter-biden-email/) that a user with the email address `v.pozharskyi.ukraine@gmail.com` registered a DNS domain under the street address of Burisma Holdings, however I am unable to independently verify this via the means in this post.

I suspect this story will continue to evolve as the election unfolds. As new information comes to light, you should draw your own conclusions - just make sure you're drawing them with all the information at hand.

