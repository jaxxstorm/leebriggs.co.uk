---
title: lbrlabs - A Github Org for my Homelab
layout: post
category: blog
tags:
  - kubernetes
  - configuration mgmt
  - homelab
  - kr8
---

_TL;DR: - go [here](https://github.com/lbrlabs)_

I often spend time in my day job wishing I could implement $newtech. I'm lucky enough to be working on projects right now that many people would find exciting, interesting and challenging, however it's often the case that I see something I'd like to try, but deploying it at $dayjob requires me to design for large scale and with security and compliance in mind.

When this happens, I generally try it out in my "homelab". This might mean trying it in a cloud account (I'm particularly fond of [DigitalOcean](https://www.digitalocean.com/) for this) but I also recently reinvested (I moved to another country last year, and had to sell my previous homelab equipment) in a very small homelab consisting of 3 mini PCs and a Dell T30 server, along with some [UniFi](https://www.ui.com/products/#unifi).

My original intention was to blog about the journey, but I realised this might end up being more time consuming than I'd like, so with that in mind I decided that perhaps the best way to contribute knowledge back to the community was via Github.

I've created a new Github Org, [lbrlabs](https://github.com/lbrlabs) to hold all this configuration. Alongside this, I've created [project boards](https://github.com/orgs/lbrlabs/projects) which will detail my journey as I build out the software in my homelab.

Currently, the Org consists of 3 repos:

  - tf-kubernetes-clusters - a repo containing simple terraform code for Kubernetes clusters for a wide variety of cloud providers. The intention here is to make launching a cluster easy and straightforward for testing purposes
  - puppet-homelab - a Puppet control repo containing roles and profiles for my homelab. This could be used as a starting point for anyone wishing to build out a homelab, I'd encourage forking this and tailoring to your needs
  - kr8-cluster-config - a repo containing configuration for [kr8](https://github.com/apptio/kr8) which allows me to quickly and easily install components inside the Kubernetes clusters I build. As an example I have components like [metallb](https://metallb.universe.tf/) which allow me to have Kubernetes LoadBalancers.

Some of the other tooling I've implemented includes:

  - [CoreDNS](https://coredns.io) via a [Puppet module](https://github.com/jaxxstorm/puppet-coredns) which allows me to control my DNS infra
  - [Choria](https://choria.io) so I can quickly run tasks across the whole homelab
  - [external-dns](https://github.com/kubernetes-incubator/external-dns) via a [kr8 component](https://github.com/lbrlabs/kr8-cluster-config/tree/master/components/external_dns) so I can automatically update DNS when deploying webapps on my homelab cluster
  - [cert-manager](https://github.com/jetstack/cert-manager) via a [kr8-component](https://github.com/lbrlabs/kr8-cluster-config/tree/master/components/cert_manager) for automated TLS on my homelab cluster
  - [consul](https://consul.io) via the [Puppet module](https://github.com/solarkennedy/puppet-consul)


In the near future, I plan on implementing other tech like:

  - Vault for secret management
  - Prometheus
  - eyaml encryption in Puppet

My hope is that doing this in the open can help other homelabbers learn about enterprise software, specifically DevOps related projects.

I encourage people to open issues in the repos, asking questions about how to implement things. Hopefully this can be my way to give back to the community.
