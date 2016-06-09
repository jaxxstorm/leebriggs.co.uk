---
layout: post
title: Building a Puppet Based Infrastructure - Part 1 - Making Decisions
category: puppet
---

So you've decided you want to use Configuration Management to control your infrastructure. You've read about all of the benefits of "infrastructure as code" and you've decided you're going to Puppet as your chosen configuration management tool.

I personally believe this to be a good choice. When making comparisons between Ansible, Chef and other configuraiton management tools, the true benefit of Puppet over these is the _ecosystem_ that has been established around it to benefit your workflow. The problem with Puppet is _getting started_. You want to manage a bunch of stuff, but where do you start? How do all these tools fit together? What decisions do you need to make before diving in?

This is a very opinionated set of posts. I'll try to cover the options, and how I've set about doing it, but the main theme here is essentially, getting you off the ground with Puppet.

So if you've finished the [Puppet learning VM](https://puppet.com/download-learning-vm), and you've browsed a few [modules](https://forge.puppetlabs.com/) and think "this is the tool for me!" then open up your desired editor and let's get cracking!

## Decision Time

Okay, now close your editor. We're not going anywhere near it yet, because the first thing you need to do is make a few decisions about your infrastructure and what you'll be managing with Puppet.

There are a lot of components within Puppet that let you manage your infrastructure in a flexible manner, but before you use them you need to know exactly what you want to do with them.

### Your Infrastructure Layout

The first thing to think about is how does your infrastructure look at the high level. There are a few things you need to think about:

  - Do you have multiple geographic datacenters?
  - Do you have multiple deployment environments? (eg. dev, stage, production)
  - Do you have multiple infrastructure types? (eg. AWS and physical infrastructure)

The reason you need to think about these things is because it will determine how you use hiera to differentiate between these environments. There will be a full blog post about hiera later, but before you start using it you need to determine how your environment looks. The question you're looking to answer is _how do you logically seperate your infrastructure?_ Once you have an idea, it's time to think about your individual hosts.

### Node Classification and Roles

The very next thing you need to thing you need to decide is how you're going to classify your nodes. Each node in a puppet infrastrucuture has a _role_ or a "thing that it does". As an example, you might have a database server (with role dbserver) and a web server (webserver). How do you determine that a webserver is a webserver? You might already know it is, but how does your infrastructure know? There are quite a few ways to do this.

  - Name based. You might always have the word "web" in the name, in which you can use a regex match
  - IP address. Maybe all webservers are in a specific subnet, in which case you might want to match on IP

These two options are both valid, and you can support them within Puppet. If you don't currently _have_ a classification system, or you want to improve it, you can use an ENC (External Node Classifier). The most popular ones are:

  - LDAP
  - [Foreman](http://foreman.org/)
  - Something else with a HTTP API

Essentially if you use an ENC, it'll become your source of true for your roles. This is personally the way I think it should be done, and I highly recommend using foreman. More to come later.
