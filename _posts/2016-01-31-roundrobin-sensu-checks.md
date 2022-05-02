---
layout: post
title: Roundrobin Sensu Checks
category: sensu
---

In my last post, I discussed sensu aggregates and server side checks and how to use them in order to monitor clusters or machines.

I now want to change tack a little bit, and discuss how sensu's server side checks can be used to monitor remote services in a distributed fashion. It's often the case that you want to monitor a remote service (AWS VPC availability anyone?) but you don't want to deploy a specific machine in order to do the monitoring. This is how I used to do monitoring like this - I'd deploy a "monpoller" server which I'd assign checks to and then use sensu's [JIT clients](https://sensuapp.org/docs/latest/clients#jit-clients) to create the alert.

Well, it turns out, there's a much better way than this, and it again involves sensu server side checks and something called "roundrobin" subscriptions. Let's get cracking.

## Roundrobin subscriptions

As mentioned before, you can have sensu clients subscribe to certain checks on a server and these subscriptions can be anything you want. I personally have all sensu clients subscribe to a "base" subscription, and then designate subscriptions based on Puppet facter facts. The brilliant [sensu-puppet module](https://github.com/sensu/sensu-puppet) allows us to do this easily, and I use hiera to assign these checks to hosts:

```yaml
sensu::subscriptions:
  - "base"
  - "location_%{::datacenter}"
  - "role_%{::role}"
  - "type_%{::virtual}"
```

I hope these are fairly self explanatory, but in case they aren't, I'm adding subscriptions to each host based on Facter facts that are either present by default, or I've added as custom facts. datacenter and role are custom facts which are company specific, but you can apply subscriptions however you wish.

In addition to these standard subscriptions, I also add a special subscription: roundrobin subscriptions. They look a little bit like this:

```yaml
sensu::subscriptions:
  - "roundrobin:%{::datacenter}"
  - "roundrobin:%{::role}"
```

Once we've assigned these subscriptions, we can use them in a special way with sensu.

## Roundrobin checks
 
A round robin check is a special server side check in sensu which only executes on a single client.The sensu server takes care of all the tricky stuff for you. It essentially will operate in the same manner as a sensu server side check, the server sends a check request out to the clients on the RabbitMQ queues, but the difference here is that it will only send the check request to a single client, and wait for the response back. This gives you some huge benefits:

  - You can monitoring shared resources (NFS shares for example) without having to worry about DDOS'ing yourself
  - The check becomes "highly available" pretty quickly. It's not reliant on a single host like a monpoller host, as the sensu server will pick a client at random with the right subscription
  - When compared with the "source" attribute of a sensu check, you can use the JIT client feature and monitor remote resources easily using the advantages of your whole infrastructure.

### Configuring a roundrobin check
 
Because the roundrobin checks make use of the subscriptions feature, you can only designate them on the server side, and you must have a subscription in place to use them. In Puppet this looks like this:

```puppet
node 'sensu-server.example.com' {
  ::sensu::check { 'check-webserver':
    ensure      => 'present',
    command     => '/etc/sensu/plugins/check-webserver.rb',
    standalone  => false,
    subscribers => [ 'roundrobin:webservers' ],
  }
}
```

That's it! As long as you have a subscription in place for "roundrobin:webservers" - sensu will do all the work for you.

Roundrobin checks are a great addition to your sensu monitoring infrastructure that are grossly underused. I'd highly recommend looking at them and how you can improve your monitoring checks with the server side components as well as the roundrobin checks.


