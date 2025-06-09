---
title: "An easy, realistic model for MCP connectivity"
layout: post
category: blog
tags:
- ai
- tailscale
- networks
---

You can't escape it. Everywhere you turn in the tech ecosystem, AI is there.

![Dwight](/img/dwight-angela.jpeg)

Whether you're an AI skeptic or an AI convert, you almost certainly understand how explosive the change in the tech ecosystem has been, and how _fast_ everything is moving right now.

I'll keep my personal opinions about AI generally out of this blog most (mostly) but I've been staying very familiar with the [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) for a few reasons, the primary one being that it seems _absolutely terrifying_ in ways I can't really comprehend.

Many of the security lessons we've learned over the years seem to have been overlooked in MCP's rapid development. "Protect your data, it is what's unique to you!" was the battle-cry of every tech oriented person for most of my career. I'm old enough to remember when Cambridge Analytica (mainly because it wasn't that long ago..) was raked over the coals because it weaponised our social media data and now a few years later we seem quite content with the idea letting large VC-funded organisations to slurp up mountains of our private data to train their word guessers.

I'm being as glib as I always am on this blog with the last paragraph, but in all seriousness, MCP has a problem - you want to get your data into an LLM, but you don't want everyone else to be able to see it.

## A quick history of the MCP evolution

At its core, MCP is a funnel. How do I get local information - or - information that isn't crawlable on the public internet - into an LLM so it can analyse it. Anthropic defined a spec that will help you do just that, and in its infancy, the trick was simple - run a local server that speaks JSON so that a local client can call and pipe it into the LLM.

The initial version of the spec seemed destined for local connectivity. The servers were designed to be accessed over a [stdio](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#stdio), which you'd run locally and then connect to with an MCP client, like Claude Desktop. Stdio is just "standard input and output streams" and isn't at all designed to be called remotely, so generally your data is pretty safe. It's really not easy to intentionally expose your data to the big scary world.

Running a stdio MCP server was pretty easy, most of them are written in Typescript or Python, and you'd just add commands that you ran into your MCP client and it'd execute it on startup - easy.

In Claude Desktop for example, here's how you'd run a filesystem MCP so Claude can analyse your local filesystem:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Desktop",
        "/Users/username/Downloads"
      ]
    }
  }
}
```

Pretty straightforward if you can, you know - easily write JSON and understand what the hell `npx` is. Obviously for non-technical users, this looks like a magical incantation, but that's okay, MCP is early.

As things have progressed (very very quickly, I might add) it's become obvious to people that eventually, you want to be able to run these MCP servers somewhere else other than your local machine. Various companies have sprung up around this, with varying degrees of success and questionable security tactics themselves.

So the spec evolved to meet these needs, and the next iteration introduced a mechanism to access MCP servers remotely, which became [Server Side Events](https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse).

You can see on this page there's suggestions for how make sure this doesn't go badly for you:

> Security Warning: DNS Rebinding Attacks
>SSE transports can be vulnerable to DNS rebinding attacks if not properly secured. To prevent this:

>- Always validate Origin headers on incoming SSE connections to ensure they come from expected sources
>- Avoid binding servers to all network interfaces (0.0.0.0) when running locally - bind only to localhost (127.0.0.1) instead
>- Implement proper authentication for all SSE connections
>- Without these protections, attackers could use DNS rebinding to interact with local MCP servers from remote websites.

SSE started to take off despite these warnings on the server side, but due to the pace of innovation, clients were surprisingly slow to introduce support for this. At the time of writing, I still can't find a client that is broadly used that will allow you to connect easily to an SSE server.

So we started to see a new type of tool appear - the proxy. It would proxy requests from stdio clients into SSE events, allowing people to run those SSE servers remotely.

Finally, the most recent innovation has been to completely ditch SSE (after only 5 months, by my count!) and switch to [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) as an alternative, which might just set the land speed record for a protocol deprecation, but still, an evolution nonetheless.

## And yet, there's still a problem

As all this change has happened, I've been watching it and thinking to myself "well, okay, but this is still a security nightmare". There are obviously things happening in the space that are changing here, and there's _intent_ to fix it, but take another look at the [streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#security-warning) warnings and spec - there is absolutely no written document at the time of writing this blog post to introduce any sort of authentication to the protocol. It _has_ been [drafted](https://modelcontextprotocol.io/specification/draft/basic/authorization) and is following a fairly typical pattern of late - "let's slap some oauth on top of it and call it good".

Personally, that doesn't make me particularly happy, because I think oauth is really confusing and easy to screw up and secondly you still have a _communication_ problem. I don't care how much authentication you put on top of something, if there's particularly sensitive data behind something, I still don't want it hanging around on the internet.

So, this got me thinking. I work for Tailscale, Tailscale's really quite good at protecting your data and connecting things together. How can we improve this situation?

## My first MCP server

As things were evolving, I wrote a little MCP server for the Tailscale API that allows you to query a few things there, primarily to try and understand the protocol and see what useful things we could do. I stuck with `stdio` and then introduced SSE, but was pretty unhappy with how things looked at that point, so left it at that.

However, when streaming HTTP was published a few weeks ago, I realised there was an opportunity here to really make the security model robust.

You can get some of the benefits of Tailscale with streaming HTTP by just having a Tailscale on both ends of the equation. Install Tailscale on your local machine, spin up another one somewhere and run a streamable HTTP server, then configure your MCP client to run an MCP proxy (of which there many, such as [sparfenyuk/mcp-proxy](https://github.com/sparfenyuk/mcp-proxy) or if you prefer Typescript, [punkpye/mcp-proxy](https://github.com/punkpeye/mcp-proxy)). When you configure the proxy, set your `endpoint` to the remote Tailscale client and you're golden.

This is a massive massive improvement because now you don't have to run the damn thing on the public internet, which should be fairly obvious, but I had an idea - what if we could use Tailscale's application awareness to improve the security model _even more_.

So I did two things:

- I wrote a little MCP proxy in Go that forwards Tailscale's headers like `X-Tailscale-User` to the remote HTTP MCP server, and then I updated my Tailscale MCP server to support reading Tailscale's grants mechanism to determine _what that Tailscale user is allowed to do_.

## A proper security model in action

So how does this look? Well, I can run my Tailscale MCP server on a remote machine. I spun up a VM in digital ocean and fired it up:

```bash
curl -L https://github.com/jaxxstorm/tailscale-mcp/releases/download/v0.0.3/tailscale-mcp-v0.0.3-li
nux-amd64.tar.gz | tar -xzf -
TS_AUTHKEY=<your-auth-key> ./tailscale-mcp --tailnet=<your-tailnet> --api-key=<tailscale-api-key>
```

And some output logs

```bash
4:48:37	INFO	tailscale-mcp/main.go:265	Starting ts-mcp	{"version": "0.0.3", "tailnet": "lbrlabs.com", "hostname": "ts-mcp", "port": 8080, "debug": false, "stdio": false}
2025/06/09 14:48:37 tsnet running state path /root/.config/tsnet-tailscale-mcp/tailscaled.state
2025/06/09 14:48:37 tsnet starting with hostname "ts-mcp", varRoot "/root/.config/tsnet-tailscale-mcp"
2025/06/09 14:48:37 Authkey is set; but state is NoState. Ignoring authkey. Re-run with TSNET_FORCE_LOGIN=1 to force use of authkey.
14:48:37	INFO	tailscale-mcp/main.go:558	Serving MCP via Tailscale	{"address": ":8080"}
14:48:37	INFO	tailscale-mcp/main.go:586	Serving MCP locally	{"address": "127.0.0.1:8080"}
2025/06/09 14:48:42 AuthLoop: state is Running; done
```

Now, I just need to configure my MCP client (in my case, Claude Desktop) to run my MCP proxy locally. 

```json
{
  "mcpServers": {
    "tailscale": {
      "command": "/usr/local/bin/tailscale-mcp-proxy",
      "args": ["--server", "http://ts-mcp:8080/mcp"]
    }
  }
}
```

I need Tailscale running on my machine so they can communicate with each other and capture the information who I am.

```bash
tailscale status
100.84.243.110  lbr-macbook-pro      mail@        macOS   -
100.72.57.77    lbr-iphone           mail@        iOS     offline
100.81.81.4     lon-derp1            tagged-devices linux   -
100.105.3.74    sea-derp1            tagged-devices linux   -
100.66.15.114   ts-mcp               mail@        linux   idle; offline, tx 52624 rx 72604
```

Now, I can fire up Claude Desktop and ask it questions about my Tailnet:


![Access denied](/img/claude-access-denied.png)

But wait, it's telling me I don't have permission? If we look at the MCP server's logs, we can see I don't have the right permissions to run the query:

```
15:17:08	INFO	tailscale-mcp/main.go:159	No MCP capabilities found
15:17:08	WARN	tailscale-mcp/main.go:172	No MCP capabilities found	{"user": "mail@lbrlabs.com"}
```

The reason for this is that my Tailscale MCP server is going to use Tailscale's grants to determine which tools I'm allowed to call. So lets add a grant to my Tailscale ACL to indicate I can call all tools:

```json
{
    "src": ["autogroup:admin"],
    "dst": ["100.66.15.114"], // the address of my Tailscale MCP, I could also use tags
    "ip":  ["tcp:8080"],
    "app": {
        "jaxxstorm.com/cap/mcp": [{
            "tools":     ["*"], // I can call all tools
            "resources": ["*"], // I can call all resources
        }],
    },
},
```

Now, let's try that query again!


![Access granted](/img/claude-access-granted.png)

Success! 

## The caveats

This is all well and good, but what are some of the considerations to this approach?

As it stands, `tsnet` is only really usable for Go servers, so you'd need to write your MCP server in Go, which is not officially supported right now. Most MCP servers are written in Typescript or Python. To each their own.

{% include note.html content="Tailscale _does_ have a proof of concept [C based library](https://github.com/tailscale/libtailscale) which could be used for Python and Typescript based MCP servers, and if you're interested in using it, you should contact us at Tailscale by posting on [Reddit](https://www.reddit.com/r/Tailscale/)" %}



The other side of this of course is that only local clients can implement these proxies. Anthropic supports calling remote MCP servers on its enterprise plans, but it expects them to be on the public internet. I would personally _love_ the idea of being able to connect from your Claude team to your Tailnet (imagine just giving Claude your Tailscale oauth credentials and it provisions a private network for you for your MCP connections!) but I'll need someone from Anthropic to implement that..

I'm also personally a huge fan of this Tailscale application model of permissions and capabilities, but I suspect the first detraction will be "we want these standards to be open, not have Tailscale in the middle of them!" which I totally get.

## The code

Finally, and to close this post down, if you want to try any of this yourself, you can find all the code for the MCP server [here](https://github.com/jaxxstorm/tailscale-mcp) and the MCP proxy[here](https://github.com/jaxxstorm/tailscale-mcp-proxy) - I hope this inspires you to get _something_ important off the public internet!

## Hypocrisy

You'll recall at the beginning of this post, I was lamenting the idea that we're going to let LLMs hoover up all our data, and yet here I am enthusiastically writing MCP servers to make it easier.

I suppose that's the thing about technology - you can either participate in shaping how it develops, or you can stand on the sidelines complaining about how everyone else is doing it wrong. I've chosen to participate, even if it means being part of a system I have mixed feelings about.

The best I can do is try to build the secure version of what's inevitably going to happen anyway. Maybe that makes me a hypocrite, but at least I'm a hypocrite that's thinking about protecting your data from the scary internet, and _only_ the LLM can access it. That makes it better...right?




