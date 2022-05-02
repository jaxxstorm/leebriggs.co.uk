---
layout: post
title: Infrastructure Service Discovery with Consul
category: consul
---

I had a problem recently. I'm deploying services, and everything is Puppetized, but I have to manually tell other infrastructure that it exists. It's frustrating. As an "ops guy" I focus on making my infrastructure services available, resiliant and distributed so that they can scale well and not fail catastrophically. I think we've all done this when deploying $things, and most people (in my experience) go through the following stages..

### Stage 1 - DNS based discovery

Everyone has used or is using a poor man's load balancer somewhere in their infrastructure. DNS is also basically the most basic of service discovery tools, you enter a DNS name and it provides the address of the service! Great! You can also get really fancy and use SRV records for port discovery as well, but then you realise there's quite a few problems with doing load balancing and service discovery like this:

  * One of the servers in your infrastructure breaks or goes offline.
  * The DNS record (either an A record or SRV record) for broken service still exists
  * Your DNS server, quite rightly, keeps resolving that address for $service because it doesn't know any better
  * Pretty much half of your requests to $service fail (assuming you have two servers for $service)

I know this pain, and I've had to deal with an outage like this. In order to fix this problem, I went with stage 2..


### Stage 2 - An actual load balancer

Once you have your service fail once (and it will..) you think you need a better solution, so you look at an actual load balancer, like HAProxy (or in my case, an F5 Big-IP). This has extra goodness, like service availability healthchecks, and will present a single VIP for the service address. You add your service to the load balancing pool, set up a healthcheck and assign a VIP to it, and it will yank out any service provider that isn't performing as expected (perhaps the TCP port doesn't respond?) - Voila! You're not going to have failures for $service now.

This is really great for us infrastructure guys, and a lot of people stop there. Their service is now reliable, and all you have to do is set up a DNS record for the VIP and point all your clients to it. 

Well, this wasn't good enough for me because everytime I provisioned a new instance of $service, I had to add it to the load balancer pool. Initially we did it manually, and then we got bored and used the API. I was still annoyed though, because I had to keep track of what $service was running where and make sure every instance of it was in the pool. In a land managed by configuration management, this really wasn't much fun at all. I want to provision a VM for $service, and I want it to identify when it's ready and start serving traffic automatically, with no manual intervention required.

The straw that broke the camels back for me was spinning up a new Puppetmaster. We might do this rarely, but it should be an automated job - create a new VM and assign it the Puppetmaster role in Puppet, then use a little script on VM startup to add the puppetmaster to the load balancing pool. It worked, but I wanted more.

 * Notifications when a puppetmaster failed, so I could fix
 * Service availability announcements - when the Puppetmaster was ready, I wanted it to announce its availability to the world and start serving traffic. A script just didn't feel...right.

This is how I got to stage 3 - with service discovery. [Consul](https://www.consul.io/), a service discovery tool written by [hashicorp](https://www.hashicorp.com/) was the key.

### Stage 3 - A different way

Before I get started, I must note that there are many other tools in this space. Things like [SmartStack](http://nerds.airbnb.com/smartstack-service-discovery-cloud/) and [Zookeeper](https://zookeeper.apache.org/) can do things like this for you, but I went with [Consul](https://www.consul.io/) for a few reasons:

 * It uses operationally available tools to practice service discovery, like DNS and Nagios Checks
 * It's written in Go (performance, concurrency, language agnostic)
 * We use hashicorp tools elsewhere, and they have always proved to be very reliable and well designed.

In order for consul to do its thing, you need to understand a few basic concepts about how it works..

 * The best way to implement is to deploy the consul agent to all your service providing infrastructure and clients. The way consul works means that this seems (to me) to be the best implementation.
 * The consul agent will form a cluster using the [raft consensus protocol](http://thesecretlivesofdata.com/raft)
 * There are some agents in your infrastructure that operate in "server mode" - these perform consensus checks and elect a leader. You need to decide how many there are in advance, and I suggest an odd number so they can elect a leader.
 * Consul uses DNS for service discovery. To do that, it provides a DNS resolver on port 8600.
 * The way it decides what to serve on that DNS resolver is by healthchecking services and determining their health status. If the service is healthy, you can query port 8600 on _any_ consul agent (port 8600) and it will provide the list of available servers.
 * The healthcheck can be done in a variety of ways, but a particularly nice way of doing it is by having consil execute nagios scripts. There's also a pure TCP check, a HTTP check and many more

This provides three interesting problems for deployment:

  * How do I get my DNS queries to Consul?
  * How do I deploy Consul?
  * How do I put an infrastructure service in Consul?

Well, I'm going to write about the ways I did this!
 
## Deploying Consul with Puppet

Consul has an excellent [Puppet Module](https://github.com/solarkennedy/puppet-consul) written by [@solarkennedy](https://github.com/solarkennedy) of Yelp which will handle the deploy for you pretty nicely. I found that it wasn't great at _bootstrapping_ the cluster, but once you have your servers up and running it worked pretty flawlessly!

### Deploying the servers

To deploy the servers with Puppet, create a consul server role and include the puppet module:

```puppet
node 'consulserver' {
  class { '::consul':
    config_hash => {
      datacenter       => "home",
      client_addr      => "0.0.0.0", # ensures the server is listening on a public interface
      node_name        => $::fqdn,
      bootstrap_expect => 3, # the number of servers that should be found before attempting to create a consul cluster
      server           => true,
      data_dir         => "/opt/consul",
      ui_dir           => "/opt/consul/ui",
      recusors         => ['8.8.8.8', '192.168.0.1'], # Your upstream DNS servers
    }
  }
}
```

The important params here are:
 * bootstrap_expect: How large should your server cluster be?
 * node_name: Make sure it's unique, $::fqdn fact seems reasonable to me
 * server: true - make sure it's a server

Once you've deployed this to your three consul hosts, and the service is started, you'll see something like this in the logs of each server:

```bash
[WARN] raft: EnableSingleNode disabled, and no known peers. Aborting election.
```

What's happening here is that your cluster is looking for peers, but it can't find them, so let's make a cluster. From _one_ of the servers, perform the following command:

```bash
$ consul join <Node A Address> <Node B Address> <Node C Address>
Successfully joined cluster by contacting 3 nodes.
```

and then, in the logs, you'll see something like this

```bash
[INFO] consul: adding server foo (Addr: 127.0.0.2:8300) (DC: dc1)
[INFO] consul: adding server bar (Addr: 127.0.0.1:8300) (DC: dc1)
[INFO] consul: Attempting bootstrap with nodes: [127.0.0.3:8300 127.0.0.2:8300 127.0.0.1:8300]
...
[INFO] consul: cluster leadership acquired
```

You have now bootstrapped a consul cluster, and you're ready to start adding agents to it from the rest of your infrastructure!

### Deploying the agents

As I said earlier, you'll probably want to deploy the agent to every single host that hosts a service or queries a service. There are other ways to do this, such as not deploying the agent everywhere and changing your DNS servers to resolve to the consul servers, but I chose to do it this way. Your mileage may vary.

Using Puppet, you deploy the agent to every server like so:

```puppet
node 'default' {
  class { '::consul':
    datacenter    => "home",
    client_addr   => "0.0.0.0",
    node_name     => $::fqdn,
    data_dir      => "/opt/consul",
    retry_join    => ["server_a", "server_b", "server_c"],
  }
}
```

The key differences from the servers are:

 * the server param is not defined (it's false by default)
 * retry_join is set: this tells the agent to try and retry these servers and therefore rejoin the cluster when it starts up.

Once you've deployed this, you'll have a consul cluster running with agents attached. You can see the status of the cluster like so:

```bash
[root@host~]# consul members
Node          Address            Status  Type    Build  Protocol  DC
hostD         192.168.4.26:8301  alive   client  0.6.3  2         home
hostA         192.168.4.21:8301  alive   server  0.6.3  2         home
hostB         192.168.4.29:8301  alive   server  0.6.3  2         home
hostC         192.168.4.34:8301  alive   server  0.6.3  2         home
```

## Consul Services

Now we have our cluster deployed, we need to make it aware of services. There's a service already deployed for the consul cluster itself, and you can see how it's deployed and the status of it using a DNS query to the consul agent. 

```bash
dig +short @127.0.0.1 -p 8600 consul.service.home.consul. ANY
192.168.4.34
192.168.4.21
192.168.4.29
```

Here, consul has returned the status of the consul service to let me know it's available from these IP addresses. Consul also supports SRV records, so it can even return the port that it's listening on

```bash
dig +short @127.0.0.1 -p 8600 consul.service.home.consul. SRV
1 1 8300 nodeA.node.home.consul.
1 1 8300 nodeB.node.home.consul.
1 1 8300 nodeC.node.home.consul.
```

The way it determines what nodes are available to provide a service is using _checks_ which I mentioned earlier. These can be either:

  * A script which is executed and returns a nagios compliant code, where 0 is healthy and anything else is an error
  * HTTP check which returns a HTTP response code, where anything with 2XX is healthy
  * TCP check, basically checking if a port is open.

There are 2 more, TTL and Docker + Interval, but for the sake of this post I'm going to refer you to the [documentation](https://www.consul.io/docs/agent/checks.html) for those.

In order for us to get started with a consul service, we need to deploy a check..

## Puppetmaster service

I chose to first deploy a puppetmaster service check, so I'll use that as my example. Again, I used the [puppet module](https://github.com/solarkennedy/puppet-consul) to do this, so in my Puppetmaster role definition, I simple did this:

```puppet
node 'puppetmaster' {
  ::consul::service { 'puppetmaster':
    port => '8140',
    tags => ['puppet'],
  }
}
```

This defines the service that this node provides and on which port. I now need to define the healthcheck for this service - I used a simple TCP check:

```puppet
::consul::check { 'puppetmaster_tcp':
    interval   => '60',
    tcp        => 'localhost:8140',
    notes      => 'Puppetmasters listen on port 8140',
    service_id => 'puppetmaster',
}
```

now, when Puppet converges, I should be able to query my service on the Puppetmaster:

```bash
dig +short @127.0.0.1 -p 8600 puppetmaster.service.home.consul. SRV
1 1 8140 puppetmaster.example.lan.node.home.consul.
```

Excellent, the service exists and it must be healthy, because there's a result for the service. Just to confirm this, lets use consul's [http API](https://www.consul.io/docs/agent/http.html) to query the service status:

```bash
[root@puppetmaster ~]# curl -s http://127.0.0.1:8500/v1/health/service/puppetmaster | jq
[
  {
    "Node": {
      "Node": "puppetmaster.example.lan",
      "Address": "192.168.4.21",
      "CreateIndex": 5,
      "ModifyIndex": 11154
    },
    "Service": {
      "ID": "puppetmaster",
      "Service": "puppetmaster",
      "Tags": [
        "puppet"
      ],
      "Address": "",
      "Port": 8140,
      "EnableTagOverride": false,
      "CreateIndex": 5535,
      "ModifyIndex": 5877
    },
    "Checks": [
      {
        "Node": "puppetmaster.example.lan",
        "CheckID": "puppetmaster_tcp",
        "Name": "puppetmaster_tcp",
        "Status": "passing",
        "Notes": "Puppetmasters listen on port 8140",
        "Output": "TCP connect localhost:8140: Success",
        "ServiceID": "puppetmaster",
        "ServiceName": "puppetmaster",
        "CreateIndex": 5601,
        "ModifyIndex": 5877
      },
      {
        "Node": "puppetmaster.example.lan",
        "CheckID": "serfHealth",
        "Name": "Serf Health Status",
        "Status": "passing",
        "Notes": "",
        "Output": "Agent alive and reachable",
        "ServiceID": "",
        "ServiceName": "",
        "CreateIndex": 5,
        "ModifyIndex": 11150
      }
    ]
  }
]
```

### A failing check

Now, this is great at this point, we have a healthy service with a passing healthcheck - but what happens when something breaks. Let's say a Puppetmaster service is stopped - what exactly happens?

Well, let's stop our Puppetmaster and see.

```bash
[root@puppetmaster ~]# service httpd stop
Redirecting to /bin/systemctl stop  httpd.service # I use passenger to serve puppetmasters, so we'll stop http
```

Now, let's do our DNS query again

```bash
[root@puppetmaster ~]# dig +short @127.0.0.1 -p 8600 puppetmaster.service.home.consul. SRV
[root@puppetmaster ~]#
```

I'm not getting _any_ dns results from consul. This is basically because I've only deployed one Puppetmaster, and I just stopped it from running, but in a multi-node setup, it would return only the healthy nodes. I can confirm this from the consul API again:

```bash
[root@puppetmaster ~]# curl -s http://127.0.0.1:8500/v1/health/service/puppetmaster | jq
[
  {
    "Node": {
      "Node": "puppetmaster.example.lan",
      "Address": "192.168.4.21",
      "CreateIndex": 5,
      "ModifyIndex": 97009
    },
    "Service": {
      "ID": "puppetmaster",
      "Service": "puppetmaster",
      "Tags": [
        "puppet"
      ],
      "Address": "",
      "Port": 8140,
      "EnableTagOverride": false,
      "CreateIndex": 5535,
      "ModifyIndex": 97009
    },
    "Checks": [
      {
        "Node": "puppetmaster.example.lan",
        "CheckID": "puppetmaster_tcp",
        "Name": "puppetmaster_tcp",
        "Status": "critical",
        "Notes": "Puppetmasters listen on port 8140",
        "Output": "dial tcp [::1]:8140: getsockopt: connection refused",
        "ServiceID": "puppetmaster",
        "ServiceName": "puppetmaster",
        "CreateIndex": 5601,
        "ModifyIndex": 97009
      },
      {
        "Node": "puppetmaster.example.lan",
        "CheckID": "serfHealth",
        "Name": "Serf Health Status",
        "Status": "passing",
        "Notes": "",
        "Output": "Agent alive and reachable",
        "ServiceID": "",
        "ServiceName": "",
        "CreateIndex": 5,
        "ModifyIndex": 11150
      }
    ]
  }
]
```

Note here how the service is returning critical, so consul has removed it from the DNS query! Easy!

Now if I start it back up, it will of course start serving traffic again and become available in the DNS query:

```bash
[root@puppetmaster ~]# service httpd start
Redirecting to /bin/systemctl start  httpd.service
[root@puppetmaster ~]# dig +short @127.0.0.1 -p 8600 puppetmaster.service.home.consul. SRV
1 1 8140 puppetmaster.example.lan.node.home.consul.
```

### DNS resolution

The final piece of this puzzle is to make sure regular DNS traffic can perform these queries. Because consul serves DNS on a non-standard port, we need to figure out how standard DNS queries from applications that expect DNS to always be on port 53 can get in on the action. There are a couple of ways of doing this:

  * Have your DNS servers forward queries for the .consul domain to their local agent
  * Install a stub resolver or caching resolver on each host which does support port config, like dnsmasq.

In my homelab, I went for option 2, but I would imagine in lots of production environments this wouldn't really be an options, so forwarding with bind would be a better idea. Your mileage may vary.

#### Configuring DNSmasq

Assuming dnsmasq is installed, you just need a config option in /etc/dnsmasq.d/10-consul like so:

```bash
server=/consul/127.0.0.1#8600
```

Now, set your resolv.conf to look at localhost first:

```bash
nameserver 127.0.0.1
```

And now you can make DNS queries without the port for consul services!

### Puppetmaster Service Deployment

For the final step, you need to do a final thing for your Puppermasters. Because the puppetmaster is now being served on the address puppetmaster.service.home.consul, you'll need to tweak your puppet config slightly to get things working. First, updated the cert names allowed adding the following to your master's /etc/puppet/puppet.conf:

```bash
dns_alt_names=puppetmaster.service.home.consul
```

Then, clean our the master's _client_ key (not the CA!) and regenerate a new cert:

```bash
rm -rf /var/lib/puppet/ssl/private_keys/puppetmaster.example.lan.pem
puppet cert clean puppetmaster.example.lan
service httpd stop
puppet master --no-daemonize
```

At this point, we should be able to run puppet against this new DNS name:

```bash
root@puppetmaster ~]# puppet agent -t --server=puppetmaster.service.home.consul
Info: Retrieving pluginfacts
Info: Retrieving plugin
Info: Loading facts
....
```

Now, we just need to change the master setting in our puppet.conf, which you can do with Puppet itself of course!

Congratulations, you've deployed a service with infrastructure service discovery!

## Wrapping up

What we've deployed here only used a single node, but the real benefits should be obvious.

  * When we deploy ANY new puppetmaster now, it will use our role definition, and automatically add the service and the healthcheck
  * Using whatever deployment automation we use, we should be able to deploy a new service immediately and it will automatically start serving traffic for our infrastructure - no additional config necessary

This article only covers a few of the possibilites with consul. I didn't cover the [key/value store](https://www.consul.io/intro/getting-started/kv.html) or adding services dynamically [using the API](https://www.consul.io/intro/getting-started/services.html). Consul also has first class support for distributed datacenters which wasn't covered here, which means you can even distribute your services across DC's and over the WAN.
