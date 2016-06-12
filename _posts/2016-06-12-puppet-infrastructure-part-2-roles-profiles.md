---
layout: post
title: Building a Puppet Based Infrastructure - Part 2 - Roles & Profiles
category: puppet
---

Now that you've made some decisions, you'll need to understand some Puppet fundamentals. One thing that is often suggested is using roles & profiles to layout your modules and manifests.

There are [lots](https://puppet.com/presentations/designing-puppet-rolesprofiles-pattern) [of](https://docs.puppet.com/pe/latest/puppet_assign_configurations.html) [articles](http://garylarizza.com/blog/2014/02/17/puppet-workflow-part-2/) [and](http://www.craigdunn.org/2012/05/239/) [posts](https://rnelson0.com/2014/07/14/intro-to-roles-and-profiles-with-puppet-and-hiera/) on this topic but I'm going to write another one because of one reason - I don't think there's a simple post which shows how to _layout_ your code in a roles and profiles way.

### Roles

Before we start, we need to go back to the previous decision we made around roles. Previously, I defined a role as follows:

> Each node in a puppet infrastrucuture has a role or a “thing that it does”.

I want to take a little further and define it a bit better.

A role in my puppet infrastructure is a very well defined thing. To give you an idea, let's see how I define roles in my [personal puppet repo](https://github.com/jaxxstorm/puppet-homelab)

```bash
$ ls -1
base.pp
db.pp
elasticsearch.pp
etcd.pp
foreman.pp
git.pp
graphite.pp
logs.pp
media.pp
metrics.pp
packages.pp
puppetmaster.pp
sensu.pp
vzhost.pp
web.pp
```

These are all role _names_ within my infrastructure. I've tried to named them so it's obvious what function they perform, like puppetmaster (my puppetmaster!), vzhost (an OpenVZ host) and I've also tried to keep their scope relatively small, with not a lot of overlap.

If you're using large physical or virtual machines, you may choose to go a bit differently and have multiple things in a role. For example, you might have DNS slaves and a DHCP node on the same host. That's not a problem, but give it a reasonable name and make sure its role is well defined.

The most important thing to take away from this is that a node can only have _one_ specific role using this method. It is a puppetmaster, or it is a web server. It gets assigned this role by you using either your ENC or using the `site.pp` manifest based on your naming convention.

You'll also notice I have a role called "base". This role is what I assign to a node when it currently doesn't have a job.

### Profiles

Profiles are a little different to roles. Everyone treats them slightly differently, but I have specific uses for profiles that are well defined. The rules I try to follow are:

 - Profiles can be used across multiple roles. If you expect a component to be reused, you should make a profile
 - Profiles wrap around modules to add or modify functionality. If you module doesn't quite do the thing you need it to, you can wrap a profile around it to make it better
 - Profiles will also collect multiple modules together. For example, you might have a profile which bundles PHP and Apache modules together, as they are used regularly on the same host

Again, here's some of the profiles I use:

```
consul.pp
hardware.pp
mcollective.pp
packages.pp
puppetagent.pp
rabbitmq.pp
redis.pp
system_checks.pp
system_metrics.pp
users.pp
yumrepos.pp
```
